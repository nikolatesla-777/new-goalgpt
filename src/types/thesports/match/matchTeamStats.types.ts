/**
 * Match Team Stats Types
 * 
 * Type definitions for /match/team_stats/list endpoint response
 */

export interface TeamStat {
  type: number; // TechnicalStatistics enum
  home: number;
  away: number;
}

export interface MatchTeamStats {
  match_id: string;
  stats: TeamStat[];
}

export interface MatchTeamStatsResponse {
  result: MatchTeamStats;
}

export interface MatchTeamStatsParams {
  match_id: string;
}

