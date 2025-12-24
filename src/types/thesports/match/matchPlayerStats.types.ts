/**
 * Match Player Stats Types
 * 
 * Type definitions for /match/player_stats/list endpoint response
 */

export interface PlayerStat {
  player_id: string;
  player_name: string;
  team_id: string;
  position?: string;
  stats: {
    [statType: string]: number;
  };
}

export interface MatchPlayerStats {
  match_id: string;
  home_team_players: PlayerStat[];
  away_team_players: PlayerStat[];
}

export interface MatchPlayerStatsResponse {
  result: MatchPlayerStats;
}

export interface MatchPlayerStatsParams {
  match_id: string;
}

