"use strict";
/**
 * H2H Pre-Sync Job
 *
 * Scans today's matches and pre-syncs H2H data for NOT_STARTED matches
 * that don't have H2H data yet. This ensures H2H tab is populated
 * before the match starts.
 *
 * Schedule: Every 30 minutes
 *
 * CRITICAL FIX: TheSports API /match/analysis only works for NOT_STARTED (status=1)
 * matches. This job pre-fetches H2H data before matches start so that
 * the H2H tab has data even during live matches.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runH2HPreSync = runH2HPreSync;
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
const dailyPreSync_service_1 = require("../services/thesports/sync/dailyPreSync.service");
const preSyncService = new dailyPreSync_service_1.DailyPreSyncService();
/**
 * Sync H2H data for today's NOT_STARTED matches that don't have H2H data
 */
async function runH2HPreSync() {
    const client = await connection_1.pool.connect();
    try {
        const now = Math.floor(Date.now() / 1000);
        // Get start and end of today (UTC)
        const dayStart = now - (now % 86400);
        const dayEnd = dayStart + 86400;
        // Find today's NOT_STARTED matches without H2H data
        const result = await client.query(`
      SELECT m.external_id
      FROM ts_matches m
      LEFT JOIN ts_match_h2h h ON m.external_id = h.match_id
      WHERE m.status_id = 1
        AND m.match_time >= $1
        AND m.match_time < $2
        AND h.match_id IS NULL
      ORDER BY m.match_time ASC
      LIMIT 50
    `, [dayStart, dayEnd]);
        if (result.rows.length === 0) {
            logger_1.logger.info('[H2HPreSync] No matches need H2H sync');
            return;
        }
        logger_1.logger.info(`[H2HPreSync] Found ${result.rows.length} matches without H2H data`);
        let synced = 0;
        let failed = 0;
        for (const row of result.rows) {
            try {
                const success = await preSyncService.syncH2HToDb(row.external_id);
                if (success) {
                    synced++;
                    logger_1.logger.info(`[H2HPreSync] Synced H2H for match ${row.external_id}`);
                }
                else {
                    logger_1.logger.debug(`[H2HPreSync] No H2H data available for match ${row.external_id}`);
                }
                // Rate limit: 500ms between requests
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            catch (err) {
                failed++;
                logger_1.logger.warn(`[H2HPreSync] Failed to sync ${row.external_id}: ${err.message}`);
            }
        }
        logger_1.logger.info(`[H2HPreSync] Completed: ${synced} synced, ${failed} failed out of ${result.rows.length} matches`);
    }
    catch (error) {
        logger_1.logger.error(`[H2HPreSync] Job error: ${error.message}`, error);
        throw error;
    }
    finally {
        client.release();
    }
}
