"use strict";
/**
 * Data Update Worker
 *
 * Background job to check for real-time updates from TheSports API
 * Runs every 20 seconds to keep local database fresh (per TheSports docs)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataUpdateWorker = void 0;
const dataUpdate_service_1 = require("../services/thesports/dataUpdate/dataUpdate.service");
const matchDetailLive_service_1 = require("../services/thesports/match/matchDetailLive.service");
const combinedStats_service_1 = require("../services/thesports/match/combinedStats.service");
const matchTrend_service_1 = require("../services/thesports/match/matchTrend.service");
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
const matchSync_service_1 = require("../services/thesports/match/matchSync.service");
const JobRunner_1 = require("./framework/JobRunner");
const lockKeys_1 = require("./lockKeys");
const MatchOrchestrator_1 = require("../modules/matches/services/MatchOrchestrator");
const teamData_service_1 = require("../services/thesports/team/teamData.service");
const competition_service_1 = require("../services/thesports/competition/competition.service");
// PR-8B: Using MatchOrchestrator for atomic match updates
class DataUpdateWorker {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.dataUpdateService = new dataUpdate_service_1.DataUpdateService();
        // SINGLETON: All services share the same API client with global rate limiting
        this.matchDetailLiveService = new matchDetailLive_service_1.MatchDetailLiveService();
        this.combinedStatsService = new combinedStats_service_1.CombinedStatsService();
        this.matchTrendService = new matchTrend_service_1.MatchTrendService();
        this.combinedStatsService = new combinedStats_service_1.CombinedStatsService();
        this.matchTrendService = new matchTrend_service_1.MatchTrendService();
        // Services for on-the-fly ingestion
        this.teamDataService = new teamData_service_1.TeamDataService();
        this.competitionService = new competition_service_1.CompetitionService();
        this.matchSyncService = new matchSync_service_1.MatchSyncService(this.teamDataService, this.competitionService);
    }
    /**
     * PR-8B: Orchestrator wrapper for match updates
     * Replaces direct SQL UPDATE with matchOrchestrator.updateMatch()
     */
    async updateMatchDirect(matchId, updates, source) {
        if (updates.length === 0) {
            return { status: 'success', fieldsUpdated: [] };
        }
        try {
            // PR-8B: Use MatchOrchestrator for atomic updates with:
            // - Match-level advisory lock
            // - Priority-based conflict resolution
            // - Immutability protection (status=8)
            const orchestratorResult = await MatchOrchestrator_1.matchOrchestrator.updateMatch(matchId, updates, source);
            // Map orchestrator result to expected format (with undefined safety)
            const result = {
                status: orchestratorResult.status,
                fieldsUpdated: orchestratorResult.fieldsUpdated ?? [],
            };
            // If update failed (locked, rejected, etc), log and return early
            if (orchestratorResult.status !== 'success') {
                if (orchestratorResult.status === 'rejected_immutable') {
                    logger_1.logger.warn(`[DataUpdate.orchestrator] REJECT: Match ${matchId} is immutable (status=8)`);
                }
                else if (orchestratorResult.status === 'rejected_locked') {
                    logger_1.logger.debug(`[DataUpdate.orchestrator] Lock busy for match ${matchId}, skipping update`);
                }
                else if (orchestratorResult.status === 'rejected_stale') {
                    logger_1.logger.debug(`[DataUpdate.orchestrator] Updates rejected by priority filter for ${matchId}`);
                }
                return result;
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error(`[DataUpdate.orchestrator] Failed to update ${matchId}:`, error);
            return { status: 'error', fieldsUpdated: [] };
        }
    }
    /**
     * Normalize changed matches from various payload formats
     * Supports:
     * - payload.changed_matches / changed_match_ids / matches (legacy)
     * - payload.results["1"] and other keys containing arrays with match_id and update_time
     *
     * Returns: { matchIds: string[], updateTimeByMatchId: Map<string, number> }
     */
    normalizeChangedMatches(payload) {
        const matchIds = [];
        const updateTimeByMatchId = new Map();
        if (!payload || typeof payload !== 'object') {
            return { matchIds, updateTimeByMatchId };
        }
        // Helper to extract match_id and update_time from an item
        const extractMatchInfo = (item) => {
            if (item == null)
                return { matchId: null, updateTime: null };
            let matchId = null;
            if (typeof item === 'string' || typeof item === 'number') {
                matchId = String(item);
            }
            else if (typeof item === 'object') {
                matchId = item.match_id != null
                    ? String(item.match_id)
                    : item.id != null
                        ? String(item.id)
                        : null;
            }
            let updateTime = null;
            if (typeof item === 'object' && item != null) {
                const ut = item.update_time ?? item.updateTime ?? item.ut ?? item.ts ?? item.timestamp;
                if (typeof ut === 'number' && ut > 0) {
                    // If milliseconds (>= year 2000 in ms), convert to seconds
                    updateTime = ut >= 946684800000 ? Math.floor(ut / 1000) : ut;
                }
                else if (typeof ut === 'string') {
                    const parsed = parseInt(ut, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        updateTime = parsed >= 946684800000 ? Math.floor(parsed / 1000) : parsed;
                    }
                }
            }
            return { matchId, updateTime };
        };
        // Legacy formats: changed_matches, changed_match_ids, matches
        const legacyRaw = payload?.changed_matches ??
            payload?.changed_match_ids ??
            payload?.matches;
        if (Array.isArray(legacyRaw)) {
            for (const item of legacyRaw) {
                const { matchId, updateTime } = extractMatchInfo(item);
                if (matchId) {
                    matchIds.push(matchId);
                    if (updateTime !== null) {
                        updateTimeByMatchId.set(matchId, updateTime);
                    }
                }
            }
        }
        // New format: results["1"], results["2"], etc. containing arrays with match_id and update_time
        const resultsObj = payload?.results;
        if (resultsObj && typeof resultsObj === 'object' && !Array.isArray(resultsObj)) {
            // Iterate through all keys in results (e.g., "1", "2", etc.)
            for (const key of Object.keys(resultsObj)) {
                const value = resultsObj[key];
                if (Array.isArray(value)) {
                    for (const item of value) {
                        const { matchId, updateTime } = extractMatchInfo(item);
                        if (matchId) {
                            matchIds.push(matchId);
                            if (updateTime !== null) {
                                updateTimeByMatchId.set(matchId, updateTime);
                            }
                        }
                    }
                }
            }
        }
        // Deduplicate matchIds (keep first occurrence)
        const uniqueMatchIds = Array.from(new Set(matchIds));
        return { matchIds: uniqueMatchIds, updateTimeByMatchId };
    }
    /**
     * Helper to safely convert to number, returns null if NaN
     */
    safeNumber(value, fallback = null) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }
        const num = Number(value);
        return isNaN(num) ? fallback : num;
    }
    /**
     * Helper to map API match object to MatchSyncData
     */
    mapToSyncData(match) {
        const homeScores = Array.isArray(match.home_scores) ? match.home_scores : [];
        const awayScores = Array.isArray(match.away_scores) ? match.away_scores : [];
        // CRITICAL FIX: Use safeNumber to prevent NaN values
        return {
            external_id: String(match.id || match.match_id),
            competition_id: match.competition_id,
            season_id: match.season_id,
            match_time: this.safeNumber(match.match_time),
            status_id: this.safeNumber(match.status_id ?? match.status, 1),
            home_team_id: match.home_team_id,
            away_team_id: match.away_team_id,
            home_scores: homeScores,
            away_scores: awayScores,
            home_score_regular: this.safeNumber(homeScores[0] ?? match.home_score),
            away_score_regular: this.safeNumber(awayScores[0] ?? match.away_score),
            venue_id: match.venue_id || null,
            referee_id: match.referee_id || null,
            stage_id: match.stage_id || null,
            round_num: this.safeNumber(match.round_num),
            group_num: this.safeNumber(match.group_num),
        };
    }
    /**
     * PHASE C: Reconcile match via LiveMatchOrchestrator
     *
     * Fetches match detail_live from API and sends updates to orchestrator
     * for centralized write coordination.
     */
    async reconcileViaOrchestrator(matchId, providerUpdateTime) {
        try {
            // Step 1: Fetch match detail_live from API
            const resp = await this.matchDetailLiveService.getMatchDetailLive({ match_id: matchId }, { forceRefresh: true });
            // Step 2: Extract fields from response
            const results = resp.results || resp.result_list;
            let matchData;
            // Check if match exists in live results
            if (results && Array.isArray(results)) {
                matchData = results.find((m) => String(m?.id || m?.match_id) === String(matchId));
            }
            // FALLBACK: If match not found in live results, check /match/detail (for finished matches)
            // This is CRITICAL for DataUpdateWorker because it receives "changed" events for finished matches
            // but those matches are immediately removed from detail_live by the provider
            if (!matchData) {
                logger_1.logger.info(`[DataUpdate.orchestrator] Match ${matchId} not in detail_live, checking /match/detail fallback...`);
                const detailResp = await this.matchDetailLiveService.getMatchDetail(matchId);
                // Check if detail response has valid data
                const detailMatch = detailResp?.results || detailResp;
                if (detailMatch && (String(detailMatch.id) === String(matchId) || String(detailMatch.match_id) === String(matchId))) {
                    matchData = detailMatch;
                    logger_1.logger.info(`[DataUpdate.orchestrator] Found match ${matchId} in /match/detail fallback. Status: ${matchData.status_id}`);
                }
            }
            if (!matchData) {
                logger_1.logger.warn(`[DataUpdate.orchestrator] Match ${matchId} not found in detail_live OR detail fallback`);
                return;
            }
            // Step 3: Parse fields using extractLiveFields() behavior manually because extractLiveFields 
            // is designed for detail_live response structure, but we might have a detail response.
            // We will use manual extraction similar to MatchWatchdog to be safe and consistent.
            const updates = [];
            const now = Math.floor(Date.now() / 1000);
            // Helper to determine status ID
            let statusId = matchData.status_id;
            if (Array.isArray(matchData.score) && matchData.score.length >= 2) {
                statusId = matchData.score[1];
            }
            // Parse score array: [home_score, status_id, [home_display, ...], [away_display, ...]]
            if (Array.isArray(matchData.score) && matchData.score.length >= 4) {
                const homeScoreDisplay = Array.isArray(matchData.score[2]) ? matchData.score[2][0] : null;
                const awayScoreDisplay = Array.isArray(matchData.score[3]) ? matchData.score[3][0] : null;
                if (homeScoreDisplay !== null) {
                    updates.push({
                        field: 'home_score_display',
                        value: homeScoreDisplay,
                        source: 'api',
                        priority: 2,
                        timestamp: matchData.update_time || providerUpdateTime || now,
                    });
                }
                if (awayScoreDisplay !== null) {
                    updates.push({
                        field: 'away_score_display',
                        value: awayScoreDisplay,
                        source: 'api',
                        priority: 2,
                        timestamp: matchData.update_time || providerUpdateTime || now,
                    });
                }
            }
            else {
                // Try standard fields if score array not present (e.g. /match/detail format)
                if (matchData.home_score !== undefined) {
                    updates.push({ field: 'home_score_display', value: matchData.home_score, source: 'api', priority: 2, timestamp: matchData.update_time || providerUpdateTime || now });
                }
                if (matchData.away_score !== undefined) {
                    updates.push({ field: 'away_score_display', value: matchData.away_score, source: 'api', priority: 2, timestamp: matchData.update_time || providerUpdateTime || now });
                }
            }
            if (statusId !== null && statusId !== undefined) {
                updates.push({
                    field: 'status_id',
                    value: statusId,
                    source: 'api',
                    priority: 2,
                    timestamp: matchData.update_time || providerUpdateTime || now,
                });
            }
            // Provider timestamps
            const effectiveUpdateTime = matchData.update_time || providerUpdateTime || now;
            updates.push({
                field: 'provider_update_time',
                value: effectiveUpdateTime,
                source: 'api',
                priority: 2,
                timestamp: effectiveUpdateTime,
            });
            updates.push({
                field: 'last_event_ts',
                value: effectiveUpdateTime,
                source: 'api',
                priority: 2,
                timestamp: effectiveUpdateTime,
            });
            // Kickoff timestamps
            // Use API kickoff time if available (liveKickoffTime logic)
            let liveKickoffTime = null;
            if (matchData.live_kickoff_time)
                liveKickoffTime = matchData.live_kickoff_time;
            else if (matchData.liveKickoffTime)
                liveKickoffTime = matchData.liveKickoffTime;
            else if (Array.isArray(matchData.score) && matchData.score.length >= 5)
                liveKickoffTime = matchData.score[4];
            if (statusId && liveKickoffTime) {
                // First half (status 2)
                if (statusId === 2) {
                    updates.push({
                        field: 'first_half_kickoff_ts',
                        value: liveKickoffTime,
                        source: 'api',
                        priority: 2,
                        timestamp: effectiveUpdateTime,
                    });
                }
                // Second half (status 4)
                else if (statusId === 4) {
                    updates.push({
                        field: 'second_half_kickoff_ts',
                        value: liveKickoffTime,
                        source: 'api',
                        priority: 2,
                        timestamp: effectiveUpdateTime,
                    });
                }
                // Note: overtime_kickoff_ts not in MatchUpdateFields schema, skipping for status 5+
            }
            // PR-8B: Send to orchestrator
            if (updates.length > 0) {
                const result = await this.updateMatchDirect(matchId, updates, 'api');
                if (result.status === 'success') {
                    (0, obsLogger_1.logEvent)('info', 'dataupdate.orchestrator.success', {
                        matchId,
                        fieldsUpdated: result.fieldsUpdated,
                    });
                }
                else {
                    logger_1.logger.warn(`[DataUpdate.orchestrator] Update status for ${matchId}: ${result.status}`);
                }
                return;
            }
        }
        catch (error) {
            logger_1.logger.error(`[DataUpdate.orchestrator] Error for match ${matchId}:`, error);
            throw error;
        }
    }
    /**
     * Check for updates
     *
     * PR-8A: Wrapped with JobRunner for overlap guard + timeout + metrics
     */
    async checkUpdates() {
        if (this.isRunning) {
            logger_1.logger.debug('[DataUpdate] Data update check already running, skipping this run.');
            return;
        }
        this.isRunning = true;
        const runId = Math.random().toString(16).slice(2, 8);
        const startedAt = Date.now();
        (0, obsLogger_1.logEvent)('debug', 'dataupdate.tick.start', { run_id: runId });
        try {
            // PR-8A: Wrap execution with JobRunner (no SQL logic changes)
            await JobRunner_1.jobRunner.run({
                jobName: 'dataUpdate',
                overlapGuard: true,
                advisoryLockKey: lockKeys_1.LOCK_KEYS.DATA_UPDATE,
                timeoutMs: 600000, // 10 minutes
            }, async (_ctx) => {
                // Original checkUpdates() logic unchanged below this line
                const payload = await this.dataUpdateService.checkUpdates();
                if (!payload) {
                    logger_1.logger.debug(`[DataUpdate:${runId}] No payload received`);
                    return;
                }
                const keys = payload && typeof payload === 'object' ? Object.keys(payload) : [];
                logger_1.logger.debug(`[DataUpdate:${runId}] checkUpdates() ok; keys=[${keys.slice(0, 12).join(', ')}]`);
                const { matchIds: changedMatchIds, updateTimeByMatchId } = this.normalizeChangedMatches(payload);
                if (changedMatchIds.length === 0) {
                    logger_1.logger.debug(`[DataUpdate:${runId}] No changed matches. rawChangedType=${Array.isArray(payload) ? 'array' : typeof payload}`);
                    return;
                }
                (0, obsLogger_1.logEvent)('info', 'dataupdate.changed', {
                    count: changedMatchIds.length,
                    match_ids: changedMatchIds.slice(0, 10), // First 10 for example
                    run_id: runId,
                });
                // CRITICAL FIX: Handle database connection errors gracefully (placeholder DB)
                let dbClient = null;
                try {
                    dbClient = await connection_1.pool.connect();
                }
                catch (dbError) {
                    // Database connection failed (placeholder DB or not configured)
                    const isDbConnectionError = dbError.message?.includes('getaddrinfo') ||
                        dbError.message?.includes('EAI_AGAIN') ||
                        dbError.message?.includes('placeholder') ||
                        dbError.message?.includes('Connection');
                    if (isDbConnectionError) {
                        logger_1.logger.warn(`[DataUpdate:${runId}] Database connection failed (placeholder DB). Skipping DB operations. Error: ${dbError.message}`);
                        // Continue without database - don't crash the worker
                        return;
                    }
                    else {
                        // Re-throw non-connection errors
                        throw dbError;
                    }
                }
                try {
                    for (const matchId of changedMatchIds) {
                        try {
                            const matchIdStr = String(matchId);
                            const updateTime = updateTimeByMatchId.get(matchIdStr) ?? null;
                            const exists = await dbClient.query('SELECT 1 FROM ts_matches WHERE external_id = $1 LIMIT 1', [matchIdStr]);
                            if (exists.rows.length === 0) {
                                logger_1.logger.warn(`[DataUpdate:${runId}] Changed match ${matchIdStr} NOT in DB. Attempting on-the-fly ingestion...`);
                                // On-the-fly ingestion for missing match
                                try {
                                    // Fetch full stats from detail fallback (which returns full match object)
                                    const detailResp = await this.matchDetailLiveService.getMatchDetail(matchIdStr);
                                    const detailMatch = detailResp?.results || detailResp;
                                    if (detailMatch && (String(detailMatch.id) === String(matchIdStr) || String(detailMatch.match_id) === String(matchIdStr))) {
                                        logger_1.logger.info(`[DataUpdate] Retrieved details for missing match ${matchIdStr}, syncing...`);
                                        const syncData = this.mapToSyncData(detailMatch);
                                        // Sync match (this will ensure teams/competition exist)
                                        await this.matchSyncService.syncMatch(syncData);
                                        logger_1.logger.info(`[DataUpdate] ✅ Successfully ingested missing match ${matchIdStr}`);
                                    }
                                    else {
                                        logger_1.logger.warn(`[DataUpdate] Failed to retrieve details for missing match ${matchIdStr}, skipping.`);
                                        continue;
                                    }
                                }
                                catch (ingestError) {
                                    logger_1.logger.error(`[DataUpdate] Error ingesting missing match ${matchIdStr}:`, ingestError.message);
                                    continue;
                                }
                            }
                            const t0 = Date.now();
                            (0, obsLogger_1.logEvent)('info', 'dataupdate.reconcile.start', {
                                match_id: matchIdStr,
                                provider_update_time: updateTime !== null ? updateTime : undefined,
                                run_id: runId,
                            });
                            // PHASE C: Use orchestrator for centralized write coordination
                            await this.reconcileViaOrchestrator(matchIdStr, updateTime);
                            const duration = Date.now() - t0;
                            (0, obsLogger_1.logEvent)('info', 'dataupdate.reconcile.done', {
                                match_id: matchIdStr,
                                duration_ms: duration,
                                run_id: runId,
                            });
                            // PHASE 4+: On match end (status=8), sync final stats/trend to database
                            // Check current status from database after orchestrator update
                            const statusResult = await dbClient.query('SELECT status_id FROM ts_matches WHERE external_id = $1', [matchIdStr]);
                            const currentStatusId = statusResult.rows[0]?.status_id;
                            if (currentStatusId === 8) {
                                logger_1.logger.info(`[DataUpdate:${runId}] Match ${matchIdStr} ended (status=8), syncing final stats/trend...`);
                                try {
                                    // Fetch and save final combined stats (includes incidents)
                                    const stats = await this.combinedStatsService.getCombinedMatchStats(matchIdStr);
                                    if (stats && stats.allStats.length > 0) {
                                        await this.combinedStatsService.saveCombinedStatsToDatabase(matchIdStr, stats);
                                        logger_1.logger.info(`[DataUpdate:${runId}] Saved ${stats.allStats.length} final stats for ${matchIdStr}`);
                                    }
                                    // Fetch final trend data (caching to statistics field removed in PR-8B)
                                    // Note: statistics field is not in MatchUpdateFields schema, cannot update via orchestrator
                                    // Trend data is still available via API, just not cached in database
                                    const trend = await this.matchTrendService.getMatchTrend({ match_id: matchIdStr }, 8);
                                    const trendResults = trend?.results;
                                    const hasTrendData = Array.isArray(trendResults) ? trendResults.length > 0 : !!trendResults;
                                    if (hasTrendData) {
                                        logger_1.logger.debug(`[DataUpdate:${runId}] Fetched trend data for ${matchIdStr} (not cached to DB)`);
                                    }
                                }
                                catch (syncErr) {
                                    logger_1.logger.warn(`[DataUpdate:${runId}] Failed to sync final stats/trend for ${matchIdStr}:`, syncErr.message);
                                }
                            }
                        }
                        catch (err) {
                            logger_1.logger.error(`[DataUpdate] Error reconciling changed match ${matchId}:`, err);
                        }
                    }
                }
                finally {
                    if (dbClient) {
                        dbClient.release();
                    }
                }
            } // PR-8A: End jobRunner.run() wrapper
            ); // PR-8A: Close jobRunner.run()
        }
        catch (error) {
            logger_1.logger.error('Data update check error:', error);
        }
        finally {
            this.isRunning = false;
            logger_1.logger.debug(`[DataUpdate:${runId}] Tick end (${Date.now() - startedAt}ms)`);
        }
    }
    /**
     * Start the worker
     * Runs every 20 seconds (as per API documentation: recommended request frequency: 20 seconds/time)
     */
    start() {
        if (this.intervalId) {
            logger_1.logger.warn('Data update worker already started');
            return;
        }
        // Run immediately on start
        void this.checkUpdates();
        // Then run every 20 seconds
        this.intervalId = setInterval(() => {
            void this.checkUpdates();
        }, 20000);
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'DataUpdateWorker',
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
            logger_1.logger.info('Data update worker stopped');
        }
    }
}
exports.DataUpdateWorker = DataUpdateWorker;
