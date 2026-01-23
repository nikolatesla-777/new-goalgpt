"use strict";
/**
 * Data Update Service
 *
 * Monitors TheSports API for real-time updates and dispatches to appropriate services
 * Uses /data/update endpoint to get changed entity IDs in the last 120 seconds
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataUpdateService = void 0;
const config_1 = require("../../../config");
const logger_1 = require("../../../utils/logger");
const obsLogger_1 = require("../../../utils/obsLogger");
const teamSync_service_1 = require("../team/teamSync.service");
const teamData_service_1 = require("../team/teamData.service");
const circuitBreaker_1 = require("../../../utils/circuitBreaker");
// SINGLETON: Use shared API client
const core_1 = require("../../../core");
class DataUpdateService {
    constructor() {
        this.baseUrl = config_1.config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
        this.user = config_1.config.thesports?.user || '';
        this.secret = config_1.config.thesports?.secret || '';
        this.teamSyncService = new teamSync_service_1.TeamSyncService();
        // SINGLETON: Use shared API client with global rate limiting
        this.teamDataService = new teamData_service_1.TeamDataService();
        // Phase 4-2: Single circuit layer - circuit breaker is in singleton, not here
    }
    /**
     * Check for updates from TheSports API
     * Returns the raw payload from /data/update endpoint
     */
    async checkUpdates() {
        try {
            logger_1.logger.debug('Checking for data updates...');
            // Phase 4-2: Single circuit layer - circuit breaker is in TheSportsClient
            try {
                const data = await core_1.theSportsAPI.get('/data/update', {});
                // Check for errors in response
                if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
                    const errorMsg = data.err || data.msg || 'Unknown error';
                    logger_1.logger.warn(`TheSports API error for data/update: ${errorMsg}`);
                    return data; // Return payload even on error
                }
                const results = data.results || {};
                const typeKeys = Object.keys(results);
                if (typeKeys.length === 0) {
                    logger_1.logger.debug('No updates detected');
                    return data; // Return payload even if no updates
                }
                logger_1.logger.info(`Detected updates for ${typeKeys.length} type(s)`);
                // Iterate through each type key and dispatch updates
                for (const typeKey of typeKeys) {
                    const updateItems = results[typeKey] || [];
                    if (updateItems.length === 0) {
                        continue;
                    }
                    // Log to learn the type mapping
                    logger_1.logger.info(`Update Detected for Type: ${typeKey}, Count: ${updateItems.length}`, {
                        sampleItem: updateItems[0],
                    });
                    // Extract IDs based on common patterns
                    const matchIds = [];
                    const teamIds = [];
                    for (const item of updateItems) {
                        // Check for match_id
                        if (item.match_id && typeof item.match_id === 'string') {
                            matchIds.push(item.match_id);
                        }
                        // Check for team_id
                        if (item.team_id && typeof item.team_id === 'string') {
                            teamIds.push(item.team_id);
                        }
                        // Also check if the typeKey itself suggests the entity type
                        // or if the item keys suggest it
                        const itemKeys = Object.keys(item);
                        if (itemKeys.includes('match_id') && !matchIds.includes(item.match_id)) {
                            matchIds.push(item.match_id);
                        }
                        if (itemKeys.includes('team_id') && !teamIds.includes(item.team_id)) {
                            teamIds.push(item.team_id);
                        }
                    }
                    // Dispatch updates based on detected IDs
                    if (matchIds.length > 0) {
                        logger_1.logger.info(`Dispatching ${matchIds.length} match update(s)`);
                        await this.syncMatches(matchIds);
                    }
                    if (teamIds.length > 0) {
                        logger_1.logger.info(`Dispatching ${teamIds.length} team update(s)`);
                        await this.syncTeams(teamIds);
                    }
                    // If no match_id or team_id found, log for learning
                    if (matchIds.length === 0 && teamIds.length === 0) {
                        logger_1.logger.warn(`Type ${typeKey} has no recognized ID fields. Sample item:`, updateItems[0]);
                    }
                }
                // Return the root payload
                return data;
            }
            catch (circuitError) {
                // Phase 4-2: Circuit breaker is OPEN - skip provider call (typed error check)
                if (circuitError instanceof circuitBreaker_1.CircuitOpenError) {
                    (0, obsLogger_1.logEvent)('warn', 'provider.circuit.skip', {
                        provider: 'thesports-http',
                        endpoint: '/data/update',
                    });
                    return null; // Return null when circuit is open
                }
                // Re-throw other errors (retry logic will handle them)
                throw circuitError;
            }
        }
        catch (error) {
            // Phase 4-2: Errors are already logged by retry/circuit breaker
            // Return null on error so caller can handle it
            return null;
        }
    }
    /**
     * Sync specific matches by IDs
     * Uses match/detail_live endpoint to fetch updated match data
     */
    async syncMatches(matchIds) {
        if (matchIds.length === 0)
            return;
        try {
            logger_1.logger.info(`Syncing ${matchIds.length} specific match(es):`, matchIds.slice(0, 5));
            // Fetch matches individually using match/detail_live endpoint
            // Limit concurrency to avoid overwhelming the API
            const batchSize = 5;
            for (let i = 0; i < matchIds.length; i += batchSize) {
                const batch = matchIds.slice(i, i + batchSize);
                const promises = batch.map(async (matchId) => {
                    try {
                        // Use MatchDetailLiveService to fetch the match
                        // This will update cache and can be extended to update database
                        const response = await core_1.theSportsAPI.get('/match/detail_live', { match_id: matchId });
                        logger_1.logger.debug(`Updated match ${matchId} from data/update`);
                    }
                    catch (error) {
                        logger_1.logger.warn(`Failed to sync match ${matchId}:`, error.message);
                    }
                });
                await Promise.all(promises);
                // Small delay between batches
                if (i + batchSize < matchIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            logger_1.logger.info(`Completed syncing ${matchIds.length} match(es)`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to sync matches:`, error.message);
        }
    }
    /**
     * Sync specific teams by IDs
     * Uses TeamDataService to fetch and update teams
     */
    async syncTeams(teamIds) {
        if (teamIds.length === 0)
            return;
        try {
            logger_1.logger.info(`Syncing ${teamIds.length} specific team(s):`, teamIds.slice(0, 5));
            // Use TeamDataService.getTeamById for each team
            // This will fetch from API if not in cache/DB and update both
            // Limit concurrency to avoid overwhelming the API
            const batchSize = 10;
            for (let i = 0; i < teamIds.length; i += batchSize) {
                const batch = teamIds.slice(i, i + batchSize);
                const promises = batch.map(async (teamId) => {
                    try {
                        await this.teamDataService.getTeamById(teamId);
                        logger_1.logger.debug(`Updated team ${teamId} from data/update`);
                    }
                    catch (error) {
                        logger_1.logger.warn(`Failed to sync team ${teamId}:`, error.message);
                    }
                });
                await Promise.all(promises);
                // Small delay between batches
                if (i + batchSize < teamIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            logger_1.logger.info(`Completed syncing ${teamIds.length} team(s)`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to sync teams:`, error.message);
        }
    }
}
exports.DataUpdateService = DataUpdateService;
