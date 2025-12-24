/**
 * WebSocket Service
 * 
 * Main service for WebSocket integration with event detection and handling
 */

import { WebSocketClient } from './websocket.client';
import { WebSocketParser } from './websocket.parser';
import { WebSocketValidator } from './websocket.validator';
import { EventDetector, MatchEvent } from './event-detector';
import { logger } from '../../../utils/logger';
import { logEvent } from '../../../utils/obsLogger';
import { config } from '../../../config';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { pool } from '../../../database/connection';
import { ParsedScore, WebSocketTliveMessage } from '../../../types/thesports/websocket/websocket.types';
import { VARResult, MatchState, isLiveMatchState, canResurrectFromEnd } from '../../../types/thesports/enums';

export class WebSocketService {
  private client: WebSocketClient;
  private parser: WebSocketParser;
  private validator: WebSocketValidator;
  private eventDetector: EventDetector;
  private eventHandlers: Array<(event: MatchEvent) => void> = [];
  
  // Track match states for "false end" detection
  // Map: matchId -> { status: MatchState, lastStatus8Time: number | null }
  private matchStates = new Map<string, { status: MatchState; lastStatus8Time: number | null }>();
  
  // Keepalive timers for matches that hit status 8 (potential false end)
  // Map: matchId -> NodeJS.Timeout
  private matchKeepaliveTimers = new Map<string, NodeJS.Timeout>();
  
  // Keepalive duration: 20 minutes after status 8
  private readonly KEEPALIVE_DURATION_MS = 20 * 60 * 1000; // 20 minutes

  // Cached schema capabilities (avoid querying information_schema on every WS tick)
  private scoreColumnSupportChecked = false;
  private hasNewScoreColumns = false;

  // Cached live_kickoff_time column capability (avoid querying information_schema on every WS tick)
  private kickoffColumnSupportChecked = false;
  private hasLiveKickoffTimeColumn = false;

  // Cached TLIVE column capability (avoid querying information_schema on every TLIVE message)
  private tliveColumnSupportChecked = false;
  private tliveTargetColumn: 'tlive' | 'timeline' | null = null;

  // Housekeeping interval reference (so we can stop it on disconnect)
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.client = new WebSocketClient({
      host: 'mqtt://mq.thesports.com', // MQTT broker host
      user: config.thesports?.user,
      secret: config.thesports?.secret,
    });

    this.parser = new WebSocketParser();
    this.validator = new WebSocketValidator();
    this.eventDetector = new EventDetector();

    // Register message handler
    this.client.onMessage((message) => {
      this.handleMessage(message);
    });

    // Cleanup old events every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.eventDetector.cleanupOldEvents();
    }, 5 * 60 * 1000);
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    try {
      logEvent('info', 'websocket.connecting', {
        host: 'mqtt://mq.thesports.com',
        user: config.thesports?.user,
      });
      await this.client.connect();
      logEvent('info', 'websocket.connected', {
        host: 'mqtt://mq.thesports.com',
        user: config.thesports?.user,
      });
    } catch (error: any) {
      logger.error('Failed to connect WebSocket service:', error);
      throw error;
    }
  }

  /**
   * Handle MQTT message
   */
  private async handleMessage(message: any): Promise<void> {
    try {
      // Extract provider update_time from message if available (for optimistic locking)
      const providerUpdateTime = this.extractProviderUpdateTimeFromMessage(message);

      // Handle score messages
      if (this.validator.isScoreMessage(message)) {
        const scoreMessages = Array.isArray((message as any).score) ? (message as any).score : [];
        for (const scoreMsg of scoreMessages) {
          try {
            const parsedScore = this.parser.parseScoreToStructured(scoreMsg);

            // Detect status change BEFORE updating local map
            const previousState = this.matchStates.get(parsedScore.matchId)?.status ?? null;
            const nextState = parsedScore.statusId as MatchState;
            const statusChanged = previousState !== null && previousState !== nextState;

            // CRITICAL: Handle match state transitions (including resurrection)
            this.handleMatchStateTransition(parsedScore.matchId, parsedScore.statusId);

            // If status changed (and we had a previous state), persist to DB + notify frontend
            if (statusChanged) {
              await this.updateMatchStatusInDatabase(parsedScore.matchId, parsedScore.statusId, providerUpdateTime);
              this.emitEvent({
                type: 'MATCH_STATE_CHANGE',
                matchId: parsedScore.matchId,
                statusId: parsedScore.statusId,
                timestamp: Date.now(),
              } as any);
            }

            // CRITICAL: Check for score rollback (Goal Cancellation)
            await this.detectScoreRollback(parsedScore);

            // Update database immediately (score + status)
            const dbUpdated = await this.updateMatchInDatabase(parsedScore, providerUpdateTime);

            // Only emit SCORE_CHANGE if we actually updated a DB row
            if (dbUpdated) {
              this.emitEvent({
                type: 'SCORE_CHANGE',
                matchId: parsedScore.matchId,
                homeScore: parsedScore.home.score,
                awayScore: parsedScore.away.score,
                timestamp: Date.now(),
              });

              // Update cache
              const scoreCacheKey = `${CacheKeyPrefix.TheSports}:ws:score:${parsedScore.matchId}`;
              await cacheService.set(scoreCacheKey, parsedScore, CacheTTL.Minute);
            } else {
              // Still cache the parsedScore for troubleshooting, but shorter TTL
              const scoreCacheKey = `${CacheKeyPrefix.TheSports}:ws:score:${parsedScore.matchId}`;
              await cacheService.set(scoreCacheKey, parsedScore, CacheTTL.Minute);
            }
          } catch (e: any) {
            logger.error('Error processing score message item:', e);
          }
        }
      }

      // Handle incidents (goals, cards, substitutions, VAR)
      if (this.validator.isIncidentsMessage(message)) {
        const incidentMessages = Array.isArray((message as any).incidents) ? (message as any).incidents : [];
        for (const incidentsMsg of incidentMessages) {
          const matchId = String((incidentsMsg as any)?.id ?? (incidentsMsg as any)?.match_id ?? (incidentsMsg as any)?.matchId ?? '').trim();
          if (!matchId) {
            logger.warn('Incidents message missing id/matchId, skipping item:', incidentsMsg);
            continue;
          }

          const incidentsArr = Array.isArray((incidentsMsg as any).incidents) ? (incidentsMsg as any).incidents : [];

          // Update database with incidents array
          await this.updateMatchIncidentsInDatabase(matchId, incidentsArr, providerUpdateTime);

          // Update cache
          const incidentsCacheKey = `${CacheKeyPrefix.TheSports}:ws:incidents:${matchId}`;
          await cacheService.set(incidentsCacheKey, incidentsMsg, CacheTTL.Minute);

          for (const incident of incidentsArr) {
            const parsedIncident = this.parser.parseIncidentToStructured(
              matchId,
              incident
            );

            // Log VAR incidents (especially goal cancellations)
            if (parsedIncident.isVAR) {
              logger.info(`VAR incident for match ${parsedIncident.matchId}: reason=${parsedIncident.varReason}, result=${parsedIncident.varResult}`);
              if (parsedIncident.isGoalCancelled) {
                logger.warn(`Goal CANCELLED via VAR for match ${parsedIncident.matchId} at ${parsedIncident.time}'`);
              }
            }

            // Detect goal (but don't rely on VAR incidents for score updates - use score field)
            const goalEvent = this.eventDetector.detectGoalFromIncident(
              parsedIncident.matchId,
              parsedIncident
            );
            if (goalEvent) {
              this.emitEvent(goalEvent);
            }

            // Detect card
            const cardEvent = this.eventDetector.detectCardFromIncident(
              parsedIncident.matchId,
              parsedIncident
            );
            if (cardEvent) {
              this.emitEvent(cardEvent);
            }

            // Detect substitution
            const substitutionEvent = this.eventDetector.detectSubstitutionFromIncident(
              parsedIncident.matchId,
              parsedIncident
            );
            if (substitutionEvent) {
              this.emitEvent(substitutionEvent);
            }
          }
        }
      }

      // Handle stats messages
      if (this.validator.isStatsMessage(message)) {
        const statsMessages = Array.isArray((message as any).stats) ? (message as any).stats : [];
        for (const statsMsg of statsMessages) {
          const matchId = String((statsMsg as any)?.id ?? (statsMsg as any)?.match_id ?? (statsMsg as any)?.matchId ?? '').trim();
          if (!matchId) {
            logger.warn('Stats message missing id/matchId, skipping item:', statsMsg);
            continue;
          }

          // Parse stats to structured format
          const structuredStats = this.parser.parseStatsToStructured(statsMsg);

          // Update database with statistics
          await this.updateMatchStatisticsInDatabase(matchId, structuredStats, providerUpdateTime);

          // Update cache
          const statsCacheKey = `${CacheKeyPrefix.TheSports}:ws:stats:${matchId}`;
          await cacheService.set(statsCacheKey, structuredStats, CacheTTL.Minute);

          logger.debug(`Stats update received for match ${matchId}: ${Object.keys(structuredStats).length} stat types`);
        }
      }

      // Handle tlive messages (timeline / phase updates: HT / 2H / FT etc.)
      if (this.validator.isTliveMessage(message)) {
        const tliveMessages = Array.isArray((message as any).tlive) ? (message as any).tlive : [];
        for (const tliveRaw of tliveMessages) {
          const tliveMsg = tliveRaw as WebSocketTliveMessage;
          const matchId = String((tliveMsg as any)?.id ?? (tliveMsg as any)?.match_id ?? (tliveMsg as any)?.matchId ?? '').trim();
          if (!matchId) {
            logger.warn('Tlive message missing id/matchId, skipping item:', tliveMsg);
            continue;
          }

          const tliveArr = Array.isArray((tliveMsg as any).tlive) ? (tliveMsg as any).tlive : [];

          // Store tlive raw array (if DB supports it) + try to infer match state from latest entry
          await this.updateMatchTliveInDatabase(matchId, tliveArr, providerUpdateTime);

          // Cache tlive
          const tliveCacheKey = `${CacheKeyPrefix.TheSports}:ws:tlive:${matchId}`;
          await cacheService.set(tliveCacheKey, tliveMsg, CacheTTL.Minute);

          // Infer status from tlive (fixes "45+ but actually HT")
          const inferredStatus = this.inferStatusFromTlive(tliveArr);
          if (inferredStatus !== null) {
            logger.info(`[WebSocket/TLIVE] Inferred status ${inferredStatus} from tlive for match ${matchId}, updating database`);
            // Update local transition map (resurrection-safe)
            this.handleMatchStateTransition(matchId, inferredStatus);

            // Update DB status_id immediately (source of truth for UI)
            await this.updateMatchStatusInDatabase(matchId, inferredStatus, providerUpdateTime);

            // Emit event so frontend can refresh live cards immediately
            this.emitEvent({
              type: 'MATCH_STATE_CHANGE',
              matchId,
              statusId: inferredStatus,
              timestamp: Date.now(),
            } as any);
          }
        }
      }
    } catch (error: any) {
      logger.error('Error handling MQTT message:', error);
    }
  }
  /**
   * Infer match status from tlive timeline entries.
   * NOTE: TheSports tlive `data` strings vary by provider/language; we use resilient keyword heuristics.
   * This is used to fix "45+ stuck" when HT/2H is only reflected via TLIVE.
   */
  private inferStatusFromTlive(tlive: any[]): number | null {
    if (!Array.isArray(tlive) || tlive.length === 0) return null;

    // Scan backwards across the last few entries because HT/2H/FT markers are not always the final element
    const scanMax = Math.min(10, tlive.length);
    const recent = tlive.slice(-scanMax).reverse();

    const getDataStr = (entry: any) => String(entry?.data ?? '').toLowerCase();

    // Check for HALF_TIME
    const halfTimeEntry = recent.find((e) => {
      const dataStr = getDataStr(e);
      return dataStr.includes('half time') || dataStr.includes('halftime') || dataStr.includes('ht') || dataStr.includes('devre arası') || dataStr.includes('devre arasi');
    });
    if (halfTimeEntry) {
      logger.info(`[WebSocket/TLIVE] HALF_TIME detected from tlive: ${JSON.stringify(halfTimeEntry)}`);
      return MatchState.HALF_TIME as unknown as number;
    }

    if (recent.some((e) => {
      const dataStr = getDataStr(e);
      return dataStr.includes('second half') || dataStr.includes('2nd half') || dataStr.includes('2h') || dataStr.includes('ikinci yarı') || dataStr.includes('ikinci yari');
    })) {
      return MatchState.SECOND_HALF as unknown as number;
    }

    if (recent.some((e) => {
      const dataStr = getDataStr(e);
      return dataStr.includes('full time') || dataStr.includes('ft') || dataStr.includes('match end') || dataStr.includes('end') || dataStr.includes('bitti') || dataStr.includes('maç bitti') || dataStr.includes('mac bitti');
    })) {
      return MatchState.END as unknown as number;
    }

    if (recent.some((e) => {
      const dataStr = getDataStr(e);
      return dataStr.includes('kick off') || dataStr.includes('kickoff') || dataStr.includes('first half') || dataStr.includes('1st half') || dataStr.includes('1h') || dataStr.includes('başladı') || dataStr.includes('basladi');
    })) {
      return MatchState.FIRST_HALF as unknown as number;
    }

    return null;
  }

  /**
   * Persist tlive to DB if the column exists.
   * Non-critical: if the column is missing, we log and continue.
   */
  private async updateMatchTliveInDatabase(matchId: string, tlive: any[], providerUpdateTime: number | null = null): Promise<void> {
    try {
      const client = await pool.connect();
      try {
        await this.ensureTliveColumnSupport(client);

        if (!this.tliveTargetColumn) {
          logger.debug(
            `No tlive/timeline column found in ts_matches. Skipping tlive persist for match ${matchId}`
          );
          return;
        }

        const targetColumn = this.tliveTargetColumn;

        // Optimistic locking check
        const freshnessCheck = await this.shouldApplyUpdate(client, matchId, providerUpdateTime);
        if (!freshnessCheck.apply) {
          return; // Stale update, skip
        }

        const query = `
          UPDATE ts_matches
          SET
            ${targetColumn} = $1::jsonb,
            provider_update_time = CASE 
              WHEN $3 IS NOT NULL THEN GREATEST(COALESCE(provider_update_time, 0), $3)
              ELSE provider_update_time
            END,
            last_event_ts = $4,
            updated_at = NOW()
          WHERE external_id = $2
        `;

        const res = await client.query(query, [
          JSON.stringify(tlive ?? []),
          matchId,
          freshnessCheck.providerTimeToWrite,
          freshnessCheck.ingestionTs,
        ]);

        if (res.rowCount === 0) {
          logger.warn(
            `⚠️ [WebSocket/TLIVE] UPDATE affected 0 rows: matchId=${matchId}. ` +
            `Match not found in DB or external_id mismatch.`
          );
          return;
        }
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.error(`Failed to update tlive for match ${matchId}:`, error.message);
    }
  }
  /**
   * Detect whether the database schema supports persisting TLIVE.
   * Cached in-memory to avoid querying information_schema on every TLIVE tick.
   */
  private async ensureTliveColumnSupport(client: any): Promise<void> {
    if (this.tliveColumnSupportChecked) return;

    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ts_matches' AND column_name IN ('tlive', 'timeline')
    `);

    if (columnCheck.rows.length === 0) {
      this.tliveTargetColumn = null;
    } else {
      const hasTlive = columnCheck.rows.some((r: any) => r.column_name === 'tlive');
      this.tliveTargetColumn = hasTlive ? 'tlive' : 'timeline';
    }

    this.tliveColumnSupportChecked = true;

    logger.info(`TLIVE column support detected: tliveTargetColumn=${this.tliveTargetColumn ?? 'none'}`);
  }

  /**
   * Update only status_id from TLIVE inference.
   * This makes DB the single source of truth for UI.
   */
  private async updateMatchStatusInDatabase(matchId: string, statusId: number, providerUpdateTime: number | null = null): Promise<void> {
    try {
      const client = await pool.connect();
      try {
        // Optimistic locking check
        const freshnessCheck = await this.shouldApplyUpdate(client, matchId, providerUpdateTime);
        if (!freshnessCheck.apply) {
          return; // Stale update, skip
        }

        const res = await client.query(
          `UPDATE ts_matches 
           SET status_id = $1, 
               provider_update_time = CASE 
                 WHEN $3 IS NOT NULL THEN GREATEST(COALESCE(provider_update_time, 0), $3)
                 ELSE provider_update_time
               END,
               last_event_ts = $4,
               updated_at = NOW() 
           WHERE external_id = $2`,
          [statusId, matchId, freshnessCheck.providerTimeToWrite, freshnessCheck.ingestionTs]
        );

        if (res.rowCount === 0) {
          logger.warn(
            `⚠️ [WebSocket/STATUS] UPDATE affected 0 rows: matchId=${matchId}, status=${statusId}. ` +
            `Match not found in DB or external_id mismatch.`
          );
        } else {
          logger.info(`[WebSocket/STATUS] Successfully updated status_id=${statusId} for matchId=${matchId}, rowCount=${res.rowCount}`);
        }
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.error(`Failed to update status_id from TLIVE for match ${matchId}:`, error.message);
    }
  }

  /**
   * Detect whether the database schema supports the new score columns.
   * Cached in-memory to avoid querying information_schema on every WS tick.
   */
  private async ensureScoreColumnSupport(client: any): Promise<void> {
    if (this.scoreColumnSupportChecked) return;

    const columnCheck = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'ts_matches' AND column_name = 'home_score_regular'
      LIMIT 1
    `);

    this.hasNewScoreColumns = columnCheck.rows.length > 0;
    this.scoreColumnSupportChecked = true;

    logger.info(`Score column support detected: hasNewScoreColumns=${this.hasNewScoreColumns}`);
  }

  /**
   * Detect whether the database schema supports persisting live_kickoff_time.
   * Cached in-memory to avoid querying information_schema on every WS tick.
   */
  private async ensureKickoffColumnSupport(client: any): Promise<void> {
    if (this.kickoffColumnSupportChecked) return;

    const columnCheck = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'ts_matches' AND column_name = 'live_kickoff_time'
      LIMIT 1
    `);

    this.hasLiveKickoffTimeColumn = columnCheck.rows.length > 0;
    this.kickoffColumnSupportChecked = true;

    logger.info(`Kickoff column support detected: hasLiveKickoffTimeColumn=${this.hasLiveKickoffTimeColumn}`);
  }

  /**
   * Extract provider update_time from MQTT message if available
   * Tries common fields: update_time, updateTime, ut, ts, timestamp
   * Returns unix seconds (converts from milliseconds if needed)
   */
  private extractProviderUpdateTimeFromMessage(msg: any): number | null {
    if (!msg || typeof msg !== 'object') return null;

    const candidates = [
      msg.update_time,
      msg.updateTime,
      msg.ut,
      msg.ts,
      msg.timestamp,
      (msg as any)?.meta?.update_time,
      (msg as any)?.meta?.timestamp,
    ];

    for (const c of candidates) {
      if (c == null) continue;
      
      let num: number;
      if (typeof c === 'string') {
        num = parseInt(c, 10);
        if (isNaN(num)) continue;
      } else if (typeof c === 'number') {
        num = c;
      } else {
        continue;
      }

      // If milliseconds (>= year 2000 in ms), convert to seconds
      if (num >= 946684800000) {
        num = Math.floor(num / 1000);
      }

      // Must be reasonable unix timestamp (after 2000, before 2100)
      if (num >= 946684800 && num < 4102444800) {
        return num;
      }
    }

    return null;
  }

  /**
   * Best-effort extraction of live kickoff time from parsed payload.
   * IMPORTANT: We do NOT derive this from message timestamps.
   * We only persist when the provider explicitly sends a kickoff/start epoch.
   */
  private extractLiveKickoffTimeSeconds(parsedScore: any): number | null {
    const candidates = [
      parsedScore?.liveKickoffTime,
      parsedScore?.live_kickoff_time,
      parsedScore?.kickoffTime,
      parsedScore?.kickoff_time,
      (parsedScore as any)?.match?.live_kickoff_time,
      (parsedScore as any)?.match?.liveKickoffTime,
    ];

    for (const c of candidates) {
      const n = typeof c === 'string' ? Number(c) : c;
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
    }

    return null;
  }

  /**
   * Handle match state transitions
   * CRITICAL: Detects "resurrection" states (Status 8 -> 5 or 7) for cup matches
   * 
   * Match Flow:
   * - Standard: 4 (2nd Half) -> 8 (End)
   * - Cup: 4 -> 8 (End of Reg) -> 5 (Overtime) -> 8 (End of OT) -> 7 (Penalty) -> 8 (Final)
   */
  private handleMatchStateTransition(matchId: string, statusId: number): void {
    const currentState = statusId as MatchState;
    const previousState = this.matchStates.get(matchId)?.status;
    
    // Track current state
    if (currentState === MatchState.END) {
      // Status 8 (END) - might be false end, track timestamp
      this.matchStates.set(matchId, {
        status: currentState,
        lastStatus8Time: Date.now(),
      });
      
      // Start keepalive timer (20 minutes) to keep listening for potential resurrection
      this.startMatchKeepalive(matchId);
      
      logger.info(`Match ${matchId} reached Status 8 (END). Keeping connection alive for potential Overtime/Penalty...`);
    } else if (currentState === MatchState.OVERTIME || currentState === MatchState.PENALTY_SHOOTOUT) {
      // Status 5 (Overtime) or 7 (Penalty) - RESURRECTION detected!
      if (previousState === MatchState.END) {
        logger.warn(`🔄 MATCH RESURRECTION: Match ${matchId} transitioned from END (8) to ${currentState === MatchState.OVERTIME ? 'OVERTIME (5)' : 'PENALTY (7)'}`);
        
        // Clear keepalive timer since match is live again
        this.clearMatchKeepalive(matchId);
      }
      
      // Update state (match is LIVE again)
      this.matchStates.set(matchId, {
        status: currentState,
        lastStatus8Time: null, // Reset since match is live
      });
      
      logger.info(`Match ${matchId} is LIVE: ${currentState === MatchState.OVERTIME ? 'Overtime' : 'Penalty Shootout'}`);
    } else if (isLiveMatchState(currentState)) {
      // Other live states (2, 4) - clear any keepalive timers
      this.clearMatchKeepalive(matchId);
      
      this.matchStates.set(matchId, {
        status: currentState,
        lastStatus8Time: null,
      });
    } else {
      // Other states - just track
      this.matchStates.set(matchId, {
        status: currentState,
        lastStatus8Time: this.matchStates.get(matchId)?.lastStatus8Time || null,
      });
    }
  }

  /**
   * Start keepalive timer for a match that hit status 8
   * Keeps connection/subscription active for 20 minutes to detect potential resurrection
   */
  private startMatchKeepalive(matchId: string): void {
    // Clear existing timer if any
    this.clearMatchKeepalive(matchId);
    
    // Set new timer
    const timer = setTimeout(() => {
      const matchState = this.matchStates.get(matchId);
      if (matchState?.status === MatchState.END) {
        // Status 8 has been stable for 20 minutes - consider it final
        logger.info(`Match ${matchId} Status 8 (END) stable for 20 minutes. Marking as definitely finished.`);
        // Timer will auto-clear, connection can be closed by higher-level logic if needed
      }
      this.matchKeepaliveTimers.delete(matchId);
    }, this.KEEPALIVE_DURATION_MS);
    
    this.matchKeepaliveTimers.set(matchId, timer);
  }

  /**
   * Clear keepalive timer (match is live again or definitely finished)
   */
  private clearMatchKeepalive(matchId: string): void {
    const timer = this.matchKeepaliveTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.matchKeepaliveTimers.delete(matchId);
    }
  }

  /**
   * Detect score rollback (Goal Cancellation)
   * CRITICAL RULE: Compare new score with DB score. If new < old, goal was cancelled.
   * Do NOT rely solely on VAR incidents - use the score field as source of truth.
   */
  private async detectScoreRollback(parsedScore: ParsedScore): Promise<void> {
    try {
      const client = await pool.connect();
      try {
        // Get current score from database
        const result = await client.query(
          `SELECT home_scores, away_scores FROM ts_matches WHERE external_id = $1`,
          [parsedScore.matchId]
        );

        if (result.rows.length === 0) {
          // Match not found in DB, skip rollback detection
          return;
        }

        const currentRow = result.rows[0];
        const currentHomeScore = Array.isArray(currentRow.home_scores) && currentRow.home_scores.length > 0
          ? currentRow.home_scores[0] : 0;
        const currentAwayScore = Array.isArray(currentRow.away_scores) && currentRow.away_scores.length > 0
          ? currentRow.away_scores[0] : 0;

        const newHomeScore = parsedScore.home.score;
        const newAwayScore = parsedScore.away.score;

        // Check for score rollback (goal cancellation)
        const homeRollback = newHomeScore < currentHomeScore;
        const awayRollback = newAwayScore < currentAwayScore;

        if (homeRollback || awayRollback) {
          logger.warn(
            `⚠️ GOAL CANCELLED detected for match ${parsedScore.matchId}: ` +
            `${currentHomeScore}-${currentAwayScore} → ${newHomeScore}-${newAwayScore}`
          );
          
          // Emit goal cancelled event
          this.emitEvent({
            type: 'GOAL_CANCELLED',
            matchId: parsedScore.matchId,
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            previousHomeScore: currentHomeScore,
            previousAwayScore: currentAwayScore,
            timestamp: Date.now(),
          });
        }
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.error(`Failed to detect score rollback for match ${parsedScore.matchId}:`, error.message);
    }
  }

  /**
   * Optimistic locking helper: Check if update should be applied
   * Returns: { apply: boolean, providerTimeToWrite: number | null, ingestionTs: number }
   * 
   * Rules:
   * - If incomingProviderUpdateTime exists: compare to DB.provider_update_time → skip if stale
   * - If no provider time: compare ingestionTs to DB.last_event_ts → skip if stale (within 5s window)
   */
  private async shouldApplyUpdate(
    client: any,
    matchId: string,
    incomingProviderUpdateTime: number | null
  ): Promise<{ apply: boolean; providerTimeToWrite: number | null; ingestionTs: number }> {
    const ingestionTs = Math.floor(Date.now() / 1000);

    // Read current timestamps
    const result = await client.query(
      `SELECT provider_update_time, last_event_ts FROM ts_matches WHERE external_id = $1`,
      [matchId]
    );

    if (result.rows.length === 0) {
      // Match not found - log warning but allow update attempt (will fail gracefully)
      logger.warn(`Match ${matchId} not found in DB during optimistic locking check`);
      return { apply: true, providerTimeToWrite: incomingProviderUpdateTime, ingestionTs };
    }

    const existing = result.rows[0];
    const existingProviderTime = existing.provider_update_time;
    const existingEventTime = existing.last_event_ts;

    // Check freshness
    if (incomingProviderUpdateTime !== null && incomingProviderUpdateTime !== undefined) {
      // Provider supplied update_time
      if (existingProviderTime !== null && incomingProviderUpdateTime <= existingProviderTime) {
        logger.debug(
          `Skipping stale update for ${matchId} (provider time: ${incomingProviderUpdateTime} <= ${existingProviderTime})`
        );
        return { apply: false, providerTimeToWrite: null, ingestionTs };
      }
      // Use max(existing, incoming) to always advance
      const providerTimeToWrite = Math.max(existingProviderTime || 0, incomingProviderUpdateTime);
      return { apply: true, providerTimeToWrite, ingestionTs };
    } else {
      // No provider update_time, use event time comparison
      if (existingEventTime !== null && ingestionTs <= existingEventTime + 5) {
        logger.debug(
          `Skipping stale update for ${matchId} (event time: ${ingestionTs} <= ${existingEventTime + 5})`
        );
        return { apply: false, providerTimeToWrite: null, ingestionTs };
      }
      return { apply: true, providerTimeToWrite: null, ingestionTs };
    }
  }

  /**
   * Update match in database with score data
   * CRITICAL: Updates ts_matches table immediately when score changes
   * 
   * Saves:
   * - status_id: Match status (Index 1 from MQTT)
   * - live_kickoff_time: Real kickoff timestamp (if known) - NOT derived from MQTT score timestamp
   * - Separate score columns: regular, overtime, penalties, display
   * - Legacy: home_scores, away_scores (for backward compatibility)
   * - provider_update_time: Provider's update_time (if available from MQTT, else null)
   * - last_event_ts: Our ingestion timestamp (always set)
   * 
   * Frontend should use live_kickoff_time (if set) to calculate: CurrentTime - KickoffTime = MatchMinute
   * Frontend uses score_display for UI, or can calculate using the algorithm
   * Frontend should implement this logic using live_kickoff_time from database.
   */
  private async updateMatchInDatabase(parsedScore: ParsedScore, providerUpdateTime: number | null = null): Promise<boolean> {
    try {
      const client = await pool.connect();
      try {
        // Optimistic locking check
        // Use provider update_time if available from MQTT message, else null
        const freshnessCheck = await this.shouldApplyUpdate(client, parsedScore.matchId, providerUpdateTime);
        if (!freshnessCheck.apply) {
          return false; // Stale update, skip
        }

        // Read existing status and kickoff timestamps for transition detection
        const existingStatusResult = await client.query(
          `SELECT status_id, first_half_kickoff_ts, second_half_kickoff_ts, overtime_kickoff_ts 
           FROM ts_matches WHERE external_id = $1`,
          [parsedScore.matchId]
        );
        const existingStatus = existingStatusResult.rows.length > 0 ? existingStatusResult.rows[0] : null;
        const existingStatusId = existingStatus?.status_id ?? null;

        await this.ensureScoreColumnSupport(client);
        const hasNewColumns = this.hasNewScoreColumns;

        // Ensure kickoff column support and extract kickoff time if possible
        await this.ensureKickoffColumnSupport(client);
        const kickoffSeconds = this.hasLiveKickoffTimeColumn
          ? this.extractLiveKickoffTimeSeconds(parsedScore as any)
          : null;
        
        // Determine kickoff time to use (provider kickoff or ingestion time as fallback)
        const kickoffTimeToUse = kickoffSeconds !== null ? kickoffSeconds : freshnessCheck.ingestionTs;

        if (hasNewColumns) {
          const withKickoff = this.hasLiveKickoffTimeColumn && kickoffSeconds !== null;
          
          // Build kickoff_ts write-once clauses based on status transition
          const kickoffClauses: string[] = [];
          const kickoffValues: number[] = [];
          let kickoffParamIndex = withKickoff ? 14 : 11; // Start after existing params
          
          // Status 2 (FIRST_HALF): Set first_half_kickoff_ts if transitioning from non-live or null
          if (parsedScore.statusId === 2 && (existingStatusId === null || existingStatusId === 1)) {
            if (existingStatus?.first_half_kickoff_ts === null) {
              kickoffClauses.push(`first_half_kickoff_ts = $${kickoffParamIndex++}`);
              kickoffValues.push(kickoffTimeToUse);
              const source = kickoffSeconds !== null ? 'liveKickoff' : 'now';
              logger.info(`[KickoffTS] set first_half_kickoff_ts=${kickoffTimeToUse} match_id=${parsedScore.matchId} source=${source}`);
            } else {
              logger.debug(`[KickoffTS] skip (already set) first_half_kickoff_ts match_id=${parsedScore.matchId}`);
            }
          }
          
          // Status 4 (SECOND_HALF): Set second_half_kickoff_ts if transitioning from HT
          if (parsedScore.statusId === 4 && existingStatusId === 3) {
            if (existingStatus?.second_half_kickoff_ts === null) {
              kickoffClauses.push(`second_half_kickoff_ts = $${kickoffParamIndex++}`);
              kickoffValues.push(kickoffTimeToUse);
              const source = kickoffSeconds !== null ? 'liveKickoff' : 'now';
              logger.info(`[KickoffTS] set second_half_kickoff_ts=${kickoffTimeToUse} match_id=${parsedScore.matchId} source=${source}`);
            } else {
              logger.debug(`[KickoffTS] skip (already set) second_half_kickoff_ts match_id=${parsedScore.matchId}`);
            }
          }
          
          // Status 5 (OVERTIME): Set overtime_kickoff_ts if transitioning from SECOND_HALF
          if (parsedScore.statusId === 5 && existingStatusId === 4) {
            if (existingStatus?.overtime_kickoff_ts === null) {
              kickoffClauses.push(`overtime_kickoff_ts = $${kickoffParamIndex++}`);
              kickoffValues.push(kickoffTimeToUse);
              const source = kickoffSeconds !== null ? 'liveKickoff' : 'now';
              logger.info(`[KickoffTS] set overtime_kickoff_ts=${kickoffTimeToUse} match_id=${parsedScore.matchId} source=${source}`);
            } else {
              logger.debug(`[KickoffTS] skip (already set) overtime_kickoff_ts match_id=${parsedScore.matchId}`);
            }
          }

          // Build SET clauses dynamically
          const setClauses: string[] = [];
          const queryValues: any[] = [];
          
          // Status
          setClauses.push(`status_id = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.statusId);
          
          // Legacy live_kickoff_time (if applicable)
          if (withKickoff) {
            setClauses.push(`live_kickoff_time = COALESCE(live_kickoff_time, $${queryValues.length + 1})`);
            queryValues.push(kickoffSeconds);
          }
          
          // Scores (new columns)
          setClauses.push(`home_score_regular = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.home.regularScore);
          setClauses.push(`home_score_overtime = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.home.overtimeScore);
          setClauses.push(`home_score_penalties = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.home.penaltyScore);
          setClauses.push(`home_score_display = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.home.score);
          setClauses.push(`away_score_regular = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.away.regularScore);
          setClauses.push(`away_score_overtime = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.away.overtimeScore);
          setClauses.push(`away_score_penalties = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.away.penaltyScore);
          setClauses.push(`away_score_display = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.away.score);
          
          // Legacy arrays
          setClauses.push(`home_scores = ARRAY[$${queryValues.length - 7}]`);
          setClauses.push(`away_scores = ARRAY[$${queryValues.length - 3}]`);
          
          // Kickoff timestamps (write-once)
          if (kickoffClauses.length > 0) {
            kickoffClauses.forEach((clause, idx) => {
              setClauses.push(clause);
              queryValues.push(kickoffValues[idx]);
            });
          }
          
          // Provider update time
          const providerTimeParam = queryValues.length + 1;
          setClauses.push(`provider_update_time = CASE 
            WHEN $${providerTimeParam} IS NOT NULL THEN GREATEST(COALESCE(provider_update_time, 0), $${providerTimeParam})
            ELSE provider_update_time
          END`);
          queryValues.push(freshnessCheck.providerTimeToWrite);
          
          // Last event ts
          setClauses.push(`last_event_ts = $${queryValues.length + 1}`);
          queryValues.push(freshnessCheck.ingestionTs);
          
          // Updated at
          setClauses.push(`updated_at = NOW()`);
          
          // Match ID for WHERE clause
          const matchIdParam = queryValues.length + 1;
          queryValues.push(parsedScore.matchId);
          
          const query = `
            UPDATE ts_matches
            SET ${setClauses.join(', ')}
            WHERE external_id = $${matchIdParam}
          `;

          const res = await client.query(query, queryValues);

          if (res.rowCount === 0) {
            logger.warn(
              `⚠️ [WebSocket/SCORE] UPDATE affected 0 rows: matchId=${parsedScore.matchId}, ` +
              `status=${parsedScore.statusId}, score=${parsedScore.home.score}-${parsedScore.away.score}. ` +
              `Match not found in DB or external_id mismatch.`
            );
            return false;
          }

          logger.debug(
            `Updated match ${parsedScore.matchId} in database: ` +
            `Display: ${parsedScore.home.score}-${parsedScore.away.score}, ` +
            `Regular: ${parsedScore.home.regularScore}-${parsedScore.away.regularScore}, ` +
            `Overtime: ${parsedScore.home.overtimeScore}-${parsedScore.away.overtimeScore}, ` +
            `Penalties: ${parsedScore.home.penaltyScore}-${parsedScore.away.penaltyScore}, ` +
            `status=${parsedScore.statusId}, msgTs=${parsedScore.messageTimestamp}`
          );
          return true;
        } else {
          // Legacy path (no new score columns) - same kickoff_ts write-once logic
          const withKickoff = this.hasLiveKickoffTimeColumn && kickoffSeconds !== null;
          
          // Build kickoff_ts write-once clauses (same logic as new columns path)
          const kickoffClauses: string[] = [];
          const kickoffValues: number[] = [];
          
          if (parsedScore.statusId === 2 && (existingStatusId === null || existingStatusId === 1)) {
            if (existingStatus?.first_half_kickoff_ts === null) {
              kickoffClauses.push(`first_half_kickoff_ts = $${withKickoff ? 4 : 3}`);
              kickoffValues.push(kickoffTimeToUse);
              const source = kickoffSeconds !== null ? 'liveKickoff' : 'now';
              logger.info(`[KickoffTS] set first_half_kickoff_ts=${kickoffTimeToUse} match_id=${parsedScore.matchId} source=${source} (legacy)`);
            } else {
              logger.debug(`[KickoffTS] skip (already set) first_half_kickoff_ts match_id=${parsedScore.matchId} (legacy)`);
            }
          }
          if (parsedScore.statusId === 4 && existingStatusId === 3) {
            if (existingStatus?.second_half_kickoff_ts === null) {
              kickoffClauses.push(`second_half_kickoff_ts = $${withKickoff ? 4 : 3}`);
              kickoffValues.push(kickoffTimeToUse);
              const source = kickoffSeconds !== null ? 'liveKickoff' : 'now';
              logger.info(`[KickoffTS] set second_half_kickoff_ts=${kickoffTimeToUse} match_id=${parsedScore.matchId} source=${source} (legacy)`);
            } else {
              logger.debug(`[KickoffTS] skip (already set) second_half_kickoff_ts match_id=${parsedScore.matchId} (legacy)`);
            }
          }
          if (parsedScore.statusId === 5 && existingStatusId === 4) {
            if (existingStatus?.overtime_kickoff_ts === null) {
              kickoffClauses.push(`overtime_kickoff_ts = $${withKickoff ? 4 : 3}`);
              kickoffValues.push(kickoffTimeToUse);
              const source = kickoffSeconds !== null ? 'liveKickoff' : 'now';
              logger.info(`[KickoffTS] set overtime_kickoff_ts=${kickoffTimeToUse} match_id=${parsedScore.matchId} source=${source} (legacy)`);
            } else {
              logger.debug(`[KickoffTS] skip (already set) overtime_kickoff_ts match_id=${parsedScore.matchId} (legacy)`);
            }
          }
          
          // Build query dynamically (legacy path)
          const setClauses: string[] = [];
          const queryValues: any[] = [];
          
          setClauses.push(`status_id = $${queryValues.length + 1}`);
          queryValues.push(parsedScore.statusId);
          
          if (withKickoff) {
            setClauses.push(`live_kickoff_time = COALESCE(live_kickoff_time, $${queryValues.length + 1})`);
            queryValues.push(kickoffSeconds);
          }
          
          setClauses.push(`home_scores = ARRAY[$${queryValues.length + 1}]`);
          queryValues.push(parsedScore.home.score);
          setClauses.push(`away_scores = ARRAY[$${queryValues.length + 1}]`);
          queryValues.push(parsedScore.away.score);
          
          // Add kickoff timestamps
          if (kickoffClauses.length > 0) {
            kickoffClauses.forEach((clause, idx) => {
              // Recalculate param index based on current queryValues length
              const paramIdx = queryValues.length + 1;
              setClauses.push(clause.replace(/\$\d+/, `$${paramIdx}`));
              queryValues.push(kickoffValues[idx]);
            });
          }
          
          const providerTimeParam = queryValues.length + 1;
          setClauses.push(`provider_update_time = CASE 
            WHEN $${providerTimeParam} IS NOT NULL THEN GREATEST(COALESCE(provider_update_time, 0), $${providerTimeParam})
            ELSE provider_update_time
          END`);
          queryValues.push(freshnessCheck.providerTimeToWrite);
          
          setClauses.push(`last_event_ts = $${queryValues.length + 1}`);
          queryValues.push(freshnessCheck.ingestionTs);
          setClauses.push(`updated_at = NOW()`);
          
          const matchIdParam = queryValues.length + 1;
          queryValues.push(parsedScore.matchId);
          
          const query = `
            UPDATE ts_matches
            SET ${setClauses.join(', ')}
            WHERE external_id = $${matchIdParam}
          `;

          const res = await client.query(query, queryValues);

          if (res.rowCount === 0) {
            logger.warn(
              `⚠️ [WebSocket/SCORE] UPDATE affected 0 rows (legacy): matchId=${parsedScore.matchId}, ` +
              `status=${parsedScore.statusId}, score=${parsedScore.home.score}-${parsedScore.away.score}. ` +
              `Match not found in DB or external_id mismatch.`
            );
            return false;
          }

          logger.debug(
            `Updated match ${parsedScore.matchId} in database (legacy): ` +
            `${parsedScore.home.score}-${parsedScore.away.score}, msgTs=${parsedScore.messageTimestamp}`
          );
          return true;
        }
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.error(`Failed to update match ${parsedScore.matchId} in database:`, error.message);
      return false;
    }
  }

  /**
   * Calculate match minute and injury time display
   * 
   * INJURY TIME LOGIC (for Frontend):
   * 
   * Formula: CurrentMinute = (Now - live_kickoff_time) / 60
   * 
   * Display Rules:
   * 1. First Half (status_id = 2):
   *    - If CurrentMinute <= 45: Show "X'" (e.g., "23'")
   *    - If CurrentMinute > 45: Show "45+" (injury time)
   * 
   * 2. Second Half (status_id = 4):
   *    - Calculate: SecondHalfMinute = CurrentMinute - 45
   *    - If SecondHalfMinute <= 45: Show "X'" (e.g., "67'" = 22' of 2nd half)
   *    - If SecondHalfMinute > 45: Show "90+" (injury time)
   * 
   * 3. Half Time (status_id = 3): Show "HT"
   * 4. Full Time (status_id = 5): Show "FT"
   * 
   * Note: This is a helper function for documentation.
   * Frontend should implement this logic using match_time from database.
   * 
   * @param statusId - Match status ID from database
   * @param liveKickoffTime - Live kickoff timestamp (Unix seconds)
   * @returns Calculated minute and display string
   */
  calculateMatchMinute(statusId: number, liveKickoffTime: number): { minute: number; display: string } {
    const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
    const elapsedSeconds = now - liveKickoffTime;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    // Status mapping (based on MatchState enum)
    // 1 = Not Started, 2 = First Half, 3 = Half Time, 4 = Second Half, 5 = Full Time
    
    if (statusId === 2) {
      // First Half
      if (elapsedMinutes <= 45) {
        return { minute: elapsedMinutes, display: `${elapsedMinutes}'` };
      } else {
        return { minute: elapsedMinutes, display: '45+' };
      }
    } else if (statusId === 4) {
      // Second Half
      const secondHalfMinute = elapsedMinutes - 45;
      if (secondHalfMinute <= 45) {
        return { minute: elapsedMinutes, display: `${elapsedMinutes}'` };
      } else {
        return { minute: elapsedMinutes, display: '90+' };
      }
    } else if (statusId === 3) {
      return { minute: 45, display: 'HT' };
    } else if (statusId === 5) {
      return { minute: 90, display: 'FT' };
    } else {
      return { minute: 0, display: '0\'' };
    }
  }

  /**
   * Update match statistics in database
   * CRITICAL: Only updates if values changed (optimization)
   * Stats are only available for popular competitions - handle gracefully if missing
   */
  private async updateMatchStatisticsInDatabase(
    matchId: string,
    statistics: Record<string, { home: number; away: number }>,
    providerUpdateTime: number | null = null
  ): Promise<void> {
    try {
      // If no stats, skip update (non-popular match)
      if (!statistics || Object.keys(statistics).length === 0) {
        logger.debug(`No statistics available for match ${matchId} (non-popular competition)`);
        return;
      }

      const client = await pool.connect();
      try {
        // Check if column exists
        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'ts_matches' AND column_name = 'statistics'
        `);

        if (columnCheck.rows.length === 0) {
          logger.warn(`statistics column not found in ts_matches. Skipping statistics update for match ${matchId}`);
          return;
        }

        // Get current statistics to compare (optimization: only update if changed)
        const currentResult = await client.query(
          `SELECT statistics FROM ts_matches WHERE external_id = $1`,
          [matchId]
        );

        if (currentResult.rows.length === 0) {
          logger.warn(`Match ${matchId} not found in database, skipping statistics update`);
          return;
        }

        const currentStats = currentResult.rows[0].statistics;
        const currentStatsStr = JSON.stringify(currentStats || {});
        const newStatsStr = JSON.stringify(statistics);

        // Only update if statistics changed (optimization)
        if (currentStatsStr === newStatsStr) {
          logger.debug(`Statistics unchanged for match ${matchId}, skipping update`);
          return;
        }

        // Optimistic locking check
        const freshnessCheck = await this.shouldApplyUpdate(client, matchId, providerUpdateTime);
        if (!freshnessCheck.apply) {
          return; // Stale update, skip
        }

        // Update statistics JSONB column
        const query = `
          UPDATE ts_matches
          SET 
            statistics = $1::jsonb,
            provider_update_time = CASE 
              WHEN $3 IS NOT NULL THEN GREATEST(COALESCE(provider_update_time, 0), $3)
              ELSE provider_update_time
            END,
            last_event_ts = $4,
            updated_at = NOW()
          WHERE external_id = $2
        `;

        const res = await client.query(query, [
          JSON.stringify(statistics),
          matchId,
          freshnessCheck.providerTimeToWrite,
          freshnessCheck.ingestionTs,
        ]);

        if (res.rowCount === 0) {
          logger.warn(
            `⚠️ [WebSocket/STATS] UPDATE affected 0 rows: matchId=${matchId}. ` +
            `Match not found in DB or external_id mismatch.`
          );
          return;
        }

        logger.debug(`Updated statistics for match ${matchId}: ${Object.keys(statistics).join(', ')}`);
      } finally {
        client.release();
      }
    } catch (error: any) {
      // If column doesn't exist, log and continue (non-critical)
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        logger.warn(`statistics column not found in ts_matches. Consider adding it via migration.`);
      } else {
        logger.error(`Failed to update statistics for match ${matchId}:`, error.message);
      }
    }
  }

  /**
   * Update match incidents in database
   * CRITICAL: Replaces entire incidents list for the match
   * The API sends the full list or increments - we replace for safety
   */
  private async updateMatchIncidentsInDatabase(matchId: string, incidents: any[], providerUpdateTime: number | null = null): Promise<void> {
    try {
      const client = await pool.connect();
      try {
        // Check if incidents column exists, if not we'll need a migration
        // For now, store in a JSONB column or separate table
        // Using a JSONB column in ts_matches for simplicity
        
        // First, check if column exists
        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'ts_matches' AND column_name = 'incidents'
        `);

        if (columnCheck.rows.length === 0) {
          // Column doesn't exist - log warning but don't fail
          logger.warn(`incidents column not found in ts_matches. Skipping incidents update for match ${matchId}`);
          return;
        }

        // Optimistic locking check
        const freshnessCheck = await this.shouldApplyUpdate(client, matchId, providerUpdateTime);
        if (!freshnessCheck.apply) {
          return; // Stale update, skip
        }

        // Update incidents JSONB column
        const query = `
          UPDATE ts_matches
          SET 
            incidents = $1::jsonb,
            provider_update_time = CASE 
              WHEN $3 IS NOT NULL THEN GREATEST(COALESCE(provider_update_time, 0), $3)
              ELSE provider_update_time
            END,
            last_event_ts = $4,
            updated_at = NOW()
          WHERE external_id = $2
        `;

        const res = await client.query(query, [
          JSON.stringify(incidents),
          matchId,
          freshnessCheck.providerTimeToWrite,
          freshnessCheck.ingestionTs,
        ]);

        if (res.rowCount === 0) {
          logger.warn(
            `⚠️ [WebSocket/INCIDENTS] UPDATE affected 0 rows: matchId=${matchId}. ` +
            `Match not found in DB or external_id mismatch.`
          );
          return;
        }

        logger.debug(`Updated ${incidents.length} incident(s) for match ${matchId}`);
      } finally {
        client.release();
      }
    } catch (error: any) {
      // If column doesn't exist, log and continue (non-critical)
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        logger.warn(`incidents column not found in ts_matches. Consider adding it via migration.`);
      } else {
        logger.error(`Failed to update incidents for match ${matchId}:`, error.message);
      }
    }
  }

  /**
   * Emit event to handlers
   */
  private emitEvent(event: MatchEvent): void {
    logger.info(`Event detected: ${event.type} for match ${event.matchId}`);
    
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error: any) {
        logger.error('Error in event handler:', error);
      }
    });
  }

  /**
   * Register event handler
   */
  onEvent(handler: (event: MatchEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  offEvent(handler: (event: MatchEvent) => void): void {
    this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.client.getConnectionStatus();
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all keepalive timers
    for (const [matchId, timer] of this.matchKeepaliveTimers.entries()) {
      clearTimeout(timer);
    }
    this.matchKeepaliveTimers.clear();
    this.matchStates.clear();
    
    this.client.disconnect();
  }

  /**
   * Get match state for a specific match
   * Useful for checking if match is in "false end" state
   */
  getMatchState(matchId: string): { status: MatchState; lastStatus8Time: number | null } | null {
    return this.matchStates.get(matchId) || null;
  }

  /**
   * Check if match is in keepalive period (potential false end)
   */
  isMatchInKeepalive(matchId: string): boolean {
    return this.matchKeepaliveTimers.has(matchId);
  }
}

