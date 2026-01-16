
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
   * - status_id = 3 (HALF_TIME) → halfTimeStaleSeconds (default 300, reduced from 900)
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
    halfTimeStaleSeconds: number = 300,  // CRITICAL FIX (2026-01-15): Reduced from 900 to 300
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
   * CRITICAL FIX (2026-01-13): Also detect KICKOFF TIMESTAMP MISMATCH anomalies:
   * - status_id = 2 (FIRST_HALF) but second_half_kickoff_ts IS NOT NULL → should be status 4!
   * - status_id = 3 (HALF_TIME) but elapsed time > 60 minutes → match should have progressed
   * - status_id = 2 (FIRST_HALF) and elapsed time > 75 minutes → definitely past 1H
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
      const nowTs = Math.floor(Date.now() / 1000);

      const query = `
        SELECT
          external_id,
          status_id,
          minute,
          match_time,
          second_half_kickoff_ts,
          ($1::integer - match_time) / 60 as elapsed_minutes
        FROM ts_matches
        WHERE
          -- Original checks: minute exceeded max
          (status_id = 4 AND minute > 100)  -- SECOND_HALF exceeded max (90 + 10 injury)
          OR (status_id = 5 AND minute > 130) -- OVERTIME exceeded max (120 + 10 injury)
          OR (status_id = 2 AND minute > 60)  -- FIRST_HALF exceeded max
          OR (status_id = 3 AND minute > 60)  -- HALF_TIME with minute > 60 is stuck
          
          -- CRITICAL FIX: KICKOFF TIMESTAMP MISMATCH DETECTION
          -- status_id = 2 (FIRST_HALF) but second_half_kickoff_ts exists → should be 4!
          OR (status_id = 2 AND second_half_kickoff_ts IS NOT NULL)
          
          -- status_id = 3 (HALF_TIME) but elapsed > 60min since match_time → stuck at HT
          OR (status_id = 3 AND ($1::integer - match_time) > 3600)
          
          -- status_id = 2 (FIRST_HALF) but elapsed > 75min → definitely past 1H
          OR (status_id = 2 AND ($1::integer - match_time) > 4500)
        ORDER BY 
          CASE 
            WHEN status_id = 2 AND second_half_kickoff_ts IS NOT NULL THEN 0  -- Highest priority: kickoff mismatch
            WHEN status_id = 2 AND ($1::integer - match_time) > 4500 THEN 1   -- Second: elapsed time anomaly
            ELSE 2
          END,
          minute DESC
        LIMIT $2
      `;

      const result = await client.query(query, [nowTs, limit]);

      return result.rows.map((row: any) => {
        let reason = '';
        const elapsedMinutes = Math.floor((nowTs - row.match_time) / 60);

        // KICKOFF MISMATCH (highest priority)
        if (row.status_id === 2 && row.second_half_kickoff_ts) {
          reason = `CRITICAL ANOMALY: status=2 (1H) but second_half_kickoff_ts exists! Elapsed ${elapsedMinutes} min. Should be status=4 (2H)`;
        }
        // ELAPSED TIME ANOMALY for 1H
        else if (row.status_id === 2 && elapsedMinutes > 75) {
          reason = `ANOMALY: status=2 (1H) but elapsed ${elapsedMinutes} min > 75. Match stuck.`;
        }
        // ELAPSED TIME ANOMALY for HT
        else if (row.status_id === 3 && elapsedMinutes > 60) {
          reason = `ANOMALY: status=3 (HT) but elapsed ${elapsedMinutes} min > 60. HT stuck too long.`;
        }
        // Original minute-based checks
        else if (row.status_id === 4 && row.minute > 100) {
          reason = `SECOND_HALF minute ${row.minute} > 100 (should have ended)`;
        } else if (row.status_id === 5 && row.minute > 130) {
          reason = `OVERTIME minute ${row.minute} > 130 (should have ended)`;
        } else if (row.status_id === 2 && row.minute > 60) {
          reason = `FIRST_HALF minute ${row.minute} > 60 (abnormal)`;
        } else if (row.status_id === 3 && row.minute > 60) {
          reason = `HALF_TIME minute ${row.minute} > 60 (CRITICAL: HT stuck while minute advances)`;
        }

        return {
          matchId: row.external_id,
          statusId: row.status_id,
          minute: row.minute ?? 0,
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

  /**
   * Find matches that JUST started (match_time passed within last N seconds)
   * 
   * CRITICAL FIX (2026-01-13): Proactive Kickoff Detection
   * Instead of waiting for TheSports API/MQTT to tell us match started,
   * we proactively transition status=1 → status=2 when match_time passes.
   * 
   * This eliminates the 5+ minute delay for minor league matches where
   * MQTT doesn't send kickoff events and API is slow to update.
   * 
   * @param nowTs - Current Unix timestamp (seconds)
   * @param windowSeconds - How far back to check (default 120s = 2 minutes window)
   * @param limit - Maximum matches to return
   * @returns Array of matches that just kicked off but are still status=1
   */
  async findImmediateKickoffs(
    nowTs: number,
    windowSeconds: number = 120,
    limit: number = 100
  ): Promise<Array<{ matchId: string; matchTime: number; secondsSinceKickoff: number }>> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          external_id as match_id,
          match_time,
          $1::integer - match_time as seconds_since_kickoff
        FROM ts_matches
        WHERE status_id = 1  -- Still marked as NOT_STARTED
          AND match_time <= $1  -- Kickoff time has passed
          AND match_time > $1 - $2  -- Within the window (last N seconds)
        ORDER BY match_time DESC
        LIMIT $3
      `;

      const result = await client.query(query, [nowTs, windowSeconds, limit]);

      return result.rows.map((row: any) => ({
        matchId: row.match_id,
        matchTime: row.match_time,
        secondsSinceKickoff: Math.floor(row.seconds_since_kickoff),
      }));
    } catch (error: any) {
      logger.error('[Watchdog] Error finding immediate kickoffs:', error);
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Find matches that should have FINISHED but are still marked live
   * 
   * CRITICAL FIX (2026-01-13): Proactive Match Finish Detection
   * Just like proactive kickoff detection, we proactively transition
   * status (2,3,4,5,7) → status=8 when match should have ended.
   * 
   * This eliminates the problem where MQTT/API never sends finish event
   * for minor league matches (e.g., Indonesia WC stuck at 90+10' forever).
   * 
   * CRITERIA for forcing finish:
   * 1. Match is live (status 2,3,4,5,7)
   * 2. Either:
   *    a) match_time + 130 minutes has passed (absolute timeout), OR
   *    b) minute >= 90 AND no update in last 15 minutes (stale finish)
   * 
   * @param nowTs - Current Unix timestamp (seconds)
   * @param limit - Maximum matches to return
   * @returns Array of matches that should be finished
   */
  async findOverdueFinishes(
    nowTs: number,
    limit: number = 100
  ): Promise<Array<{
    matchId: string;
    matchTime: number;
    minute: number;
    statusId: number;
    secondsSinceKickoff: number;
    secondsSinceUpdate: number;
    reason: 'absolute_timeout' | 'stale_finish';
    homeScore: number;
    awayScore: number;
  }>> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT
          external_id as match_id,
          match_time,
          minute,
          status_id,
          $1::integer - match_time as seconds_since_kickoff,
          EXTRACT(EPOCH FROM (NOW() - updated_at))::integer as seconds_since_update,
          home_scores[1] as home_score,
          away_scores[1] as away_score,
          CASE
            -- CRITICAL FIX (2026-01-15): Reduced from 7800 (130min) to 6300 (105min = 90 + 15 HT)
            WHEN $1::integer - match_time > 6300 THEN 'absolute_timeout'
            WHEN minute >= 95 THEN 'minute_exceeded'
            ELSE 'stale_finish'
          END as reason
        FROM ts_matches
        WHERE
          status_id IN (2, 3, 4, 5, 7)
          AND (
            $1::integer - match_time > 6300
            OR
            minute >= 95
            OR
            (minute >= 90 AND EXTRACT(EPOCH FROM (NOW() - updated_at)) > 600)
          )
        ORDER BY match_time ASC
        LIMIT $2
      `;

      const result = await client.query(query, [nowTs, limit]);

      return result.rows.map((row: any) => ({
        matchId: row.match_id,
        matchTime: row.match_time,
        minute: row.minute ?? 90,
        statusId: row.status_id,
        secondsSinceKickoff: Math.floor(row.seconds_since_kickoff),
        secondsSinceUpdate: Math.floor(row.seconds_since_update),
        reason: row.reason,
        homeScore: row.home_score ?? 0,
        awayScore: row.away_score ?? 0,
      }));
    } catch (error: any) {
      logger.error('[Watchdog] Error finding overdue finishes:', error);
      return [];
    } finally {
      client.release();
    }
  }
}

