/**
 * Coach Types
 * 
 * Type definitions for coach/manager data
 */

export interface Coach {
  id: string; // UUID
  external_id: string; // TheSports coach ID
  name: string | null;
  short_name: string | null;
  logo: string | null;
  team_id: string | null; // FK to ts_teams(external_id), NULL if not currently coaching
  country_id: string | null;
  type: number | null; // 1=Head coach, 2=Interim
  birthday: number | null; // Unix timestamp
  age: number | null;
  preferred_formation: string | null; // e.g. "4-4-2"
  nationality: string | null;
  joined: number | null; // Unix timestamp
  contract_until: number | null; // Unix timestamp
  uid?: string | null; // Master ID if this is a duplicate (empty/null = master record)
  is_duplicate?: boolean; // true if uid is present (duplicate/merged record)
  updated_at: Date;
  created_at: Date;
}

export interface CoachData {
  id: string; // TheSports coach ID
  name: string | null;
  short_name: string | null;
  logo: string | null;
  team_id: string | null;
  country_id: string | null;
  type: number | null;
  birthday: number | null;
  age: number | null;
  preferred_formation: string | null;
  nationality: string | null;
  joined: number | null;
  contract_until: number | null;
  uid?: string | null; // Master ID if this is a duplicate
}

