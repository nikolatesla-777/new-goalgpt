/**
 * Match Detail Live Types
 * 
 * Type definitions for /match/detail_live endpoint response
 */

import { MatchState } from '../enums';

export interface MatchDetailLive {
  id: string;
  home_team_id: string;
  away_team_id: string;
  match_time: number;
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
  // Live-specific fields
  current_minute?: number;
  injury_time?: number;
  home_team_stats?: any;
  away_team_stats?: any;
}

export interface MatchDetailLiveResponse {
  result: MatchDetailLive;
}

export interface MatchDetailLiveParams {
  match_id: string;
}

