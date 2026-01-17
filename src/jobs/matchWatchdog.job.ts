/**
 * Match Watchdog Worker
 * 
 * Background job to detect and recover stale live matches.
 * Runs every 30 seconds, identifies stale matches, and triggers reconcile.
 * 
 * CRITICAL: Watchdog does NOT update updated_at directly.
 * It only triggers reconcile; reconcile may update updated_at.
 */

import { MatchWatchdogService } from '../services/thesports/match/matchWatchdog.service';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { MatchRecentService } from '../services/thesports/match/matchRecent.service';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { halfStatsPersistenceService } from '../services/thesports/match/halfStatsPersistence.service';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';
import { CircuitOpenError } from '../utils/circuitBreaker';
import { invalidateLiveMatchesCache } from '../utils/matchCache';
import { broadcastEvent } from '../routes/websocket.routes';

// REFACTOR: Direct database writes (orchestrator removed)
interface FieldUpdate {
  field: string;
  value: any;
  source: string;
  priority: number;
  timestamp: number;
}

export class MatchWatchdogWorker {
  private matchWatchdogService: MatchWatchdogService;
  private matchDetailLiveService: MatchDetailLiveService;
  private matchRecentService: MatchRecentService;
  private matchDiaryService: MatchDiaryService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(matchDetailLiveService: MatchDetailLiveService, matchRecentService: MatchRecentService) {
    this.matchWatchdogService = new MatchWatchdogService();
    this.matchDetailLiveService = matchDetailLiveService;
    this.matchRecentService = matchRecentService;
    this.matchDiaryService = new MatchDiaryService();
  }

  /**
   * REFACTOR: Direct database write helper (replaces orchestrator.updateMatch)
   * Builds dynamic UPDATE query from field updates
   */
  private async updateMatchDirect(matchId: string, updates: FieldUpdate[], source: string): Promise<{ status: string; fieldsUpdated: string[] }> {
    if (updates.length === 0) {
      return { status: 'success', fieldsUpdated: [] };
    }

    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      const fieldsUpdated: string[] = [];

      for (const update of updates) {
        setClauses.push(`${update.field} = $${paramIndex}`);
        values.push(update.value);
        fieldsUpdated.push(update.field);
        paramIndex++;

        // Map field names to correct source column names
        const sourceColumnMap: Record<string, string> = {
          'home_score_display': 'home_score_source',
          'away_score_display': 'away_score_source',
          'status_id': 'status_id_source',
          'minute': 'minute_source',
        };

        const sourceColumn = sourceColumnMap[update.field];
        if (sourceColumn) {
          setClauses.push(`${sourceColumn} = $${paramIndex}`);
          values.push(update.source);
          paramIndex++;
          setClauses.push(`${sourceColumn.replace('_source', '_timestamp')} = $${paramIndex}`);
          values.push(update.timestamp);
          paramIndex++;
        }
      }

      // Always update updated_at
      setClauses.push(`updated_at = NOW()`);

      const query = `
        UPDATE ts_matches
        SET ${setClauses.join(', ')}
        WHERE external_id = $${paramIndex}
      `;
      values.push(matchId);

      await pool.query(query, values);

      // CRITICAL FIX: Broadcast WebSocket events after database write
      // This ensures frontend receives real-time updates even when data comes from Watchdog
      const hasScoreUpdate = fieldsUpdated.some(f => f === 'home_score_display' || f === 'away_score_display');
      const hasStatusUpdate = fieldsUpdated.some(f => f === 'status_id');
      const hasMinuteUpdate = fieldsUpdated.some(f => f === 'minute');

      try {
        if (hasScoreUpdate || hasStatusUpdate) {
          const homeScoreUpdate = updates.find(u => u.field === 'home_score_display');
          const awayScoreUpdate = updates.find(u => u.field === 'away_score_display');
          const statusUpdate = updates.find(u => u.field === 'status_id');

          if (hasScoreUpdate) {
            broadcastEvent({
              type: 'SCORE_CHANGE',
              matchId,
              homeScore: homeScoreUpdate?.value,
              awayScore: awayScoreUpdate?.value,
              statusId: statusUpdate?.value,
              timestamp: Date.now(),
            } as any);
          }

          if (hasStatusUpdate) {
            broadcastEvent({
              type: 'MATCH_STATE_CHANGE',
              matchId,
              statusId: statusUpdate?.value,
              newStatus: statusUpdate?.value,
              timestamp: Date.now(),
            } as any);
          }
        }

        if (hasMinuteUpdate) {
          const minuteUpdate = updates.find(u => u.field === 'minute');
          const statusUpdate = updates.find(u => u.field === 'status_id');

          broadcastEvent({
            type: 'MINUTE_UPDATE',
            matchId,
            minute: minuteUpdate?.value,
            statusId: statusUpdate?.value || 2,
            timestamp: Date.now(),
          } as any);
        }
      } catch (broadcastError: any) {
        logger.warn(`[Watchdog.directWrite] Failed to broadcast event for ${matchId}: ${broadcastError.message}`);
      }

      return { status: 'success', fieldsUpdated };
    } catch (error: any) {
      logger.error(`[Watchdog.directWrite] Failed to update ${matchId}:`, error);
      return { status: 'error', fieldsUpdated: [] };
    }
  }

  /**
   * PHASE C: Reconcile match via LiveMatchOrchestrator
   *
   * Fetches match detail_live from API and sends updates to orchestrator
   * for centralized write coordination.
   */
  private async reconcileViaOrchestrator(matchId: string): Promise<{ statusId?: number }> {
    try {
      // Step 1: Fetch match detail_live from API
      const resp = await this.matchDetailLiveService.getMatchDetailLive(
        { match_id: matchId },
        { forceRefresh: true }
      );

      // Step 2: Extract fields from response
      const results = (resp as any).results || (resp as any).result_list;

      let matchData;

      // Check if match exists in live results
      if (results && Array.isArray(results)) {
        matchData = results.find((m: any) => String(m?.id || m?.match_id) === String(matchId));
      }

      // FALLBACK: If match not found in live results, check /match/detail (for finished matches)
      if (!matchData) {
        logger.info(`[Watchdog.orchestrator] Match ${matchId} not in detail_live, checking /match/detail fallback...`);
        try {
          // CRITICAL FIX: Wrap fallback in try-catch to handle "Unauthorized" errors gracefully
          const detailResp = await this.matchDetailLiveService.getMatchDetail(matchId);

          // Check if detail response has valid data
          // detail endpoint usually returns the match object directly or wrapper
          const detailMatch = detailResp?.results || detailResp;

          if (detailMatch && (String(detailMatch.id) === String(matchId) || String(detailMatch.match_id) === String(matchId))) {
            matchData = detailMatch;
            logger.info(`[Watchdog.orchestrator] Found match ${matchId} in /match/detail fallback. Status: ${matchData.status_id}`);
          }
        } catch (fallbackError: any) {
          // Suppress "Unauthorized" or simple 403 errors to avoid noise
          logger.warn(`[Watchdog.orchestrator] Fallback /match/detail failed for ${matchId}: ${fallbackError.message}`);
        }
      }

      if (!matchData) {
        logger.warn(`[Watchdog.orchestrator] Match ${matchId} not found in detail_live OR detail fallback`);
        return {};
      }

      // Step 3: Parse fields
      const updates: FieldUpdate[] = [];
      const now = Math.floor(Date.now() / 1000);

      // Helper to determine status ID safely
      let statusId = matchData.status_id;
      if (Array.isArray(matchData.score) && matchData.score.length >= 2) {
        statusId = matchData.score[1];
      }

      // Parse score array: [home_score, status_id, [home_display, ...], [away_display, ...]]
      if (Array.isArray(matchData.score) && matchData.score.length >= 4) {
        const homeScoreDisplay = Array.isArray(matchData.score[2]) ? matchData.score[2][0] : null;
        const awayScoreDisplay = Array.isArray(matchData.score[3]) ? matchData.score[3][0] : null;

        if (homeScoreDisplay !== null) {
          updates.push({
            field: 'home_score_display',
            value: homeScoreDisplay,
            source: 'api',
            priority: 2,
            timestamp: matchData.update_time || now,
          });
        }

        if (awayScoreDisplay !== null) {
          updates.push({
            field: 'away_score_display',
            value: awayScoreDisplay,
            source: 'api',
            priority: 2,
            timestamp: matchData.update_time || now,
          });
        }
      } else {
        // Try standard fields if score array not present (e.g. /match/detail format)
        if (matchData.home_score !== undefined) {
          updates.push({ field: 'home_score_display', value: matchData.home_score, source: 'api', priority: 2, timestamp: matchData.update_time || now });
        }
        if (matchData.away_score !== undefined) {
          updates.push({ field: 'away_score_display', value: matchData.away_score, source: 'api', priority: 2, timestamp: matchData.update_time || now });
        }
      }

      if (statusId !== null && statusId !== undefined) {
        updates.push({
          field: 'status_id',
          value: statusId,
          source: 'api',
          priority: 2,
          timestamp: matchData.update_time || now,
        });
      }

      // Minute (if available)
      if (matchData.minute !== null && matchData.minute !== undefined) {
        updates.push({
          field: 'minute',
          value: matchData.minute,
          source: 'api',
          priority: 2,
          timestamp: matchData.update_time || now,
        });
      }

      // Provider timestamps
      if (matchData.update_time) {
        updates.push({
          field: 'provider_update_time',
          value: matchData.update_time,
          source: 'api',
          priority: 2,
          timestamp: matchData.update_time,
        });
      }

      if (matchData.event_time) {
        updates.push({
          field: 'last_event_ts',
          value: matchData.event_time,
          source: 'api',
          priority: 2,
          timestamp: matchData.update_time || now,
        });
      }

      // Second half kickoff (write-once)
      if (matchData.second_half_kickoff_ts) {
        updates.push({
          field: 'second_half_kickoff_ts',
          value: matchData.second_half_kickoff_ts,
          source: 'api',
          priority: 2,
          timestamp: matchData.update_time || now,
        });
      }

      // Step 4: Send to orchestrator
      if (updates.length > 0) {
        const result = await this.updateMatchDirect(matchId, updates, 'watchdog');

        if (result.status === 'success') {
          logEvent('info', 'watchdog.orchestrator.success', {
            matchId,
            fieldsUpdated: result.fieldsUpdated,
          });
        }

        // Extract status_id for caller
        const statusIdUpdate = updates.find(u => u.field === 'status_id');
        return { statusId: statusIdUpdate?.value };
      }

      return {};
    } catch (error: any) {
      logger.error(`[Watchdog.orchestrator] Error for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * PHASE 4-2: Global Live Sweep
   * Serves as the ultimate safety net for match visibility.
   * Blindly fetches ALL currently live matches from the API and ensures 
   * they exist and are updated in our DB, regardless of schedule or past status.
   */
  private async runGlobalSweep(): Promise<void> {
    try {
      // API call to get EVERYTHING that is currently live
      const liveMatches = await this.matchDetailLiveService.getAllLiveStats();
      if (!liveMatches || liveMatches.length === 0) return;

      const count = liveMatches.length;
      // Log occasionally to avoid spam, or log if high count
      if (count > 0) {
        logger.debug(`[Watchdog] Global Sweep: Processing ${count} active live matches.`);
      }

      // Process in chunks to prevent blocking the event loop
      // This is critical for performance when feed is large (e.g. 100+ matches)
      const chunk = 15;
      for (let i = 0; i < count; i += chunk) {
        const batch = liveMatches.slice(i, i + chunk);
        await Promise.all(batch.map(async (m) => {
          const matchId = m.id || m.match_id;
          if (!matchId) return;

          try {
            // Reconcile logic now handles:
            // 1. Auto-insert if missing
            // 2. Status update if changed
            // 3. Timestamp override
            await this.matchDetailLiveService.reconcileMatchToDatabase(matchId);
          } catch (err: any) {
            // Log warning but continue sweep
            logger.warn(`[Watchdog] Global Sweep failed for ${matchId}: ${err.message}`);
          }
        }));

        // Tiny yield to let other events process
        if (i + chunk < count) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
    } catch (error: any) {
      logger.error('[Watchdog] Global Sweep Fatal Error:', error);
    }
  }

  /**
   * Process stale matches and trigger reconcile
   */
  async tick(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Watchdog] Tick already running, skipping this run');
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();
    logger.info('[Watchdog] ========== TICK START ==========');

    try {
      const nowTs = Math.floor(Date.now() / 1000);
      logger.info(`[Watchdog] Current timestamp: ${nowTs}`);

      // CRITICAL FIX (2026-01-13): PROACTIVE KICKOFF DETECTION
      // Instead of waiting for TheSports API/MQTT to tell us match started,
      // we proactively transition status=1 → status=2 when match_time passes.
      // This runs FIRST, before any other processing, for fastest possible kickoff detection.
      // CRITICAL FIX (2026-01-15): Expanded window from 120s to 300s (5 min) to catch delayed kickoffs
      try {
        const immediateKickoffs = await this.matchWatchdogService.findImmediateKickoffs(nowTs, 300, 100);

        if (immediateKickoffs.length > 0) {
          logger.info(`[Watchdog] ⚡ Proactive Kickoff: Found ${immediateKickoffs.length} matches that just started`);

          for (const kickoff of immediateKickoffs) {
            try {
              // Calculate minute based on time since match_time
              const calculatedMinute = Math.max(1, Math.floor(kickoff.secondsSinceKickoff / 60));

              // Force status=2 (FIRST_HALF) via orchestrator
              const result = await this.updateMatchDirect(
                kickoff.matchId,
                [
                  { field: 'status_id', value: 2, source: 'computed', priority: 2, timestamp: nowTs },
                  { field: 'minute', value: calculatedMinute, source: 'computed', priority: 1, timestamp: nowTs },
                ],
                'proactive-kickoff'
              );

              if (result.status === 'success') {
                logger.info(`[Watchdog] ⚡ KICKOFF: ${kickoff.matchId} → status=2 (FIRST_HALF), minute=${calculatedMinute}`);

                logEvent('info', 'watchdog.proactive_kickoff', {
                  match_id: kickoff.matchId,
                  seconds_since_kickoff: kickoff.secondsSinceKickoff,
                  calculated_minute: calculatedMinute,
                  result: 'success',
                });
              }
            } catch (kickoffErr: any) {
              logger.warn(`[Watchdog] Proactive kickoff failed for ${kickoff.matchId}: ${kickoffErr.message}`);
            }
          }

          // CRITICAL FIX (2026-01-16): Invalidate live matches cache after kickoff
          // New live matches should appear immediately in /api/matches/live
          if (immediateKickoffs.length > 0) {
            invalidateLiveMatchesCache();
            logger.info(`[Watchdog] Cache invalidated after ${immediateKickoffs.length} kickoffs`);
          }
        }
      } catch (kickoffError: any) {
        logger.error('[Watchdog] Proactive Kickoff Detection failed:', kickoffError);
        // Continue with normal processing even if kickoff detection fails
      }

      // CRITICAL FIX (2026-01-13): PROACTIVE MATCH FINISH DETECTION
      // Just like proactive kickoff detection, we proactively transition live matches to FINISHED
      // when match_time + 130 minutes has passed OR minute >= 90 with no update in 15 minutes.
      // This fixes matches stuck in CANLI (e.g., Indonesia WC at 90+10' forever).
      try {
        logger.info('[Watchdog] 🏁 Checking for overdue finishes...');
        const overdueFinishes = await this.matchWatchdogService.findOverdueFinishes(nowTs, 100);
        logger.info(`[Watchdog] 🏁 findOverdueFinishes returned: ${overdueFinishes.length} matches`);

        if (overdueFinishes.length > 0) {
          logger.info(`[Watchdog] 🏁 Proactive Finish: Found ${overdueFinishes.length} matches that should have ended`);
          overdueFinishes.forEach(f => {
            logger.info(`[Watchdog]   - ${f.matchId}: minute=${f.minute}, status=${f.statusId}, reason=${f.reason}, score=${f.homeScore}-${f.awayScore}`);
          });

          for (const finish of overdueFinishes) {
            try {
              logger.info(`[Watchdog] 🏁 Processing finish for ${finish.matchId} (${finish.reason})...`);

              // Force status=8 (FINISHED) via orchestrator with actual scores
              const result = await this.updateMatchDirect(
                finish.matchId,
                [
                  { field: 'status_id', value: 8, source: 'computed', priority: 10, timestamp: nowTs },
                  { field: 'minute', value: 90, source: 'computed', priority: 10, timestamp: nowTs },
                ],
                'proactive-finish'
              );

              logger.info(`[Watchdog] 🏁 updateMatchDirect result for ${finish.matchId}: ${result.status}, fields: ${result.fieldsUpdated.join(',')}`);

              if (result.status === 'success') {
                logger.info(`[Watchdog] 🏁 FINISHED: ${finish.matchId} → status=8 (was ${finish.statusId} @ ${finish.minute}') [${finish.reason}] Score: ${finish.homeScore}-${finish.awayScore}`);

                logEvent('info', 'watchdog.proactive_finish', {
                  match_id: finish.matchId,
                  previous_status: finish.statusId,
                  previous_minute: finish.minute,
                  seconds_since_kickoff: finish.secondsSinceKickoff,
                  seconds_since_update: finish.secondsSinceUpdate,
                  reason: finish.reason,
                  home_score: finish.homeScore,
                  away_score: finish.awayScore,
                  result: 'success',
                });
              }
            } catch (finishErr: any) {
              logger.error(`[Watchdog] 🏁 Proactive finish FAILED for ${finish.matchId}: ${finishErr.message}`, finishErr);
            }
          }

          // CRITICAL FIX (2026-01-16): Invalidate live matches cache after finishing matches
          // Without this, finished matches stay in /api/matches/live cache for 30s showing wrong status
          if (overdueFinishes.length > 0) {
            invalidateLiveMatchesCache();
            logger.info(`[Watchdog] Cache invalidated after finishing ${overdueFinishes.length} matches`);
          }
        } else {
          logger.info('[Watchdog] 🏁 No overdue finishes found (all matches within normal time)');
        }
      } catch (finishError: any) {
        logger.error('[Watchdog] 🏁 Proactive Finish Detection EXCEPTION:', finishError);
        logger.error('[Watchdog] 🏁 Stack trace:', finishError.stack);
        // Continue with normal processing even if finish detection fails
      }

      // CRITICAL: Execute Global Live Sweep
      // This ensures matches that "Start Late" or have "Wrong Schedule" are picked up INSTANTLY.
      await this.runGlobalSweep();


      // CRITICAL FIX (2026-01-11): Use /match/diary instead of /match/recent/list
      // /match/recent/list only returns recently CHANGED matches (500 limit)
      // This caused orphan matches: if a match finished but wasn't in the 500-limit window,
      // it would stay "live" in DB forever
      // /match/diary returns ALL today's matches with CURRENT status - this is the correct source
      let recentListAllMatches: Map<string, { statusId: number; updateTime: number | null }> = new Map();
      try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        // Fetch ALL today's matches from /match/diary
        const diaryResponse = await this.matchDiaryService.getMatchDiary({ date: today });
        const diaryMatches = diaryResponse?.results ?? [];

        // Build map of ALL matches from diary (not just changed ones)
        for (const match of diaryMatches) {
          const status = (match as any).status_id ?? (match as any).status ?? 0;
          const matchId = (match as any).id ?? (match as any).match_id ?? (match as any).external_id;
          if (matchId) {
            const updateTime = (match as any).update_time ?? (match as any).updateTime ?? null;
            recentListAllMatches.set(matchId, { statusId: status, updateTime });
          }
        }

        const liveCount = Array.from(recentListAllMatches.values()).filter(m => [2, 3, 4, 5, 7].includes(m.statusId)).length;
        const endCount = Array.from(recentListAllMatches.values()).filter(m => [8, 9, 10, 12].includes(m.statusId)).length;
        // Always log (even if empty) for observability
        logger.info(`[Watchdog] Fetched /match/diary: ${recentListAllMatches.size} total matches (${liveCount} live, ${endCount} finished)`);
      } catch (error: any) {
        logger.error('[Watchdog] Error fetching /match/diary:', error);
        // Continue processing, but reconciliation will fall back to detail_live only
      }

      // CRITICAL FIX: Re-enable stale match detection for HALF_TIME matches stuck in status 3
      // /data/update handles live match updates but doesn't handle HALF_TIME -> END transitions
      // We need to find stale matches (especially HALF_TIME) that should be END
      // UPDATED: Reduced HALF_TIME threshold from 900s (15 min) to 300s (5 min) for faster recovery
      const stales = await this.matchWatchdogService.findStaleLiveMatches(nowTs, 120, 300, 100);

      // CRITICAL FIX: Also find matches that should be live (match_time passed but status still NOT_STARTED)
      // This ensures matches transition from NOT_STARTED to LIVE when they actually start
      // maxMinutesAgo = 1440 (24 saat) to catch ALL today's matches, even if they started many hours ago
      // Previous limit of 120 minutes was too restrictive and missed matches that started 3+ hours ago
      // CRITICAL: Increase limit to 2000 to process more matches per tick (was 1000)
      const shouldBeLive = await this.matchWatchdogService.findShouldBeLiveMatches(nowTs, 1440, 2000);

      // CRITICAL FIX: Find matches that exceeded maximum duration (minute > 105 for 2nd half, > 130 for overtime)
      // These matches should have ended but status is still LIVE - need immediate reconciliation
      const overdueMatches = await this.matchWatchdogService.findOverdueMatches(50);
      if (overdueMatches.length > 0) {
        logger.warn(`[Watchdog] Found ${overdueMatches.length} OVERDUE matches (minute exceeded max):`);
        overdueMatches.forEach(m => logger.warn(`  - ${m.matchId}: ${m.reason}`));
      }

      const candidatesCount = stales.length + shouldBeLive.length + overdueMatches.length;

      if (candidatesCount === 0) {
        // Phase 5-S: Emit summary even when no candidates (for observability)
        logEvent('info', 'watchdog.tick.summary', {
          candidates_count: 0,
          attempted_count: 0,
          success_count: 0,
          fail_count: 0,
          skipped_count: 0,
          stale_count: 0,
          should_be_live_count: 0,
          reasons: {},
        });
        return;
      }

      // Phase 5-S: Track reconcile attempts with detailed breakdown
      let attemptedCount = 0;
      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;
      const reasons: Record<string, number> = {};

      // Process each stale match
      for (const stale of stales) {
        logEvent('info', 'watchdog.stale_detected', {
          match_id: stale.matchId,
          status_id: stale.statusId,
          reason: stale.reason,
          last_event_ts: stale.lastEventTs,
          provider_update_time: stale.providerUpdateTime,
        });

        const reconcileStartTime = Date.now();
        attemptedCount++;

        try {
          // Phase 5-S FIX: Check recent/list first - if match is finished (status=8) or not in list, transition to END
          const recentListMatch = recentListAllMatches.get(stale.matchId);

          // CRITICAL FIX HATA #3: HALF_TIME (status 3) için özel kontrol
          // Devre arasından ikinci yarıya geçiş sırasında recent/list'te olmayabilir
          if (stale.statusId === 3 && !recentListMatch) {
            logger.info(
              `[Watchdog] HALF_TIME match ${stale.matchId} not in recent/list, ` +
              `checking detail_live for SECOND_HALF transition before END`
            );

            const { pool } = await import('../database/connection');
            const client = await pool.connect();
            try {
              // PHASE C: Use orchestrator - check detail_live for SECOND_HALF transition
              const reconcileResult = await this.reconcileViaOrchestrator(stale.matchId);

              if (reconcileResult.statusId !== undefined) {
                // detail_live başarılı → status güncellendi (muhtemelen SECOND_HALF)
                if (reconcileResult.statusId === 4) {
                  logger.info(
                    `[Watchdog] HALF_TIME match ${stale.matchId} transitioned to SECOND_HALF via detail_live`
                  );
                  successCount++;
                  reasons['half_time_to_second_half'] = (reasons['half_time_to_second_half'] || 0) + 1;

                  logEvent('info', 'watchdog.reconcile.done', {
                    match_id: stale.matchId,
                    result: 'success',
                    reason: 'half_time_to_second_half',
                    duration_ms: Date.now() - reconcileStartTime,
                    new_status_id: 4,
                  });
                  continue; // Success - skip further processing
                } else {
                  logger.info(
                    `[Watchdog] HALF_TIME match ${stale.matchId} updated via detail_live to status ${reconcileResult.statusId}`
                  );
                  successCount++;
                  reasons['half_time_updated'] = (reasons['half_time_updated'] || 0) + 1;
                  continue; // Success - skip further processing
                }
              }

              // detail_live başarısız → match_time kontrolü yap
              const matchInfo = await client.query(
                `SELECT match_time, first_half_kickoff_ts FROM ts_matches WHERE external_id = $1`,
                [stale.matchId]
              );

              if (matchInfo.rows.length > 0) {
                const match = matchInfo.rows[0];
                const toSafeNum = (val: any) => {
                  if (val === null || val === undefined || val === '') return null;
                  const num = Number(val);
                  return isNaN(num) ? null : num;
                };

                const nowTs = Math.floor(Date.now() / 1000);
                const matchTime = toSafeNum(match.match_time);
                const firstHalfKickoff = toSafeNum(match.first_half_kickoff_ts);

                // CRITICAL FIX (2026-01-09): Reduced HALF_TIME threshold from 120 to 60 minutes
                // Reason: HALF_TIME match without recent/list or detail_live data is anomaly
                // 60 minutes is sufficient to determine match should have finished
                // Normal match: 45 (first half) + 15 (HT) = 60 minutes minimum
                // Previously 120 minutes was too conservative, causing 10+ matches to stay stuck in HALF_TIME
                const minTimeForEnd = (firstHalfKickoff || matchTime || 0) + (60 * 60); // 60 minutes (was 120)

                if (nowTs < minTimeForEnd) {
                  logger.warn(
                    `[Watchdog] HALF_TIME match ${stale.matchId} not in recent/list but match started ` +
                    `${Math.floor((nowTs - (matchTime ?? nowTs)) / 60)} minutes ago (<60 min). ` +
                    `Skipping END transition. Will retry later.`
                  );
                  skippedCount++;
                  reasons['half_time_too_recent'] = (reasons['half_time_too_recent'] || 0) + 1;
                  continue; // Don't transition to END, retry later
                } else {
                  // Match time is old enough, safe to transition to END
                  logger.info(
                    `[Watchdog] HALF_TIME match ${stale.matchId} not in recent/list and match started ` +
                    `${Math.floor((nowTs - (matchTime ?? nowTs)) / 60)} minutes ago (>60 min). Transitioning to END.`
                  );

                  // PHASE C: Use orchestrator for centralized write coordination
                  const orchestratorResult = await this.updateMatchDirect(
                    stale.matchId,
                    [
                      { field: 'status_id', value: 8, source: 'watchdog', priority: 1, timestamp: nowTs },
                      { field: 'last_event_ts', value: nowTs, source: 'watchdog', priority: 1, timestamp: nowTs },
                    ],
                    'watchdog'
                  );

                  if (orchestratorResult.status === 'success') {
                    successCount++;
                    reasons['half_time_finished_safe'] = (reasons['half_time_finished_safe'] || 0) + 1;

                    logEvent('info', 'watchdog.reconcile.done', {
                      match_id: stale.matchId,
                      result: 'success',
                      reason: 'half_time_finished_safe',
                      duration_ms: Date.now() - reconcileStartTime,
                      fields_updated: orchestratorResult.fieldsUpdated,
                      new_status_id: 8,
                      match_time: matchTime,
                      elapsed_minutes: Math.floor((nowTs - (matchTime ?? nowTs)) / 60),
                    });

                    // CRITICAL FIX: Trigger post-match persistence when HALF_TIME match transitions to END
                    logger.info(`[Watchdog] HALF_TIME match ${stale.matchId} transitioned to END (8), triggering post-match persistence + half stats save...`);
                    try {
                      const { PostMatchProcessor } = await import('../services/liveData/postMatchProcessor');
                      const { theSportsAPI } = await import('../core');
                      // SINGLETON: Use shared API client with global rate limiting
                      const processor = new PostMatchProcessor();
                      await processor.onMatchEnded(stale.matchId);
                      logger.info(`[Watchdog] ✅ Post-match persistence completed for ${stale.matchId}`);
                    } catch (postMatchErr: any) {
                      logger.warn(`[Watchdog] Failed to trigger post-match persistence for ${stale.matchId}:`, postMatchErr.message);
                    }

                    // HALF STATS PERSISTENCE: Save second half data when match transitions to END
                    halfStatsPersistenceService.saveSecondHalfData(stale.matchId)
                      .then(res => {
                        if (res.success) logger.info(`[Watchdog] Half stats saved for ${stale.matchId}: ${res.statsCount} stats, ${res.incidentsCount} incidents`);
                      })
                      .catch(err => logger.warn(`[Watchdog] Failed to save half stats for ${stale.matchId}:`, err.message));

                    continue; // Skip further processing
                  }
                }
              }
            } catch (detailLiveError: any) {
              logger.warn(
                `[Watchdog] detail_live failed for HALF_TIME match ${stale.matchId}: ${detailLiveError.message}`
              );
              // Fall through to normal processing
            } finally {
              client.release();
            }
          }

          // Normal stale match processing (status 2, 4, 5, 7) - HATA #1 fix will be applied here
          if (!recentListMatch) {
            // Match not in recent/list - check match_time before transitioning to END
            const { pool } = await import('../database/connection');
            const client = await pool.connect();
            try {
              const matchInfo = await client.query(
                `SELECT match_time, first_half_kickoff_ts, second_half_kickoff_ts, status_id 
                 FROM ts_matches WHERE external_id = $1`,
                [stale.matchId]
              );

              if (matchInfo.rows.length === 0) {
                continue; // Match not found, skip
              }

              const match = matchInfo.rows[0];
              const nowTs = Math.floor(Date.now() / 1000);

              const toSafeNum = (val: any) => {
                if (val === null || val === undefined || val === '') return null;
                const num = Number(val);
                return isNaN(num) ? null : num;
              };

              const matchTime = toSafeNum(match.match_time);

              // Calculate minimum time for match to be finished
              // Standard match: 90 minutes + 15 min HT = 105 minutes minimum
              // With overtime: up to 120 minutes
              // CRITICAL FIX: Reduced safety margin from 150 to 120 minutes (2 hours) for faster match ending
              // This ensures matches end faster when they should be finished
              const minTimeForEnd = (matchTime || 0) + (120 * 60); // 120 minutes in seconds (was 150)

              // If match started less than 120 minutes ago, DO NOT transition to END
              if (nowTs < minTimeForEnd) {
                logger.warn(
                  `[Watchdog] Match ${stale.matchId} not in recent/list but match_time (${matchTime}) ` +
                  `is less than 120 minutes ago (now: ${nowTs}, diff: ${Math.floor((nowTs - (matchTime ?? nowTs)) / 60)} min). ` +
                  `Skipping END transition. Will try detail_live instead.`
                );
                // Continue to detail_live reconcile instead of END
                // (fall through to detail_live check below)
              } else {
                // Match time is old enough, safe to transition to END
                logger.info(
                  `[Watchdog] Match ${stale.matchId} not in recent/list and match_time (${matchTime}) ` +
                  `is ${Math.floor((nowTs - (matchTime ?? nowTs)) / 60)} minutes ago (>120 min). Transitioning to END.`
                );

                // PHASE C: Use orchestrator for centralized write coordination
                const orchestratorResult = await this.updateMatchDirect(
                  stale.matchId,
                  [
                    { field: 'status_id', value: 8, source: 'watchdog', priority: 1, timestamp: nowTs },
                    { field: 'last_event_ts', value: nowTs, source: 'watchdog', priority: 1, timestamp: nowTs },
                  ],
                  'watchdog'
                );

                if (orchestratorResult.status === 'success') {
                  successCount++;
                  reasons['finished_not_in_recent_list_safe'] = (reasons['finished_not_in_recent_list_safe'] || 0) + 1;

                  logEvent('info', 'watchdog.reconcile.done', {
                    match_id: stale.matchId,
                    result: 'success',
                    reason: 'finished_not_in_recent_list_safe',
                    duration_ms: Date.now() - reconcileStartTime,
                    fields_updated: orchestratorResult.fieldsUpdated,
                    new_status_id: 8,
                    match_time: matchTime,
                    elapsed_minutes: Math.floor((nowTs - (matchTime ?? nowTs)) / 60),
                  });
                  continue; // Skip detail_live reconcile
                }
              }
            } finally {
              client.release();
            }
          } else if ([8, 9, 10, 12].includes(recentListMatch.statusId)) {
            // Match is END in recent/list but LIVE in DB - transition to END
            logger.info(`[Watchdog] Match ${stale.matchId} is END (status ${recentListMatch.statusId}) in recent/list, transitioning DB to END`);

            const nowTs = Math.floor(Date.now() / 1000);

            // PHASE C: Use orchestrator for centralized write coordination
            const orchestratorResult = await this.updateMatchDirect(
              stale.matchId,
              [
                { field: 'status_id', value: 8, source: 'watchdog', priority: 1, timestamp: nowTs },
                { field: 'provider_update_time', value: recentListMatch.updateTime || nowTs, source: 'api', priority: 2, timestamp: nowTs },
                { field: 'last_event_ts', value: nowTs, source: 'watchdog', priority: 1, timestamp: nowTs },
              ],
              'watchdog'
            );

            if (orchestratorResult.status === 'success') {
              successCount++;
              reasons['finished_in_recent_list'] = (reasons['finished_in_recent_list'] || 0) + 1;

              logEvent('info', 'watchdog.reconcile.done', {
                match_id: stale.matchId,
                result: 'success',
                reason: 'finished_in_recent_list',
                duration_ms: Date.now() - reconcileStartTime,
                fields_updated: orchestratorResult.fieldsUpdated,
                new_status_id: 8,
                provider_status_id: recentListMatch.statusId,
              });

              // HALF STATS PERSISTENCE: Save second half data when match transitions to END
              halfStatsPersistenceService.saveSecondHalfData(stale.matchId)
                .then(res => {
                  if (res.success) logger.info(`[Watchdog] Half stats saved for ${stale.matchId}: ${res.statsCount} stats, ${res.incidentsCount} incidents`);
                })
                .catch(err => logger.warn(`[Watchdog] Failed to save half stats for ${stale.matchId}:`, err.message));

              continue; // Skip detail_live reconcile
            }
          }

          // Phase 5-S: Emit reconcile.start event
          logEvent('info', 'watchdog.reconcile.start', {
            match_id: stale.matchId,
            external_id: stale.matchId,
            match_time: null, // Stale matches don't have match_time in context
            reason: stale.reason,
          });

          // PHASE C: Use orchestrator for centralized write coordination
          const reconcileResult = await this.reconcileViaOrchestrator(stale.matchId);
          const duration = Date.now() - reconcileStartTime;

          // Phase 5-S: Check if reconcile was successful (statusId returned)
          if (reconcileResult.statusId !== undefined) {
            successCount++;
            const reasonKey = `success_${stale.reason}`;
            reasons[reasonKey] = (reasons[reasonKey] || 0) + 1;

            // Phase 5-S: Emit reconcile.done event with success
            logEvent('info', 'watchdog.reconcile.done', {
              match_id: stale.matchId,
              result: 'success',
              reason: stale.reason,
              duration_ms: duration,
              new_status_id: reconcileResult.statusId,
            });
          } else {
            skippedCount++;
            reasons['no_update'] = (reasons['no_update'] || 0) + 1;

            // Phase 5-S: Emit reconcile.done event with skip (no update)
            logEvent('info', 'watchdog.reconcile.done', {
              match_id: stale.matchId,
              result: 'skip',
              reason: 'no_update',
              duration_ms: duration,
            });
          }
        } catch (error: any) {
          const duration = Date.now() - reconcileStartTime;
          failCount++;

          // Phase 5-S: Categorize failure reason
          let failureReason = 'unknown_error';
          if (error instanceof CircuitOpenError) {
            failureReason = 'circuit_open';
          } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
            failureReason = 'timeout';
          } else if (error.message?.includes('404') || error.message?.includes('not found')) {
            failureReason = 'provider_404';
          } else if (error.message?.includes('no usable data')) {
            failureReason = 'no_usable_data';
          }
          reasons[failureReason] = (reasons[failureReason] || 0) + 1;

          logger.error(`[Watchdog] reconcile failed for ${stale.matchId}:`, error);

          // Phase 5-S: Emit reconcile.done event with failure
          logEvent('error', 'watchdog.reconcile.done', {
            match_id: stale.matchId,
            result: 'fail',
            reason: failureReason,
            duration_ms: duration,
            error_message: error.message || 'Unknown error',
          });
        }
      }

      // Process matches that should be live
      // NOTE: recentListAllMatches is already fetched at the beginning of tick() and reused here
      for (const match of shouldBeLive) {
        logEvent('info', 'watchdog.should_be_live_detected', {
          match_id: match.matchId,
          match_time: match.matchTime,
          minutes_ago: match.minutesAgo,
        });

        const reconcileStartTime = Date.now();
        attemptedCount++;

        try {
          // Phase 5-S FIX: Check if match is in recent/list first
          const recentListMatch = recentListAllMatches.get(match.matchId);

          if (!recentListMatch) {
            // Match not in recent/list - try detail_live first, then diary as fallback
            logEvent('info', 'watchdog.reconcile.start', {
              match_id: match.matchId,
              external_id: match.matchId,
              match_time: match.matchTime,
              reason: 'should_be_live',
              source: 'detail_live_fallback',
            });

            try {
              // PHASE C: Use orchestrator for centralized write coordination
              const reconcileResult = await this.reconcileViaOrchestrator(match.matchId);
              const duration = Date.now() - reconcileStartTime;

              if (reconcileResult.statusId !== undefined) {
                successCount++;
                reasons['should_be_live_detail_live_success'] = (reasons['should_be_live_detail_live_success'] || 0) + 1;
                logEvent('info', 'watchdog.reconcile.done', {
                  match_id: match.matchId,
                  result: 'success',
                  reason: 'should_be_live_detail_live_success',
                  duration_ms: duration,
                  new_status_id: reconcileResult.statusId,
                  source: 'detail_live_fallback',
                });
                continue;
              }

              // detail_live returned no data - check if match is VERY OLD (>115 mins)
              // Old matches should be transitioned to END since they're clearly finished
              const matchAgeMinutes = match.minutesAgo;
              // CRITICAL FIX: Reduced from 180 to 115 mins to clear 90+10 stuck matches faster
              const OLD_MATCH_THRESHOLD_MINUTES = 115; // ~2 hours

              if (matchAgeMinutes > OLD_MATCH_THRESHOLD_MINUTES) {
                // Match is >3 hours old with no live data - transition to END
                logger.info(
                  `[Watchdog] Match ${match.matchId} is ${matchAgeMinutes} min old (>${OLD_MATCH_THRESHOLD_MINUTES}min) ` +
                  `with no detail_live data. Transitioning to END (status=8).`
                );

                const nowTs = Math.floor(Date.now() / 1000);

                // PHASE C: Use orchestrator for centralized write coordination
                const orchestratorResult = await this.updateMatchDirect(
                  match.matchId,
                  [
                    { field: 'status_id', value: 8, source: 'watchdog', priority: 1, timestamp: nowTs },
                    { field: 'last_event_ts', value: nowTs, source: 'watchdog', priority: 1, timestamp: nowTs },
                  ],
                  'watchdog'
                );

                if (orchestratorResult.status === 'success') {
                  successCount++;
                  reasons['old_match_transition_to_end'] = (reasons['old_match_transition_to_end'] || 0) + 1;

                  logEvent('info', 'watchdog.reconcile.done', {
                    match_id: match.matchId,
                    result: 'success',
                    reason: 'old_match_transition_to_end',
                    duration_ms: Date.now() - reconcileStartTime,
                    fields_updated: orchestratorResult.fieldsUpdated,
                    match_age_minutes: matchAgeMinutes,
                    new_status_id: 8,
                  });
                }
                continue;
              }

              // Match is recent but no live data - skip and retry later
              logger.warn(
                `[Watchdog] detail_live returned no data for ${match.matchId}. ` +
                `Match is ${matchAgeMinutes} min old (<${OLD_MATCH_THRESHOLD_MINUTES}min threshold). ` +
                `Will retry on next tick.`
              );

              // Match is not old enough to force-end, skip for now
              skippedCount++;
              reasons['not_in_recent_list_no_detail_data'] = (reasons['not_in_recent_list_no_detail_data'] || 0) + 1;
              logEvent('info', 'watchdog.reconcile.done', {
                match_id: match.matchId,
                result: 'skip',
                reason: 'not_in_recent_list_no_detail_data',
                duration_ms: duration,
                row_count: 0,
                source: 'detail_live_fallback',
              });
            } catch (error: any) {
              const duration = Date.now() - reconcileStartTime;
              failCount++;
              let failureReason = 'unknown_error';
              if (error instanceof CircuitOpenError) {
                failureReason = 'circuit_open';
              } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
                failureReason = 'timeout';
              } else if (error.message?.includes('404') || error.message?.includes('not found')) {
                failureReason = 'provider_404';
              }
              reasons[failureReason] = (reasons[failureReason] || 0) + 1;
              logEvent('error', 'watchdog.reconcile.done', {
                match_id: match.matchId,
                result: 'fail',
                reason: failureReason,
                duration_ms: duration,
                error_message: error.message || 'Unknown error',
                source: 'detail_live_fallback',
              });
            }
            continue;
          }

          // Phase 5-S FIX: Match is in recent/list - update status first, then call detail_live
          logEvent('info', 'watchdog.reconcile.start', {
            match_id: match.matchId,
            external_id: match.matchId,
            match_time: match.matchTime,
            reason: 'should_be_live',
            source: 'recent_list',
          });

          // Update status using optimistic locking (same pattern as reconcileMatchToDatabase)
          const client = await pool.connect();
          let statusUpdateSuccess = false;

          try {
            // Read existing timestamps for optimistic locking
            const existingResult = await client.query(
              `SELECT provider_update_time, last_event_ts, status_id 
               FROM ts_matches WHERE external_id = $1`,
              [match.matchId]
            );

            if (existingResult.rows.length === 0) {
              logger.warn(`[Watchdog] Match ${match.matchId} not found in DB during status update`);
              throw new Error('Match not found in DB');
            }

            const existing = existingResult.rows[0];
            const existingProviderTime = existing.provider_update_time;
            const incomingProviderTime = recentListMatch.updateTime;

            // Optimistic locking: only update if provider time is newer (or null existing)
            if (incomingProviderTime !== null && existingProviderTime !== null && incomingProviderTime <= existingProviderTime) {
              logger.debug(
                `[Watchdog] Skipping status update for ${match.matchId} (provider time: ${incomingProviderTime} <= ${existingProviderTime})`
              );
            } else {
              // Update status_id using provider_update_time from recent/list
              const ingestionTs = Math.floor(Date.now() / 1000);
              const providerTimeToWrite = incomingProviderTime !== null && incomingProviderTime !== undefined
                ? Math.max(existingProviderTime || 0, incomingProviderTime)
                : ingestionTs;

              // PHASE C: Use orchestrator for centralized write coordination
              const orchestratorResult = await this.updateMatchDirect(
                match.matchId,
                [
                  { field: 'status_id', value: recentListMatch.statusId, source: 'api', priority: 2, timestamp: providerTimeToWrite },
                  { field: 'provider_update_time', value: providerTimeToWrite, source: 'api', priority: 2, timestamp: providerTimeToWrite },
                  { field: 'last_event_ts', value: ingestionTs, source: 'api', priority: 2, timestamp: ingestionTs },
                ],
                'watchdog'
              );

              if (orchestratorResult.status === 'success') {
                statusUpdateSuccess = true;
                logger.info(`[Watchdog] Updated status for ${match.matchId} from 1 to ${recentListMatch.statusId} (from recent/list)`);
              }
            }
          } finally {
            client.release();
          }

          // Now call detail_live for events/score/minute (only if status update succeeded)
          if (statusUpdateSuccess) {
            try {
              // PHASE C: Use orchestrator for centralized write coordination
              const reconcileResult = await this.reconcileViaOrchestrator(match.matchId);
              const duration = Date.now() - reconcileStartTime;

              // Phase 5-S: Check if reconcile was successful
              if (reconcileResult.statusId !== undefined || statusUpdateSuccess) {
                successCount++;
                reasons['success_should_be_live'] = (reasons['success_should_be_live'] || 0) + 1;

                logEvent('info', 'watchdog.reconcile.done', {
                  match_id: match.matchId,
                  result: 'success',
                  reason: 'should_be_live',
                  duration_ms: duration,
                  new_status_id: reconcileResult.statusId || recentListMatch.statusId,
                  provider_update_time: recentListMatch.updateTime || null,
                });
              } else {
                // Status updated but detail_live didn't update anything
                successCount++; // Status update is still success
                reasons['success_should_be_live'] = (reasons['success_should_be_live'] || 0) + 1;

                logEvent('info', 'watchdog.reconcile.done', {
                  match_id: match.matchId,
                  result: 'success',
                  reason: 'should_be_live_status_only',
                  duration_ms: duration,
                  new_status_id: recentListMatch.statusId,
                  provider_update_time: recentListMatch.updateTime || null,
                });
              }
            } catch (detailLiveError: any) {
              // Status update succeeded but detail_live failed - still count as partial success
              const duration = Date.now() - reconcileStartTime;
              successCount++;
              reasons['success_should_be_live_status_only'] = (reasons['success_should_be_live_status_only'] || 0) + 1;

              let failureReason = 'detail_live_missing';
              if (detailLiveError instanceof CircuitOpenError) {
                failureReason = 'circuit_open';
              } else if (detailLiveError.message?.includes('timeout')) {
                failureReason = 'provider_timeout';
              } else if (detailLiveError.message?.includes('404')) {
                failureReason = 'provider_404';
              }

              logEvent('warn', 'watchdog.reconcile.done', {
                match_id: match.matchId,
                result: 'success', // Status update succeeded
                reason: `should_be_live_${failureReason}`,
                duration_ms: duration,
                row_count: 1, // Status update
                provider_update_time: recentListMatch.updateTime || null,
                detail_live_error: failureReason,
              });
            }
          } else {
            // Status update failed (optimistic locking guard)
            skippedCount++;
            reasons['status_update_skipped'] = (reasons['status_update_skipped'] || 0) + 1;

            const duration = Date.now() - reconcileStartTime;
            logEvent('info', 'watchdog.reconcile.done', {
              match_id: match.matchId,
              result: 'skip',
              reason: 'status_update_skipped',
              duration_ms: duration,
              row_count: 0,
            });
          }
        } catch (error: any) {
          const duration = Date.now() - reconcileStartTime;
          failCount++;

          // Phase 5-S: Categorize failure reason
          let failureReason = 'unknown_error';
          if (error instanceof CircuitOpenError) {
            failureReason = 'circuit_open';
            skippedCount++;
            failCount--;
          } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
            failureReason = 'provider_timeout';
          } else if (error.message?.includes('404') || error.message?.includes('not found')) {
            failureReason = 'provider_404';
          } else if (error.message?.includes('no usable data')) {
            failureReason = 'no_usable_data';
          }
          reasons[failureReason] = (reasons[failureReason] || 0) + 1;

          logger.error(`[Watchdog] reconcile failed for should-be-live match ${match.matchId}:`, error);

          logEvent('error', 'watchdog.reconcile.done', {
            match_id: match.matchId,
            result: failureReason === 'circuit_open' ? 'skip' : 'fail',
            reason: failureReason,
            duration_ms: duration,
            error_message: error.message || 'Unknown error',
          });
        }
      }

      // CRITICAL FIX: Process OVERDUE matches (minute exceeded maximum)
      // These matches have status=4 with minute>105 or status=5 with minute>130
      // They should have ended but didn't get status update - force reconcile to get correct status
      for (const overdue of overdueMatches) {
        logEvent('warn', 'watchdog.overdue_detected', {
          match_id: overdue.matchId,
          status_id: overdue.statusId,
          minute: overdue.minute,
          reason: overdue.reason,
        });

        const reconcileStartTime = Date.now();
        attemptedCount++;

        try {
          // CRITICAL FIX (2026-01-13): Handle KICKOFF TIMESTAMP MISMATCH ANOMALY
          // If status=2 (1H) but second_half_kickoff_ts exists, force status=4 immediately
          // This is the primary cause of "stuck at 45" bug for minor league matches
          if (overdue.statusId === 2 && overdue.reason.includes('second_half_kickoff_ts')) {
            logger.warn(
              `[Watchdog] KICKOFF MISMATCH DETECTED: ${overdue.matchId} has status=2 (1H) but 2H kickoff timestamp exists! ` +
              `Force transitioning to status=4 (SECOND_HALF).`
            );

            const nowTs = Math.floor(Date.now() / 1000);

            // First, force status_id=4 via orchestrator (high priority watchdog source)
            const statusFixResult = await this.updateMatchDirect(
              overdue.matchId,
              [
                { field: 'status_id', value: 4, source: 'watchdog', priority: 3, timestamp: nowTs },
                { field: 'last_event_ts', value: nowTs, source: 'watchdog', priority: 1, timestamp: nowTs },
              ],
              'watchdog-kickoff-mismatch-fix'
            );

            if (statusFixResult.status === 'success') {
              successCount++;
              reasons['kickoff_mismatch_fixed'] = (reasons['kickoff_mismatch_fixed'] || 0) + 1;

              logEvent('info', 'watchdog.reconcile.done', {
                match_id: overdue.matchId,
                result: 'success',
                reason: 'kickoff_mismatch_fixed',
                duration_ms: Date.now() - reconcileStartTime,
                fields_updated: statusFixResult.fieldsUpdated,
                old_status: 2,
                new_status: 4,
              });

              // Now try to get actual status from API (may be status=8 if match already ended)
              const reconcileResult = await this.reconcileViaOrchestrator(overdue.matchId);
              if (reconcileResult.statusId !== undefined && reconcileResult.statusId !== 4) {
                logger.info(`[Watchdog] Kickoff mismatch match ${overdue.matchId} further updated to status=${reconcileResult.statusId} from API`);
              }
              continue;
            }

            logger.error(`[Watchdog] Failed to fix kickoff mismatch for ${overdue.matchId}: ${statusFixResult.reason}`);
            // Fall through to normal reconcile if kickoff mismatch fix failed
          }

          // PHASE C: Use orchestrator - try to reconcile via API to get correct status
          const reconcileResult = await this.reconcileViaOrchestrator(overdue.matchId);
          const duration = Date.now() - reconcileStartTime;

          if (reconcileResult.statusId !== undefined) {
            // API returned updated data
            successCount++;
            reasons['overdue_reconciled'] = (reasons['overdue_reconciled'] || 0) + 1;

            logEvent('info', 'watchdog.reconcile.done', {
              match_id: overdue.matchId,
              result: 'success',
              reason: 'overdue_reconciled',
              duration_ms: duration,
              old_minute: overdue.minute,
              old_status: overdue.statusId,
              new_status: reconcileResult.statusId,
            });

            // If match transitioned to END, trigger post-match persistence
            if (reconcileResult.statusId === 8) {
              logger.info(`[Watchdog] Overdue match ${overdue.matchId} transitioned to END (8), triggering post-match persistence...`);
              try {
                const { PostMatchProcessor } = await import('../services/liveData/postMatchProcessor');
                const { theSportsAPI } = await import('../core');
                const processor = new PostMatchProcessor();
                await processor.onMatchEnded(overdue.matchId);
                logger.info(`[Watchdog] ✅ Post-match persistence completed for overdue match ${overdue.matchId}`);
              } catch (postMatchErr: any) {
                logger.warn(`[Watchdog] Failed to trigger post-match persistence for overdue ${overdue.matchId}:`, postMatchErr.message);
              }

              // Save half stats
              halfStatsPersistenceService.saveSecondHalfData(overdue.matchId)
                .then(res => {
                  if (res.success) logger.info(`[Watchdog] Half stats saved for overdue ${overdue.matchId}: ${res.statsCount} stats, ${res.incidentsCount} incidents`);
                })
                .catch(err => logger.warn(`[Watchdog] Failed to save half stats for overdue ${overdue.matchId}:`, err.message));
            }
            continue;
          }

          // API didn't return updated data - force transition to END
          // Match minute is way over maximum (105 for 2nd half, 130 for overtime)
          // This means match should have ended but provider didn't send update
          logger.warn(
            `[Watchdog] Overdue match ${overdue.matchId} (minute=${overdue.minute}, status=${overdue.statusId}) ` +
            `not updated by API. Force transitioning to END (status=8).`
          );

          const nowTs = Math.floor(Date.now() / 1000);

          // PHASE C: Use orchestrator for centralized write coordination
          const orchestratorResult = await this.updateMatchDirect(
            overdue.matchId,
            [
              { field: 'status_id', value: 8, source: 'watchdog', priority: 1, timestamp: nowTs },
              { field: 'last_event_ts', value: nowTs, source: 'watchdog', priority: 1, timestamp: nowTs },
            ],
            'watchdog'
          );

          if (orchestratorResult.status === 'success') {
            successCount++;
            reasons['overdue_force_end'] = (reasons['overdue_force_end'] || 0) + 1;

            logEvent('info', 'watchdog.reconcile.done', {
              match_id: overdue.matchId,
              result: 'success',
              reason: 'overdue_force_end',
              duration_ms: Date.now() - reconcileStartTime,
              fields_updated: orchestratorResult.fieldsUpdated,
              old_minute: overdue.minute,
              old_status: overdue.statusId,
              new_status: 8,
            });

            // Trigger post-match persistence
            logger.info(`[Watchdog] Overdue match ${overdue.matchId} force-ended, triggering post-match persistence...`);
            try {
              const { PostMatchProcessor } = await import('../services/liveData/postMatchProcessor');
              const { theSportsAPI } = await import('../core');
              const processor = new PostMatchProcessor();
              await processor.onMatchEnded(overdue.matchId);
            } catch (postMatchErr: any) {
              logger.warn(`[Watchdog] Failed to trigger post-match persistence for force-ended ${overdue.matchId}:`, postMatchErr.message);
            }

            // Save half stats
            halfStatsPersistenceService.saveSecondHalfData(overdue.matchId)
              .then(res => {
                if (res.success) logger.info(`[Watchdog] Half stats saved for force-ended ${overdue.matchId}: ${res.statsCount} stats, ${res.incidentsCount} incidents`);
              })
              .catch(err => logger.warn(`[Watchdog] Failed to save half stats for force-ended ${overdue.matchId}:`, err.message));
          } else {
            skippedCount++;
            reasons['overdue_no_update'] = (reasons['overdue_no_update'] || 0) + 1;
          }
        } catch (error: any) {
          failCount++;
          let failureReason = 'overdue_reconcile_failed';
          if (error instanceof CircuitOpenError) {
            failureReason = 'circuit_open';
          } else if (error.message?.includes('timeout')) {
            failureReason = 'timeout';
          }
          reasons[failureReason] = (reasons[failureReason] || 0) + 1;

          logger.error(`[Watchdog] Overdue match reconcile failed for ${overdue.matchId}:`, error);

          logEvent('error', 'watchdog.reconcile.done', {
            match_id: overdue.matchId,
            result: 'fail',
            reason: failureReason,
            duration_ms: Date.now() - reconcileStartTime,
            error_message: error.message || 'Unknown error',
          });
        }
      }

      // Phase 5-S: Emit summary log with detailed breakdown
      const duration = Date.now() - startedAt;
      logEvent('info', 'watchdog.tick.summary', {
        candidates_count: candidatesCount,
        attempted_count: attemptedCount,
        success_count: successCount,
        fail_count: failCount,
        skipped_count: skippedCount,
        stale_count: stales.length,
        should_be_live_count: shouldBeLive.length,
        overdue_count: overdueMatches.length,
        reasons: reasons,
        duration_ms: duration,
      });

      logger.info(
        `[Watchdog] tick: stale=${stales.length} should_be_live=${shouldBeLive.length} overdue=${overdueMatches.length} ` +
        `attempted=${attemptedCount} success=${successCount} fail=${failCount} skipped=${skippedCount} (${duration}ms)`
      );
    } catch (error: any) {
      logger.error('[Watchdog] CRITICAL ERROR in tick:', error);
      logger.error('[Watchdog] Error stack:', error.stack);
    } finally {
      this.isRunning = false;
      logger.info('[Watchdog] ========== TICK END ==========');
    }
  }

  /**
   * Start the worker
   * CRITICAL FIX: Re-enabled for "should-be-live" matches (status=1 but match_time passed)
   * 
   * /data/update only handles matches that provider marks as "changed"
   * But "should-be-live" matches (status=1, match_time passed) may not appear in /data/update
   * So we need watchdog to proactively check and transition them to LIVE
   * 
   * Watchdog now ONLY handles:
   * - Should-be-live matches (status=1, match_time passed) → transition to LIVE
   * - Stale match detection is still disabled (handled by /data/update)
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Match watchdog worker already started');
      return;
    }

    logger.info('[Watchdog] Starting MatchWatchdogWorker for should-be-live and stale match detection');

    // Run immediately on start with timeout safety
    logger.info('[Watchdog] Calling first tick()...');
    this.tick().catch(err => {
      logger.error('[Watchdog] Initial tick() failed:', err);
      this.isRunning = false; // Reset flag on error
    });

    // CRITICAL FIX (2026-01-09): Run every 30 seconds (balanced approach)
    // Reason: 5s was too aggressive (unnecessary API calls, 83% more frequent than needed)
    //         60s (API docs) too conservative for catching anomalies
    // 30s provides good balance: catches anomalies quickly without overwhelming API
    // DataUpdate worker already handles real-time updates every 20s
    this.intervalId = setInterval(() => {
      this.tick().catch(err => {
        logger.error('[Watchdog] Interval tick() failed:', err);
        this.isRunning = false; // Reset flag on error to prevent deadlock
      });
    }, 30000); // 30 seconds (balanced)

    logEvent('info', 'worker.started', {
      worker: 'MatchWatchdogWorker',
      interval_sec: 30,
      purpose: 'should_be_live_and_stale_detection',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Match watchdog worker stopped');
    }
  }
}

