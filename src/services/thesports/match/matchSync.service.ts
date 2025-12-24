/**
 * Match Sync Service
 * 
 * SINGLE SOURCE OF TRUTH for saving matches to database
 * Ensures teams and competitions exist before saving matches
 * Fixes "Unknown League" and Foreign Key issues
 */

import { logger } from '../../../utils/logger';
import { TeamDataService } from '../team/teamData.service';
import { CompetitionService } from '../competition/competition.service';
import { pool } from '../../../database/connection';
import { MatchState } from '../../../types/thesports/enums';
import { CompetitionRepository } from '../../../repositories/implementations/CompetitionRepository';
import { TeamRepository } from '../../../repositories/implementations/TeamRepository';

export interface MatchSyncData {
  external_id: string;
  season_id?: string | null;
  competition_id?: string | null;
  home_team_id?: string | null;
  away_team_id?: string | null;
  status_id?: number | null;
  match_time?: number | null; // Unix timestamp (UTC)
  venue_id?: string | null;
  referee_id?: string | null;
  neutral?: boolean | null;
  note?: string | null;
  home_scores?: number[] | null;
  away_scores?: number[] | null;
  home_position?: number | null;
  away_position?: number | null;
  coverage_mlive?: boolean | null;
  coverage_lineup?: boolean | null;
  stage_id?: string | null;
  group_num?: number | null;
  round_num?: number | null;
  related_id?: string | null;
  agg_score?: string | null;
  environment_weather?: string | null;
  environment_pressure?: string | null;
  environment_temperature?: string | null;
  environment_wind?: string | null;
  environment_humidity?: string | null;
  tbd?: boolean | null;
  has_ot?: boolean | null;
  ended?: boolean | null;
  team_reverse?: boolean | null;
  external_updated_at?: number | null;
  // New score columns
  home_score_regular?: number | null;
  home_score_overtime?: number | null;
  home_score_penalties?: number | null;
  home_score_display?: number | null;
  away_score_regular?: number | null;
  away_score_overtime?: number | null;
  away_score_penalties?: number | null;
  away_score_display?: number | null;
  // JSONB columns
  incidents?: any | null;
  statistics?: any | null;
}

export class MatchSyncService {
  private teamDataService: TeamDataService;
  private competitionService: CompetitionService;
  private competitionRepository: CompetitionRepository;
  private teamRepository: TeamRepository;

  // Cached schema capabilities (avoid querying information_schema on every upsert)
  private matchColumnSupportChecked = false;
  private hasNewScoreColumns = false;
  private hasIncidentsColumn = false;
  private hasStatisticsColumn = false;
  private ensuredCompetitionIds = new Set<string>();
  private ensuredTeamIds = new Set<string>();

  constructor(
    teamDataService: TeamDataService,
    competitionService: CompetitionService
  ) {
    this.teamDataService = teamDataService;
    this.competitionService = competitionService;
    this.competitionRepository = new CompetitionRepository();
    this.teamRepository = new TeamRepository();
  }

  /**
   * Save or update a match (atomic upsert)
   * CRITICAL: Ensures teams and competitions exist before saving (seed-on-the-fly)
   * Uses results_extra data if available to prevent foreign key constraint failures
   */
  async syncMatch(matchData: MatchSyncData, resultsExtra?: { competition?: Record<string, any>; team?: any }): Promise<void> {
    // RELAXED VALIDATION: Only reject if critical fields are missing
    if (!matchData.external_id) {
      throw new Error('REJECTED: missing external_id (required)');
    }
    if (matchData.match_time == null || matchData.match_time === 0) {
      throw new Error('REJECTED: missing match_time (required)');
    }
    
    // Note: home_team_id, away_team_id, competition_id are optional (can be null)
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Step 1: Extract dependencies
      const competitionId = matchData.competition_id != null ? String(matchData.competition_id) : null;
      const homeTeamId = matchData.home_team_id != null ? String(matchData.home_team_id) : null;
      const awayTeamId = matchData.away_team_id != null ? String(matchData.away_team_id) : null;

      // Step 2: Ensure competition exists (CRITICAL: Seed-on-the-fly from results_extra)
      if (competitionId && competitionId !== '0' && competitionId !== '') {
        if (!this.ensuredCompetitionIds.has(competitionId)) {
          // First check if it exists in DB
          let competition = await this.competitionService.getCompetitionById(competitionId);
          
          if (!competition || !competition.name) {
            // Try to create from results_extra if available
            if (resultsExtra?.competition && (resultsExtra.competition as any)[competitionId]) {
              const compData = (resultsExtra.competition as any)[competitionId];
              logger.info(`🔧 Creating competition ${competitionId} from results_extra: ${compData.name || compData.name_en || 'Unknown'}`);
              
              // Save to DB immediately using repository
              await this.competitionRepository.createOrUpdate({
                external_id: competitionId,
                name: compData.name || compData.name_en || compData.name_cn || 'Unknown Competition',
                logo_url: compData.logo_url || compData.logo || null,
                country_id: compData.country_id || null,
                category_id: compData.category_id || null,
                type: compData.type || null,
              });
              
              competition = await this.competitionService.getCompetitionById(competitionId);
              logger.info(`✅ Competition ${competitionId} created: ${competition?.name || 'Unknown'}`);
            } else {
              // Fallback: Try to fetch from API
              logger.warn(`⚠️ Competition ${competitionId} not in results_extra. Attempting API fetch...`);
              competition = await this.competitionService.getCompetitionById(competitionId);
              if (!competition || !competition.name) {
                logger.warn(`⚠️ Competition ${competitionId} still not found. Match will be saved with competition_id but no name.`);
              }
            }
          }
          this.ensuredCompetitionIds.add(competitionId);
        }
      }

      // Step 3: Ensure teams exist (CRITICAL: Seed-on-the-fly from results_extra)
      if (homeTeamId && homeTeamId !== '0' && homeTeamId !== '') {
        if (!this.ensuredTeamIds.has(homeTeamId)) {
          let homeTeam = await this.teamDataService.getTeamById(homeTeamId);
          
          if (!homeTeam) {
            // Try to create from results_extra if available
            let teamData: any = null;
            
            // Check if results_extra.team is an array or object
            if (resultsExtra?.team) {
              if (Array.isArray(resultsExtra.team)) {
                teamData = resultsExtra.team.find((t: any) => String(t?.id) === homeTeamId);
              } else {
                teamData = (resultsExtra.team as any)[homeTeamId];
              }
            }
            
            if (teamData) {
              logger.info(`🔧 Creating home team ${homeTeamId} from results_extra: ${teamData.name || 'Unknown'}`);
              
              // Save to DB immediately using repository
              await this.teamRepository.createOrUpdate({
                external_id: homeTeamId,
                name: teamData.name || 'Unknown Team',
                logo_url: teamData.logo_url || teamData.logo || null,
                short_name: teamData.short_name || null,
              });
              
              homeTeam = await this.teamDataService.getTeamById(homeTeamId);
              logger.info(`✅ Home team ${homeTeamId} created: ${homeTeam?.name || 'Unknown'}`);
            } else {
              // Fallback: Try to fetch from API
              logger.warn(`⚠️ Home team ${homeTeamId} not in results_extra. Attempting API fetch...`);
              homeTeam = await this.teamDataService.getTeamById(homeTeamId);
              if (!homeTeam) {
                logger.warn(`⚠️ Home team ${homeTeamId} still not found. Match will be saved with home_team_id but no team data.`);
              }
            }
          }
          this.ensuredTeamIds.add(homeTeamId);
        }
      }

      if (awayTeamId && awayTeamId !== '0' && awayTeamId !== '') {
        if (!this.ensuredTeamIds.has(awayTeamId)) {
          let awayTeam = await this.teamDataService.getTeamById(awayTeamId);
          
          if (!awayTeam) {
            // Try to create from results_extra if available
            let teamData: any = null;
            
            // Check if results_extra.team is an array or object
            if (resultsExtra?.team) {
              if (Array.isArray(resultsExtra.team)) {
                teamData = resultsExtra.team.find((t: any) => String(t?.id) === awayTeamId);
              } else {
                teamData = (resultsExtra.team as any)[awayTeamId];
              }
            }
            
            if (teamData) {
              logger.info(`🔧 Creating away team ${awayTeamId} from results_extra: ${teamData.name || 'Unknown'}`);
              
              // Save to DB immediately using repository
              await this.teamRepository.createOrUpdate({
                external_id: awayTeamId,
                name: teamData.name || 'Unknown Team',
                logo_url: teamData.logo_url || teamData.logo || null,
                short_name: teamData.short_name || null,
              });
              
              awayTeam = await this.teamDataService.getTeamById(awayTeamId);
              logger.info(`✅ Away team ${awayTeamId} created: ${awayTeam?.name || 'Unknown'}`);
            } else {
              // Fallback: Try to fetch from API
              logger.warn(`⚠️ Away team ${awayTeamId} not in results_extra. Attempting API fetch...`);
              awayTeam = await this.teamDataService.getTeamById(awayTeamId);
              if (!awayTeam) {
                logger.warn(`⚠️ Away team ${awayTeamId} still not found. Match will be saved with away_team_id but no team data.`);
              }
            }
          }
          this.ensuredTeamIds.add(awayTeamId);
        }
      }

      // Step 4: Validate and fix timezone logic
      const validatedData = this.validateMatchData(matchData);

      // Step 5: Upsert match
      // Debug: Log first match's JSONB data
      if (matchData.external_id && matchData.external_id.startsWith('l5ergph4')) {
        logger.debug(`🔍 [MatchSync] Debug match ${matchData.external_id}:`, {
          home_scores: matchData.home_scores,
          away_scores: matchData.away_scores,
          home_scores_type: typeof matchData.home_scores,
          away_scores_type: typeof matchData.away_scores,
          home_scores_is_array: Array.isArray(matchData.home_scores),
          away_scores_is_array: Array.isArray(matchData.away_scores),
          incidents: matchData.incidents ? (typeof matchData.incidents) : null,
          statistics: matchData.statistics ? (typeof matchData.statistics) : null,
        });
      }
      await this.upsertMatch(client, validatedData);

      await client.query('COMMIT');
      logger.debug(`Match ${matchData.external_id} synced successfully`);
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error(`Failed to sync match ${matchData.external_id}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureMatchColumnSupport(client: any): Promise<void> {
    if (this.matchColumnSupportChecked) return;

    const columnCheckQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ts_matches' AND column_name IN (
        'home_score_regular', 'home_score_overtime', 'home_score_penalties', 'home_score_display',
        'away_score_regular', 'away_score_overtime', 'away_score_penalties', 'away_score_display',
        'incidents', 'statistics'
      );
    `;
    const columnCheckResult = await client.query(columnCheckQuery);

    const cols = new Set(columnCheckResult.rows.map((r: any) => r.column_name));
    const scoreCols = [
      'home_score_regular', 'home_score_overtime', 'home_score_penalties', 'home_score_display',
      'away_score_regular', 'away_score_overtime', 'away_score_penalties', 'away_score_display',
    ];

    this.hasNewScoreColumns = scoreCols.every(c => cols.has(c));
    this.hasIncidentsColumn = cols.has('incidents');
    this.hasStatisticsColumn = cols.has('statistics');
    this.matchColumnSupportChecked = true;

    logger.info(
      `Match schema detected: hasNewScoreColumns=${this.hasNewScoreColumns}, ` +
      `hasIncidents=${this.hasIncidentsColumn}, hasStatistics=${this.hasStatisticsColumn}`
    );
  }

  /**
   * Validate match data and fix timezone issues
   * CRITICAL: If match_time is in the future, status cannot be "Ended" or any finished state
   */
  private validateMatchData(matchData: MatchSyncData): MatchSyncData {
    const validated = { ...matchData };
    const now = Math.floor(Date.now() / 1000); // Current Unix timestamp (UTC)

    // CRITICAL TIMEZONE FIX: Recalculate status based on match_time vs current time
    if (validated.match_time) {
      const matchTime = validated.match_time;
      const matchDate = new Date(matchTime * 1000);
      const nowDate = new Date(now * 1000);
      const timeDiff = now - matchTime; // Seconds difference
      const minutesDiff = Math.floor(timeDiff / 60);
      
      // IMPORTANT: Do NOT auto-transition to LIVE based only on time.
      // Live status should be sourced from WebSocket or /match/detail_live confirmation.
      if (matchTime <= now && minutesDiff > 5 && validated.status_id === MatchState.NOT_STARTED) {
        logger.warn(
          `⚠️ [MatchSync] Match ${validated.external_id} kickoff passed (${minutesDiff}m) but status is still NOT_STARTED. ` +
          `Leaving status as-is (source LIVE from WS/detail_live). Match time: ${matchDate.toISOString()}, Now: ${nowDate.toISOString()}`
        );
      }
      
      // If match_time is in the future, force status to NOT_STARTED
      if (matchTime > now) {
        const isFinishedState = validated.status_id === MatchState.END || 
                               validated.status_id === MatchState.CANCEL ||
                               validated.status_id === MatchState.INTERRUPT;
        
        if (isFinishedState) {
          logger.warn(
            `Match ${validated.external_id} has status ${validated.status_id} (finished) but match_time (${matchDate.toISOString()}) ` +
            `is in the future (now: ${nowDate.toISOString()}). Fixing status to NOT_STARTED.`
          );
          validated.status_id = MatchState.NOT_STARTED;
          validated.ended = false;
        }
      }
    }

    // Ensure match_time is treated as UTC (Unix timestamp)
    if (validated.match_time && validated.match_time < 1000000000) {
      logger.debug(`Match ${validated.external_id} match_time: ${validated.match_time} (Unix seconds)`);
    }

    return validated;
  }

  /**
   * Upsert match to database
   */
  private async upsertMatch(client: any, matchData: MatchSyncData): Promise<void> {
    await this.ensureMatchColumnSupport(client);
    const hasNewColumns = this.hasNewScoreColumns;
    const hasIncidents = this.hasIncidentsColumn;
    const hasStatistics = this.hasStatisticsColumn;
    
    // Debug: Log problematic data types for JSONB columns
    if (hasIncidents && matchData.incidents != null && typeof matchData.incidents === 'string') {
      logger.debug(`⚠️ [MatchSync] incidents is string, will parse: ${matchData.incidents.substring(0, 50)}...`);
    }
    if (hasStatistics && matchData.statistics != null && typeof matchData.statistics === 'string') {
      logger.debug(`⚠️ [MatchSync] statistics is string, will parse: ${matchData.statistics.substring(0, 50)}...`);
    }

    // Build query based on available columns
    const baseColumns = [
      'external_id',
      'season_id',
      'competition_id',
      'home_team_id',
      'away_team_id',
      'status_id',
      'match_time',
      'venue_id',
      'referee_id',
      'neutral',
      'note',
      'home_position',
      'away_position',
      'coverage_mlive',
      'coverage_lineup',
      'stage_id',
      'group_num',
      'round_num',
      'related_id',
      'agg_score',
      'environment_weather',
      'environment_pressure',
      'environment_temperature',
      'environment_wind',
      'environment_humidity',
      'tbd',
      'has_ot',
      'ended',
      'team_reverse',
      'external_updated_at',
    ];

    const values: any[] = [];
    let paramIndex = 1;

    // Base values
    const baseValues = [
      matchData.external_id,
      matchData.season_id || null,
      matchData.competition_id || null,
      matchData.home_team_id || null,
      matchData.away_team_id || null,
      matchData.status_id ?? null,
      matchData.match_time ?? null,
      matchData.venue_id || null,
      matchData.referee_id || null,
      matchData.neutral ?? null,
      matchData.note || null,
      // CRITICAL FIX: Ensure integer fields are properly typed (null or number, never string/undefined)
      matchData.home_position != null ? Number(matchData.home_position) : null,
      matchData.away_position != null ? Number(matchData.away_position) : null,
      matchData.coverage_mlive ?? null,
      matchData.coverage_lineup ?? null,
      matchData.stage_id || null,
      matchData.group_num != null ? Number(matchData.group_num) : null,
      matchData.round_num != null ? Number(matchData.round_num) : null,
      matchData.related_id || null,
      matchData.agg_score || null,
      matchData.environment_weather || null,
      matchData.environment_pressure || null,
      matchData.environment_temperature || null,
      matchData.environment_wind || null,
      matchData.environment_humidity || null,
      matchData.tbd ?? null,
      matchData.has_ot ?? null,
      matchData.ended ?? null,
      matchData.team_reverse ?? null,
      matchData.external_updated_at ?? null,
    ];

    values.push(...baseValues);
    paramIndex += baseValues.length;

    let columns = [...baseColumns];
    let placeholders = baseValues.map((_, i) => `$${i + 1}`).join(', ');

    // Add new score columns if they exist
    if (hasNewColumns) {
      columns.push(
        'home_score_regular',
        'home_score_overtime',
        'home_score_penalties',
        'home_score_display',
        'away_score_regular',
        'away_score_overtime',
        'away_score_penalties',
        'away_score_display'
      );
      const scoreValues = [
        matchData.home_score_regular ?? null,
        matchData.home_score_overtime ?? null,
        matchData.home_score_penalties ?? null,
        matchData.home_score_display ?? null,
        matchData.away_score_regular ?? null,
        matchData.away_score_overtime ?? null,
        matchData.away_score_penalties ?? null,
        matchData.away_score_display ?? null,
      ];
      values.push(...scoreValues);
      placeholders += ', ' + scoreValues.map((_, i) => `$${paramIndex + i}`).join(', ');
      paramIndex += scoreValues.length;
    }

    // Add JSONB columns if they exist
    // CRITICAL FIX: Use JSON.stringify + ::jsonb cast for proper JSONB serialization
    // This ensures arrays, nested arrays, and objects are correctly stored as JSONB
    if (hasIncidents) {
      columns.push('incidents');
      let incidentsValue: string | null = null;
      if (matchData.incidents != null) {
        try {
          // Stringify to ensure valid JSON format, SQL will cast to jsonb
          incidentsValue = JSON.stringify(matchData.incidents);
        } catch {
          incidentsValue = null; // Invalid data, skip
        }
      }
      values.push(incidentsValue);
      // Use ::jsonb cast in placeholder to ensure proper type conversion
      placeholders += `, $${paramIndex}::jsonb`;
      paramIndex++;
    }

    if (hasStatistics) {
      columns.push('statistics');
      let statisticsValue: string | null = null;
      if (matchData.statistics != null) {
        try {
          // Stringify to ensure valid JSON format, SQL will cast to jsonb
          statisticsValue = JSON.stringify(matchData.statistics);
        } catch {
          statisticsValue = null; // Invalid data, skip
        }
      }
      values.push(statisticsValue);
      // Use ::jsonb cast in placeholder to ensure proper type conversion
      placeholders += `, $${paramIndex}::jsonb`;
      paramIndex++;
    }

    // Handle home_scores and away_scores (legacy arrays - stored as JSONB)
    // CRITICAL FIX: JSON.stringify + ::jsonb cast ensures proper array serialization
    columns.push('home_scores', 'away_scores');
    let homeScoresValue: string | null = null;
    let awayScoresValue: string | null = null;
    
    if (matchData.home_scores != null) {
      try {
        // Stringify array (even empty arrays or nested arrays) to valid JSON string
        homeScoresValue = JSON.stringify(matchData.home_scores);
      } catch {
        homeScoresValue = null; // Invalid data, skip
      }
    }
    
    if (matchData.away_scores != null) {
      try {
        // Stringify array (even empty arrays or nested arrays) to valid JSON string
        awayScoresValue = JSON.stringify(matchData.away_scores);
      } catch {
        awayScoresValue = null; // Invalid data, skip
      }
    }
    
    values.push(homeScoresValue, awayScoresValue);
    // Use ::jsonb cast in placeholders for proper type conversion
    placeholders += `, $${paramIndex}::jsonb, $${paramIndex + 1}::jsonb`;
    paramIndex += 2;

    // Build update clause
    const updateClause = columns
      .filter(col => col !== 'external_id')
      .map((col) => `${col} = EXCLUDED.${col}`)
      .join(', ');

    // CRITICAL: id column now has DEFAULT gen_random_uuid() in database schema
    // We don't need to specify it in the INSERT - database will auto-generate
    const query = `
      INSERT INTO ts_matches (${columns.join(', ')}, created_at, updated_at)
      VALUES (${placeholders}, NOW(), NOW())
      ON CONFLICT (external_id)
      DO UPDATE SET ${updateClause}, updated_at = NOW()
    `;

    await client.query(query, values);
  }

  /**
   * Batch sync matches
   */
  async syncMatches(matches: MatchSyncData[], resultsExtra?: { competition?: Record<string, any>; team?: any }): Promise<{ synced: number; errors: number; rejectedReasons?: Record<string, number> }> {
    let synced = 0;
    let errors = 0;
    const rejectedReasons: Record<string, number> = {};

    logger.info(`🔄 [MatchSync] Starting to sync ${matches.length} matches...`);

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      try {
        // CRITICAL: Pass resultsExtra to enable seed-on-the-fly
        await this.syncMatch(match, resultsExtra);
        synced++;
        // Log progress every 50 matches
        if ((i + 1) % 50 === 0 || i === matches.length - 1) {
          logger.info(`📊 [MatchSync] Progress: ${i + 1}/${matches.length} matches processed (${synced} synced, ${errors} errors)`);
        }
      } catch (error: any) {
        // DETAILED ERROR LOGGING - Log EVERY rejection reason with full context
        const rejectReason = error.message || String(error);
        const errorDetails: any = {
          match_id: match.external_id,
          raw_competition_id: match.competition_id,
          raw_home_team_id: match.home_team_id,
          raw_away_team_id: match.away_team_id,
          match_time: match.match_time,
          reject_reason: rejectReason,
          error_code: error.code,
          error_detail: error.detail,
          error_constraint: error.constraint,
          error_column: error.column,
        };
        
        // Detect error type
        if (rejectReason.includes('REJECTED:')) {
          errorDetails.error_type = 'VALIDATION_REJECTION';
        } else if (error.message?.includes('null value in column')) {
          errorDetails.error_type = 'NULL_CONSTRAINT_VIOLATION';
          errorDetails.null_column = error.column || 'unknown';
        } else if (error.message?.includes('foreign key constraint')) {
          errorDetails.error_type = 'FOREIGN_KEY_VIOLATION';
        } else if (error.message?.includes('duplicate key')) {
          errorDetails.error_type = 'DUPLICATE_KEY';
        } else {
          errorDetails.error_type = 'UNKNOWN_ERROR';
        }
        
        logger.error(`❌ [MatchSync] REJECTED match ${match.external_id}:`, errorDetails);
        
        // Track rejection reasons (top 3 will be logged)
        const reasonKey = errorDetails.error_type || 'UNKNOWN_ERROR';
        rejectedReasons[reasonKey] = (rejectedReasons[reasonKey] || 0) + 1;
        
        errors++;
        // CRITICAL: Continue processing even if one match fails (don't skip remaining matches)
      }
    }

    // Summary log with top 3 rejection reasons
    const topReasons = Object.entries(rejectedReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => `${reason}: ${count}`)
      .join(', ');

    logger.info(`✅ [MatchSync] Completed: ${synced}/${matches.length} matches synced, ${errors} errors`);
    if (errors > 0) {
      logger.warn(`⚠️ [MatchSync] ${errors} matches failed to sync. Top rejection reasons: ${topReasons || 'none'}`);
    }
    return { synced, errors, rejectedReasons };
  }
}

