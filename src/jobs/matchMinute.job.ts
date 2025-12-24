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
            minute
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

        for (const match of matches) {
          const matchId = match.external_id;
          const statusId = match.status_id;
          const firstHalfKickoffTs = match.first_half_kickoff_ts ? Number(match.first_half_kickoff_ts) : null;
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

          // Update only if minute changed
          const updateResult = await this.matchMinuteService.updateMatchMinute(
            matchId,
            newMinute,
            existingMinute
          );

          if (updateResult.updated) {
            updatedCount++;
          } else {
            skippedCount++;
          }
        }

        logEvent('debug', 'minute.tick', {
          processed_count: matches.length,
          updated_count: updatedCount,
        });
        logger.info(
          `[MinuteEngine] tick: processed ${matches.length} matches, updated ${updatedCount}, skipped ${skippedCount} (${Date.now() - startedAt}ms)`
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
   * Runs every 30 seconds
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Match minute worker already started');
      return;
    }

    // Run immediately on start
    void this.tick();

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      void this.tick();
    }, 30000);

    logEvent('info', 'worker.started', {
      worker: 'MatchMinuteWorker',
      interval_sec: 30,
    });
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

