/**
 * Match Trend Types
 * 
 * Types for /match/trend/live and /match/trend/detail endpoints
 * Returns minute-by-minute trend data
 */

export interface MatchTrendParams {
    match_id: string;
}

export interface TrendPoint {
    minute: number;
    home_value: number;  // Positive for home
    away_value: number;  // Negative for away
    type?: string;       // possession, attack, etc.
}

export interface MatchTrendData {
    match_id: string;
    first_half: TrendPoint[];
    second_half: TrendPoint[];
    overtime?: TrendPoint[];
}

export interface MatchTrendResponse {
    code?: number;
    results?: MatchTrendData | MatchTrendData[];
    err?: string;
}

export interface MatchTrendLiveResponse {
    code?: number;
    results?: MatchTrendData[];
    err?: string;
}
