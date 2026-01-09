/**
 * Match Recent Types
 * 
 * Type definitions for /match/recent/list endpoint response
 * 
 * Score Array Format (Array[7]):
 * [0] = Regular score (normal time)
 * [1] = Half-time score
 * [2] = Red cards
 * [3] = Yellow cards  
 * [4] = Corners
 * [5] = Overtime score
 * [6] = Penalty shootout score
 */

import { MatchState, Weather } from '../enums';
import { MatchEnvironment, ScoreArray } from './matchBase.types';

export interface MatchRecent {
  // Identifiers
  id: string;
  match_id?: string;
  external_id?: string;
  
  // Teams
  home_team_id: string;
  away_team_id: string;
  
  // Competition & Season
  competition_id?: string;
  season_id?: string;
  stage_id?: string;
  
  // Timing
  match_time: number;           // Unix timestamp (UTC)
  ended?: number;               // End timestamp
  
  // Status
  status: MatchState;
  status_id?: number;
  minute?: number;
  
  // Scores (Array[7] format) - STRICT TYPE (Phase 2: Type Safety)
  // Only accept exact 7-element tuple for compile-time safety
  home_scores?: ScoreArray;
  away_scores?: ScoreArray;
  
  // Scores (Simple format)
  home_score?: number;
  away_score?: number;
  
  // Round & Group
  round?: string;
  round_num?: number;
  group_num?: number;           // 1=A, 2=B, etc.
  
  // Team positions
  home_position?: string;
  away_position?: string;
  
  // Venue & Officials
  venue?: string;
  venue_id?: string;
  referee?: string;
  referee_id?: string;
  attendance?: number;
  
  // Coverage flags
  coverage_mlive?: boolean;     // Has live animation? (0/1 in API)
  coverage_lineup?: boolean;    // Has lineup data? (0/1 in API)
  
  // Match flags
  neutral?: boolean;            // Neutral venue?
  tbd?: boolean;                // Time to be determined?
  has_ot?: boolean;             // Has overtime?
  team_reverse?: boolean;       // Teams reversed from official?
  loss?: boolean;               // Match ruled as loss?
  
  // Environment/Weather
  weather?: Weather | string | number;
  temperature?: number | string;
  environment?: MatchEnvironment;
  
  // Related match
  related_id?: string;
  agg_score?: [number, number]; // Aggregate score [home, away]
  
  // Notes
  note?: string;
  
  // Timestamps
  updated_at?: number;
  update_time?: number;
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
      country_id?: string;
    };
  } | any[]; // Support both object and array formats
  competition?: {
    [competitionId: string]: {
      name?: string;
      name_en?: string;
      logo?: string;
      logo_url?: string;
      country_id?: string;
      category_id?: string;
      type?: number;
    };
  };
}

export interface MatchRecentResponse {
  results: MatchRecent[];
  results_extra?: ResultsExtra;
  pagination?: Pagination;
  err?: string; // TheSports API error message
  code?: number;
  msg?: string;
}

export interface MatchRecentParams {
  page?: number;
  limit?: number;
  competition_id?: string;
  season_id?: string;
  date?: string; // YYYY-MM-DD format
  time?: number; // Unix timestamp for incremental updates (Last Sync Timestamp + 1)
}
