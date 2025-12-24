/**
 * Referee Types
 * 
 * Type definitions for referee/official data
 * Critical for future "Card/Penalty" AI predictions
 */

export interface Referee {
  id: string; // UUID
  external_id: string; // TheSports referee ID
  name: string | null;
  short_name: string | null;
  logo: string | null;
  country_id: string | null;
  birthday: number | null; // Unix timestamp
  updated_at: Date;
  created_at: Date;
}

export interface RefereeData {
  id: string; // TheSports referee ID
  name: string | null;
  short_name: string | null;
  logo: string | null;
  country_id: string | null;
  birthday: number | null;
}







