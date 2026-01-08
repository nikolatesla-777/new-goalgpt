
/**
 * Match Watchdog Service
 * 
 * DB-only service to identify stale live matches.
 * Does NOT make API calls or update DB directly.
 * Only provides selection logic for watchdog worker.
 * 
 * PHASE 3C COMPLETE — Minute & Watchdog logic frozen
 * No further changes allowed without Phase 4+ approval.
 */

import { pool } from '../../../database/connection';
import { logger } from '../../../utils/logger';
import { logEvent } from '../../../utils/obsLogger';

export type StaleMatch = {
  matchId: string;
  statusId: number;
  reason: string;
  lastEventTs: number | null;
  providerUpdateTime: number | null;
  updatedAt: string;
};

export class MatchWatchdogService {
  /**
   * Find stale live matches from DB
   * 
   * A match is stale if:
   * - status_id IN (2, 3, 4, 5, 7) (live-like statuses)
   * - match_time <= nowTs + 3600 (avoid far-future matches)
   * - AND at least ONE of:
   *   - last_event_ts IS NULL OR <= nowTs - threshold
   *   - provider_update_time IS NULL OR <= nowTs - threshold
   *   - updated_at <= NOW() - threshold
   * 
   * Thresholds:
   * - status_id IN (2, 4, 5, 7) → staleSeconds (default 120)
   * - status_id = 3 (HALF_TIME) → halfTimeStaleSeconds (default 900)
   * 
   * @param nowTs - Current Unix timestamp (seconds)
   * @param staleSeconds - Stale threshold for statuses 2/4/5/7 (default 120)
   * @param halfTimeStaleSeconds - Stale threshold for status 3 (HALF_TIME) (default 900)
   * @param limit - Maximum number of matches to return (default 50)
   * @returns Array of stale matches with reason and timestamp info
   */
  async findStaleLiveMatches(
    nowTs: number,
    staleSeconds: number = 120,
    halfTimeStaleSeconds: number = 900,
    limit: number = 50
  ): Promise<StaleMatch[]> {
    const client = await pool.connect();
    try {
      // SQL query with CASE WHEN for status-specific thresholds
      // Use integer multiplication with INTERVAL for safe parameterization
      const query = `
        SELECT
          external_id,
          status_id,
          last_event_ts,
          provider_update_time,
          updated_at
        FROM ts_matches
        WHERE
          status_id IN (2, 3, 4, 5, 7)
          AND match_time <= $1::BIGINT + 3600
          AND (
            last_event_ts IS NULL OR last_event_ts <= $1::BIGINT - CASE WHEN status_id = 3 THEN $3::INTEGER ELSE $2::INTEGER END
            OR provider_update_time IS NULL OR provider_update_time <= $1::BIGINT - CASE WHEN status_id = 3 THEN $3::INTEGER ELSE $2::INTEGER END
            OR updated_at <= NOW() - make_interval(secs => CASE WHEN status_id = 3 THEN $3::INTEGER ELSE $2::INTEGER END)
          )
        ORDER BY updated_at ASC
        LIMIT $4
      `;

      const result = await client.query(query, [nowTs, staleSeconds, halfTimeStaleSeconds, limit]);
      const rows = result.rows;

      // Map rows to StaleMatch with reason assignment
      const staleMatches: StaleMatch[] = rows.map((row) => {
        const threshold = row.status_id === 3 ? halfTimeStaleSeconds : staleSeconds;
        const lastEventTs = row.last_event_ts ? Number(row.last_event_ts) : null;
        const providerUpdateTime = row.provider_update_time ? Number(row.provider_update_time) : null;
        const updatedAt = row.updated_at ? new Date(row.updated_at).toISOString() : '';

        // Determine reason (prioritize last_event_ts, then provider_update_time, then updated_at)
        let reason = '';
        if (lastEventTs === null || lastEventTs <= nowTs - threshold) {
          reason = 'last_event_ts stale';
        } else if (providerUpdateTime === null || providerUpdateTime <= nowTs - threshold) {
          reason = 'provider_update_time stale';
        } else {
          reason = 'updated_at stale';
        }

        return {
          matchId: row.external_id,
          statusId: row.status_id,
          reason,
          lastEventTs,
          providerUpdateTime,
          updatedAt,
        };
      });

      return staleMatches;
    } catch (error: any) {
      logger.error('[Watchdog] Error finding stale matches:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find matches that exceeded maximum expected duration (should have ended)
   *
   * These matches are stuck in live status but minute exceeds normal game time:
   * - status_id = 4 (SECOND_HALF) AND minute > 105 (90 + 15 injury time)
   * - status_id = 5 (OVERTIME) AND minute > 130 (120 + 10 injury time)
   *
   * These need immediate reconciliation to get correct status from API.
   *
   * @param limit - Maximum number of matches to return (default 50)
   * @returns Array of matches that should have ended
   */
  async findOverdueMatches(
    limit: number = 50
  ): Promise<Array<{ matchId: string; statusId: number; minute: number; reason: string }>> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT
          external_id,
          status_id,
          minute
        FROM ts_matches
        WHERE
          (status_id = 4 AND minute > 105)  -- SECOND_HALF exceeded max (90 + 15 injury)
          OR (status_id = 5 AND minute > 130) -- OVERTIME exceeded max (120 + 10 injury)
          OR (status_id = 2 AND minute > 60)  -- FIRST_HALF exceeded max (45 + 15 injury - something is very wrong)
        ORDER BY minute DESC
        LIMIT $1
      `;

      const result = await client.query(query, [limit]);

      return result.rows.map((row: any) => {
        let reason = '';
        if (row.status_id === 4 && row.minute > 105) {
          reason = `SECOND_HALF minute ${row.minute} > 105 (should have ended)`;
        } else if (row.status_id === 5 && row.minute > 130) {
          reason = `OVERTIME minute ${row.minute} > 130 (should have ended)`;
        } else if (row.status_id === 2 && row.minute > 60) {
          reason = `FIRST_HALF minute ${row.minute} > 60 (abnormal)`;
        }

        return {
          matchId: row.external_id,
          statusId: row.status_id,
          minute: row.minute,
          reason,
        };
      });
    } catch (error: any) {
      logger.error('[Watchdog] Error finding overdue matches:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find matches that should be live (match_time passed but status still NOT_STARTED)
   * 
   * These matches need status update from API to transition from NOT_STARTED to LIVE
   * 
   * CRITICAL FIX: For today's matches, we use todayStart (TSİ-aware) instead of maxMinutesAgo
   * to catch ALL today's matches, even if they started many hours ago.
   * 
   * @param nowTs - Current Unix timestamp (seconds)
   * @param maxMinutesAgo - Maximum minutes ago to check (default 1440 = 24 hours for today's matches)
   * @param limit - Maximum number of matches to return (default 50)
   * @returns Array of match IDs that should be live
   */
  async findShouldBeLiveMatches(
    nowTs: number,
    maxMinutesAgo: number = 1440,
    limit: number = 50
  ): Promise<Array<{ matchId: string; matchTime: number; minutesAgo: number }>> {
    const client = await pool.connect();
    try {
      // CRITICAL FIX: Use maxMinutesAgo directly to calculate minimum time
      // This ensures we catch ALL stuck matches from the last N minutes,
      // regardless of which TSI day they started on.
      // Previous logic used TSI-based todayStart which filtered out yesterday's matches.
      const minTime = nowTs - (maxMinutesAgo * 60); // e.g., 1440 min = 24 hours ago

      const query = `
        SELECT 
          external_id as match_id,
          match_time,
          EXTRACT(EPOCH FROM NOW()) - match_time as seconds_ago
        FROM ts_matches
        WHERE match_time <= $1
          AND match_time >= $2  -- Last N minutes (e.g., 24 hours)
          AND status_id = 1  -- NOT_STARTED but match_time has passed
        ORDER BY match_time DESC
        LIMIT $3
      `;

      const result = await client.query(query, [nowTs, minTime, limit]);

      return result.rows.map((row: any) => ({
        matchId: row.match_id,
        matchTime: row.match_time,
        minutesAgo: Math.floor(row.seconds_ago / 60),
      }));
    } finally {
      client.release();
    }
  }
}

