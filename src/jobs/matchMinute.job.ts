/**
 * Match Minute Worker
 * 
 * Background job to calculate and update match minutes for live matches.
 * Runs every 30 seconds, processes 100 matches per tick.
 * 
 * CRITICAL: Minute Engine does NOT use time-based thresholds.
 * Minute updates only when value changes (new_minute !== existing_minute).
 */

import { pool } from '../database/connection';
import { MatchMinuteService } from '../services/thesports/match/matchMinute.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';
import { broadcastEvent } from '../routes/websocket.routes';

export class MatchMinuteWorker {
  private matchMinuteService: MatchMinuteService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.matchMinuteService = new MatchMinuteService();
  }

  /**
   * Process a batch of matches and update their minutes
   * @param batchSize - Maximum number of matches to process (default: 100)
   */
  async tick(batchSize: number = 100): Promise<void> {
    if (this.isRunning) {
      logger.debug('[MinuteEngine] Tick already running, skipping this run');
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();

    try {
      const nowTs = Math.floor(Date.now() / 1000);

      // Query matches with status IN (2,3,4,5,7)
      // NO time-based threshold filter (no last_minute_update_ts gating)
      // NO minute IS NULL filter (minute can progress after initial calculation)
      const client = await pool.connect();
      try {
        const query = `
          SELECT
            external_id,
            status_id,
            first_half_kickoff_ts,
            second_half_kickoff_ts,
            overtime_kickoff_ts,
            live_kickoff_time,
            match_time,
            minute,
            provider_update_time,
            last_event_ts
          FROM ts_matches
          WHERE status_id IN (2, 3, 4, 5, 7)
          ORDER BY match_time DESC
          LIMIT $1
        `;

        const result = await client.query(query, [batchSize]);
        const matches = result.rows;

        if (matches.length === 0) {
          logger.debug('[MinuteEngine] No live matches to process');
          return;
        }

        let updatedCount = 0;
        let skippedCount = 0;
        let skippedRecentlyUpdated = 0;

        for (const match of matches) {
          const matchId = match.external_id;
          const statusId = match.status_id;

          // OPTIMIZATION: Skip minute calculation if DataUpdate recently updated this match
          // DataUpdate worker (20s interval) fetches fresh minute from API
          // CRITICAL FIX (2026-01-15): Reduced from 25s to 5s to minimize minute update delays
          const providerUpdateTime = match.provider_update_time ? Number(match.provider_update_time) : null;
          const lastEventTs = match.last_event_ts ? Number(match.last_event_ts) : null;

          // Use the most recent timestamp (provider_update_time or last_event_ts)
          const lastApiUpdate = providerUpdateTime || lastEventTs;

          if (lastApiUpdate && (nowTs - lastApiUpdate) < 5) {
            const secondsAgo = nowTs - lastApiUpdate;
            logger.debug(
              `[MinuteEngine] skipped match_id=${matchId} reason=recently_updated_by_api (${secondsAgo}s ago) - using API minute`
            );
            skippedRecentlyUpdated++;
            skippedCount++;
            continue;
          }

          // FALLBACK LOGIC: Use first_half_kickoff_ts, else live_kickoff_time, else match_time
          const firstHalfKickoffTs = match.first_half_kickoff_ts
            ? Number(match.first_half_kickoff_ts)
            : (match.live_kickoff_time ? Number(match.live_kickoff_time) : (match.match_time ? Number(match.match_time) : null));

          const secondHalfKickoffTs = match.second_half_kickoff_ts ? Number(match.second_half_kickoff_ts) : null;
          const overtimeKickoffTs = match.overtime_kickoff_ts ? Number(match.overtime_kickoff_ts) : null;
          const existingMinute = match.minute !== null ? Number(match.minute) : null;

          // Calculate new minute
          const newMinute = this.matchMinuteService.calculateMinute(
            statusId,
            firstHalfKickoffTs,
            secondHalfKickoffTs,
            overtimeKickoffTs,
            existingMinute,
            nowTs
          );

          // If calculation returned null (missing kickoff_ts), skip
          if (newMinute === null) {
            if (existingMinute === null) {
              logger.debug(`[MinuteEngine] skipped match_id=${matchId} reason=missing kickoff_ts`);
            } else {
              logger.debug(`[MinuteEngine] skipped match_id=${matchId} reason=missing kickoff_ts (preserving existing minute=${existingMinute})`);
            }
            skippedCount++;
            continue;
          }

          // REFACTOR: Direct database write (bypass orchestrator)
          // Only send update if minute changed
          if (newMinute !== existingMinute) {
            try {
              const updateQuery = `
                UPDATE ts_matches
                SET
                  minute = $1,
                  last_minute_update_ts = $2,
                  minute_source = 'computed',
                  minute_timestamp = $2
                WHERE external_id = $3
              `;

              await client.query(updateQuery, [newMinute, nowTs, matchId]);
              updatedCount++;

              logger.debug(`[MinuteEngine] Updated ${matchId}: minute ${existingMinute} → ${newMinute}`);

              // CRITICAL FIX: Broadcast MINUTE_UPDATE event to frontend
              // This ensures real-time minute progression without page refresh
              try {
                broadcastEvent({
                  type: 'MINUTE_UPDATE',
                  matchId,
                  minute: newMinute,
                  statusId: statusId || 2, // Use actual status or default to FIRST_HALF
                  timestamp: Date.now(),
                } as any);
              } catch (broadcastError: any) {
                logger.warn(`[MinuteEngine] Failed to broadcast minute update for ${matchId}: ${broadcastError.message}`);
              }
            } catch (error: any) {
              logger.error(`[MinuteEngine] Failed to update ${matchId}:`, error);
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        }

        logEvent('debug', 'minute.tick', {
          processed_count: matches.length,
          updated_count: updatedCount,
          skipped_recently_updated: skippedRecentlyUpdated,
        });
        logger.info(
          `[MinuteEngine] tick: processed ${matches.length} matches, updated ${updatedCount}, skipped ${skippedCount} (recently_updated: ${skippedRecentlyUpdated}) (${Date.now() - startedAt}ms)`
        );
        logger.info(`[MinuteEngine] NOTE: does NOT update updated_at; only minute + last_minute_update_ts`);
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.error('[MinuteEngine] Error in tick:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   * Calculates minutes from kickoff timestamps every 30 seconds.
   * Fallback when WebSocket/detail_live is unavailable.
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Match minute worker already started');
      return;
    }

    logger.info('[MinuteEngine] ENABLED: Calculating minutes from kickoff timestamps');
    logEvent('info', 'worker.started', {
      worker: 'MatchMinuteWorker',
      interval_sec: 30,
    });

    // Run immediately on start
    void this.tick();

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      void this.tick();
    }, 30000);
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Match minute worker stopped');
    }
  }
}

