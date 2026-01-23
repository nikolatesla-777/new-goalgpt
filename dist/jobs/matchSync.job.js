"use strict";
/**
 * Match Sync Worker
 *
 * Background job to sync matches using incremental sync
 * Uses /match/recent/list with time parameter
 * Runs every 1 minute
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchSyncWorker = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const TheSportsAPIManager_1 = require("../core/TheSportsAPIManager"); // Phase 3A: Singleton migration
const recentSync_service_1 = require("../services/thesports/match/recentSync.service");
const matchSync_service_1 = require("../services/thesports/match/matchSync.service");
const teamData_service_1 = require("../services/thesports/team/teamData.service");
const competition_service_1 = require("../services/thesports/competition/competition.service");
const logger_1 = require("../utils/logger");
const matchDetailLive_service_1 = require("../services/thesports/match/matchDetailLive.service");
const connection_1 = require("../database/connection");
const obsLogger_1 = require("../utils/obsLogger");
const aiPrediction_service_1 = require("../services/ai/aiPrediction.service");
const predictionSettlement_service_1 = require("../services/ai/predictionSettlement.service");
const matchStats_repository_1 = require("../repositories/matchStats.repository");
const websocket_routes_1 = require("../routes/websocket.routes");
const matchDetailSync_service_1 = require("../services/thesports/match/matchDetailSync.service");
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
class MatchSyncWorker {
    constructor() {
        this.isRunning = false;
        this.cronJob = null;
        this.liveInterval = null;
        this.firstHalfInterval = null;
        this.secondHalfInterval = null;
        this.halfTimeInterval = null;
        // LIVE reconcile queue (dedup) + backpressure controls
        this.reconcileQueue = new Set();
        this.isReconciling = false;
        this.liveTickInterval = null;
        this.predictionResultInterval = null;
        this.matchDetailSyncInterval = null; // Match Detail page sync
        // Reconcile backpressure constants
        this.RECONCILE_BATCH_LIMIT = 15;
        this.RECONCILE_DELAY_MS = 50; // fast updates (50ms per API call)
        // TheSports status buckets (adjust if your enums differ)
        // LIVE phases: first/second half, halftime, overtime, penalties
        this.LIVE_STATUS_IDS = [2, 3, 4, 5, 7];
        // HALF_TIME is special: minute should not "run", but status/score can still change.
        this.HALFTIME_STATUS_IDS = [3];
        // SECOND_HALF matches need more frequent checks for END transition (FT detection)
        this.SECOND_HALF_STATUS_IDS = [4];
        // FIRST_HALF matches need frequent checks for HALF_TIME transition (status 2 → 3)
        this.FIRST_HALF_STATUS_IDS = [2];
        this.client = TheSportsAPIManager_1.theSportsAPI; // Phase 3A: Use singleton
        // Initialize MatchSyncService for RecentSyncService
        const teamDataService = new teamData_service_1.TeamDataService();
        const competitionService = new competition_service_1.CompetitionService();
        const matchSyncService = new matchSync_service_1.MatchSyncService(teamDataService, competitionService);
        this.recentSyncService = new recentSync_service_1.RecentSyncService(matchSyncService);
        this.matchDetailLiveService = new matchDetailLive_service_1.MatchDetailLiveService();
        this.aiPredictionService = new aiPrediction_service_1.AIPredictionService();
    }
    /**
     * REFACTOR: Direct database write helper (replaces orchestrator.updateMatch)
     */
    async updateMatchDirect(matchId, updates, source) {
        if (updates.length === 0) {
            return { status: 'success', fieldsUpdated: [] };
        }
        try {
            // CRITICAL FIX: Protect finished matches from being overridden
            // Once status=8, it should be IMMUTABLE (unless update also has status=8)
            const statusUpdate = updates.find(u => u.field === 'status_id');
            if (statusUpdate && statusUpdate.value !== 8) {
                const checkQuery = `SELECT status_id FROM ts_matches WHERE external_id = $1`;
                const checkResult = await connection_1.pool.query(checkQuery, [matchId]);
                const existing = checkResult.rows[0];
                if (existing?.status_id === 8) {
                    logger_1.logger.warn(`[MatchSync.directWrite] REJECT: Match ${matchId} already finished (status=8 immutable). Attempted change to status=${statusUpdate.value}`);
                    return { status: 'rejected_immutable', fieldsUpdated: [] };
                }
            }
            const setClauses = [];
            const values = [];
            let paramIndex = 1;
            const fieldsUpdated = [];
            for (const update of updates) {
                setClauses.push(`${update.field} = $${paramIndex}`);
                values.push(update.value);
                fieldsUpdated.push(update.field);
                paramIndex++;
                // Map field names to correct source column names
                const sourceColumnMap = {
                    'home_score_display': 'home_score_source',
                    'away_score_display': 'away_score_source',
                    'status_id': 'status_id_source',
                    'minute': 'minute_source',
                };
                const sourceColumn = sourceColumnMap[update.field];
                if (sourceColumn) {
                    setClauses.push(`${sourceColumn} = $${paramIndex}`);
                    values.push(update.source);
                    paramIndex++;
                    setClauses.push(`${sourceColumn.replace('_source', '_timestamp')} = $${paramIndex}`);
                    values.push(update.timestamp);
                    paramIndex++;
                }
            }
            setClauses.push(`updated_at = NOW()`);
            const query = `UPDATE ts_matches SET ${setClauses.join(', ')} WHERE external_id = $${paramIndex}`;
            values.push(matchId);
            await connection_1.pool.query(query, values);
            // CRITICAL FIX: Broadcast WebSocket events after database write
            // This ensures frontend receives real-time updates even when data comes from API (not MQTT)
            const hasScoreUpdate = fieldsUpdated.some(f => f === 'home_score_display' || f === 'away_score_display');
            const hasStatusUpdate = fieldsUpdated.some(f => f === 'status_id');
            const hasMinuteUpdate = fieldsUpdated.some(f => f === 'minute');
            try {
                if (hasScoreUpdate || hasStatusUpdate) {
                    // Get updated values from updates array
                    const homeScoreUpdate = updates.find(u => u.field === 'home_score_display');
                    const awayScoreUpdate = updates.find(u => u.field === 'away_score_display');
                    const statusUpdate = updates.find(u => u.field === 'status_id');
                    if (hasScoreUpdate) {
                        (0, websocket_routes_1.broadcastEvent)({
                            type: 'SCORE_CHANGE',
                            matchId,
                            homeScore: homeScoreUpdate?.value,
                            awayScore: awayScoreUpdate?.value,
                            statusId: statusUpdate?.value,
                            timestamp: Date.now(),
                        });
                    }
                    if (hasStatusUpdate) {
                        (0, websocket_routes_1.broadcastEvent)({
                            type: 'MATCH_STATE_CHANGE',
                            matchId,
                            statusId: statusUpdate?.value,
                            newStatus: statusUpdate?.value,
                            timestamp: Date.now(),
                        });
                    }
                }
                if (hasMinuteUpdate) {
                    const minuteUpdate = updates.find(u => u.field === 'minute');
                    const statusUpdate = updates.find(u => u.field === 'status_id');
                    (0, websocket_routes_1.broadcastEvent)({
                        type: 'MINUTE_UPDATE',
                        matchId,
                        minute: minuteUpdate?.value,
                        statusId: statusUpdate?.value || 2, // Default to FIRST_HALF if not provided
                        timestamp: Date.now(),
                    });
                }
            }
            catch (broadcastError) {
                // Don't fail the update if broadcasting fails
                logger_1.logger.warn(`[MatchSync.directWrite] Failed to broadcast event for ${matchId}: ${broadcastError.message}`);
            }
            return { status: 'success', fieldsUpdated };
        }
        catch (error) {
            logger_1.logger.error(`[MatchSync.directWrite] Failed to update ${matchId}:`, error);
            return { status: 'error', fieldsUpdated: [] };
        }
    }
    /**
     * Sync matches incrementally using /match/recent/list with time parameter
     */
    async syncMatches() {
        if (this.isRunning) {
            logger_1.logger.warn('Match sync job skipped: previous run still in progress');
            return;
        }
        this.isRunning = true;
        try {
            logger_1.logger.info('Starting match incremental sync job...');
            const result = await this.recentSyncService.syncIncremental();
            logger_1.logger.info(`Match sync completed: ${result.synced} matches synced, ${result.errors} errors`);
            // After incremental sync, run authoritative reconciliation for LIVE matches.
            await this.reconcileLiveMatches();
        }
        catch (error) {
            logger_1.logger.error('Match sync job error:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Enqueue a match for authoritative detail_live reconciliation (dedup).
     * Safe to call frequently; Set dedups.
     */
    enqueueReconcile(matchId) {
        if (!matchId)
            return;
        this.reconcileQueue.add(String(matchId));
    }
    /**
     * Enqueue matches by status bucket for authoritative reconciliation.
     * This does NOT call the API directly; it only fills the queue.
     */
    async enqueueMatchesForReconcile(statusIds, label, limit = 500) {
        const client = await connection_1.pool.connect();
        try {
            const res = await client.query(`
        SELECT external_id
        FROM ts_matches
        WHERE status_id = ANY($1)
        ORDER BY match_time ASC
        LIMIT $2
        `, [statusIds, limit]);
            if (res.rows.length === 0) {
                logger_1.logger.debug(`[${label}] No matches found.`);
                return;
            }
            for (const row of res.rows) {
                this.enqueueReconcile(String(row.external_id));
            }
            logger_1.logger.info(`[${label}] Enqueued ${res.rows.length} matches for reconciliation.`);
        }
        finally {
            client.release();
        }
    }
    async reconcileLiveMatches() {
        await this.enqueueMatchesForReconcile(this.LIVE_STATUS_IDS, 'LiveReconcile', 500);
    }
    /**
     * PHASE C: Reconcile match via LiveMatchOrchestrator
     *
     * Fetches match detail_live from API and sends updates to orchestrator
     * for centralized write coordination.
     */
    async reconcileViaOrchestrator(matchId) {
        try {
            // Step 1: Fetch match detail_live from API
            const resp = await this.matchDetailLiveService.getMatchDetailLive({ match_id: matchId }, { forceRefresh: true });
            // Step 2: Extract fields from response
            const results = resp.results || resp.result_list;
            if (!results || !Array.isArray(results)) {
                logger_1.logger.warn(`[reconcileViaOrchestrator] No results for match ${matchId}`);
                return;
            }
            const matchData = results.find((m) => String(m?.id || m?.match_id) === String(matchId));
            if (!matchData) {
                logger_1.logger.warn(`[reconcileViaOrchestrator] Match ${matchId} not found in results`);
                return;
            }
            // Step 3: Parse fields
            const updates = [];
            const now = Math.floor(Date.now() / 1000);
            // Parse score array: [home_score, status_id, [home_display, ...], [away_display, ...]]
            if (Array.isArray(matchData.score) && matchData.score.length >= 4) {
                const homeScore = matchData.score[0];
                const statusId = matchData.score[1];
                const homeScoreDisplay = Array.isArray(matchData.score[2]) ? matchData.score[2][0] : null;
                const awayScoreDisplay = Array.isArray(matchData.score[3]) ? matchData.score[3][0] : null;
                if (homeScoreDisplay !== null) {
                    updates.push({
                        field: 'home_score_display',
                        value: homeScoreDisplay,
                        source: 'api',
                        priority: 2,
                        timestamp: matchData.update_time || now,
                    });
                }
                if (awayScoreDisplay !== null) {
                    updates.push({
                        field: 'away_score_display',
                        value: awayScoreDisplay,
                        source: 'api',
                        priority: 2,
                        timestamp: matchData.update_time || now,
                    });
                }
                if (statusId !== null && statusId !== undefined) {
                    updates.push({
                        field: 'status_id',
                        value: statusId,
                        source: 'api',
                        priority: 2,
                        timestamp: matchData.update_time || now,
                    });
                }
            }
            // REMOVED: API minute - calculated by MatchMinuteWorker per TheSports formula
            // Provider timestamps
            if (matchData.update_time) {
                updates.push({
                    field: 'provider_update_time',
                    value: matchData.update_time,
                    source: 'api',
                    priority: 2,
                    timestamp: matchData.update_time,
                });
            }
            if (matchData.event_time) {
                updates.push({
                    field: 'last_event_ts',
                    value: matchData.event_time,
                    source: 'api',
                    priority: 2,
                    timestamp: matchData.update_time || now,
                });
            }
            // Second half kickoff (write-once)
            if (matchData.second_half_kickoff_ts) {
                updates.push({
                    field: 'second_half_kickoff_ts',
                    value: matchData.second_half_kickoff_ts,
                    source: 'api',
                    priority: 2,
                    timestamp: matchData.update_time || now,
                });
            }
            // Step 4: Send to orchestrator
            if (updates.length > 0) {
                const result = await this.updateMatchDirect(matchId, updates, 'matchSync');
                if (result.status === 'success') {
                    (0, obsLogger_1.logEvent)('info', 'matchsync.orchestrator.success', {
                        matchId,
                        fieldsUpdated: result.fieldsUpdated,
                    });
                }
                else if (result.status === 'retry') {
                    // Retry later
                    this.enqueueReconcile(matchId);
                }
            }
            // Step 5: Save stats to database (DB-first architecture)
            // Extract stats from API response and persist to ts_match_stats
            try {
                const parsedStats = matchStats_repository_1.matchStatsRepository.parseStatsFromDetailLive(matchData);
                if (Object.keys(parsedStats).length > 0) {
                    await matchStats_repository_1.matchStatsRepository.upsertStats({
                        match_id: matchId,
                        ...parsedStats,
                    });
                }
            }
            catch (statsError) {
                // Non-blocking: stats save failure shouldn't fail the reconcile
                logger_1.logger.warn(`[reconcileViaOrchestrator] Stats save failed for ${matchId}: ${statsError.message}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`[reconcileViaOrchestrator] Error for match ${matchId}:`, error);
            throw error;
        }
    }
    /**
     * Process the reconcile queue with backpressure + throttling.
     * - Dedup via Set
     * - Max N matches per tick
     * - Throttle between API calls
     */
    async processReconcileQueue() {
        // DEBUG: Always log to see if function is called
        if (this.reconcileQueue.size > 0) {
            logger_1.logger.info(`[LiveReconcile.DEBUG] Called with queueSize=${this.reconcileQueue.size}, isReconciling=${this.isReconciling}`);
        }
        if (this.isReconciling)
            return;
        if (this.reconcileQueue.size === 0)
            return;
        this.isReconciling = true;
        try {
            const toProcess = [];
            for (const id of this.reconcileQueue) {
                toProcess.push(id);
                if (toProcess.length >= this.RECONCILE_BATCH_LIMIT)
                    break;
            }
            // Remove selected IDs before processing
            for (const id of toProcess)
                this.reconcileQueue.delete(id);
            logger_1.logger.info(`[LiveReconcile] Processing ${toProcess.length} matches (queueRemaining=${this.reconcileQueue.size})`);
            for (const matchId of toProcess) {
                try {
                    // PHASE C: Use orchestrator for centralized write coordination
                    await this.reconcileViaOrchestrator(String(matchId));
                }
                catch (err) {
                    logger_1.logger.error(`[LiveReconcile] Error reconciling matchId=${matchId}:`, err);
                }
                await sleep(this.RECONCILE_DELAY_MS);
            }
            logger_1.logger.info('[LiveReconcile] Queue batch processed.');
        }
        finally {
            this.isReconciling = false;
        }
    }
    /**
     * Start the worker
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('Match sync worker already started');
            return;
        }
        // Run every 1 minute (CRITICAL: Changed from 5 minutes for real-time updates)
        this.cronJob = node_cron_1.default.schedule('*/1 * * * *', async () => {
            await this.syncMatches();
        });
        // Tier-1 reconcile: enqueue LIVE-phase matches every 3 seconds for REAL-TIME updates
        this.liveInterval = setInterval(() => {
            this.reconcileLiveMatches().catch(err => logger_1.logger.error('[LiveReconcile] enqueue interval error:', err));
        }, 3000);
        // Tier-1.5 reconcile: enqueue FIRST_HALF matches every 20 seconds (for HALF_TIME transition detection)
        // CRITICAL: First half matches can transition to HALF_TIME (status 2 → 3) at any time around 45 minutes
        this.firstHalfInterval = setInterval(() => {
            this.enqueueMatchesForReconcile(this.FIRST_HALF_STATUS_IDS, 'FirstHalfReconcile', 500)
                .catch(err => logger_1.logger.error('[FirstHalfReconcile] enqueue interval error:', err));
        }, 20000); // Every 20 seconds for HALF_TIME transition detection
        // Tier-1.6 reconcile: enqueue SECOND_HALF matches every 15 seconds (more frequent for END/FT detection)
        // CRITICAL: Second half matches can finish at any time, need frequent checks for status 8 (END)
        this.secondHalfInterval = setInterval(() => {
            this.enqueueMatchesForReconcile(this.SECOND_HALF_STATUS_IDS, 'SecondHalfReconcile', 500)
                .catch(err => logger_1.logger.error('[SecondHalfReconcile] enqueue interval error:', err));
        }, 15000); // Every 15 seconds for faster END detection
        // Tier-2 reconcile: enqueue HALF_TIME matches every 30 seconds (status can change to SECOND_HALF)
        // CRITICAL: HALF_TIME matches can transition to SECOND_HALF (status 3 → 4) quickly
        this.halfTimeInterval = setInterval(() => {
            this.enqueueMatchesForReconcile(this.HALFTIME_STATUS_IDS, 'HalfTimeReconcile', 500)
                .catch(err => logger_1.logger.error('[HalfTimeReconcile] enqueue interval error:', err));
        }, 30000); // Every 30 seconds (reduced from 120s for faster SECOND_HALF transition)
        // Process reconcile queue every 1 second (backpressure-controlled)
        this.liveTickInterval = setInterval(() => {
            this.processReconcileQueue().catch(err => logger_1.logger.error('[LiveReconcile] process interval error:', err));
        }, 1000);
        // Prediction Resulter: Update prediction results every 30 seconds
        // Checks matched predictions where match has ended and calculates win/lose
        // Uses centralized PredictionSettlementService for proper IY/MS differentiation
        this.predictionResultInterval = setInterval(async () => {
            try {
                // ============================================
                // PART 1: HALFTIME & FULLTIME SETTLEMENT
                // For status=3 (halftime) and status=8 (ended)
                // ============================================
                const pendingResult = await connection_1.pool.query(`
          SELECT DISTINCT
            p.match_id,
            m.status_id,
            m.home_score_display,
            m.away_score_display,
            (m.home_scores->0)::INTEGER as current_home_score,
            (m.away_scores->0)::INTEGER as current_away_score,
            (m.home_scores->1)::INTEGER as ht_home_score,
            (m.away_scores->1)::INTEGER as ht_away_score
          FROM ai_predictions p
          JOIN ts_matches m ON p.match_id = m.external_id
          WHERE p.result = 'pending'
            AND p.match_id IS NOT NULL
            AND (m.status_id = 8 OR m.status_id = 3)
        `);
                let totalSettled = 0;
                for (const row of pendingResult.rows) {
                    const eventType = row.status_id === 3 ? 'halftime' : 'fulltime';
                    const homeScore = eventType === 'halftime'
                        ? (parseInt(row.ht_home_score) || 0)
                        : (parseInt(row.home_score_display) || parseInt(row.current_home_score) || 0);
                    const awayScore = eventType === 'halftime'
                        ? (parseInt(row.ht_away_score) || 0)
                        : (parseInt(row.away_score_display) || parseInt(row.current_away_score) || 0);
                    const result = await predictionSettlement_service_1.predictionSettlementService.processEvent({
                        matchId: row.match_id,
                        eventType,
                        homeScore,
                        awayScore,
                        htHome: parseInt(row.ht_home_score) || undefined,
                        htAway: parseInt(row.ht_away_score) || undefined,
                        statusId: row.status_id,
                        timestamp: Date.now(),
                    });
                    totalSettled += result.settled;
                }
                if (totalSettled > 0) {
                    logger_1.logger.info(`[PredictionResulter] Settled ${totalSettled} prediction results (HT/FT)`);
                }
                // ============================================
                // PART 2: LIVE MATCH INSTANT WIN SETTLEMENT
                // CRITICAL FIX: For status=2,4 (live matches)
                // This catches matches where WebSocket/MQTT doesn't send score updates
                // ============================================
                const liveResult = await connection_1.pool.query(`
          SELECT DISTINCT
            p.match_id,
            m.status_id,
            m.minute,
            (m.home_scores->0)::INTEGER as current_home_score,
            (m.away_scores->0)::INTEGER as current_away_score
          FROM ai_predictions p
          JOIN ts_matches m ON p.match_id = m.external_id
          WHERE p.result = 'pending'
            AND p.match_id IS NOT NULL
            AND m.status_id IN (2, 4, 5, 7)
        `);
                let liveSettled = 0;
                for (const row of liveResult.rows) {
                    const homeScore = parseInt(row.current_home_score) || 0;
                    const awayScore = parseInt(row.current_away_score) || 0;
                    const totalGoals = homeScore + awayScore;
                    // Only process if there are goals (instant win is only possible with goals)
                    if (totalGoals > 0) {
                        // Use proxy minute based on status for IY/MS determination
                        // Status 2 = 1st half, Status 4+ = 2nd half
                        const proxyMinute = row.status_id === 2 ? (row.minute || 1) : (row.minute || 46);
                        const result = await predictionSettlement_service_1.predictionSettlementService.processEvent({
                            matchId: row.match_id,
                            eventType: 'score_change',
                            homeScore,
                            awayScore,
                            minute: proxyMinute,
                            statusId: row.status_id,
                            timestamp: Date.now(),
                        });
                        if (result.settled > 0) {
                            liveSettled += result.settled;
                            logger_1.logger.info(`[PredictionResulter] LIVE instant win for ${row.match_id}: ${homeScore}-${awayScore}, settled ${result.settled}`);
                        }
                    }
                }
                if (liveSettled > 0) {
                    logger_1.logger.info(`[PredictionResulter] Settled ${liveSettled} LIVE instant win predictions`);
                }
            }
            catch (err) {
                logger_1.logger.error('[PredictionResulter] Error updating prediction results:', err);
            }
        }, 30000); // Every 30 seconds
        // Match Detail Sync: Sync detailed match data every 30 seconds for Match Detail page
        // This populates ts_match_stats, ts_match_incidents tables for DB-first architecture
        this.matchDetailSyncInterval = setInterval(async () => {
            try {
                // Get all live matches
                const liveMatchesResult = await connection_1.pool.query(`
          SELECT external_id
          FROM ts_matches
          WHERE status_id = ANY($1)
          ORDER BY match_time ASC
          LIMIT 100
        `, [this.LIVE_STATUS_IDS]);
                if (liveMatchesResult.rows.length === 0) {
                    return;
                }
                let totalStats = 0;
                let totalIncidents = 0;
                // Sync each live match (with throttling)
                for (const row of liveMatchesResult.rows) {
                    try {
                        const result = await matchDetailSync_service_1.matchDetailSyncService.syncMatchDetail(row.external_id);
                        totalStats += result.stats;
                        totalIncidents += result.incidents;
                        await sleep(100); // 100ms between each match to avoid API overload
                    }
                    catch (err) {
                        logger_1.logger.warn(`[MatchDetailSync] Error syncing ${row.external_id}: ${err.message}`);
                    }
                }
                if (totalStats > 0 || totalIncidents > 0) {
                    logger_1.logger.info(`[MatchDetailSync] Synced ${liveMatchesResult.rows.length} matches: ${totalStats} stats, ${totalIncidents} incidents`);
                }
            }
            catch (err) {
                logger_1.logger.error('[MatchDetailSync] Error in sync interval:', err);
            }
        }, 30000); // Every 30 seconds
        // Run immediately on start (but wait 10 seconds to let bootstrap complete)
        setTimeout(() => {
            this.syncMatches();
        }, 10000);
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'MatchSyncWorker',
            schedule: '*/1 * * * *',
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger_1.logger.info('Match sync worker stopped');
        }
        if (this.liveInterval) {
            clearInterval(this.liveInterval);
            this.liveInterval = null;
            logger_1.logger.info('Live reconcile interval stopped');
        }
        if (this.firstHalfInterval) {
            clearInterval(this.firstHalfInterval);
            this.firstHalfInterval = null;
            logger_1.logger.info('First half reconcile interval stopped');
        }
        if (this.secondHalfInterval) {
            clearInterval(this.secondHalfInterval);
            this.secondHalfInterval = null;
            logger_1.logger.info('Second half reconcile interval stopped');
        }
        if (this.liveTickInterval) {
            clearInterval(this.liveTickInterval);
            this.liveTickInterval = null;
            logger_1.logger.info('Live reconcile queue processor stopped');
        }
        if (this.halfTimeInterval) {
            clearInterval(this.halfTimeInterval);
            this.halfTimeInterval = null;
            logger_1.logger.info('Half-time reconcile interval stopped');
        }
        if (this.predictionResultInterval) {
            clearInterval(this.predictionResultInterval);
            this.predictionResultInterval = null;
            logger_1.logger.info('Prediction result interval stopped');
        }
        if (this.matchDetailSyncInterval) {
            clearInterval(this.matchDetailSyncInterval);
            this.matchDetailSyncInterval = null;
            logger_1.logger.info('Match detail sync interval stopped');
        }
    }
}
exports.MatchSyncWorker = MatchSyncWorker;
