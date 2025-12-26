/**
 * Match Half Stats Types
 * 
 * Types for /match/half/team_stats/list and /match/half/team_stats/detail endpoints
 * Returns first/second half team statistics
 */

export interface MatchHalfStatsParams {
    match_id?: string;
}

export interface HalfStats {
    possession?: number;
    shots?: number;
    shots_on_target?: number;
    corners?: number;
    fouls?: number;
    offsides?: number;
    yellow_cards?: number;
    red_cards?: number;
    passes?: number;
    pass_accuracy?: number;
    attacks?: number;
    dangerous_attacks?: number;
}

export interface MatchHalfStatsData {
    match_id: string;
    home_first_half: HalfStats;
    away_first_half: HalfStats;
    home_second_half: HalfStats;
    away_second_half: HalfStats;
    home_overtime?: HalfStats;
    away_overtime?: HalfStats;
}

export interface MatchHalfStatsResponse {
    code?: number;
    results?: MatchHalfStatsData | MatchHalfStatsData[];
    err?: string;
}
