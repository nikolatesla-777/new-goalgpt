"use strict";
/**
 * Match Minute Worker
 *
 * Background job to calculate and update match minutes for live matches.
 * Runs every 30 seconds, processes 100 matches per tick.
 *
 * CRITICAL: Minute Engine does NOT use time-based thresholds.
 * Minute updates only when value changes (new_minute !== existing_minute).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchMinuteWorker = void 0;
const connection_1 = require("../database/connection");
const matchMinute_service_1 = require("../services/thesports/match/matchMinute.service");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
const websocket_routes_1 = require("../routes/websocket.routes");
const JobRunner_1 = require("./framework/JobRunner");
const lockKeys_1 = require("./lockKeys");
class MatchMinuteWorker {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.matchMinuteService = new matchMinute_service_1.MatchMinuteService();
    }
    /**
     * Process a batch of matches and update their minutes
     * @param batchSize - Maximum number of matches to process (default: 100)
     *
     * PR-8A: Wrapped with JobRunner for overlap guard + timeout + metrics
     */
    async tick(batchSize = 100) {
        if (this.isRunning) {
            logger_1.logger.debug('[MinuteEngine] Tick already running, skipping this run');
            return;
        }
        this.isRunning = true;
        const startedAt = Date.now();
        try {
            // PR-8A: Wrap execution with JobRunner (no SQL logic changes)
            await JobRunner_1.jobRunner.run({
                jobName: 'matchMinute',
                overlapGuard: true,
                advisoryLockKey: lockKeys_1.LOCK_KEYS.MATCH_MINUTE,
                timeoutMs: 120000, // 2 minutes
            }, async (_ctx) => {
                // Original tick() logic unchanged below this line
                const nowTs = Math.floor(Date.now() / 1000);
                // Query matches with status IN (2,3,4,5,7)
                // NO time-based threshold filter (no last_minute_update_ts gating)
                // NO minute IS NULL filter (minute can progress after initial calculation)
                const client = await connection_1.pool.connect();
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
                        logger_1.logger.debug('[MinuteEngine] No live matches to process');
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
                            logger_1.logger.debug(`[MinuteEngine] skipped match_id=${matchId} reason=recently_updated_by_api (${secondsAgo}s ago) - using API minute`);
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
                        const newMinute = this.matchMinuteService.calculateMinute(statusId, firstHalfKickoffTs, secondHalfKickoffTs, overtimeKickoffTs, existingMinute, nowTs);
                        // If calculation returned null (missing kickoff_ts), skip
                        if (newMinute === null) {
                            if (existingMinute === null) {
                                logger_1.logger.debug(`[MinuteEngine] skipped match_id=${matchId} reason=missing kickoff_ts`);
                            }
                            else {
                                logger_1.logger.debug(`[MinuteEngine] skipped match_id=${matchId} reason=missing kickoff_ts (preserving existing minute=${existingMinute})`);
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
                                logger_1.logger.debug(`[MinuteEngine] Updated ${matchId}: minute ${existingMinute} → ${newMinute}`);
                                // CRITICAL FIX: Broadcast MINUTE_UPDATE event to frontend
                                // This ensures real-time minute progression without page refresh
                                try {
                                    (0, websocket_routes_1.broadcastEvent)({
                                        type: 'MINUTE_UPDATE',
                                        matchId,
                                        minute: newMinute,
                                        statusId: statusId || 2, // Use actual status or default to FIRST_HALF
                                        timestamp: Date.now(),
                                    });
                                }
                                catch (broadcastError) {
                                    logger_1.logger.warn(`[MinuteEngine] Failed to broadcast minute update for ${matchId}: ${broadcastError.message}`);
                                }
                            }
                            catch (error) {
                                logger_1.logger.error(`[MinuteEngine] Failed to update ${matchId}:`, error);
                                skippedCount++;
                            }
                        }
                        else {
                            skippedCount++;
                        }
                    }
                    (0, obsLogger_1.logEvent)('debug', 'minute.tick', {
                        processed_count: matches.length,
                        updated_count: updatedCount,
                        skipped_recently_updated: skippedRecentlyUpdated,
                    });
                    logger_1.logger.info(`[MinuteEngine] tick: processed ${matches.length} matches, updated ${updatedCount}, skipped ${skippedCount} (recently_updated: ${skippedRecentlyUpdated}) (${Date.now() - startedAt}ms)`);
                    logger_1.logger.info(`[MinuteEngine] NOTE: does NOT update updated_at; only minute + last_minute_update_ts`);
                }
                finally {
                    client.release();
                }
            } // PR-8A: End jobRunner.run() wrapper
            ); // PR-8A: Close jobRunner.run()
        }
        catch (error) {
            logger_1.logger.error('[MinuteEngine] Error in tick:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Start the worker
     * Calculates minutes from kickoff timestamps every 30 seconds.
     * Fallback when WebSocket/detail_live is unavailable.
     */
    start() {
        if (this.intervalId) {
            logger_1.logger.warn('Match minute worker already started');
            return;
        }
        logger_1.logger.info('[MinuteEngine] ENABLED: Calculating minutes from kickoff timestamps');
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
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
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger_1.logger.info('Match minute worker stopped');
        }
    }
}
exports.MatchMinuteWorker = MatchMinuteWorker;
