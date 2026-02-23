/**
 * API Type Definitions
 * Centralized types for API requests and responses
 */

// ============================================================================
// Telegram Daily Lists
// ============================================================================

export interface DailyListMatch {
  fs_id: number;
  match_id?: string | null;
  home_name: string;
  away_name: string;
  league_name: string;
  date_unix: number;
  confidence: number;
  reason?: string;
  potentials?: {
    btts?: number;
    over25?: number;
    over15?: number;
    avg?: number;
    corners?: number;
    cards?: number;
  };
  xg?: {
    home?: number;
    away?: number;
  };
  odds?: {
    home?: number;
    draw?: number;
    away?: number;
  };
  live_score?: {
    home: number;
    away: number;
    minute: string;
    status: string;
  };
  // Settlement fields (from backend settlement system)
  match_finished?: boolean | null;
  final_score?: {
    home: number;
    away: number;
  } | null;
  result?: 'won' | 'lost' | 'void' | 'pending';
  settlement_reason?: string | null;
}

export interface DailyList {
  market: string;
  title: string;
  emoji: string;
  matches_count: number;
  avg_confidence: number;
  matches: DailyListMatch[];
  preview?: string;
  generated_at?: number;
  performance?: {
    total: number;
    won: number;
    lost: number;
    pending: number;
    win_rate: number;
  };
  settlement_result?: {
    won: number;
    lost: number;
    void: number;
    list_id?: string;
    list_type?: string;
    matches?: Array<{
      fs_match_id: number;
      match_id?: string;
      home_team: string;
      away_team: string;
      result: string;
      home_score?: number;
      away_score?: number;
      reason?: string;
      rule?: string;
    }>;
  };
  status?: string;
  settled_at?: string | null;
  telegram_message_id?: string | null;
  channel_id?: string | null;
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
// Twitter Publishing
// ============================================================================

export interface TwitterPublishResponse {
  success: boolean;
  dry_run?: boolean;
  skipped?: boolean;
  skip_reason?: string;
  tweet_count?: number;
  main_tweet_id?: string;
  tweet_ids?: string[];
  post_id?: string;
  error?: string;
  elapsed_ms?: number;
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

// ============================================================================
// Match Analysis
// ============================================================================

export interface MatchAnalysisRecommendation {
  market: string;
  prediction: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface MatchAnalysis {
  title: string;
  fullAnalysis: string;
  recommendations: MatchAnalysisRecommendation[];
  generatedAt: string;
}

export interface MatchAnalysisResponse {
  success: boolean;
  match: {
    id: number;
    home_name: string;
    away_name: string;
    competition_name: string;
    date_unix: number;
  };
  analysis: MatchAnalysis;
  formatted: {
    telegram: string;
    copy: string;
  };
}
