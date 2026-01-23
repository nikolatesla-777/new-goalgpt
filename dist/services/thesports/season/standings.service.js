"use strict";
/**
 * Season Standings Service
 *
 * Handles standings from /table/live endpoint (real-time standings)
 * Falls back to database cache when API returns no data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeasonStandingsService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
const connection_1 = require("../../../database/connection");
class SeasonStandingsService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get season standings - tries API first, falls back to DB
     * Always enriches with team names from ts_teams table
     */
    async getSeasonStandings(params) {
        const { season_id } = params;
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:season:standings:${season_id}`;
        // 1. Check cache first
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached && cached.results && Array.isArray(cached.results) && cached.results.length > 0) {
            logger_1.logger.debug(`Cache hit for season standings: ${cacheKey}`);
            return cached;
        }
        let standings = [];
        // 2. Try /table/live endpoint (only works if league has live matches)
        try {
            logger_1.logger.info(`Fetching standings from /table/live for season: ${season_id}`);
            const liveResponse = await this.client.get('/table/live', { season_id });
            // Find the standings for this specific season
            if (liveResponse.results && Array.isArray(liveResponse.results)) {
                // CRITICAL FIX: Log all returned season IDs for debugging
                const returnedSeasonIds = liveResponse.results.map((r) => r.season_id);
                logger_1.logger.info(`/table/live returned ${liveResponse.results.length} seasons: ${returnedSeasonIds.join(', ')}`);
                const seasonStandings = liveResponse.results.find((r) => r.season_id === season_id);
                if (seasonStandings && seasonStandings.tables && seasonStandings.tables.length > 0) {
                    // Parse standings
                    standings = this.parseTableLiveResponse(seasonStandings);
                    // Save raw to database (without team names - we'll enrich on read)
                    await this.saveStandingsToDb(season_id, standings, liveResponse);
                    logger_1.logger.info(`✅ Found matching standings for season ${season_id}: ${standings.length} teams`);
                }
                else {
                    // CRITICAL FIX: API returned data but for DIFFERENT seasons
                    // This happens for minor leagues where API doesn't have standings
                    logger_1.logger.warn(`⚠️ /table/live returned data for seasons [${returnedSeasonIds.join(', ')}] but NOT for requested season ${season_id}`);
                    // DO NOT cache wrong data - leave standings empty
                }
            }
        }
        catch (error) {
            logger_1.logger.warn(`/table/live failed for ${season_id}: ${error.message}`);
        }
        // 3. If no live data, get from database
        if (standings.length === 0) {
            logger_1.logger.info(`Fetching standings from DB for season: ${season_id}`);
            const dbStandings = await this.getStandingsFromDb(season_id);
            if (dbStandings && dbStandings.standings && Array.isArray(dbStandings.standings)) {
                standings = dbStandings.standings;
            }
        }
        // 4. Enrich with team names from ts_teams table
        if (standings.length > 0) {
            standings = await this.enrichWithTeamNames(standings);
            const response = { code: 0, results: standings };
            await cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.FiveMinutes);
            return response;
        }
        // No data available
        logger_1.logger.warn(`No standings data found for season: ${season_id}`);
        return { code: 0, results: [] };
    }
    /**
     * Enrich standings with team names from ts_teams table
     */
    async enrichWithTeamNames(standings) {
        if (!standings || standings.length === 0)
            return standings;
        const teamIds = standings.map(s => s.team_id).filter(Boolean);
        if (teamIds.length === 0)
            return standings;
        const client = await connection_1.pool.connect();
        try {
            // Get team names and logos from ts_teams
            const placeholders = teamIds.map((_, i) => `$${i + 1}`).join(',');
            const result = await client.query(`SELECT external_id, name, logo_url FROM ts_teams WHERE external_id IN (${placeholders})`, teamIds);
            // Create lookup map
            const teamMap = new Map();
            for (const row of result.rows) {
                teamMap.set(row.external_id, { name: row.name, logo_url: row.logo_url });
            }
            // Enrich standings
            return standings.map(team => ({
                ...team,
                team_name: teamMap.get(team.team_id)?.name || null,
                team_logo: teamMap.get(team.team_id)?.logo_url || null,
            }));
        }
        finally {
            client.release();
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
                    team_name: row.team_name || null, // Will be enriched later
                    played: row.total || 0,
                    won: row.won || 0,
                    drawn: row.draw || 0,
                    lost: row.loss || 0,
                    goals_for: row.goals || 0,
                    goals_against: row.goals_against || 0,
                    goal_diff: row.goal_diff || 0,
                    points: row.points || 0,
                    // Additional details
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
    /**
     * Save standings to database
     */
    async saveStandingsToDb(seasonId, standings, rawResponse) {
        const client = await connection_1.pool.connect();
        try {
            await client.query(`
                INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (season_id) DO UPDATE SET
                    standings = EXCLUDED.standings,
                    raw_response = EXCLUDED.raw_response,
                    updated_at = NOW()
            `, [seasonId, JSON.stringify(standings), JSON.stringify(rawResponse)]);
            logger_1.logger.info(`✅ Saved standings for season ${seasonId}: ${standings.length} teams`);
        }
        finally {
            client.release();
        }
    }
    /**
     * Get standings from database
     */
    async getStandingsFromDb(seasonId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query('SELECT standings FROM ts_standings WHERE season_id = $1', [seasonId]);
            return result.rows[0] || null;
        }
        finally {
            client.release();
        }
    }
}
exports.SeasonStandingsService = SeasonStandingsService;
