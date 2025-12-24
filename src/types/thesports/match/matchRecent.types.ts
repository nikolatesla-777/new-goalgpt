/**
 * Match Recent Types
 * 
 * Type definitions for /match/recent/list endpoint response
 */

import { MatchState } from '../enums';

export interface MatchRecent {
  id: string;
  home_team_id: string;
  away_team_id: string;
  match_time: number; // Unix timestamp
  status: MatchState;
  home_score?: number;
  away_score?: number;
  competition_id?: string;
  season_id?: string;
  round?: string;
  venue?: string;
  attendance?: number;
  referee?: string;
  weather?: string;
  temperature?: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ResultsExtra {
  team?: {
    [teamId: string]: {
      name?: string;
      logo_url?: string;
      short_name?: string;
    };
  };
  competition?: {
    [competitionId: string]: {
      name?: string;
      logo_url?: string;
    };
  };
}

export interface MatchRecentResponse {
  results: MatchRecent[];
  results_extra?: ResultsExtra;
  pagination?: Pagination;
  err?: string; // TheSports API error message
}

export interface MatchRecentParams {
  page?: number;
  limit?: number;
  competition_id?: string;
  season_id?: string;
  date?: string; // YYYY-MM-DD format
}

