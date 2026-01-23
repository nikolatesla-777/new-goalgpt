"use strict";
/**
 * Table Live Service
 *
 * Handles real-time standings from /table/live endpoint
 * Note: /table/live returns ALL live league standings, then we filter by season_id
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableLiveService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
const connection_1 = require("../../../database/connection");
class TableLiveService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get real-time standings with cache support
     * Note: /table/live returns all leagues with live matches
     */
    async getTableLive(seasonId) {
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:table:live:all`;
        // Always fetch all live standings (API doesn't filter well by season_id)
        let response = await cache_service_1.cacheService.get(cacheKey);
        if (!response) {
            logger_1.logger.info(`Fetching all live standings from /table/live`);
            response = await this.client.get('/table/live', {});
            // Cache for 1 minute
            if (response && response.results) {
                await cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.Minute);
            }
        }
        // Filter by season_id if provided
        if (seasonId && response?.results) {
            const filtered = response.results.filter((r) => r.season_id === seasonId);
            return { code: response.code, results: filtered };
        }
        return response || { code: 0, results: [] };
    }
    /**
     * Sync standings to database for a season
     */
    async syncStandingsToDb(seasonId) {
        try {
            const response = await this.getTableLive(seasonId);
            if (!response.results || response.results.length === 0) {
                logger_1.logger.debug(`No live standings data for season ${seasonId}`);
                return;
            }
            // Parse the first result (should be the season's standings)
            const seasonData = response.results[0];
            if (!seasonData || !seasonData.tables || !Array.isArray(seasonData.tables)) {
                logger_1.logger.debug(`Invalid standings structure for season ${seasonId}`);
                return;
            }
            // Parse standings into our format
            const standings = this.parseTableLiveResponse(seasonData);
            if (standings.length === 0) {
                logger_1.logger.debug(`No teams in standings for season ${seasonId}`);
                return;
            }
            const client = await connection_1.pool.connect();
            try {
                await client.query(`
                    INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
                    VALUES ($1, $2, $3, NOW())
                    ON CONFLICT (season_id) 
                    DO UPDATE SET 
                        standings = EXCLUDED.standings,
                        raw_response = EXCLUDED.raw_response,
                        updated_at = NOW()
                `, [seasonId, JSON.stringify(standings), JSON.stringify(response)]);
                logger_1.logger.info(`✅ Synced standings for season ${seasonId}: ${standings.length} teams`);
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to sync standings for season ${seasonId}:`, error.message);
        }
    }
    /**
     * Parse /table/live response into our format
     */
    parseTableLiveResponse(seasonData) {
        const result = [];
        if (!seasonData.tables || !Array.isArray(seasonData.tables)) {
            return result;
        }
        for (const table of seasonData.tables) {
            if (!table.rows || !Array.isArray(table.rows))
                continue;
            for (const row of table.rows) {
                result.push({
                    position: row.position,
                    team_id: row.team_id,
                    played: row.total || 0,
                    won: row.won || 0,
                    drawn: row.draw || 0,
                    lost: row.loss || 0,
                    goals_for: row.goals || 0,
                    goals_against: row.goals_against || 0,
                    goal_diff: row.goal_diff || 0,
                    points: row.points || 0,
                    home_played: row.home_total || 0,
                    home_won: row.home_won || 0,
                    home_drawn: row.home_draw || 0,
                    home_lost: row.home_loss || 0,
                    home_goals_for: row.home_goals || 0,
                    home_goals_against: row.home_goals_against || 0,
                    away_played: row.away_total || 0,
                    away_won: row.away_won || 0,
                    away_drawn: row.away_draw || 0,
                    away_lost: row.away_loss || 0,
                    away_goals_for: row.away_goals || 0,
                    away_goals_against: row.away_goals_against || 0,
                    promotion_id: row.promotion_id || null,
                    group: table.group || 0,
                });
            }
        }
        // Sort by position
        result.sort((a, b) => a.position - b.position);
        return result;
    }
}
exports.TableLiveService = TableLiveService;
