"use strict";
/**
 * Match Freeze Detection Service
 *
 * Phase 4-3: Detects matches that are "stuck" (no provider events) while still LIVE.
 * READ-ONLY detection logic - no DB mutations except via reconcile trigger.
 *
 * CRITICAL INVARIANTS:
 * - Does NOT update minute
 * - Does NOT update updated_at (only via reconcile)
 * - Does NOT override provider_update_time
 * - Does NOT change match status
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchFreezeDetectionService = void 0;
const connection_1 = require("../../../database/connection");
const logger_1 = require("../../../utils/logger");
const obsLogger_1 = require("../../../utils/obsLogger");
class MatchFreezeDetectionService {
    /**
     * Detect stale/frozen matches using deterministic rules
     *
     * Rule 1: LIVE Match Stale (Status 2, 4, 5, 7)
     * - status_id IN (2, 4, 5, 7)
     * - last_event_ts or provider_update_time older than 120s
     *
     * Rule 2: HALF_TIME Stuck (Status 3)
     * - status_id = 3
     * - last_event_ts or provider_update_time older than 900s (15 min)
     *
     * Rule 3: SECOND_HALF No Progress (Status 4)
     * - status_id = 4
     * - minute >= 45 (second half started)
     * - last_event_ts or provider_update_time older than 180s (3 min)
     *
     * @param nowTs - Current Unix timestamp (seconds)
     * @param liveStaleSeconds - Threshold for LIVE matches (default 120)
     * @param halfTimeStaleSeconds - Threshold for HALF_TIME (default 900)
     * @param secondHalfStaleSeconds - Threshold for SECOND_HALF with progress (default 180)
     * @param limit - Maximum matches to return (default 50)
     */
    async detectFrozenMatches(nowTs, liveStaleSeconds = 120, halfTimeStaleSeconds = 900, secondHalfStaleSeconds = 180, limit = 50) {
        const client = await connection_1.pool.connect();
        try {
            // Rule 1 & 2: LIVE + HALF_TIME matches
            const query1 = `
        SELECT
          external_id,
          status_id,
          minute,
          last_event_ts,
          provider_update_time,
          updated_at
        FROM ts_matches
        WHERE
          status_id IN (2, 3, 4, 5, 7)
          AND match_time <= $1::BIGINT + 3600
          AND (
            (status_id IN (2, 4, 5, 7) AND (
              last_event_ts IS NULL OR last_event_ts <= $1::BIGINT - $2::INTEGER
              OR provider_update_time IS NULL OR provider_update_time <= $1::BIGINT - $2::INTEGER
            ))
            OR (status_id = 3 AND (
              last_event_ts IS NULL OR last_event_ts <= $1::BIGINT - $3::INTEGER
              OR provider_update_time IS NULL OR provider_update_time <= $1::BIGINT - $3::INTEGER
            ))
          )
        ORDER BY updated_at ASC
        LIMIT $4
      `;
            const result1 = await client.query(query1, [nowTs, liveStaleSeconds, halfTimeStaleSeconds, limit]);
            const matches1 = result1.rows.map(row => this.mapToFreezeMatch(row, nowTs, liveStaleSeconds, halfTimeStaleSeconds));
            // Rule 3: SECOND_HALF with no progress (minute >= 45 but stale)
            const query2 = `
        SELECT
          external_id,
          status_id,
          minute,
          last_event_ts,
          provider_update_time,
          updated_at
        FROM ts_matches
        WHERE
          status_id = 4
          AND match_time <= $1::BIGINT + 3600
          AND minute IS NOT NULL
          AND minute >= 45
          AND (
            last_event_ts IS NULL OR last_event_ts <= $1::BIGINT - $2::INTEGER
            OR provider_update_time IS NULL OR provider_update_time <= $1::BIGINT - $2::INTEGER
          )
        ORDER BY updated_at ASC
        LIMIT $3
      `;
            const result2 = await client.query(query2, [nowTs, secondHalfStaleSeconds, limit]);
            const matches2 = result2.rows.map(row => this.mapToFreezeMatch(row, nowTs, secondHalfStaleSeconds, halfTimeStaleSeconds));
            // Combine and deduplicate by matchId
            const allMatches = [...matches1, ...matches2];
            const uniqueMatches = new Map();
            for (const match of allMatches) {
                if (!uniqueMatches.has(match.matchId)) {
                    uniqueMatches.set(match.matchId, match);
                }
            }
            return Array.from(uniqueMatches.values()).slice(0, limit);
        }
        catch (error) {
            logger_1.logger.error('[FreezeDetection] Error detecting frozen matches:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Map DB row to FreezeMatch with reason and age calculation
     */
    mapToFreezeMatch(row, nowTs, liveStaleSeconds, halfTimeStaleSeconds) {
        const statusId = row.status_id;
        const threshold = statusId === 3 ? halfTimeStaleSeconds : liveStaleSeconds;
        const lastEventTs = row.last_event_ts ? Number(row.last_event_ts) : null;
        const providerUpdateTime = row.provider_update_time ? Number(row.provider_update_time) : null;
        // Calculate age (time since last event/update)
        let ageSec = 0;
        let reason = '';
        if (lastEventTs === null) {
            ageSec = threshold + 1; // Assume very old if never received
            reason = 'NO_EVENTS';
        }
        else if (lastEventTs <= nowTs - threshold) {
            ageSec = nowTs - lastEventTs;
            reason = 'EVENTS_STALE';
        }
        else if (providerUpdateTime === null) {
            ageSec = threshold + 1;
            reason = 'NO_PROVIDER_UPDATE';
        }
        else if (providerUpdateTime <= nowTs - threshold) {
            ageSec = nowTs - providerUpdateTime;
            reason = 'PROVIDER_UPDATE_STALE';
        }
        else {
            // Should not happen (query should filter these), but handle gracefully
            ageSec = 0;
            reason = 'UNKNOWN';
        }
        return {
            matchId: row.external_id,
            statusId,
            minute: row.minute ? Number(row.minute) : null,
            lastEventTs,
            providerUpdateTime,
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
            reason,
            ageSec,
            thresholdSec: threshold,
        };
    }
    /**
     * Force-end a severely stale match by updating status_id to 8 (ENDED)
     *
     * CRITICAL: Only call this for matches that are:
     * - Stuck for 2+ hours (7200 seconds)
     * - API reconcile returned no data
     * - Still have LIVE status (2, 3, 4, 5, 7)
     *
     * @param matchId - External ID of the match to force-end
     * @returns true if match was updated, false otherwise
     */
    async forceEndStaleMatch(matchId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`UPDATE ts_matches 
         SET status_id = 8, 
             updated_at = NOW(),
             minute_text = 'FT'
         WHERE external_id = $1 
         AND status_id IN (2, 3, 4, 5, 7)
         RETURNING external_id`, [matchId]);
            const updated = result.rowCount !== null && result.rowCount > 0;
            (0, obsLogger_1.logEvent)(updated ? 'warn' : 'debug', 'match.stale.force_ended', {
                match_id: matchId,
                updated,
                new_status: 8,
            });
            if (updated) {
                logger_1.logger.info(`[FreezeDetection] Force-ended stale match: ${matchId}`);
            }
            return updated;
        }
        catch (error) {
            logger_1.logger.error(`[FreezeDetection] Error force-ending match ${matchId}:`, error);
            throw error;
        }
        finally {
            client.release();
        }
    }
}
exports.MatchFreezeDetectionService = MatchFreezeDetectionService;
