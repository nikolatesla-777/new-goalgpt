
/**
 * Recent Sync Service
 * 
 * Handles incremental sync using /match/recent/list with time parameter
 * CRITICAL: Uses time parameter (Last Sync Timestamp + 1) to fetch only changed records
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { MatchRecentResponse, MatchRecentParams } from '../../../types/thesports/match';
import { withSyncLock, SyncType } from '../sync/sync-strategy';
import { getCurrentUnixTimestamp } from '../../../utils/thesports/timestamp.util';
import { SyncStateRepository } from '../../../repositories/implementations/SyncStateRepository';
import { MatchSyncService, MatchSyncData } from './matchSync.service';
import { TeamDataService } from '../team/teamData.service';
import { CompetitionService } from '../competition/competition.service';

export class RecentSyncService {
  private syncStateRepository: SyncStateRepository;
  private matchSyncService: MatchSyncService;

  constructor(
    private client: any,
    matchSyncService?: MatchSyncService
  ) {
    this.syncStateRepository = new SyncStateRepository();
    
    // Initialize MatchSyncService if not provided
    if (matchSyncService) {
      this.matchSyncService = matchSyncService;
    } else {
      const teamDataService = new TeamDataService(client);
      const competitionService = new CompetitionService(client);
      this.matchSyncService = new MatchSyncService(teamDataService, competitionService);
    }
  }

  /**
   * Incremental sync: Only fetch matches that have changed since last sync
   * Uses /match/recent/list with time parameter (Last Sync Timestamp + 1)
   */
  async syncIncremental(lastSyncTimestamp?: Date): Promise<{ synced: number; errors: number }> {
    return withSyncLock(SyncType.RECENT, async () => {
      // Get last sync timestamp from database or use provided
      let lastSyncUnix: number;
      
      if (lastSyncTimestamp) {
        lastSyncUnix = Math.floor(lastSyncTimestamp.getTime() / 1000);
      } else {
        const syncState = await this.syncStateRepository.getLastSyncTime('match');
        if (syncState && syncState.last_updated_at) {
          // Use MAX(updated_at) from database + 1 second
          lastSyncUnix = syncState.last_updated_at + 1;
        } else {
          // First sync: Use 1 hour ago
          const oneHourAgo = new Date();
          oneHourAgo.setHours(oneHourAgo.getHours() - 1);
          lastSyncUnix = Math.floor(oneHourAgo.getTime() / 1000);
        }
      }

      const currentUnix = getCurrentUnixTimestamp();

      logger.info(`Incremental sync: ${lastSyncUnix} -> ${currentUnix} (time param: ${lastSyncUnix + 1})`);

      // Fetch recent matches with time parameter (CRITICAL: Last Sync + 1)
      // TheSports API: time parameter fetches matches updated AFTER this timestamp
      const response = await this.client.get<MatchRecentResponse>(
        '/match/recent/list',
        {
          page: 1,
          limit: 1000, // Fetch more to catch all changes
          time: lastSyncUnix + 1, // CRITICAL: Last sync timestamp + 1
        }
      );

      // Check for errors
      if (response.err) {
        logger.warn(`TheSports API error for match/recent/list: ${response.err}`);
        return { synced: 0, errors: 1 };
      }

      const results = response.results || [];
      logger.info(`Found ${results.length} changed matches since last sync (time=${lastSyncUnix + 1})`);

      if (results.length === 0) {
        logger.debug('No matches to sync');
        return { synced: 0, errors: 0 };
      }

      // Convert to MatchSyncData format and sync
      let synced = 0;
      let errors = 0;

      for (const match of results) {
        try {
          const matchData: MatchSyncData = this.mapApiMatchToSyncData(match);
          await this.matchSyncService.syncMatch(matchData);
          synced++;
        } catch (error: any) {
          logger.error(`Failed to sync match ${match.id || 'unknown'}:`, error.message);
          errors++;
        }
      }

      // Update sync state with latest updated_at
      if (results.length > 0) {
        const maxUpdatedAt = Math.max(...results.map(m => m.updated_at || 0));
        if (maxUpdatedAt > 0) {
          await this.syncStateRepository.updateLastSyncTime('match', maxUpdatedAt);
        }
      }

      logger.info(`Match incremental sync completed: ${synced} synced, ${errors} errors`);
      return { synced, errors };
    });
  }

  /**
   * Map API match response to MatchSyncData format
   * Handles score arrays (Array[7]) with correct index mapping
   */
  private mapApiMatchToSyncData(match: any): MatchSyncData {
    // Extract score arrays (Array[7] format)
    // Index 0: regular_score, Index 5: overtime_score, Index 6: penalty_score
    const homeScores = match.home_scores || (match.home_score !== undefined ? [match.home_score] : null);
    const awayScores = match.away_scores || (match.away_score !== undefined ? [match.away_score] : null);

    // Extract score components from array
    const homeRegularScore = Array.isArray(homeScores) && homeScores.length > 0 ? homeScores[0] : null;
    const homeOvertimeScore = Array.isArray(homeScores) && homeScores.length > 5 ? homeScores[5] : null;
    const homePenaltyScore = Array.isArray(homeScores) && homeScores.length > 6 ? homeScores[6] : null;
    
    const awayRegularScore = Array.isArray(awayScores) && awayScores.length > 0 ? awayScores[0] : null;
    const awayOvertimeScore = Array.isArray(awayScores) && awayScores.length > 5 ? awayScores[5] : null;
    const awayPenaltyScore = Array.isArray(awayScores) && awayScores.length > 6 ? awayScores[6] : null;

    // Calculate display scores (same logic as MQTT parser)
    const homeDisplayScore = this.calculateDisplayScore(homeRegularScore, homeOvertimeScore, homePenaltyScore, match.status);
    const awayDisplayScore = this.calculateDisplayScore(awayRegularScore, awayOvertimeScore, awayPenaltyScore, match.status);

    return {
      external_id: match.id || match.match_id,
      season_id: match.season_id || null,
      competition_id: match.competition_id || null,
      home_team_id: match.home_team_id || match.home_id || null,
      away_team_id: match.away_team_id || match.away_id || null,
      status_id: typeof match.status === 'number' ? match.status : (match.status_id || null),
      match_time: match.match_time || null,
      venue_id: match.venue_id || null,
      referee_id: match.referee_id || null,
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
      environment_temperature: match.environment_temperature || null,
      environment_wind: match.environment_wind || null,
      environment_humidity: match.environment_humidity || null,
      tbd: match.tbd ?? null,
      has_ot: match.has_ot ?? null,
      ended: match.ended ?? null,
      team_reverse: match.team_reverse ?? null,
      external_updated_at: match.updated_at || null,
      // Score components (mapped from array indices)
      home_score_regular: homeRegularScore,
      home_score_overtime: homeOvertimeScore,
      home_score_penalties: homePenaltyScore,
      home_score_display: homeDisplayScore,
      away_score_regular: awayRegularScore,
      away_score_overtime: awayOvertimeScore,
      away_score_penalties: awayPenaltyScore,
      away_score_display: awayDisplayScore,
    };
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
   * Get last sync timestamp from database
   */
  async getLastSyncTimestamp(): Promise<Date> {
    const syncState = await this.syncStateRepository.getLastSyncTime('match');
    if (syncState && syncState.last_updated_at) {
      return new Date(syncState.last_updated_at * 1000);
    }
    
    // Default: 1 hour ago
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    return oneHourAgo;
  }
}

