/**
 * Stage Types
 * 
 * Type definitions for stage/tournament phase data
 * Crucial for distinguishing "Group Stage" vs "Finals"
 */

export interface Stage {
  id: string; // UUID
  external_id: string; // TheSports stage ID
  season_id: string | null; // FK to ts_seasons(external_id)
  name: string | null; // e.g. "Group A", "Quarter-final"
  mode: number | null; // 1=Points (League), 2=Elimination (Cup)
  group_count: number | null;
  round_count: number | null;
  sort_order: number | null; // Sorting order (renamed from 'order' to avoid SQL reserved keyword)
  updated_at: Date;
  created_at: Date;
}

export interface StageData {
  id: string; // TheSports stage ID
  season_id: string | null;
  name: string | null;
  mode: number | null;
  group_count: number | null;
  round_count: number | null;
  sort_order: number | null;
}

