/**
 * API Type Definitions
 * Centralized types for API requests and responses
 */

// ============================================================================
// Telegram Daily Lists
// ============================================================================

export interface DailyListMatch {
  match_id: string | null;
  home: string;
  away: string;
  league: string;
  date: string;
  date_unix: number;
  prediction_value: number;
  confidence: number;
  reasoning?: string;
}

export interface DailyList {
  market: string;
  title: string;
  description: string;
  emoji: string;
  matches: DailyListMatch[];
  performance?: {
    total: number;
    won: number;
    lost: number;
    pending: number;
    win_rate: number;
  };
  telegram_message_id?: string | null;
  published_at?: string | null;
}

export interface DailyListsResponse {
  success: boolean;
  generated_at: string;
  lists_count: number;
  lists: DailyList[];
}

export interface DailyListsRangeResponse {
  success: boolean;
  date_range: {
    start: string;
    end: string;
  };
  dates_count: number;
  data: Array<{
    date: string;
    lists_count: number;
    lists: DailyList[];
  }>;
}

// ============================================================================
// Telegram Publish
// ============================================================================

export interface TelegramPublishRequest {
  dry_run?: boolean;
}

export interface TelegramPublishResponse {
  success: boolean;
  market?: string;
  title?: string;
  telegram_message_id?: string | null;
  dry_run?: boolean;
  match_count?: number;
  avg_confidence?: number;
  duration_ms?: number;
  message?: string;
  error?: string;
}

// ============================================================================
// Trends Analysis
// ============================================================================

export interface TrendMatch {
  id: number;
  home_team: string;
  away_team: string;
  league: string;
  kickoff_time: number;
  trend_type: string;
  confidence: number;
}

export interface TrendsAnalysisResponse {
  success: boolean;
  trends: {
    goalTrends: TrendMatch[];
    cornerTrends: TrendMatch[];
    cardsTrends: TrendMatch[];
    formTrends: TrendMatch[];
    valueBets: TrendMatch[];
  };
  totalMatches: number;
  generated_at: string;
}

// ============================================================================
// Player Search
// ============================================================================

export interface PlayerSearchResult {
  player_id: number;
  player_name: string;
  team_name: string;
  position: string;
  nationality: string;
  age: number;
  height: number;
  weight: number;
  jersey_number: number;
}

export interface PlayerSearchResponse {
  success: boolean;
  players: PlayerSearchResult[];
  total: number;
}

// ============================================================================
// League Standings
// ============================================================================

export interface StandingsTeam {
  team_id: number;
  team_name: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: string;
}

export interface LeagueStandingsResponse {
  success: boolean;
  league_name: string;
  season: string;
  standings: StandingsTeam[];
}
