"use strict";
/**
 * Live State Update Controller
 *
 * HTTP endpoint for state transitions (1→2→3→4→8)
 * Replaces DataUpdate worker with simple 5s cron-triggered endpoint
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLiveMatchStates = updateLiveMatchStates;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const dataUpdate_service_1 = require("../../services/thesports/dataUpdate/dataUpdate.service");
const matchDetailLive_service_1 = require("../../services/thesports/match/matchDetailLive.service");
const websocket_routes_1 = require("../../routes/websocket.routes");
const matchMinuteText_1 = require("../../utils/matchMinuteText");
const dataUpdateService = new dataUpdate_service_1.DataUpdateService();
const matchDetailLiveService = new matchDetailLive_service_1.MatchDetailLiveService();
/**
 * Helper: Extract match IDs from API response
 */
function extractChangedMatchIds(payload) {
    if (!payload || typeof payload !== 'object') {
        return [];
    }
    const matchIds = [];
    // Legacy format: changed_matches / changed_match_ids
    const legacyRaw = payload?.changed_matches ?? payload?.changed_match_ids ?? payload?.matches;
    if (Array.isArray(legacyRaw)) {
        for (const item of legacyRaw) {
            if (typeof item === 'string' || typeof item === 'number') {
                matchIds.push(String(item));
            }
            else if (item?.match_id != null) {
                matchIds.push(String(item.match_id));
            }
            else if (item?.id != null) {
                matchIds.push(String(item.id));
            }
        }
    }
    // New format: results["1"], results["2"], etc.
    const resultsObj = payload?.results;
    if (resultsObj && typeof resultsObj === 'object' && !Array.isArray(resultsObj)) {
        for (const key of Object.keys(resultsObj)) {
            const value = resultsObj[key];
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item?.match_id != null) {
                        matchIds.push(String(item.match_id));
                    }
                    else if (item?.id != null) {
                        matchIds.push(String(item.id));
                    }
                }
            }
        }
    }
    return Array.from(new Set(matchIds)); // Deduplicate
}
/**
 * Helper: Direct database update with timestamp lock
 */
async function updateMatchDirect(matchId, updates) {
    if (updates.length === 0) {
        return { success: true, fieldsUpdated: [] };
    }
    try {
        // IMMUTABLE LOCK: Protect finished matches (status=8)
        const statusUpdate = updates.find(u => u.field === 'status_id');
        if (statusUpdate && statusUpdate.value !== 8) {
            const checkQuery = `SELECT status_id FROM ts_matches WHERE external_id = $1`;
            const checkResult = await connection_1.pool.query(checkQuery, [matchId]);
            const existing = checkResult.rows[0];
            if (existing?.status_id === 8) {
                logger_1.logger.warn(`[StateUpdate] REJECT: Match ${matchId} already finished (status=8 immutable)`);
                return { success: false, fieldsUpdated: [] };
            }
        }
        const setClauses = [];
        const values = [];
        let paramIndex = 1;
        const fieldsUpdated = [];
        // Build SET clause for each update
        for (const update of updates) {
            setClauses.push(`${update.field} = $${paramIndex}`);
            values.push(update.value);
            fieldsUpdated.push(update.field);
            paramIndex++;
            // Track source and timestamp for critical fields
            const sourceColumnMap = {
                home_score_display: 'home_score_source',
                away_score_display: 'away_score_source',
                status_id: 'status_id_source',
                minute: 'minute_source',
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
        return { success: true, fieldsUpdated };
    }
    catch (error) {
        logger_1.logger.error(`[StateUpdate] Failed to update ${matchId}:`, error.message);
        return { success: false, fieldsUpdated: [] };
    }
}
/**
 * POST /api/matches/update-live-states
 *
 * State transition endpoint called by 5s cron
 * Handles: 1→2 (start), 2→3 (HT), 3→4 (2nd half), 4→8 (FT)
 */
async function updateLiveMatchStates(request, reply) {
    try {
        const startTime = Date.now();
        const nowTs = Math.floor(Date.now() / 1000);
        // 1. Get changed matches from TheSports API
        const payload = await dataUpdateService.checkUpdates();
        if (!payload) {
            return reply.send({
                success: true,
                updated: 0,
                message: 'No updates from API',
            });
        }
        const changedMatchIds = extractChangedMatchIds(payload);
        if (changedMatchIds.length === 0) {
            return reply.send({
                success: true,
                updated: 0,
                message: 'No changed matches',
            });
        }
        logger_1.logger.info(`[StateUpdate] Processing ${changedMatchIds.length} changed matches`);
        let updatedCount = 0;
        const results = [];
        // 2. Process each changed match
        for (const matchId of changedMatchIds) {
            try {
                // Check if match exists in database
                const existsResult = await connection_1.pool.query('SELECT status_id FROM ts_matches WHERE external_id = $1', [matchId]);
                if (existsResult.rows.length === 0) {
                    logger_1.logger.debug(`[StateUpdate] Match ${matchId} not in DB, skipping`);
                    continue;
                }
                const oldStatusId = existsResult.rows[0].status_id;
                // 3. Fetch latest data from /match/detail_live
                const resp = await matchDetailLiveService.getMatchDetailLive({ match_id: matchId }, { forceRefresh: true });
                const results_list = resp.results || resp.result_list || [];
                const matchData = results_list.find((m) => String(m?.id || m?.match_id) === String(matchId));
                if (!matchData) {
                    logger_1.logger.debug(`[StateUpdate] Match ${matchId} not in detail_live response`);
                    continue;
                }
                // 4. Parse status from response
                let newStatusId = matchData.status_id;
                if (Array.isArray(matchData.score) && matchData.score.length >= 2) {
                    newStatusId = matchData.score[1];
                }
                // 5. Parse scores and minute
                let homeScore = 0;
                let awayScore = 0;
                if (Array.isArray(matchData.score) && matchData.score.length >= 4) {
                    const homeScoreDisplay = Array.isArray(matchData.score[2])
                        ? matchData.score[2][0]
                        : null;
                    const awayScoreDisplay = Array.isArray(matchData.score[3])
                        ? matchData.score[3][0]
                        : null;
                    if (homeScoreDisplay !== null)
                        homeScore = homeScoreDisplay;
                    if (awayScoreDisplay !== null)
                        awayScore = awayScoreDisplay;
                }
                else if (matchData.home_score !== undefined && matchData.away_score !== undefined) {
                    homeScore = matchData.home_score;
                    awayScore = matchData.away_score;
                }
                const newMinute = matchData.minute !== undefined ? matchData.minute : null;
                // 6. Prepare database updates
                const updates = [];
                updates.push({
                    field: 'status_id',
                    value: newStatusId,
                    source: 'api_state_update',
                    timestamp: nowTs,
                });
                updates.push({
                    field: 'home_score_display',
                    value: homeScore,
                    source: 'api_state_update',
                    timestamp: nowTs,
                });
                updates.push({
                    field: 'away_score_display',
                    value: awayScore,
                    source: 'api_state_update',
                    timestamp: nowTs,
                });
                if (newMinute !== null) {
                    updates.push({
                        field: 'minute',
                        value: newMinute,
                        source: 'api_state_update',
                        timestamp: nowTs,
                    });
                    // Generate minute_text
                    const minuteText = (0, matchMinuteText_1.generateMinuteText)(newMinute, newStatusId);
                    updates.push({
                        field: 'minute_text',
                        value: minuteText,
                        source: 'api_state_update',
                        timestamp: nowTs,
                    });
                }
                updates.push({
                    field: 'provider_update_time',
                    value: matchData.update_time || nowTs,
                    source: 'api_state_update',
                    timestamp: nowTs,
                });
                // 7. Write to database
                const result = await updateMatchDirect(matchId, updates);
                if (result.success) {
                    updatedCount++;
                    // 8. Log state transitions
                    if (oldStatusId !== newStatusId) {
                        const transitions = {
                            '1-2': 'STARTED',
                            '2-3': 'HALF-TIME',
                            '3-4': '2ND HALF',
                            '4-8': 'FINISHED',
                            '2-8': 'FINISHED (no HT)',
                        };
                        const transitionKey = `${oldStatusId}-${newStatusId}`;
                        const transitionName = transitions[transitionKey] || `${oldStatusId}→${newStatusId}`;
                        logger_1.logger.info(`[StateUpdate] ✅ Match ${matchId} ${transitionName} (${homeScore}-${awayScore})`);
                        // 9. Broadcast WebSocket event
                        (0, websocket_routes_1.broadcastEvent)({
                            type: 'MATCH_STATE_CHANGE',
                            matchId: matchId,
                            statusId: newStatusId,
                            newStatus: newStatusId,
                            minute: newMinute,
                            timestamp: Date.now(),
                        });
                    }
                    results.push({
                        matchId,
                        status: 'updated',
                        oldStatus: oldStatusId,
                        newStatus: newStatusId,
                        score: `${homeScore}-${awayScore}`,
                    });
                }
            }
            catch (matchError) {
                logger_1.logger.error(`[StateUpdate] Error processing ${matchId}:`, matchError.message);
                results.push({
                    matchId,
                    status: 'error',
                    message: matchError.message,
                });
            }
        }
        const duration = Date.now() - startTime;
        logger_1.logger.info(`[StateUpdate] Completed in ${duration}ms: ${updatedCount}/${changedMatchIds.length} matches updated`);
        return reply.send({
            success: true,
            updated: updatedCount,
            total: changedMatchIds.length,
            duration_ms: duration,
            results: results.slice(0, 10), // Return first 10 for debugging
        });
    }
    catch (error) {
        logger_1.logger.error('[StateUpdate] Error:', error);
        return reply.status(500).send({
            success: false,
            error: error.message,
        });
    }
}
