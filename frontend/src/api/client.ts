/**
 * API Client - Domain-specific API functions
 * All API calls go through centralized HTTP client
 */

import { get, post } from './http';
import type {
  DailyListsResponse,
  DailyListsRangeResponse,
  TelegramPublishRequest,
  TelegramPublishResponse,
  TwitterPublishResponse,
  TrendsAnalysisResponse,
  PlayerSearchResponse,
  LeagueStandingsResponse,
  MatchAnalysisResponse,
} from './types';

// ============================================================================
// Telegram Daily Lists API
// ============================================================================

/**
 * Get today's daily lists (auto-generates if needed)
 */
export async function getTelegramDailyListsToday(): Promise<DailyListsResponse> {
  return get<DailyListsResponse>('/telegram/daily-lists/today');
}

/**
 * Get daily lists for a date range
 * @param start Start date (YYYY-MM-DD)
 * @param end End date (YYYY-MM-DD)
 */
export async function getTelegramDailyListsRange(
  start: string,
  end: string
): Promise<DailyListsRangeResponse> {
  return get<DailyListsRangeResponse>(
    `/telegram/daily-lists/range?start=${start}&end=${end}`
  );
}

/**
 * Publish a single daily list to Telegram
 * @param market Market type (e.g., 'OVER_25', 'BTTS')
 * @param options Publish options (dry_run, etc.)
 */
export async function publishTelegramDailyList(
  market: string,
  options: TelegramPublishRequest = {}
): Promise<TelegramPublishResponse> {
  return post<TelegramPublishResponse>(
    `/telegram/publish/daily-list/${market}`,
    options
  );
}

/**
 * Publish a single daily list as PHOTO + CAPTION to Telegram
 * @param market Market type (e.g., 'OVER_25', 'BTTS')
 * @param caption Optional custom caption text (HTML supported)
 */
export async function publishTelegramDailyListPhoto(
  market: string,
  caption?: string
): Promise<TelegramPublishResponse> {
  return post<TelegramPublishResponse>(
    `/telegram/publish/daily-list/${market}/photo`,
    { caption }
  );
}

/**
 * Publish all daily lists to Telegram
 * @param options Publish options (dry_run, etc.)
 */
export async function publishAllTelegramDailyLists(
  options: TelegramPublishRequest = {}
): Promise<TelegramPublishResponse> {
  return post<TelegramPublishResponse>('/telegram/publish/daily-lists/all', options);
}

/**
 * Force regenerate today's daily lists
 */
export async function regenerateTelegramDailyLists(): Promise<DailyListsResponse> {
  return post<DailyListsResponse>('/telegram/daily-lists/regenerate');
}

// ============================================================================
// Twitter Publishing API
// ============================================================================

/**
 * Publish today's trend analysis as a Twitter/X thread
 */
export async function publishTrendsToTwitter(): Promise<TwitterPublishResponse> {
  return post<TwitterPublishResponse>('/twitter/publish/trends');
}

/**
 * Publish a single manually edited match tweet, optionally with a card image (base64 PNG)
 * @param text The final tweet text (max 280 chars)
 * @param imageBase64 Optional PNG image as base64 string (no data: prefix)
 */
export async function publishSingleMatchTweet(
  text: string,
  imageBase64?: string,
  replyText?: string
): Promise<{ success: boolean; dry_run: boolean; tweet_id?: string; reply_tweet_id?: string; thread_length?: number; error?: string }> {
  return post('/twitter/publish/single-match', { text, imageBase64, replyText });
}

/**
 * Fetch AI analysis for a FootyStats match ID
 */
export async function getMatchAnalysis(fsMatchId: number): Promise<MatchAnalysisResponse> {
  return post<MatchAnalysisResponse>(`/telegram/analysis/match/${fsMatchId}`, {});
}

// ============================================================================
// Trends Analysis API
// ============================================================================

/**
 * Get trends analysis
 */
export async function getTrendsAnalysis(): Promise<TrendsAnalysisResponse> {
  return get<TrendsAnalysisResponse>('/footystats/trends-analysis');
}

// ============================================================================
// Player Search API
// ============================================================================

/**
 * Search players by name
 * @param query Search query
 */
export async function searchPlayers(query: string): Promise<PlayerSearchResponse> {
  return get<PlayerSearchResponse>(`/players/search?q=${encodeURIComponent(query)}`);
}

/**
 * Get player details by ID
 * @param playerId Player ID
 */
export async function getPlayerById(playerId: number): Promise<any> {
  return get(`/players/${playerId}`);
}

// ============================================================================
// League Standings API
// ============================================================================

/**
 * Get league standings
 * @param leagueId League ID
 * @param season Season (optional)
 */
export async function getLeagueStandings(
  leagueId: number,
  season?: string
): Promise<LeagueStandingsResponse> {
  const queryParams = season ? `?season=${season}` : '';
  return get<LeagueStandingsResponse>(`/leagues/${leagueId}/standings${queryParams}`);
}

// ============================================================================
// Match Analysis API
// ============================================================================

/**
 * Generate AI-powered analysis for a match
 * @param matchId FootyStats match ID
 */
export async function generateMatchAnalysis(
  matchId: number
): Promise<MatchAnalysisResponse> {
  return post<MatchAnalysisResponse>(`/telegram/analysis/match/${matchId}`, {});
}

// ============================================================================
// Export all as default
// ============================================================================

export default {
  // Telegram Daily Lists
  getTelegramDailyListsToday,
  getTelegramDailyListsRange,
  publishTelegramDailyList,
  publishAllTelegramDailyLists,
  regenerateTelegramDailyLists,

  // Match Analysis
  generateMatchAnalysis,

  // Trends
  getTrendsAnalysis,

  // Twitter
  publishTrendsToTwitter,

  // Players
  searchPlayers,
  getPlayerById,

  // Leagues
  getLeagueStandings,
};
