
/**
 * Player Statistics Service
 * 
 * Handles fetching and aggregating player statistics:
 * - Fetch match-level player stats from /match/player_stats/detail
 * - Aggregate into season_stats in ts_players table
 * - Prevent double-counting with match tracking
 */

import { pool } from '../../../database/connection';
import { logger } from '../../../utils/logger';
import { TheSportsClient } from '../client/thesports-client';

interface PlayerMatchStats {
  player_id: string;
  team_id?: string;
  position?: string;
  rating?: number;
  minutes_played?: number;
  goals?: number;
  assists?: number;
  yellow_cards?: number;
  red_cards?: number;
  shots?: number;
  shots_on_target?: number;
  passes?: number;
  passes_accuracy?: number;
  key_passes?: number;
  dribble?: number;
  dribble_succ?: number;
  duels?: number;
  duels_won?: number;
  tackles?: number;
  interceptions?: number;
  clearances?: number;
  fouls?: number;
  was_fouled?: number;
  offsides?: number;
  saves?: number;
  [key: string]: any;
}

interface SeasonStatsEntry {
  matches_played: number;
  matches_counted: string[];
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  minutes_played: number;
  shots: number;
  shots_on_target: number;
  passes: number;
  passes_accuracy_total: number;
  passes_accuracy_avg: number;
  key_passes: number;
  tackles: number;
  interceptions: number;
  duels: number;
  duels_won: number;
  rating_sum: number;
  rating_avg: number;
  last_updated: string;
  [key: string]: any;
}

export class PlayerStatsService {
  private client: any;

  constructor(client?: TheSportsClient) {
    this.client = client || new TheSportsClient();
  }

  /**
   * Fetch player stats for a match from API
   */
  async getMatchPlayerStatsFromApi(matchId: string): Promise<PlayerMatchStats[] | null> {
    try {
      const response = await this.client.get<any>('/match/player_stats/detail', { match_id: matchId });
      
      if (response?.err) {
        logger.warn(`[PlayerStats] API error for match ${matchId}: ${response.err}`);
        return null;
      }

      const results = response?.results;
      if (!results || !Array.isArray(results)) {
        return null;
      }

      return results.map((p: any) => ({
        player_id: String(p.player_id || p.id),
        team_id: p.team_id ? String(p.team_id) : undefined,
        position: p.position,
        rating: p.rating,
        minutes_played: p.minutes_played,
        goals: p.goals || 0,
        assists: p.assists || 0,
        yellow_cards: p.yellow_cards || 0,
        red_cards: p.red_cards || 0,
        shots: p.shots || 0,
        shots_on_target: p.shots_on_target || 0,
        passes: p.passes || 0,
        passes_accuracy: p.passes_accuracy || 0,
        key_passes: p.key_passes || 0,
        dribble: p.dribble || 0,
        dribble_succ: p.dribble_succ || 0,
        duels: p.duels || 0,
        duels_won: p.duels_won || 0,
        tackles: p.tackles || 0,
        interceptions: p.interceptions || 0,
        clearances: p.clearances || 0,
        fouls: p.fouls || 0,
        was_fouled: p.was_fouled || 0,
        offsides: p.offsides || 0,
        saves: p.saves || 0
      }));
    } catch (error: any) {
      logger.error(`[PlayerStats] Failed to fetch stats for match ${matchId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Process and save player stats for a completed match
   */
  async processMatchPlayerStats(matchId: string, seasonId: string): Promise<number> {
    const client = await pool.connect();
    let updatedPlayers = 0;

    try {
      // Fetch player stats from API
      const playerStats = await this.getMatchPlayerStatsFromApi(matchId);
      
      if (!playerStats || playerStats.length === 0) {
        logger.debug(`[PlayerStats] No player stats found for match ${matchId}`);
        return 0;
      }

      // Save to ts_matches.player_stats
      await client.query(
        `UPDATE ts_matches SET player_stats = $1, updated_at = NOW() WHERE external_id = $2`,
        [JSON.stringify(playerStats), matchId]
      );
      logger.info(`[PlayerStats] Saved ${playerStats.length} player stats to match ${matchId}`);

      // Aggregate into ts_players.season_stats
      for (const stats of playerStats) {
        try {
          const wasUpdated = await this.aggregatePlayerSeasonStats(
            stats.player_id,
            matchId,
            seasonId,
            stats,
            client
          );
          if (wasUpdated) {
            updatedPlayers++;
          }
        } catch (error: any) {
          logger.warn(`[PlayerStats] Failed to aggregate for player ${stats.player_id}: ${error.message}`);
        }
      }

      logger.info(`[PlayerStats] ✅ Aggregated season stats for ${updatedPlayers} players from match ${matchId}`);
      return updatedPlayers;
    } finally {
      client.release();
    }
  }

  /**
   * Aggregate player stats into season_stats
   * Prevents double-counting by tracking processed matches
   */
  private async aggregatePlayerSeasonStats(
    playerId: string,
    matchId: string,
    seasonId: string,
    matchStats: PlayerMatchStats,
    client: any
  ): Promise<boolean> {
    // Get current player data
    const playerResult = await client.query(
      'SELECT season_stats FROM ts_players WHERE external_id = $1',
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      logger.debug(`[PlayerStats] Player ${playerId} not found in database`);
      return false;
    }

    let seasonStats: Record<string, SeasonStatsEntry> = playerResult.rows[0].season_stats || {};

    // Initialize season entry if not exists
    if (!seasonStats[seasonId]) {
      seasonStats[seasonId] = {
        matches_played: 0,
        matches_counted: [],
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        minutes_played: 0,
        shots: 0,
        shots_on_target: 0,
        passes: 0,
        passes_accuracy_total: 0,
        passes_accuracy_avg: 0,
        key_passes: 0,
        tackles: 0,
        interceptions: 0,
        duels: 0,
        duels_won: 0,
        rating_sum: 0,
        rating_avg: 0,
        last_updated: new Date().toISOString()
      };
    }

    const season = seasonStats[seasonId];

    // Check if this match was already counted
    if (season.matches_counted.includes(matchId)) {
      logger.debug(`[PlayerStats] Match ${matchId} already counted for player ${playerId}`);
      return false;
    }

    // Sum up stats
    const sumFields = [
      'goals', 'assists', 'yellow_cards', 'red_cards', 'minutes_played',
      'shots', 'shots_on_target', 'passes', 'key_passes', 'tackles',
      'interceptions', 'duels', 'duels_won', 'clearances', 'fouls',
      'was_fouled', 'offsides', 'saves', 'dribble', 'dribble_succ'
    ];

    for (const field of sumFields) {
      if (matchStats[field] !== undefined) {
        season[field] = (season[field] || 0) + (matchStats[field] || 0);
      }
    }

    // Handle rating (for average calculation)
    if (matchStats.rating) {
      season.rating_sum = (season.rating_sum || 0) + matchStats.rating;
    }

    // Handle passes accuracy (for weighted average)
    if (matchStats.passes_accuracy && matchStats.passes) {
      season.passes_accuracy_total = (season.passes_accuracy_total || 0) + matchStats.passes_accuracy;
    }

    // Increment matches played
    season.matches_played++;
    season.matches_counted.push(matchId);

    // Calculate averages
    if (season.matches_played > 0) {
      season.rating_avg = (season.rating_sum || 0) / season.matches_played;
      season.passes_accuracy_avg = (season.passes_accuracy_total || 0) / season.matches_played;
    }

    season.last_updated = new Date().toISOString();

    // Save updated season stats
    await client.query(
      'UPDATE ts_players SET season_stats = $1, updated_at = NOW() WHERE external_id = $2',
      [JSON.stringify(seasonStats), playerId]
    );

    return true;
  }

  /**
   * Batch process player stats for recently completed matches
   */
  async batchProcessRecentMatches(limit: number = 50): Promise<{ processed: number; players_updated: number }> {
    const client = await pool.connect();
    try {
      // Find completed matches in last 30 days without player_stats
      const result = await client.query(`
        SELECT external_id as match_id, season_id
        FROM ts_matches
        WHERE status_id = 8
          AND match_time >= EXTRACT(EPOCH FROM NOW()) - 30 * 86400
          AND (player_stats IS NULL OR player_stats = '[]'::jsonb)
        ORDER BY match_time DESC
        LIMIT $1
      `, [limit]);

      const matches = result.rows;
      logger.info(`[PlayerStats] Found ${matches.length} matches to process`);

      let totalUpdated = 0;

      for (const match of matches) {
        const updated = await this.processMatchPlayerStats(match.match_id, match.season_id || '');
        totalUpdated += updated;

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      return { processed: matches.length, players_updated: totalUpdated };
    } finally {
      client.release();
    }
  }
}

