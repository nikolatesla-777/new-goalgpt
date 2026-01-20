
/**
 * Recent Sync Service
 * 
 * Handles incremental sync using /match/recent/list with time parameter
 * CRITICAL: Uses time parameter (Last Sync Timestamp + 1) to fetch only changed records
 */

import { theSportsAPI } from '../../../core/TheSportsAPIManager';
import { logger } from '../../../utils/logger';
import { MatchRecentResponse, MatchRecentParams } from '../../../types/thesports/match';
import { withSyncLock, SyncType } from '../sync/sync-strategy';
import { getCurrentUnixTimestamp } from '../../../utils/thesports/timestamp.util';
import { SyncStateRepository } from '../../../repositories/implementations/SyncStateRepository';
import { MatchSyncService, MatchSyncData } from './matchSync.service';
import { TeamDataService } from '../team/teamData.service';
import { CompetitionService } from '../competition/competition.service';

export class RecentSyncService {
  private client = theSportsAPI;
  private syncStateRepository: SyncStateRepository;
  private matchSyncService: MatchSyncService;

  constructor(matchSyncService?: MatchSyncService) {
    this.syncStateRepository = new SyncStateRepository();

    // Initialize MatchSyncService if not provided
    if (matchSyncService) {
      this.matchSyncService = matchSyncService;
    } else {
      const teamDataService = new TeamDataService();
      const competitionService = new CompetitionService();
      this.matchSyncService = new MatchSyncService(teamDataService, competitionService);
    }
  }

  /**
   * Incremental sync: Only fetch matches that have changed since last sync
   * Uses /match/recent/list with time parameter (Last Sync Timestamp + 1)
   *
   * CRITICAL: Implements proper pagination per TheSports API documentation:
   * - First time: Full data via page parameter (loop until total=0 or empty results)
   * - Subsequent: Incremental update via time parameter (recommended: 1min/request)
   */
  async syncIncremental(lastSyncTimestamp?: Date): Promise<{ synced: number; errors: number }> {
    return withSyncLock(SyncType.RECENT, async () => {
      // Get last sync timestamp from database or use provided
      let lastSyncUnix: number;
      let isFirstSync = false;

      if (lastSyncTimestamp) {
        lastSyncUnix = Math.floor(lastSyncTimestamp.getTime() / 1000);
      } else {
        const syncState = await this.syncStateRepository.getLastSyncTime('match');
        if (syncState && syncState.last_updated_at) {
          // Use MAX(updated_at) from database + 1 second
          lastSyncUnix = syncState.last_updated_at + 1;
        } else {
          // First sync: Use 24 hours ago and fetch ALL pages
          isFirstSync = true;
          const oneDayAgo = new Date();
          oneDayAgo.setHours(oneDayAgo.getHours() - 24);
          lastSyncUnix = Math.floor(oneDayAgo.getTime() / 1000);
          logger.info('[RecentSync] First sync detected - will fetch ALL pages');
        }
      }

      const currentUnix = getCurrentUnixTimestamp();
      logger.info(`[RecentSync] Incremental sync: ${lastSyncUnix} -> ${currentUnix} (time param: ${lastSyncUnix + 1})`);

      // PAGINATION FIX: Fetch ALL pages until no more results
      // TheSports API: "Page increases by 1, loop to get the interface, total is 0, and the loop ends"
      let allResults: any[] = [];
      let page = 1;
      const limit = 500; // Recommended limit per page
      const maxPages = 20; // Safety limit to prevent infinite loops
      let hasMore = true;

      while (hasMore && page <= maxPages) {
        const response = await this.client.get<MatchRecentResponse>(
          '/match/recent/list',
          {
            page,
            limit,
            time: lastSyncUnix + 1, // CRITICAL: Last sync timestamp + 1
          }
        );

        // Check for errors
        if (response.err) {
          logger.warn(`[RecentSync] TheSports API error for match/recent/list page ${page}: ${response.err}`);
          break;
        }

        const results = response.results || [];
        const total = response.total ?? 0;

        if (results.length === 0 || total === 0) {
          // No more results - stop pagination
          hasMore = false;
          logger.debug(`[RecentSync] Page ${page}: No more results (total=${total})`);
        } else {
          allResults = allResults.concat(results);
          logger.info(`[RecentSync] Page ${page}: Fetched ${results.length} matches (total so far: ${allResults.length})`);

          // Check if we've fetched all available matches
          if (results.length < limit) {
            // Last page - fewer results than limit
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      if (page > maxPages) {
        logger.warn(`[RecentSync] Hit max page limit (${maxPages}). Some matches may be missed.`);
      }

      logger.info(`[RecentSync] Found ${allResults.length} changed matches since last sync (time=${lastSyncUnix + 1})`);

      if (allResults.length === 0) {
        logger.debug('[RecentSync] No matches to sync');
        return { synced: 0, errors: 0 };
      }

      // Convert to MatchSyncData format and sync
      let synced = 0;
      let errors = 0;

      for (const match of allResults) {
        try {
          const matchData: MatchSyncData = this.mapApiMatchToSyncData(match);
          await this.matchSyncService.syncMatch(matchData);
          synced++;
        } catch (error: any) {
          logger.error(`[RecentSync] Failed to sync match ${match.id || 'unknown'}:`, error.message);
          errors++;
        }
      }

      // Update sync state with latest updated_at
      if (allResults.length > 0) {
        const maxUpdatedAt = Math.max(...allResults.map(m => m.updated_at || 0));
        if (maxUpdatedAt > 0) {
          await this.syncStateRepository.updateLastSyncTime('match', maxUpdatedAt);
          logger.info(`[RecentSync] Updated sync state to ${maxUpdatedAt} (${new Date(maxUpdatedAt * 1000).toISOString()})`);
        }
      }

      logger.info(`[RecentSync] Match incremental sync completed: ${synced} synced, ${errors} errors`);
      return { synced, errors };
    });
  }

  /**
   * Helper to safely convert to number, returns null if NaN
   */
  private safeNumber(value: any, fallback: number | null = null): number | null {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    const num = Number(value);
    return isNaN(num) ? fallback : num;
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

    // Extract score components from array - CRITICAL: Use safeNumber to prevent NaN
    const homeRegularScore = Array.isArray(homeScores) && homeScores.length > 0 ? this.safeNumber(homeScores[0]) : null;
    const homeOvertimeScore = Array.isArray(homeScores) && homeScores.length > 5 ? this.safeNumber(homeScores[5]) : null;
    const homePenaltyScore = Array.isArray(homeScores) && homeScores.length > 6 ? this.safeNumber(homeScores[6]) : null;

    const awayRegularScore = Array.isArray(awayScores) && awayScores.length > 0 ? this.safeNumber(awayScores[0]) : null;
    const awayOvertimeScore = Array.isArray(awayScores) && awayScores.length > 5 ? this.safeNumber(awayScores[5]) : null;
    const awayPenaltyScore = Array.isArray(awayScores) && awayScores.length > 6 ? this.safeNumber(awayScores[6]) : null;

    // Calculate display scores (same logic as MQTT parser)
    const homeDisplayScore = this.calculateDisplayScore(homeRegularScore, homeOvertimeScore, homePenaltyScore, match.status);
    const awayDisplayScore = this.calculateDisplayScore(awayRegularScore, awayOvertimeScore, awayPenaltyScore, match.status);

    return {
      external_id: match.id || match.match_id,
      season_id: match.season_id || null,
      competition_id: match.competition_id || null,
      home_team_id: match.home_team_id || match.home_id || null,
      away_team_id: match.away_team_id || match.away_id || null,
      status_id: this.safeNumber(match.status ?? match.status_id, 1),
      match_time: this.safeNumber(match.match_time),
      venue_id: match.venue_id || null,
      referee_id: match.referee_id || null,
      neutral: match.neutral ?? null,
      note: match.note || null,
      home_scores: homeScores, // Keep full array for legacy support
      away_scores: awayScores, // Keep full array for legacy support
      home_position: this.safeNumber(match.home_position),
      away_position: this.safeNumber(match.away_position),
      coverage_mlive: match.coverage_mlive ?? null,
      coverage_lineup: match.coverage_lineup ?? null,
      stage_id: match.stage_id || null,
      group_num: this.safeNumber(match.group_num),
      round_num: this.safeNumber(match.round_num ?? match.round),
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
      external_updated_at: this.safeNumber(match.updated_at),
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

