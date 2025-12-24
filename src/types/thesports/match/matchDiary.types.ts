/**
 * Match Diary Types
 * 
 * Type definitions for /match/diary endpoint response
 */

import { MatchRecent } from './matchRecent.types';

export interface MatchDiary extends MatchRecent {
  // Match Diary extends MatchRecent with additional fields if needed
}

export interface MatchDiaryResponse {
  results: MatchDiary[];
  results_extra?: {
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
  };
  err?: string; // TheSports API error message
}

export interface MatchDiaryParams {
  date?: string; // YYYY-MM-DD format (default: today)
}

