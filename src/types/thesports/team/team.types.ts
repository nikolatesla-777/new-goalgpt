/**
 * Team Types
 * 
 * Type definitions for team data
 */

export interface Team {
  id: string; // UUID
  external_id: string; // TheSports team ID
  name: string | null;
  short_name: string | null;
  logo_url: string | null;
  website: string | null;
  national: boolean | null;
  foundation_time: number | null;
  country_id: string | null;
  competition_id: string | null;
  venue_id: string | null;
  coach_id: string | null;
  uid?: string | null; // Master ID if this is a duplicate (empty/null = master record)
  is_duplicate?: boolean; // true if uid is present (duplicate/merged record)
  created_at: Date;
  updated_at: Date;
}

export interface TeamData {
  id: string; // TheSports team ID
  name: string | null;
  short_name: string | null;
  logo_url: string | null;
  country_id?: string;
  competition_id?: string;
  uid?: string | null; // Master ID if this is a duplicate
}

export interface ResultsExtraTeam {
  [teamId: string]: {
    name?: string;
    logo_url?: string;
    short_name?: string;
  };
}

