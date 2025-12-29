/**
 * PostMatchProcessor
 * 
 * Handles all data persistence when a match ends:
 * - Final statistics
 * - All incidents
 * - Final trend data
 * - Player statistics aggregation
 * - Standings update trigger
 * 
 * This ensures all match data is preserved in the database
 * even after the live APIs stop returning data.
 */

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { TheSportsClient } from '../thesports/client/thesports-client';
import { CombinedStatsService } from '../thesports/match/combinedStats.service';
import { MatchTrendService } from '../thesports/match/matchTrend.service';
import { TableLiveService } from '../thesports/season/tableLive.service';
import { MatchDetailLiveService } from '../thesports/match/matchDetailLive.service';

interface MatchData {
  match_id: string;
  external_id: string;
  season_id: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
}

interface ProcessingResult {
  match_id: string;
  success: boolean;
  stats_saved: boolean;
  incidents_saved: boolean;
  trend_saved: boolean;
  player_stats_saved: boolean;
  standings_updated: boolean;
  error?: string;
}

export class PostMatchProcessor {
  private combinedStatsService: CombinedStatsService;
  private matchTrendService: MatchTrendService;
  private tableLiveService: TableLiveService;
  private matchDetailLiveService: MatchDetailLiveService;

  constructor(client: TheSportsClient) {
    this.combinedStatsService = new CombinedStatsService(client);
    this.matchTrendService = new MatchTrendService(client);
    this.tableLiveService = new TableLiveService(client);
    this.matchDetailLiveService = new MatchDetailLiveService(client);
  }

  /**
   * Process a single match after it ends
   */
  async processMatchEnd(matchData: MatchData): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      match_id: matchData.match_id,
      success: false,
      stats_saved: false,
      incidents_saved: false,
      trend_saved: false,
      player_stats_saved: false,
      standings_updated: false
    };

    try {
      logger.info(`[PostMatch] Processing ended match: ${matchData.match_id}`);

      // 1. Save final statistics
      try {
        await this.saveFinalStats(matchData.match_id);
        result.stats_saved = true;
        logger.debug(`[PostMatch] Stats saved for ${matchData.match_id}`);
      } catch (error: any) {
        logger.warn(`[PostMatch] Failed to save stats for ${matchData.match_id}: ${error.message}`);
      }

      // 2. Save final incidents
      try {
        await this.saveFinalIncidents(matchData.match_id);
        result.incidents_saved = true;
        logger.debug(`[PostMatch] Incidents saved for ${matchData.match_id}`);
      } catch (error: any) {
        logger.warn(`[PostMatch] Failed to save incidents for ${matchData.match_id}: ${error.message}`);
      }

      // 3. Save final trend data
      try {
        await this.saveFinalTrend(matchData.match_id);
        result.trend_saved = true;
        logger.debug(`[PostMatch] Trend saved for ${matchData.match_id}`);
      } catch (error: any) {
        logger.warn(`[PostMatch] Failed to save trend for ${matchData.match_id}: ${error.message}`);
      }

      // 4. Process player statistics
      try {
        await this.processPlayerStats(matchData);
        result.player_stats_saved = true;
        logger.debug(`[PostMatch] Player stats saved for ${matchData.match_id}`);
      } catch (error: any) {
        logger.warn(`[PostMatch] Failed to save player stats for ${matchData.match_id}: ${error.message}`);
      }

      // 5. Update standings for the season
      if (matchData.season_id) {
        try {
          await this.updateStandings(matchData.season_id);
          result.standings_updated = true;
          logger.debug(`[PostMatch] Standings updated for season ${matchData.season_id}`);
        } catch (error: any) {
          logger.warn(`[PostMatch] Failed to update standings for season ${matchData.season_id}: ${error.message}`);
        }
      }

      result.success = true;
      logger.info(`[PostMatch] ✅ Completed processing match ${matchData.match_id}: stats=${result.stats_saved}, incidents=${result.incidents_saved}, trend=${result.trend_saved}, players=${result.player_stats_saved}, standings=${result.standings_updated}`);

    } catch (error: any) {
      result.error = error.message;
      logger.error(`[PostMatch] Failed to process match ${matchData.match_id}: ${error.message}`);
    }

    return result;
  }

  /**
   * Save final statistics to database
   */
  private async saveFinalStats(matchId: string): Promise<void> {
    const client = await pool.connect();
    try {
      // Check if stats already saved
      const existing = await client.query(
        'SELECT statistics FROM ts_matches WHERE external_id = $1',
        [matchId]
      );

      if (existing.rows[0]?.statistics && Object.keys(existing.rows[0].statistics).length > 0) {
        logger.debug(`[PostMatch] Stats already exist for ${matchId}, skipping`);
        return;
      }

      // Fetch from API and save
      const stats = await this.combinedStatsService.getCombinedMatchStats(matchId);
      if (stats && Object.keys(stats).length > 0) {
        await client.query(
          `UPDATE ts_matches SET statistics = $1, updated_at = NOW() WHERE external_id = $2`,
          [JSON.stringify(stats), matchId]
        );
      }
    } finally {
      client.release();
    }
  }

  /**
   * Save final incidents to database
   */
  private async saveFinalIncidents(matchId: string): Promise<void> {
    const client = await pool.connect();
    try {
      // Check if incidents already saved
      const existing = await client.query(
        'SELECT incidents FROM ts_matches WHERE external_id = $1',
        [matchId]
      );

      if (existing.rows[0]?.incidents && Array.isArray(existing.rows[0].incidents) && existing.rows[0].incidents.length > 0) {
        logger.debug(`[PostMatch] Incidents already exist for ${matchId}, skipping`);
        return;
      }

      // Fetch from matchDetailLive and save
      const matchData = await this.matchDetailLiveService.getMatchDetailLive({ match_id: matchId });
      if (matchData && Array.isArray((matchData as any).incidents) && (matchData as any).incidents.length > 0) {
        await client.query(
          `UPDATE ts_matches SET incidents = $1, updated_at = NOW() WHERE external_id = $2`,
          [JSON.stringify((matchData as any).incidents), matchId]
        );
      }
    } finally {
      client.release();
    }
  }

  /**
   * Save final trend data to database
   */
  private async saveFinalTrend(matchId: string): Promise<void> {
    const client = await pool.connect();
    try {
      // Check if trend already saved
      const existing = await client.query(
        'SELECT trend_data FROM ts_matches WHERE external_id = $1',
        [matchId]
      );

      if (existing.rows[0]?.trend_data && Array.isArray(existing.rows[0].trend_data) && existing.rows[0].trend_data.length > 0) {
        logger.debug(`[PostMatch] Trend already exists for ${matchId}, skipping`);
        return;
      }

      // Fetch trend from historical endpoint
      const trendData = await this.matchTrendService.getMatchTrendDetail({ match_id: matchId });
      if (trendData && Array.isArray((trendData as any).results) && (trendData as any).results.length > 0) {
        await client.query(
          `UPDATE ts_matches SET trend_data = $1, updated_at = NOW() WHERE external_id = $2`,
          [JSON.stringify((trendData as any).results), matchId]
        );
      }
    } finally {
      client.release();
    }
  }

  /**
   * Process and aggregate player statistics
   */
  private async processPlayerStats(matchData: MatchData): Promise<void> {
    const client = await pool.connect();
    try {
      // Check if player stats already processed
      const existing = await client.query(
        'SELECT player_stats FROM ts_matches WHERE external_id = $1',
        [matchData.match_id]
      );

      if (existing.rows[0]?.player_stats && Array.isArray(existing.rows[0].player_stats) && existing.rows[0].player_stats.length > 0) {
        logger.debug(`[PostMatch] Player stats already exist for ${matchData.match_id}, skipping`);
        return;
      }

      // Import player stats service dynamically to avoid circular dependencies
      const { PlayerStatsService } = await import('../thesports/player/playerStats.service');
      const playerStatsService = new PlayerStatsService();

      // Process player stats for this match
      await playerStatsService.processMatchPlayerStats(matchData.match_id, matchData.season_id || '');
    } finally {
      client.release();
    }
  }

  /**
   * Update standings for a season after match ends
   */
  private async updateStandings(seasonId: string): Promise<void> {
    await this.tableLiveService.syncStandingsToDb(seasonId);
  }

  /**
   * Batch process multiple ended matches
   * Useful for catching up on missed matches
   */
  async processEndedMatches(limit: number = 50): Promise<{ processed: number; success: number; failed: number }> {
    const client = await pool.connect();
    try {
      // Find recently ended matches that might need processing
      // Criteria: status_id = 8 (END), ended in last 24 hours, missing some data
      const result = await client.query(`
        SELECT 
          external_id as match_id,
          external_id,
          season_id,
          home_team_id,
          away_team_id,
          home_score_display as home_score,
          away_score_display as away_score
        FROM ts_matches 
        WHERE status_id = 8
          AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
          AND (
            statistics IS NULL 
            OR incidents IS NULL 
            OR trend_data IS NULL 
            OR player_stats IS NULL
          )
        ORDER BY match_time DESC
        LIMIT $1
      `, [limit]);

      const matches = result.rows;
      logger.info(`[PostMatch] Found ${matches.length} ended matches needing processing`);

      let success = 0;
      let failed = 0;

      for (const match of matches) {
        try {
          const processResult = await this.processMatchEnd(match);
          if (processResult.success) {
            success++;
          } else {
            failed++;
          }
        } catch (error: any) {
          failed++;
          logger.error(`[PostMatch] Error processing ${match.match_id}: ${error.message}`);
        }

        // Small delay between processing
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return { processed: matches.length, success, failed };
    } finally {
      client.release();
    }
  }

  /**
   * Handle match status transition to END
   * Called by MatchStateTracker when a match ends
   */
  async onMatchEnded(matchId: string): Promise<void> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          external_id as match_id,
          external_id,
          season_id,
          home_team_id,
          away_team_id,
          home_score_display as home_score,
          away_score_display as away_score
        FROM ts_matches 
        WHERE external_id = $1
      `, [matchId]);

      if (result.rows.length === 0) {
        logger.warn(`[PostMatch] Match ${matchId} not found in database`);
        return;
      }

      const matchData = result.rows[0];
      await this.processMatchEnd(matchData);
    } finally {
      client.release();
    }
  }
}

// Export singleton for use across the application
let postMatchProcessorInstance: PostMatchProcessor | null = null;

export function getPostMatchProcessor(client?: TheSportsClient): PostMatchProcessor {
  if (!postMatchProcessorInstance && client) {
    postMatchProcessorInstance = new PostMatchProcessor(client);
  }
  if (!postMatchProcessorInstance) {
    throw new Error('PostMatchProcessor not initialized. Call with TheSportsClient first.');
  }
  return postMatchProcessorInstance;
}

