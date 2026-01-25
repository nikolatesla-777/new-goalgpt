
/**
 * Bootstrap Service
 * 
 * Ensures system is "Warm" before going "Live"
 * Handles cold boot sequence for empty database
 */

import { logger } from '../utils/logger';
// @ts-expect-error - Legacy sync jobs removed, bootstrap service needs refactoring
import { CategorySyncWorker } from '../jobs/categorySync.job';
// @ts-expect-error - Legacy sync jobs removed, bootstrap service needs refactoring
import { CountrySyncWorker } from '../jobs/countrySync.job';
// @ts-expect-error - Legacy sync jobs removed, bootstrap service needs refactoring
import { CompetitionSyncWorker } from '../jobs/competitionSync.job';
// @ts-expect-error - Legacy sync jobs removed, bootstrap service needs refactoring
import { TeamSyncWorker } from '../jobs/teamSync.job';
import { MatchDiaryService } from './thesports/match/matchDiary.service';
import { MatchSyncService } from './thesports/match/matchSync.service';
import { TeamDataService } from './thesports/team/teamData.service';
import { CompetitionService } from './thesports/competition/competition.service';
import { pool } from '../database/connection';
import { formatTheSportsDate } from '../utils/thesports/timestamp.util';
// SINGLETON: Use shared API client
import { theSportsAPI } from '../core';

export class BootstrapService {
  private categorySyncWorker: CategorySyncWorker;
  private countrySyncWorker: CountrySyncWorker;
  private competitionSyncWorker: CompetitionSyncWorker;
  private teamSyncWorker: TeamSyncWorker;
  private matchDiaryService: MatchDiaryService;
  private matchSyncService: MatchSyncService;
  private teamDataService: TeamDataService;
  private competitionService: CompetitionService;

  constructor() {
    // SINGLETON: Use shared API client with global rate limiting
    this.categorySyncWorker = new CategorySyncWorker();
    this.countrySyncWorker = new CountrySyncWorker();
    this.competitionSyncWorker = new CompetitionSyncWorker();
    this.teamSyncWorker = new TeamSyncWorker();

    this.teamDataService = new TeamDataService();
    this.competitionService = new CompetitionService();
    this.matchSyncService = new MatchSyncService(this.teamDataService, this.competitionService);
    this.matchDiaryService = new MatchDiaryService();
  }

  /**
   * Check if database is empty (no basic metadata)
   */
  private async isDbEmpty(): Promise<boolean> {
    // CRITICAL FIX: If database connection fails (placeholder DB), skip bootstrap
    // This allows server to start without database (for Supabase setup phase)
    try {
      const client = await pool.connect();
      try {
        // Check if we have any categories
        const categoryResult = await client.query('SELECT COUNT(*) as count FROM ts_categories');
        const categoryCount = parseInt(categoryResult.rows[0]?.count || '0', 10);

        // Check if we have any competitions
        const competitionResult = await client.query('SELECT COUNT(*) as count FROM ts_competitions');
        const competitionCount = parseInt(competitionResult.rows[0]?.count || '0', 10);

        // Check if we have any teams
        const teamResult = await client.query('SELECT COUNT(*) as count FROM ts_teams');
        const teamCount = parseInt(teamResult.rows[0]?.count || '0', 10);

        const isEmpty = categoryCount === 0 && competitionCount === 0 && teamCount === 0;

        logger.info(
          `Database status: Categories=${categoryCount}, Competitions=${competitionCount}, Teams=${teamCount}, Empty=${isEmpty}`
        );

        return isEmpty;
      } finally {
        client.release();
      }
    } catch (error: any) {
      // Database connection failed (placeholder DB or not configured)
      // Return false to skip bootstrap syncs, but allow server to start
      logger.warn('⚠️ Database connection failed during bootstrap check. Skipping bootstrap syncs. Error:', error.message);
      return false; // Treat as "not empty" to skip syncs
    }
  }

  /**
   * Initialize bootstrap sequence
   */
  async init(): Promise<void> {
    logger.info('🚀 Starting Bootstrap Sequence...');

    try {
      // Step 1: Check if database is empty
      const isEmpty = await this.isDbEmpty();
      
      // Step 1.1: Check individual master data counts
      const client = await pool.connect();
      let categoryCount = 0;
      let competitionCount = 0;
      let teamCount = 0;
      try {
        const catResult = await client.query('SELECT COUNT(*) as count FROM ts_categories');
        const compResult = await client.query('SELECT COUNT(*) as count FROM ts_competitions');
        const teamResult = await client.query('SELECT COUNT(*) as count FROM ts_teams');
        categoryCount = parseInt(catResult.rows[0]?.count || '0', 10);
        competitionCount = parseInt(compResult.rows[0]?.count || '0', 10);
        teamCount = parseInt(teamResult.rows[0]?.count || '0', 10);
      } finally {
        client.release();
      }

      if (isEmpty) {
        logger.info('📦 Database is empty. Running initial syncs...');

        // Step 1.1: Sync Categories (foundation)
        logger.info('📋 Syncing Categories...');
        try {
          await this.categorySyncWorker.syncAllCategories();
          logger.info('✅ Categories synced');
        } catch (error: any) {
          logger.error('Failed to sync categories:', error.message);
          // Continue - categories might not be critical for matches
        }

        // Step 1.2: Sync Countries (depends on Categories)
        logger.info('🌍 Syncing Countries...');
        try {
          await this.countrySyncWorker.syncAllCountries();
          logger.info('✅ Countries synced');
        } catch (error: any) {
          logger.error('Failed to sync countries:', error.message);
          // Continue - countries might not be critical for matches
        }

        // Step 1.3: Sync Competitions (depends on Categories/Countries)
        logger.info('🏆 Syncing Competitions...');
        await this.competitionSyncWorker.syncCompetitions();
        logger.info('✅ Competitions synced');

        // Step 1.4: Sync Teams (depends on Competitions)
        logger.info('⚽ Syncing Teams...');
        await this.teamSyncWorker.syncTeams();
        logger.info('✅ Teams synced');
      } else {
        logger.info(`📦 Database has data. Categories=${categoryCount}, Competitions=${competitionCount}, Teams=${teamCount}`);
        
        // CRITICAL FIX: Sync missing master data even if database is not empty
        // This handles cases where partial sync happened (e.g., teams synced but competitions didn't)
        
        if (categoryCount === 0) {
          logger.info('📋 Categories missing. Syncing Categories...');
          try {
            await this.categorySyncWorker.syncAllCategories();
            logger.info('✅ Categories synced');
          } catch (error: any) {
            logger.error('Failed to sync categories:', error.message);
          }
        }
        
        if (competitionCount === 0) {
          logger.info('🏆 Competitions missing. Syncing Competitions...');
          try {
            await this.competitionSyncWorker.syncCompetitions();
            logger.info('✅ Competitions synced');
          } catch (error: any) {
            logger.error('Failed to sync competitions:', error.message);
          }
        }
        
        if (teamCount === 0) {
          logger.info('⚽ Teams missing. Syncing Teams...');
          try {
            await this.teamSyncWorker.syncTeams();
            logger.info('✅ Teams synced');
          } catch (error: any) {
            logger.error('Failed to sync teams:', error.message);
          }
        }
      }

      // Step 2: Fetch Today's Bulletin (Vital)
      logger.info('📅 Fetching Today\'s Schedule...');
      await this.syncTodaySchedule();

      logger.info('✅ Bootstrap Complete. System Ready. Opening MQTT Gates...');
    } catch (error: any) {
      logger.error('❌ Bootstrap failed:', error);
      throw error;
    }
  }

  /**
   * Calculate display score based on algorithm
   * Case A (Overtime exists): Display = overtime_score + penalty_score
   * Case B (No Overtime): Display = regular_score + penalty_score
   */
  private calculateDisplayScore(
    regularScore: number | null,
    overtimeScore: number | null,
    penaltyScore: number | null,
    statusId?: number | null
  ): number {
    const regular = regularScore || 0;
    const overtime = overtimeScore || 0;
    const penalty = penaltyScore || 0;

    // Case A: Overtime exists (overtime_score > 0)
    if (overtime > 0) {
      return overtime + penalty;
    }

    // Case B: No overtime
    return regular + penalty;
  }

  /**
   * Sync today's schedule using MatchSyncService
   */
  private async syncTodaySchedule(): Promise<void> {
    try {
      const today = new Date();
      const dateStr = formatTheSportsDate(today).replace(/-/g, ''); // YYYYMMDD format

      logger.info(`Fetching match diary for today: ${dateStr}`);

      // Fetch matches from API
      const response = await this.matchDiaryService.getMatchDiary({ date: dateStr });

      if (response.err) {
        logger.warn(`Failed to fetch today's schedule: ${response.err}`);
        return;
      }

      if (!response.results || response.results.length === 0) {
        logger.info('No matches found for today');
        return;
      }

      logger.info(`Found ${response.results.length} matches for today. Syncing...`);

      // CRITICAL: Use results_extra to populate teams and competitions FIRST
      // This ensures foreign key dependencies exist before saving matches
      if (response.results_extra) {
        logger.info('📋 Populating teams and competitions from results_extra...');
        
        // Populate teams from results_extra
        if (response.results_extra.team) {
          await this.teamDataService.enrichFromResultsExtra(response.results_extra);
          logger.info('✅ Teams populated from results_extra');
        }
        
        // Populate competitions from results_extra
        if (response.results_extra.competition) {
          await this.competitionService.enrichFromResultsExtra(response.results_extra);
          logger.info('✅ Competitions populated from results_extra');
        }
      }

      // Convert API matches to MatchSyncData format with score array mapping (Array[7])
      // Score Array Indices: 0=regular, 1=halftime, 2=red, 3=yellow, 4=corners, 5=overtime, 6=penalty
      const matchesToSync = response.results.map((match: any) => {
        // Convert status (MatchState enum) to status_id (number)
        const statusId = typeof match.status === 'number' ? match.status : 
                        (match.status_id || match.status || null);

        // Extract score arrays (Array[7] format from API)
        const homeScores = match.home_scores || (match.home_score !== undefined ? [match.home_score] : null);
        const awayScores = match.away_scores || (match.away_score !== undefined ? [match.away_score] : null);

        // Extract score components from array indices
        const homeRegularScore = Array.isArray(homeScores) && homeScores.length > 0 ? homeScores[0] : null;
        const homeOvertimeScore = Array.isArray(homeScores) && homeScores.length > 5 ? homeScores[5] : null;
        const homePenaltyScore = Array.isArray(homeScores) && homeScores.length > 6 ? homeScores[6] : null;
        
        const awayRegularScore = Array.isArray(awayScores) && awayScores.length > 0 ? awayScores[0] : null;
        const awayOvertimeScore = Array.isArray(awayScores) && awayScores.length > 5 ? awayScores[5] : null;
        const awayPenaltyScore = Array.isArray(awayScores) && awayScores.length > 6 ? awayScores[6] : null;

        // Calculate display scores (same algorithm as MQTT parser)
        const homeDisplayScore = this.calculateDisplayScore(homeRegularScore, homeOvertimeScore, homePenaltyScore, statusId);
        const awayDisplayScore = this.calculateDisplayScore(awayRegularScore, awayOvertimeScore, awayPenaltyScore, statusId);

        return {
          external_id: match.id || match.match_id,
          season_id: match.season_id || null,
          competition_id: match.competition_id || null,
          home_team_id: match.home_team_id || null,
          away_team_id: match.away_team_id || null,
          status_id: statusId,
          match_time: match.match_time || null, // Unix timestamp (UTC)
          venue_id: match.venue_id || match.venue || null,
          referee_id: match.referee_id || match.referee || null,
          neutral: match.neutral ?? null,
          note: match.note || null,
          home_scores: homeScores, // Keep full array for legacy support
          away_scores: awayScores, // Keep full array for legacy support
          home_position: match.home_position || null,
          away_position: match.away_position || null,
          coverage_mlive: match.coverage_mlive ?? null,
          coverage_lineup: match.coverage_lineup ?? null,
          stage_id: match.stage_id || null,
          group_num: match.group_num || null,
          round_num: match.round_num || match.round || null,
          related_id: match.related_id || null,
          agg_score: match.agg_score || null,
          environment_weather: match.environment_weather || match.weather || null,
          environment_pressure: match.environment_pressure || null,
          environment_temperature: match.environment_temperature || match.temperature || null,
          environment_wind: match.environment_wind || null,
          environment_humidity: match.environment_humidity || null,
          tbd: match.tbd ?? null,
          has_ot: match.has_ot ?? null,
          ended: match.ended ?? null,
          team_reverse: match.team_reverse ?? null,
          external_updated_at: match.updated_at || null,
          // Score components (mapped from array indices 0, 5, 6)
          home_score_regular: homeRegularScore,
          home_score_overtime: homeOvertimeScore,
          home_score_penalties: homePenaltyScore,
          home_score_display: homeDisplayScore,
          away_score_regular: awayRegularScore,
          away_score_overtime: awayOvertimeScore,
          away_score_penalties: awayPenaltyScore,
          away_score_display: awayDisplayScore,
        };
      });

      // CRITICAL: Sync matches with results_extra for seed-on-the-fly logic
      // This prevents foreign key constraint failures by creating competitions/teams on-the-fly
      // BATCH PROCESSING: Process matches in batches to avoid timeout/connection issues
      const BATCH_SIZE = 100; // Process 100 matches at a time
      const INTER_BATCH_DELAY_MS = 1000; // 1 second delay between batches
      const totalBatches = Math.ceil(matchesToSync.length / BATCH_SIZE);
      
      logger.info(`🔄 Starting to sync ${matchesToSync.length} matches in ${totalBatches} batches (${BATCH_SIZE} per batch)...`);
      
      let totalSynced = 0;
      let totalErrors = 0;
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, matchesToSync.length);
        const batch = matchesToSync.slice(startIndex, endIndex);
        const batchNumber = batchIndex + 1;
        
        try {
          logger.info(`📦 [Bootstrap] Processing batch ${batchNumber}/${totalBatches} (matches ${startIndex + 1}-${endIndex})...`);
          
          const batchResult = await this.matchSyncService.syncMatches(batch, response.results_extra);
          
          totalSynced += batchResult.synced || 0;
          totalErrors += batchResult.errors || 0;
          
          logger.info(
            `✅ [Bootstrap] Batch ${batchNumber}/${totalBatches} completed: ${batchResult.synced} synced, ${batchResult.errors || 0} errors`
          );
          
          // Small delay between batches to avoid overwhelming the database/API
          if (batchIndex < totalBatches - 1) {
            await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
          }
        } catch (error: any) {
          logger.error(`❌ [Bootstrap] Batch ${batchNumber}/${totalBatches} failed:`, error.message);
          totalErrors += batch.length;
          // Continue with next batch even if this one failed
        }
      }
      
      const result = { synced: totalSynced, errors: totalErrors };
      
      logger.info(
        `✅ Today's schedule synced: ${result.synced}/${matchesToSync.length} matches synced, ${result.errors} errors`
      );
      
      // CRITICAL: Log how many matches were actually saved to DB
      if (result.synced < matchesToSync.length) {
        logger.warn(`⚠️ Only ${result.synced} out of ${matchesToSync.length} matches were saved. Check for errors.`);
      }
    } catch (error: any) {
      logger.error('Failed to sync today\'s schedule:', error);
      // Don't throw - bootstrap can continue even if today's schedule fails
    }
  }
}

