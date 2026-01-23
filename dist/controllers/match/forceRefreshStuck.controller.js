"use strict";
/**
 * Force Refresh Stuck Matches Controller
 *
 * Endpoint to manually refresh matches stuck at 90+ minutes
 * Uses /match/detail_live API to get latest status
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.forceRefreshStuckMatches = forceRefreshStuckMatches;
exports.forceRefreshMatch = forceRefreshMatch;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const matchDetailLive_service_1 = require("../../services/thesports/match/matchDetailLive.service");
const websocket_routes_1 = require("../../routes/websocket.routes");
const matchDetailLiveService = new matchDetailLive_service_1.MatchDetailLiveService();
/**
 * Force refresh stuck matches (minute >= 105 or minute >= 90 with 15+ min stale)
 */
async function forceRefreshStuckMatches(request, reply) {
    try {
        const nowTs = Math.floor(Date.now() / 1000);
        // Find stuck matches
        const stuckQuery = `
      SELECT
        external_id,
        status_id,
        minute,
        home_score_display,
        away_score_display,
        FLOOR(($1 - COALESCE(home_score_timestamp, match_time)) / 60) as mins_since_update
      FROM ts_matches
      WHERE status_id IN (2,3,4,5,7)
        AND (
          minute >= 105
          OR (minute >= 90 AND $1 - COALESCE(home_score_timestamp, match_time) > 900)
        )
      ORDER BY minute DESC
      LIMIT 50
    `;
        const stuckResult = await connection_1.pool.query(stuckQuery, [nowTs]);
        const stuckMatches = stuckResult.rows;
        logger_1.logger.info(`[ForceRefresh] Found ${stuckMatches.length} stuck matches`);
        if (stuckMatches.length === 0) {
            return reply.send({
                success: true,
                message: 'No stuck matches found',
                refreshed: 0,
                finished: 0,
            });
        }
        let refreshedCount = 0;
        let finishedCount = 0;
        const results = [];
        // Process each stuck match
        for (const match of stuckMatches) {
            try {
                logger_1.logger.info(`[ForceRefresh] Processing ${match.external_id} (minute: ${match.minute}, stale: ${match.mins_since_update}min)`);
                // Fetch latest data from /match/detail_live
                const resp = await matchDetailLiveService.getMatchDetailLive({ match_id: match.external_id }, { forceRefresh: true });
                const results_list = resp.results || resp.result_list || [];
                const matchData = results_list.find((m) => String(m?.id || m?.match_id) === String(match.external_id));
                if (!matchData) {
                    logger_1.logger.warn(`[ForceRefresh] Match ${match.external_id} not found in detail_live response`);
                    results.push({
                        matchId: match.external_id,
                        status: 'not_found',
                        message: 'Match not in detail_live response',
                    });
                    continue;
                }
                // Parse status from response
                let newStatusId = matchData.status_id;
                if (Array.isArray(matchData.score) && matchData.score.length >= 2) {
                    newStatusId = matchData.score[1];
                }
                // Parse scores
                let homeScore = match.home_score_display;
                let awayScore = match.away_score_display;
                if (Array.isArray(matchData.score) && matchData.score.length >= 4) {
                    const homeScoreDisplay = Array.isArray(matchData.score[2]) ? matchData.score[2][0] : null;
                    const awayScoreDisplay = Array.isArray(matchData.score[3]) ? matchData.score[3][0] : null;
                    if (homeScoreDisplay !== null)
                        homeScore = homeScoreDisplay;
                    if (awayScoreDisplay !== null)
                        awayScore = awayScoreDisplay;
                }
                else if (matchData.home_score !== undefined && matchData.away_score !== undefined) {
                    homeScore = matchData.home_score;
                    awayScore = matchData.away_score;
                }
                const newMinute = matchData.minute !== undefined ? matchData.minute : match.minute;
                // Update database
                const updateQuery = `
          UPDATE ts_matches
          SET
            status_id = $1,
            minute = $2,
            home_score_display = $3,
            away_score_display = $4,
            status_id_source = 'api_force_refresh',
            status_id_timestamp = $5,
            minute_source = 'api_force_refresh',
            minute_timestamp = $5,
            home_score_source = 'api_force_refresh',
            home_score_timestamp = $5,
            away_score_source = 'api_force_refresh',
            away_score_timestamp = $5,
            provider_update_time = COALESCE($6, provider_update_time),
            updated_at = NOW()
          WHERE external_id = $7
          RETURNING status_id, minute, home_score_display, away_score_display
        `;
                const updateResult = await connection_1.pool.query(updateQuery, [
                    newStatusId,
                    newMinute,
                    homeScore,
                    awayScore,
                    nowTs,
                    matchData.update_time || null,
                    match.external_id,
                ]);
                if (updateResult.rowCount > 0) {
                    const updated = updateResult.rows[0];
                    refreshedCount++;
                    if (newStatusId === 8) {
                        finishedCount++;
                        logger_1.logger.info(`[ForceRefresh] ✅ Match ${match.external_id} FINISHED ${updated.home_score_display}-${updated.away_score_display}`);
                    }
                    else {
                        logger_1.logger.info(`[ForceRefresh] ✅ Match ${match.external_id} updated to status=${newStatusId}, minute=${updated.minute}`);
                    }
                    // Broadcast WebSocket events
                    if (homeScore !== match.home_score_display || awayScore !== match.away_score_display) {
                        (0, websocket_routes_1.broadcastEvent)({
                            type: 'SCORE_CHANGE',
                            matchId: match.external_id,
                            homeScore,
                            awayScore,
                            statusId: newStatusId,
                            timestamp: Date.now(),
                        });
                    }
                    if (newStatusId !== match.status_id) {
                        (0, websocket_routes_1.broadcastEvent)({
                            type: 'MATCH_STATE_CHANGE',
                            matchId: match.external_id,
                            statusId: newStatusId,
                            newStatus: newStatusId,
                            timestamp: Date.now(),
                        });
                    }
                    if (newMinute !== match.minute) {
                        (0, websocket_routes_1.broadcastEvent)({
                            type: 'MINUTE_UPDATE',
                            matchId: match.external_id,
                            minute: newMinute,
                            statusId: newStatusId,
                            timestamp: Date.now(),
                        });
                    }
                    results.push({
                        matchId: match.external_id,
                        status: 'updated',
                        oldStatus: match.status_id,
                        newStatus: newStatusId,
                        oldMinute: match.minute,
                        newMinute: updated.minute,
                        score: `${updated.home_score_display}-${updated.away_score_display}`,
                    });
                }
            }
            catch (matchError) {
                logger_1.logger.error(`[ForceRefresh] Error processing ${match.external_id}: ${matchError.message}`);
                results.push({
                    matchId: match.external_id,
                    status: 'error',
                    message: matchError.message,
                });
            }
        }
        logger_1.logger.info(`[ForceRefresh] Completed: ${refreshedCount} refreshed, ${finishedCount} finished`);
        return reply.send({
            success: true,
            message: `Refreshed ${refreshedCount} matches, ${finishedCount} finished`,
            refreshed: refreshedCount,
            finished: finishedCount,
            total: stuckMatches.length,
            results,
        });
    }
    catch (error) {
        logger_1.logger.error('[ForceRefresh] Error:', error);
        return reply.status(500).send({
            success: false,
            error: error.message,
        });
    }
}
/**
 * Force refresh single match by ID
 */
async function forceRefreshMatch(request, reply) {
    try {
        const matchId = request.params.id;
        const nowTs = Math.floor(Date.now() / 1000);
        logger_1.logger.info(`[ForceRefresh] Manual refresh requested for ${matchId}`);
        // Fetch latest data from /match/detail_live
        const resp = await matchDetailLiveService.getMatchDetailLive({ match_id: matchId }, { forceRefresh: true });
        const results_list = resp.results || resp.result_list || [];
        const matchData = results_list.find((m) => String(m?.id || m?.match_id) === String(matchId));
        if (!matchData) {
            return reply.status(404).send({
                success: false,
                error: 'Match not found in detail_live response',
            });
        }
        // Parse status
        let newStatusId = matchData.status_id;
        if (Array.isArray(matchData.score) && matchData.score.length >= 2) {
            newStatusId = matchData.score[1];
        }
        // Parse scores
        let homeScore = 0;
        let awayScore = 0;
        if (Array.isArray(matchData.score) && matchData.score.length >= 4) {
            const homeScoreDisplay = Array.isArray(matchData.score[2]) ? matchData.score[2][0] : null;
            const awayScoreDisplay = Array.isArray(matchData.score[3]) ? matchData.score[3][0] : null;
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
        // Update database
        const updateQuery = `
      UPDATE ts_matches
      SET
        status_id = $1,
        minute = $2,
        home_score_display = $3,
        away_score_display = $4,
        status_id_source = 'api_manual_refresh',
        status_id_timestamp = $5,
        minute_source = 'api_manual_refresh',
        minute_timestamp = $5,
        home_score_source = 'api_manual_refresh',
        home_score_timestamp = $5,
        away_score_source = 'api_manual_refresh',
        away_score_timestamp = $5,
        provider_update_time = COALESCE($6, provider_update_time),
        updated_at = NOW()
      WHERE external_id = $7
      RETURNING status_id, minute, home_score_display, away_score_display
    `;
        const updateResult = await connection_1.pool.query(updateQuery, [
            newStatusId,
            newMinute,
            homeScore,
            awayScore,
            nowTs,
            matchData.update_time || null,
            matchId,
        ]);
        if (updateResult.rowCount === 0) {
            return reply.status(404).send({
                success: false,
                error: 'Match not found in database',
            });
        }
        const updated = updateResult.rows[0];
        logger_1.logger.info(`[ForceRefresh] ✅ Match ${matchId} manually refreshed: status=${updated.status_id}, minute=${updated.minute}, score=${updated.home_score_display}-${updated.away_score_display}`);
        // Broadcast WebSocket events
        (0, websocket_routes_1.broadcastEvent)({
            type: 'SCORE_CHANGE',
            matchId,
            homeScore,
            awayScore,
            statusId: newStatusId,
            timestamp: Date.now(),
        });
        (0, websocket_routes_1.broadcastEvent)({
            type: 'MATCH_STATE_CHANGE',
            matchId,
            statusId: newStatusId,
            newStatus: newStatusId,
            timestamp: Date.now(),
        });
        if (newMinute !== null) {
            (0, websocket_routes_1.broadcastEvent)({
                type: 'MINUTE_UPDATE',
                matchId,
                minute: newMinute,
                statusId: newStatusId,
                timestamp: Date.now(),
            });
        }
        return reply.send({
            success: true,
            message: 'Match refreshed successfully',
            match: {
                id: matchId,
                status_id: updated.status_id,
                minute: updated.minute,
                home_score: updated.home_score_display,
                away_score: updated.away_score_display,
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`[ForceRefresh] Error refreshing match: ${error.message}`);
        return reply.status(500).send({
            success: false,
            error: error.message,
        });
    }
}
