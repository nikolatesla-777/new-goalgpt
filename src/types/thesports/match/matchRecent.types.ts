/**
 * Match Recent Types
 * 
 * Type definitions for /match/recent/list endpoint response
 */

import { MatchState } from '../enums';

export interface MatchRecent {
  id: string;
  match_id?: string;
  external_id?: string;
  home_team_id: string;
  away_team_id: string;
  match_time: number; // Unix timestamp
  status: MatchState;
  status_id?: number;
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
  updated_at?: number;
  update_time?: number;
  minute?: number;
  home_scores?: number[];
  away_scores?: number[];
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
      name_en?: string;
      logo?: string;
      logo_url?: string;
      short_name?: string;
      id?: string;
    };
  } | any[]; // Support both object and array formats
  competition?: {
    [competitionId: string]: {
      name?: string;
      name_en?: string;
      logo?: string;
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
  time?: number; // Unix timestamp for incremental updates (Last Sync Timestamp + 1)
}

