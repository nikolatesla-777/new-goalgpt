/**
 * Season Standings Types
 * 
 * Types for /season/recent/table/detail endpoint
 * Returns league standings/table data
 */

export interface SeasonStandingsParams {
    season_id: string;
}

export interface TeamStanding {
    team_id: string;
    team_name?: string;
    team_logo?: string;
    position: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
    form?: string[];  // e.g., ['W', 'W', 'D', 'L', 'W']
    home_played?: number;
    home_won?: number;
    home_drawn?: number;
    home_lost?: number;
    home_goals_for?: number;
    home_goals_against?: number;
    away_played?: number;
    away_won?: number;
    away_drawn?: number;
    away_lost?: number;
    away_goals_for?: number;
    away_goals_against?: number;
}

export interface StandingsGroup {
    group_name?: string;
    standings: TeamStanding[];
}

export interface SeasonStandingsData {
    season_id: string;
    competition_id?: string;
    season_name?: string;
    groups?: StandingsGroup[];
    standings?: TeamStanding[];  // For leagues without groups
}

export interface SeasonStandingsResponse {
    code?: number;
    results?: SeasonStandingsData;
    err?: string;
}
