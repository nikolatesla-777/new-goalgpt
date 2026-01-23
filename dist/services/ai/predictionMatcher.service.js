"use strict";
/**
 * Prediction Matcher Service
 *
 * Automatically matches predictions with NULL match_id to actual matches in ts_matches table
 * Uses team name matching and date proximity to find the correct match
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictionMatcherService = exports.PredictionMatcherService = void 0;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const teamNameMatcher_service_1 = require("./teamNameMatcher.service");
const unifiedPrediction_service_1 = require("./unifiedPrediction.service");
class PredictionMatcherService {
    /**
     * Match all unmatched predictions (match_id IS NULL)
     * Uses team names and creation date to find matches
     * Processes in batches to avoid connection pool exhaustion
     */
    async matchUnmatchedPredictions() {
        try {
            logger_1.logger.info('[PredictionMatcher] Starting to match unmatched predictions...');
            // Get all predictions with NULL match_id (limit to recent ones)
            const unmatchedQuery = `
        SELECT
          id,
          external_id,
          home_team_name,
          away_team_name,
          league_name,
          created_at,
          minute_at_prediction
        FROM ai_predictions
        WHERE match_id IS NULL
          AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 50
      `;
            const result = await connection_1.pool.query(unmatchedQuery);
            const unmatchedPredictions = result.rows;
            logger_1.logger.info(`[PredictionMatcher] Found ${unmatchedPredictions.length} unmatched predictions`);
            if (unmatchedPredictions.length === 0) {
                return [];
            }
            // Process in batches of 5 to avoid connection pool exhaustion
            const BATCH_SIZE = 5;
            const matchResults = [];
            for (let i = 0; i < unmatchedPredictions.length; i += BATCH_SIZE) {
                const batch = unmatchedPredictions.slice(i, i + BATCH_SIZE);
                logger_1.logger.info(`[PredictionMatcher] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(unmatchedPredictions.length / BATCH_SIZE)}`);
                // Process batch sequentially (not parallel) to control connection usage
                for (const prediction of batch) {
                    try {
                        const matchResult = await this.matchSinglePrediction(prediction.id, prediction.external_id, prediction.home_team_name, prediction.away_team_name, prediction.league_name, prediction.created_at, prediction.minute_at_prediction);
                        matchResults.push(matchResult);
                    }
                    catch (error) {
                        logger_1.logger.error(`[PredictionMatcher] Error matching prediction ${prediction.id}:`, error);
                        matchResults.push({
                            predictionId: prediction.id,
                            predictionExternalId: prediction.external_id,
                            homeTeam: prediction.home_team_name,
                            awayTeam: prediction.away_team_name,
                            matchFound: false,
                            error: error.message
                        });
                    }
                }
                // Small delay between batches to let connections close
                if (i + BATCH_SIZE < unmatchedPredictions.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            const successCount = matchResults.filter(r => r.matchFound).length;
            logger_1.logger.info(`[PredictionMatcher] Matched ${successCount}/${matchResults.length} predictions`);
            return matchResults;
        }
        catch (error) {
            logger_1.logger.error('[PredictionMatcher] Error in matchUnmatchedPredictions:', error);
            throw error;
        }
    }
    /**
     * Match a single prediction to a match
     */
    async matchSinglePrediction(predictionId, externalId, homeTeamName, awayTeamName, leagueName, createdAt, minuteAtPrediction) {
        try {
            logger_1.logger.info(`[PredictionMatcher] Matching prediction ${externalId}: ${homeTeamName} vs ${awayTeamName}`);
            // Use teamNameMatcherService to find the match
            const matchLookup = await teamNameMatcher_service_1.teamNameMatcherService.findMatchByTeams(homeTeamName, awayTeamName, minuteAtPrediction, undefined, // No score hint
            leagueName);
            if (!matchLookup) {
                logger_1.logger.warn(`[PredictionMatcher] No match found for prediction ${externalId}`);
                return {
                    predictionId,
                    predictionExternalId: externalId,
                    homeTeam: homeTeamName,
                    awayTeam: awayTeamName,
                    matchFound: false
                };
            }
            // Match found! Update the prediction
            logger_1.logger.info(`[PredictionMatcher] Match found for ${externalId}: ${matchLookup.matchExternalId} (confidence: ${Math.round(matchLookup.overallConfidence * 100)}%)`);
            await unifiedPrediction_service_1.unifiedPredictionService.matchPrediction(predictionId, matchLookup.matchExternalId, matchLookup.matchUuid, matchLookup.overallConfidence, matchLookup.homeTeam.teamId, matchLookup.awayTeam.teamId);
            logger_1.logger.info(`[PredictionMatcher] ✅ Successfully matched prediction ${externalId} to match ${matchLookup.matchExternalId}`);
            return {
                predictionId,
                predictionExternalId: externalId,
                homeTeam: homeTeamName,
                awayTeam: awayTeamName,
                matchFound: true,
                matchId: matchLookup.matchExternalId,
                matchUuid: matchLookup.matchUuid,
                confidence: matchLookup.overallConfidence
            };
        }
        catch (error) {
            logger_1.logger.error(`[PredictionMatcher] Error matching single prediction ${predictionId}:`, error);
            return {
                predictionId,
                predictionExternalId: externalId,
                homeTeam: homeTeamName,
                awayTeam: awayTeamName,
                matchFound: false,
                error: error.message
            };
        }
    }
    /**
     * Match a specific prediction by external ID
     * Useful for manual matching or testing
     */
    async matchByExternalId(externalId) {
        try {
            const predQuery = `
        SELECT
          id,
          external_id,
          home_team_name,
          away_team_name,
          league_name,
          created_at,
          minute_at_prediction,
          match_id
        FROM ai_predictions
        WHERE external_id = $1
      `;
            const result = await connection_1.pool.query(predQuery, [externalId]);
            if (result.rows.length === 0) {
                throw new Error(`Prediction with external_id ${externalId} not found`);
            }
            const prediction = result.rows[0];
            if (prediction.match_id) {
                logger_1.logger.info(`[PredictionMatcher] Prediction ${externalId} already has match_id: ${prediction.match_id}`);
                return {
                    predictionId: prediction.id,
                    predictionExternalId: externalId,
                    homeTeam: prediction.home_team_name,
                    awayTeam: prediction.away_team_name,
                    matchFound: true,
                    matchId: prediction.match_id
                };
            }
            return await this.matchSinglePrediction(prediction.id, prediction.external_id, prediction.home_team_name, prediction.away_team_name, prediction.league_name, prediction.created_at, prediction.minute_at_prediction);
        }
        catch (error) {
            logger_1.logger.error(`[PredictionMatcher] Error matching prediction by external ID ${externalId}:`, error);
            throw error;
        }
    }
}
exports.PredictionMatcherService = PredictionMatcherService;
exports.predictionMatcherService = new PredictionMatcherService();
