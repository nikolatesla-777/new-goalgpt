/**
 * Player Types
 * 
 * Type definitions for player data
 */

export interface Player {
  id: string; // UUID
  external_id: string; // TheSports player ID
  name: string | null;
  short_name: string | null;
  logo: string | null;
  team_id: string | null; // FK to ts_teams(external_id), NULL if "0" (Free Agent/Retired)
  country_id: string | null;
  age: number | null;
  birthday: number | null; // Unix timestamp
  height: number | null; // cm
  weight: number | null; // kg
  market_value: number | null; // BigInt in DB
  market_value_currency: string | null;
  contract_until: number | null; // Unix timestamp
  preferred_foot: number | null; // 1=Left, 2=Right, 3=Both
  position: string | null; // Main position code (F, M, D, G)
  positions: any | null; // JSONB - detailed positions array
  ability: any | null; // JSONB - ability array
  characteristics: any | null; // JSONB - characteristics array
  uid?: string | null; // Master ID if this is a duplicate (empty/null = master record)
  is_duplicate?: boolean; // true if uid is present (duplicate/merged record)
  updated_at: Date;
  created_at: Date;
}

export interface PlayerData {
  id: string; // TheSports player ID
  name: string | null;
  short_name: string | null;
  logo: string | null;
  team_id: string | null;
  country_id: string | null;
  age: number | null;
  birthday: number | null;
  height: number | null;
  weight: number | null;
  market_value: number | null;
  market_value_currency: string | null;
  contract_until: number | null;
  preferred_foot: number | null;
  position: string | null;
  positions: any | null;
  ability: any | null;
  characteristics: any | null;
  uid?: string | null; // Master ID if this is a duplicate
}

