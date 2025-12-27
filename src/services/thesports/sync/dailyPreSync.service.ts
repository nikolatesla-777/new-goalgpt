/**
 * Daily Pre-Sync Service
 * 
 * Orchestrates pre-sync of all match data before matches start:
 * - H2H data from /match/analysis
 * - Lineups from /match/lineup/detail
 * - Standings from /season/recent/table/detail
 * - Compensation from /compensation/list
 */

import { TheSportsClient } from '../client/thesports-client';
import { MatchAnalysisService } from '../match/matchAnalysis.service';
import { MatchLineupService } from '../match/matchLineup.service';
import { SeasonStandingsService } from '../season/standings.service';
import { CompensationService } from '../match/compensation.service';
import { TableLiveService } from '../season/tableLive.service';
import { logger } from '../../../utils/logger';
import { pool } from '../../../database/connection';

export interface PreSyncResult {
    h2hSynced: number;
    lineupsSynced: number;
    standingsSynced: number;
    compensationSynced: number;
    errors: string[];
}

export class DailyPreSyncService {
    private matchAnalysisService: MatchAnalysisService;
    private matchLineupService: MatchLineupService;
    private seasonStandingsService: SeasonStandingsService;
    private compensationService: CompensationService;
    private tableLiveService: TableLiveService;

    constructor(private client: TheSportsClient) {
        this.matchAnalysisService = new MatchAnalysisService(client);
        this.matchLineupService = new MatchLineupService(client);
        this.seasonStandingsService = new SeasonStandingsService(client);
        this.compensationService = new CompensationService(client);
        this.tableLiveService = new TableLiveService(client);
    }

    /**
     * Run full pre-sync for today's matches
     */
    async runPreSync(matchIds: string[], seasonIds: string[]): Promise<PreSyncResult> {
        const result: PreSyncResult = {
            h2hSynced: 0,
            lineupsSynced: 0,
            standingsSynced: 0,
            compensationSynced: 0,
            errors: [],
        };

        logger.info(`🔄 Starting pre-sync for ${matchIds.length} matches, ${seasonIds.length} seasons`);

        // 1. Sync H2H for each match
        for (const matchId of matchIds) {
            try {
                const synced = await this.syncH2HToDb(matchId);
                if (synced) {
                    result.h2hSynced++;
                }
            } catch (error: any) {
                result.errors.push(`H2H ${matchId}: ${error.message}`);
            }
        }

        // 2. Sync Lineups for each match
        for (const matchId of matchIds) {
            try {
                const synced = await this.syncLineupToDb(matchId);
                if (synced) {
                    result.lineupsSynced++;
                }
            } catch (error: any) {
                result.errors.push(`Lineup ${matchId}: ${error.message}`);
            }
        }

        // 3. Sync Standings for each season
        const uniqueSeasons = [...new Set(seasonIds)];
        for (const seasonId of uniqueSeasons) {
            try {
                const synced = await this.syncStandingsToDb(seasonId);
                if (synced) {
                    result.standingsSynced++;
                }
            } catch (error: any) {
                result.errors.push(`Standings ${seasonId}: ${error.message}`);
            }
        }

        // 4. Sync Compensation (paginated - all upcoming matches)
        try {
            result.compensationSynced = await this.compensationService.syncAllCompensation();
        } catch (error: any) {
            result.errors.push(`Compensation: ${error.message}`);
        }

        logger.info(`✅ Pre-sync complete: H2H=${result.h2hSynced}, Lineups=${result.lineupsSynced}, Standings=${result.standingsSynced}, Compensation=${result.compensationSynced}`);

        return result;
    }

    /**
     * Sync H2H data to database
     * @returns true if data was synced, false if no data available
     */
    async syncH2HToDb(matchId: string): Promise<boolean> {
        try {
            const response = await this.matchAnalysisService.getMatchAnalysis({ match_id: matchId });
            const results = (response as any).results || {};

            // Skip if no data
            if (!results || Object.keys(results).length === 0) {
                logger.debug(`No H2H data for match ${matchId}`);
                return false;
            }

            // Parse H2H data
            const h2hMatches = results.history || results.h2h || [];
            const homeRecentForm = results.home_last || results.home_recent || [];
            const awayRecentForm = results.away_last || results.away_recent || [];
            const goalDistribution = results.goal_distribution || null;

            // Calculate summary
            let totalMatches = 0, homeWins = 0, draws = 0, awayWins = 0;
            if (Array.isArray(h2hMatches)) {
                totalMatches = h2hMatches.length;
                for (const match of h2hMatches) {
                    const homeScore = match.home_score ?? match.home ?? 0;
                    const awayScore = match.away_score ?? match.away ?? 0;
                    if (homeScore > awayScore) homeWins++;
                    else if (homeScore < awayScore) awayWins++;
                    else draws++;
                }
            }

            const client = await pool.connect();
            try {
                await client.query(`
          INSERT INTO ts_match_h2h (
            match_id, total_matches, home_wins, draws, away_wins,
            h2h_matches, home_recent_form, away_recent_form, goal_distribution, raw_response, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (match_id) DO UPDATE SET
            total_matches = EXCLUDED.total_matches,
            home_wins = EXCLUDED.home_wins,
            draws = EXCLUDED.draws,
            away_wins = EXCLUDED.away_wins,
            h2h_matches = EXCLUDED.h2h_matches,
            home_recent_form = EXCLUDED.home_recent_form,
            away_recent_form = EXCLUDED.away_recent_form,
            goal_distribution = EXCLUDED.goal_distribution,
            raw_response = EXCLUDED.raw_response,
            updated_at = NOW()
        `, [
                    matchId, totalMatches, homeWins, draws, awayWins,
                    JSON.stringify(h2hMatches),
                    JSON.stringify(homeRecentForm),
                    JSON.stringify(awayRecentForm),
                    JSON.stringify(goalDistribution),
                    JSON.stringify(response)
                ]);

                logger.debug(`✅ Synced H2H for match ${matchId}: ${totalMatches} matches`);
                return true;
            } finally {
                client.release();
            }
        } catch (error: any) {
            logger.warn(`Failed to sync H2H for match ${matchId}: ${error.message}`);
            throw error; // Re-throw to be caught by caller
        }
    }

    /**
     * Sync Lineup data to database
     * @returns true if data was synced, false if no data available
     */
    async syncLineupToDb(matchId: string): Promise<boolean> {
        try {
            const response = await this.matchLineupService.getMatchLineup({ match_id: matchId });
            const results = (response as any).results || {};

            if (!results || Object.keys(results).length === 0) {
                logger.debug(`No lineup data for match ${matchId}`);
                return false;
            }

            const homeFormation = results.home_formation || results.home?.formation || null;
            const awayFormation = results.away_formation || results.away?.formation || null;
            const homeLineup = results.home_lineup || results.home?.lineup || [];
            const awayLineup = results.away_lineup || results.away?.lineup || [];
            const homeSubs = results.home_subs || results.home?.subs || [];
            const awaySubs = results.away_subs || results.away?.subs || [];

            const client = await pool.connect();
            try {
                await client.query(`
          INSERT INTO ts_match_lineups (
            match_id, home_formation, away_formation,
            home_lineup, away_lineup, home_subs, away_subs, raw_response, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (match_id) DO UPDATE SET
            home_formation = EXCLUDED.home_formation,
            away_formation = EXCLUDED.away_formation,
            home_lineup = EXCLUDED.home_lineup,
            away_lineup = EXCLUDED.away_lineup,
            home_subs = EXCLUDED.home_subs,
            away_subs = EXCLUDED.away_subs,
            raw_response = EXCLUDED.raw_response,
            updated_at = NOW()
        `, [
                    matchId, homeFormation, awayFormation,
                    JSON.stringify(homeLineup),
                    JSON.stringify(awayLineup),
                    JSON.stringify(homeSubs),
                    JSON.stringify(awaySubs),
                    JSON.stringify(response)
                ]);

                logger.debug(`✅ Synced lineup for match ${matchId}`);
                return true;
            } finally {
                client.release();
            }
        } catch (error: any) {
            logger.warn(`Failed to sync lineup for match ${matchId}: ${error.message}`);
            throw error; // Re-throw to be caught by caller
        }
    }

    /**
     * Sync Standings data to database
     * @returns true if data was synced, false if no data available
     */
    async syncStandingsToDb(seasonId: string): Promise<boolean> {
        try {
            const response = await this.seasonStandingsService.getSeasonStandings({ season_id: seasonId });
            const results = (response as any).results || [];

            if (!results || results.length === 0) {
                logger.debug(`No standings data for season ${seasonId}`);
                return false;
            }

            const client = await pool.connect();
            try {
                await client.query(`
          INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (season_id) DO UPDATE SET
            standings = EXCLUDED.standings,
            raw_response = EXCLUDED.raw_response,
            updated_at = NOW()
        `, [seasonId, JSON.stringify(results), JSON.stringify(response)]);

                logger.debug(`✅ Synced standings for season ${seasonId}`);
                return true;
            } finally {
                client.release();
            }
        } catch (error: any) {
            logger.warn(`Failed to sync standings for season ${seasonId}: ${error.message}`);
            throw error; // Re-throw to be caught by caller
        }
    }

    /**
     * Get H2H data from database
     */
    async getH2HFromDb(matchId: string): Promise<any> {
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT * FROM ts_match_h2h WHERE match_id = $1',
                [matchId]
            );
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    /**
     * Get Lineup data from database
     */
    async getLineupFromDb(matchId: string): Promise<any> {
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT * FROM ts_match_lineups WHERE match_id = $1',
                [matchId]
            );
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    /**
     * Get Standings data from database
     */
    async getStandingsFromDb(seasonId: string): Promise<any> {
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT * FROM ts_standings WHERE season_id = $1',
                [seasonId]
            );
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }
}
