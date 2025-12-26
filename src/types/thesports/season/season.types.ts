/**
 * Season Types
 * 
 * Type definitions for season/timeline data
 * Critical for "Standings/Table" and filtering current matches
 */

export interface Season {
  id: string; // UUID
  external_id: string; // TheSports season ID
  competition_id: string | null;
  year: string | null; // e.g. "2023-2024"
  is_current: boolean | null; // 1=Yes, 0=No
  has_table: boolean | null; // 1=Has Standings
  has_player_stats: boolean | null;
  has_team_stats: boolean | null;
  start_time: number | null; // Unix timestamp
  end_time: number | null; // Unix timestamp
  updated_at: Date;
  created_at: Date;
}

export interface SeasonData {
  id: string; // TheSports season ID
  competition_id: string | null;
  year: string | null;
  is_current: boolean | null;
  has_table: boolean | null;
  has_player_stats: boolean | null;
  has_team_stats: boolean | null;
  start_time: number | null;
  end_time: number | null;
}









