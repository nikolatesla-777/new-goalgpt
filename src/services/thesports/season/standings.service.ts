/**
 * Season Standings Service
 * 
 * Handles standings from /table/live endpoint (real-time standings)
 * Falls back to database cache when API returns no data
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { SeasonStandingsParams, SeasonStandingsResponse } from '../../../types/thesports/season/seasonStandings.types';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { pool } from '../../../database/connection';

export class SeasonStandingsService {
    constructor(private client: TheSportsClient) { }

    /**
     * Get season standings - tries API first, falls back to DB
     * Always enriches with team names from ts_teams table
     */
    async getSeasonStandings(params: SeasonStandingsParams): Promise<SeasonStandingsResponse> {
        const { season_id } = params;
        const cacheKey = `${CacheKeyPrefix.TheSports}:season:standings:${season_id}`;

        // 1. Check cache first
        const cached = await cacheService.get<SeasonStandingsResponse>(cacheKey);
        if (cached && cached.results && Array.isArray(cached.results) && cached.results.length > 0) {
            logger.debug(`Cache hit for season standings: ${cacheKey}`);
            return cached;
        }

        let standings: any[] = [];

        // 2. Try /table/live endpoint (only works if league has live matches)
        try {
            logger.info(`Fetching standings from /table/live for season: ${season_id}`);
            const liveResponse = await this.client.get<{ code: number; results: any[] }>(
                '/table/live',
                { season_id }
            );

            // Find the standings for this specific season
            if (liveResponse.results && Array.isArray(liveResponse.results)) {
                const seasonStandings = liveResponse.results.find(
                    (r: any) => r.season_id === season_id
                );
                
                if (seasonStandings && seasonStandings.tables && seasonStandings.tables.length > 0) {
                    // Parse standings
                    standings = this.parseTableLiveResponse(seasonStandings);
                    
                    // Save raw to database (without team names - we'll enrich on read)
                    await this.saveStandingsToDb(season_id, standings, liveResponse);
                }
            }
        } catch (error: any) {
            logger.warn(`/table/live failed for ${season_id}: ${error.message}`);
        }

        // 3. If no live data, get from database
        if (standings.length === 0) {
            logger.info(`Fetching standings from DB for season: ${season_id}`);
            const dbStandings = await this.getStandingsFromDb(season_id);
            
            if (dbStandings && dbStandings.standings && Array.isArray(dbStandings.standings)) {
                standings = dbStandings.standings;
            }
        }

        // 4. Enrich with team names from ts_teams table
        if (standings.length > 0) {
            standings = await this.enrichWithTeamNames(standings);
            
            const response: SeasonStandingsResponse = { code: 0, results: standings };
            await cacheService.set(cacheKey, response, CacheTTL.FiveMinutes);
            return response;
        }

        // No data available
        logger.warn(`No standings data found for season: ${season_id}`);
        return { code: 0, results: [] };
    }

    /**
     * Enrich standings with team names from ts_teams table
     */
    private async enrichWithTeamNames(standings: any[]): Promise<any[]> {
        if (!standings || standings.length === 0) return standings;

        const teamIds = standings.map(s => s.team_id).filter(Boolean);
        if (teamIds.length === 0) return standings;

        const client = await pool.connect();
        try {
            // Get team names and logos from ts_teams
            const placeholders = teamIds.map((_, i) => `$${i + 1}`).join(',');
            const result = await client.query(
                `SELECT external_id, name, logo_url FROM ts_teams WHERE external_id IN (${placeholders})`,
                teamIds
            );

            // Create lookup map
            const teamMap = new Map<string, { name: string; logo_url: string }>();
            for (const row of result.rows) {
                teamMap.set(row.external_id, { name: row.name, logo_url: row.logo_url });
            }

            // Enrich standings
            return standings.map(team => ({
                ...team,
                team_name: teamMap.get(team.team_id)?.name || null,
                team_logo: teamMap.get(team.team_id)?.logo_url || null,
            }));
        } finally {
            client.release();
        }
    }

    /**
     * Parse /table/live response into our format
     */
    private parseTableLiveResponse(seasonData: any): any[] {
        const result: any[] = [];
        
        if (!seasonData.tables || !Array.isArray(seasonData.tables)) {
            return result;
        }

        for (const table of seasonData.tables) {
            if (!table.rows || !Array.isArray(table.rows)) continue;
            
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
    private async saveStandingsToDb(seasonId: string, standings: any[], rawResponse: any): Promise<void> {
        const client = await pool.connect();
        try {
            await client.query(`
                INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (season_id) DO UPDATE SET
                    standings = EXCLUDED.standings,
                    raw_response = EXCLUDED.raw_response,
                    updated_at = NOW()
            `, [seasonId, JSON.stringify(standings), JSON.stringify(rawResponse)]);
            
            logger.info(`✅ Saved standings for season ${seasonId}: ${standings.length} teams`);
        } finally {
            client.release();
        }
    }

    /**
     * Get standings from database
     */
    private async getStandingsFromDb(seasonId: string): Promise<any | null> {
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT standings FROM ts_standings WHERE season_id = $1',
                [seasonId]
            );
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }
}
