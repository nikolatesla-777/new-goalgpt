/**
 * Match Lineup Types
 * 
 * Type definitions for /match/lineup/detail endpoint response
 */

export interface Player {
  id: string;
  name: string;
  number?: number;
  position?: string;
  is_captain?: boolean;
  is_goalkeeper?: boolean;
}

export interface Lineup {
  formation?: string;
  starting_xi: Player[];
  substitutes: Player[];
  coach?: string;
}

export interface MatchLineup {
  match_id: string;
  home_team_lineup: Lineup;
  away_team_lineup: Lineup;
}

export interface MatchLineupResponse {
  result: MatchLineup;
}

export interface MatchLineupParams {
  match_id: string;
}

