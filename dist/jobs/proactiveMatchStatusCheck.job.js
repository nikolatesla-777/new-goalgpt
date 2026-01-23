"use strict";
/**
 * Proactive Match Status Check Worker
 *
 * CRITICAL FIX: Normal akış çalışmadığı için proaktif kontrol
 *
 * Sorun:
 * - /data/update çalışmıyor (IP whitelist)
 * - /match/recent/list boş dönüyor (bazı maçlar "recent" değil)
 * - WebSocket bazı maçlar için mesaj göndermiyor
 *
 * Çözüm:
 * - Bugünkü tüm maçları periyodik olarak kontrol et
 * - match_time geçmiş + status hala NOT_STARTED olanları tespit et
 * - /match/detail_live ile güncel durumu çek ve DB'yi güncelle
 *
 * Bu, normal akışın çalışmadığı durumlar için "proaktif" bir mekanizma
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProactiveMatchStatusCheckWorker = void 0;
const matchDetailLive_service_1 = require("../services/thesports/match/matchDetailLive.service");
const TheSportsAPIManager_1 = require("../core/TheSportsAPIManager"); // Phase 3A: Singleton migration
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class ProactiveMatchStatusCheckWorker {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.client = TheSportsAPIManager_1.theSportsAPI; // Phase 3A: Use singleton
        this.matchDetailLiveService = new matchDetailLive_service_1.MatchDetailLiveService();
    }
    /**
     * Check today's matches that should be live but status is still NOT_STARTED
     */
    async checkTodayMatches() {
        if (this.isRunning) {
            logger_1.logger.debug('[ProactiveCheck] Already running, skipping');
            return;
        }
        this.isRunning = true;
        const startedAt = Date.now();
        let client = null;
        try {
            const nowTs = Math.floor(Date.now() / 1000);
            // TSİ-based today start (UTC-3 hours)
            const TSI_OFFSET_SECONDS = 3 * 3600;
            const nowDate = new Date(nowTs * 1000);
            const year = nowDate.getUTCFullYear();
            const month = nowDate.getUTCMonth();
            const day = nowDate.getUTCDate();
            const todayStartTSI = Math.floor((Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000) / 1000);
            const todayEndTSI = todayStartTSI + 86400; // 24 hours later
            // Find matches that should be checked via endpoint:
            // 1. NOT_STARTED (1) but match_time has passed - should be LIVE
            // 2. END (8) but match_time is less than 150 minutes ago - suspicious, verify via endpoint
            client = await connection_1.pool.connect();
            try {
                const minTimeForEnd = nowTs - (150 * 60); // 150 minutes ago
                const query = `
          SELECT 
            external_id,
            match_time,
            status_id,
            provider_update_time,
            last_event_ts
          FROM ts_matches
          WHERE match_time >= $1
            AND match_time < $2
            AND (
              -- Case 1: NOT_STARTED but match_time passed - should be LIVE
              (status_id = 1 AND match_time <= $3)
              OR
              -- Case 2: END but match_time is suspiciously recent (< 150 min ago)
              (status_id = 8 AND match_time >= $4)
            )
          ORDER BY match_time ASC
          LIMIT 200
        `;
                const result = await client.query(query, [todayStartTSI, todayEndTSI, nowTs, minTimeForEnd]);
                const matches = result.rows;
                if (matches.length === 0) {
                    logger_1.logger.debug('[ProactiveCheck] No matches to check');
                    return;
                }
                const notStartedCount = matches.filter(m => m.status_id === 1).length;
                const suspiciousEndCount = matches.filter(m => m.status_id === 8).length;
                logger_1.logger.info(`[ProactiveCheck] Found ${matches.length} matches to check via endpoint: ` +
                    `${notStartedCount} NOT_STARTED (should be live), ${suspiciousEndCount} suspicious END (verify via endpoint)`);
                let checkedCount = 0;
                let updatedCount = 0;
                let errorCount = 0;
                for (const match of matches) {
                    try {
                        checkedCount++;
                        const minutesAgo = Math.floor((nowTs - match.match_time) / 60);
                        const checkReason = match.status_id === 1
                            ? 'should_be_live'
                            : 'suspicious_end_verify_via_endpoint';
                        (0, obsLogger_1.logEvent)('info', 'proactive.check.start', {
                            match_id: match.external_id,
                            match_time: match.match_time,
                            minutes_ago: minutesAgo,
                            current_status_id: match.status_id,
                            reason: checkReason,
                        });
                        // Perform authoritative detail_live reconciliation
                        let reconcileResult = await this.matchDetailLiveService.reconcileMatchToDatabase(match.external_id, null);
                        // NOTE: Diary fallback removed here because DailyMatchSyncWorker now syncs today's diary every 5 minutes globally.
                        // This prevents redundant and rate-limited API calls within this loop.
                        if (reconcileResult.rowCount > 0) {
                            updatedCount++;
                            (0, obsLogger_1.logEvent)('info', 'proactive.check.success', {
                                match_id: match.external_id,
                                minutes_ago: minutesAgo,
                                row_count: reconcileResult.rowCount,
                                source: reconcileResult.rowCount > 0 ? 'detail_live_or_diary' : 'none',
                            });
                        }
                        else {
                            (0, obsLogger_1.logEvent)('info', 'proactive.check.no_update', {
                                match_id: match.external_id,
                                minutes_ago: minutesAgo,
                                reason: 'no_update_from_detail_live_or_diary',
                            });
                        }
                        // Throttle: 200ms between API calls
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    catch (error) {
                        errorCount++;
                        logger_1.logger.error(`[ProactiveCheck] Error checking match ${match.external_id}:`, error);
                        (0, obsLogger_1.logEvent)('error', 'proactive.check.error', {
                            match_id: match.external_id,
                            error_message: error.message || 'Unknown error',
                        });
                    }
                }
                const duration = Date.now() - startedAt;
                logger_1.logger.info(`[ProactiveCheck] Completed: ${checkedCount} checked, ${updatedCount} updated, ${errorCount} errors (${duration}ms)`);
                (0, obsLogger_1.logEvent)('info', 'proactive.check.summary', {
                    checked_count: checkedCount,
                    updated_count: updatedCount,
                    error_count: errorCount,
                    duration_ms: duration,
                });
            }
            finally {
                if (client) {
                    client.release();
                }
            }
        }
        catch (error) {
            logger_1.logger.error('[ProactiveCheck] Fatal error:', error);
            (0, obsLogger_1.logEvent)('error', 'proactive.check.fatal', {
                error_message: error.message || 'Unknown error',
                error_stack: error.stack,
            });
        }
        finally {
            // CRITICAL FIX: Always reset isRunning flag, even if error occurred
            this.isRunning = false;
            logger_1.logger.debug('[ProactiveCheck] Reset isRunning flag');
        }
    }
    /**
     * Start the worker
     * Runs every 20 seconds to proactively check today's matches (more aggressive)
     */
    start() {
        if (this.intervalId) {
            logger_1.logger.warn('[ProactiveCheck] Already started');
            return;
        }
        // CRITICAL FIX: Run every 10 seconds (very aggressive for real-time updates)
        // This ensures matches start and end as quickly as possible
        this.intervalId = setInterval(() => {
            this.checkTodayMatches().catch(err => {
                logger_1.logger.error('[ProactiveCheck] Interval error:', err);
            });
        }, 10000); // 10 seconds (was 20, more aggressive)
        // Run immediately on start
        setTimeout(() => {
            this.checkTodayMatches().catch(err => {
                logger_1.logger.error('[ProactiveCheck] Initial run error:', err);
            });
        }, 5000); // Wait 5 seconds after startup
        logger_1.logger.info('[ProactiveCheck] Worker started (20s interval)');
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'ProactiveMatchStatusCheckWorker',
            interval_sec: 20,
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger_1.logger.info('[ProactiveCheck] Worker stopped');
        }
    }
}
exports.ProactiveMatchStatusCheckWorker = ProactiveMatchStatusCheckWorker;
