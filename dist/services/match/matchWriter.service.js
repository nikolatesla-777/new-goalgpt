"use strict";
/**
 * MatchWriterService - Centralized Match Database Writer
 *
 * This service provides a SINGLE ENTRY POINT for all match database writes.
 * Benefits:
 * - Timestamp-based conflict resolution
 * - Automatic WebSocket broadcasting
 * - Automatic settlement triggering
 * - Observability and logging
 *
 * MIGRATION STRATEGY:
 * - New code should use this service
 * - Existing code will be migrated gradually
 * - Service handles backward compatibility
 *
 * SOURCES:
 * - 'mqtt': Real-time WebSocket data (highest priority for live matches)
 * - 'api': TheSports API calls (detail_live, /data/update)
 * - 'watchdog': Emergency fix for stuck matches
 * - 'manual': Admin manual corrections
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchWriterService = void 0;
exports.setOnMatchUpdated = setOnMatchUpdated;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const obsLogger_1 = require("../../utils/obsLogger");
const predictionSettlement_service_1 = require("../ai/predictionSettlement.service");
// Callback for WebSocket broadcast
let onMatchUpdated = null;
function setOnMatchUpdated(callback) {
    onMatchUpdated = callback;
}
// ============================================================================
// MATCH WRITER SERVICE
// ============================================================================
class MatchWriterService {
    constructor() {
        this.writeCount = 0;
        this.skipCount = 0;
    }
    /**
     * Main entry point for all match database writes
     *
     * @param update - Match data to write
     * @param source - Source of the update (mqtt, api, watchdog, manual)
     * @returns WriteResult indicating success/skip status
     */
    async write(update, source) {
        const startTime = Date.now();
        try {
            // 1. Validation
            if (!update.matchId) {
                return { success: false, updated: false, skipped: true, reason: 'missing_match_id' };
            }
            // 2. Build dynamic SET clauses
            const setClauses = [];
            const values = [];
            let paramIndex = 1;
            // Status
            if (update.statusId !== undefined) {
                setClauses.push(`status_id = $${paramIndex}, status_id_source = $${paramIndex + 1}, status_id_timestamp = $${paramIndex + 2}`);
                values.push(update.statusId, source, Math.floor(Date.now() / 1000));
                paramIndex += 3;
            }
            // Scores (display)
            if (update.homeScore !== undefined) {
                setClauses.push(`home_score_display = $${paramIndex}, home_score_source = $${paramIndex + 1}, home_score_timestamp = $${paramIndex + 2}`);
                values.push(update.homeScore, source, Math.floor(Date.now() / 1000));
                paramIndex += 3;
            }
            if (update.awayScore !== undefined) {
                setClauses.push(`away_score_display = $${paramIndex}, away_score_source = $${paramIndex + 1}, away_score_timestamp = $${paramIndex + 2}`);
                values.push(update.awayScore, source, Math.floor(Date.now() / 1000));
                paramIndex += 3;
            }
            // Minute
            if (update.minute !== undefined) {
                setClauses.push(`minute = $${paramIndex}, minute_source = $${paramIndex + 1}, minute_timestamp = $${paramIndex + 2}`);
                values.push(update.minute, source, Math.floor(Date.now() / 1000));
                paramIndex += 3;
            }
            // Score arrays (TheSports format)
            if (update.homeScores) {
                setClauses.push(`home_scores = $${paramIndex}::jsonb`);
                values.push(JSON.stringify(update.homeScores));
                paramIndex++;
            }
            if (update.awayScores) {
                setClauses.push(`away_scores = $${paramIndex}::jsonb`);
                values.push(JSON.stringify(update.awayScores));
                paramIndex++;
            }
            // Ended flag
            if (update.ended !== undefined) {
                setClauses.push(`ended = $${paramIndex}`);
                values.push(update.ended);
                paramIndex++;
            }
            // Provider update time
            if (update.providerUpdateTime) {
                setClauses.push(`provider_update_time = GREATEST(COALESCE(provider_update_time, 0), $${paramIndex})`);
                values.push(update.providerUpdateTime);
                paramIndex++;
            }
            // Always update timestamp
            setClauses.push(`updated_at = NOW()`);
            setClauses.push(`last_updated_by = $${paramIndex}`);
            values.push(source);
            paramIndex++;
            setClauses.push(`last_updated_at = $${paramIndex}`);
            values.push(Math.floor(Date.now() / 1000));
            paramIndex++;
            // Add matchId for WHERE clause
            values.push(update.matchId);
            // 3. Execute query with optimistic locking
            const query = `
        UPDATE ts_matches
        SET ${setClauses.join(', ')}
        WHERE external_id = $${paramIndex}
          AND (
            last_updated_at IS NULL
            OR last_updated_at < $${paramIndex - 1}
            OR $${paramIndex - 2}::VARCHAR IN ('watchdog', 'manual')
          )
        RETURNING *
      `;
            const result = await connection_1.pool.query(query, values);
            if (result.rowCount === 0) {
                // Check if match exists
                const existsCheck = await connection_1.pool.query('SELECT external_id, last_updated_at, last_updated_by FROM ts_matches WHERE external_id = $1', [update.matchId]);
                if (existsCheck.rows.length === 0) {
                    this.skipCount++;
                    return { success: false, updated: false, skipped: true, reason: 'match_not_found' };
                }
                // Match exists but update was stale
                this.skipCount++;
                logger_1.logger.debug(`[MatchWriter] Skipped stale update for ${update.matchId} from ${source}`);
                return { success: true, updated: false, skipped: true, reason: 'stale_update' };
            }
            const updatedMatch = result.rows[0];
            this.writeCount++;
            // 4. Log the write
            const duration = Date.now() - startTime;
            logger_1.logger.debug(`[MatchWriter] Updated ${update.matchId} from ${source}: ` +
                `status=${update.statusId}, score=${update.homeScore}-${update.awayScore}, ` +
                `minute=${update.minute} [${duration}ms]`);
            (0, obsLogger_1.logEvent)('info', 'match.write', {
                match_id: update.matchId,
                source,
                status_id: update.statusId,
                score: update.homeScore !== undefined ? `${update.homeScore}-${update.awayScore}` : null,
                minute: update.minute,
                duration_ms: duration,
            });
            // 5. WebSocket broadcast (non-blocking)
            if (onMatchUpdated) {
                try {
                    onMatchUpdated(updatedMatch, source);
                }
                catch (err) {
                    logger_1.logger.warn(`[MatchWriter] Broadcast failed for ${update.matchId}: ${err.message}`);
                }
            }
            // 6. Trigger settlement if needed (non-blocking)
            this.triggerSettlementIfNeeded(update, updatedMatch);
            return { success: true, updated: true, skipped: false, match: updatedMatch };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            logger_1.logger.error(`[MatchWriter] Error writing ${update.matchId} from ${source}: ${error.message} [${duration}ms]`);
            return { success: false, updated: false, skipped: false, reason: error.message };
        }
    }
    /**
     * Batch write multiple matches (for sync jobs)
     */
    async writeBatch(updates, source) {
        let success = 0, failed = 0, skipped = 0;
        for (const update of updates) {
            const result = await this.write(update, source);
            if (result.updated)
                success++;
            else if (result.skipped)
                skipped++;
            else
                failed++;
        }
        logger_1.logger.info(`[MatchWriter] Batch write complete: ${success} updated, ${skipped} skipped, ${failed} failed`);
        return { success, failed, skipped };
    }
    /**
     * Force write without timestamp check (for watchdog/manual)
     */
    async forceWrite(update, source) {
        // Force write uses the same method but source type bypasses timestamp check
        return this.write(update, source);
    }
    /**
     * Trigger settlement based on match state change
     */
    triggerSettlementIfNeeded(update, match) {
        // Only trigger for status changes with scores
        if (update.statusId === undefined || update.homeScore === undefined) {
            return;
        }
        // Halftime settlement (status 3)
        if (update.statusId === 3) {
            predictionSettlement_service_1.predictionSettlementService.processEvent({
                matchId: update.matchId,
                eventType: 'halftime',
                homeScore: update.homeScore,
                awayScore: update.awayScore ?? 0,
                minute: 45,
                timestamp: Date.now(),
            }).catch(err => logger_1.logger.warn(`[MatchWriter] Settlement error: ${err.message}`));
        }
        // Fulltime settlement (status 8)
        if (update.statusId === 8) {
            predictionSettlement_service_1.predictionSettlementService.processEvent({
                matchId: update.matchId,
                eventType: 'fulltime',
                homeScore: update.homeScore,
                awayScore: update.awayScore ?? 0,
                htHome: update.htHomeScore,
                htAway: update.htAwayScore,
                minute: 90,
                timestamp: Date.now(),
            }).catch(err => logger_1.logger.warn(`[MatchWriter] Settlement error: ${err.message}`));
        }
        // Score change (live matches)
        if ([2, 3, 4, 5, 7].includes(update.statusId)) {
            predictionSettlement_service_1.predictionSettlementService.processEvent({
                matchId: update.matchId,
                eventType: 'score_change',
                homeScore: update.homeScore,
                awayScore: update.awayScore ?? 0,
                minute: update.minute ?? undefined,
                statusId: update.statusId,
                timestamp: Date.now(),
            }).catch(err => logger_1.logger.warn(`[MatchWriter] Settlement error: ${err.message}`));
        }
    }
    /**
     * Get service statistics
     */
    getStats() {
        return { writeCount: this.writeCount, skipCount: this.skipCount };
    }
}
// Singleton export
exports.matchWriterService = new MatchWriterService();
