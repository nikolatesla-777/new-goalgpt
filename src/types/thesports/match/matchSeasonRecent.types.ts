/**
 * Match Season Recent Types
 * 
 * Type definitions for /match/season/recent endpoint response
 */

import { MatchRecent } from './matchRecent.types';

export interface MatchSeasonRecent extends MatchRecent {
  season_id?: string;
  competition_id?: string;
}

export interface MatchSeasonRecentResponse {
  results: MatchSeasonRecent[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface MatchSeasonRecentParams {
  season_id: string;
  page?: number;
  limit?: number;
}

