/**
 * Match Analysis Types (H2H)
 * 
 * Types for /match/analysis endpoint
 * Returns historical confrontation, recent results, and goal distribution
 */

export interface MatchAnalysisParams {
    match_id: string;
}

export interface H2HMatch {
    id: string;
    match_time: number;
    home_team_id: string;
    away_team_id: string;
    home_score: number;
    away_score: number;
    home_ht_score?: number;
    away_ht_score?: number;
    competition_id?: string;
    season_id?: string;
}

export interface TeamRecentForm {
    team_id: string;
    matches: H2HMatch[];
    win: number;
    draw: number;
    loss: number;
    goals_for: number;
    goals_against: number;
}

export interface GoalDistribution {
    first_half_home: number;
    first_half_away: number;
    second_half_home: number;
    second_half_away: number;
}

export interface MatchAnalysisData {
    // Historical H2H matches between these two teams
    h2h: H2HMatch[];
    // Home team recent form
    home_recent: TeamRecentForm;
    // Away team recent form
    away_recent: TeamRecentForm;
    // Goal distribution stats
    goal_distribution?: GoalDistribution;
    // Future/upcoming matches
    future_matches?: H2HMatch[];
}

export interface MatchAnalysisResponse {
    code?: number;
    results?: MatchAnalysisData;
    err?: string;
}
