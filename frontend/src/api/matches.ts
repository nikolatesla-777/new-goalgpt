/**
 * Match API Client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface Competition {
  id: string;
  name: string;
  logo_url?: string | null;
  country_id?: string;
  country_name?: string;
}

/**
 * PHASE 3: AI Prediction on Match
 * Embedded prediction data enriched via LEFT JOIN LATERAL
 */
export interface AIPredictionOnMatch {
  id: string;
  canonical_bot_name: string;
  prediction: string;              // "IY 0.5 ÜST"
  prediction_threshold: number;    // 0.5
  result: 'pending' | 'won' | 'lost' | 'cancelled';
  result_reason: string | null;
  final_score: string | null;
  access_type: 'VIP' | 'FREE';
  minute_at_prediction: number;
  score_at_prediction: string;
  created_at: string;
  resulted_at: string | null;
}

export interface MatchRecent {
  id: string;
  competition_id?: string;
  season_id?: string;
  match_time: number;
  status: number; // Backend uses 'status' not 'match_status'
  match_status?: number; // legacy/compat alias (some endpoints may still send this)
  minute?: number | null; // Phase 3C: Backend-calculated minute (from Minute Engine)
  minute_text: string; // Phase 4-4: UI-friendly display text (HT/45+/90+/FT/etc.) - REQUIRED, never null
  updated_at: string; // Phase 4-4: ISO timestamp of last DB update (for stale badge)
  age_sec?: number | null; // Phase 4-4: Optional age since last update (backend-calculated)
  stale_reason?: string | null; // Phase 4-4: Optional stale reason from Phase 4-3
  provider_update_time?: number | null; // Phase 4-4: Optional provider timestamp (epoch seconds)
  last_event_ts?: number | null; // Phase 4-4: Optional last event timestamp (epoch seconds)
  live_kickoff_time?: number | null; // legacy/compat (deprecated for minute calculation, kept for backward compat)
  home_team_id: string;
  away_team_id: string;
  home_score?: number;
  away_score?: number;
  home_score_regular?: number | null;
  away_score_regular?: number | null;
  home_score_overtime?: number | null;
  away_score_overtime?: number | null;
  home_score_penalties?: number | null;
  away_score_penalties?: number | null;
  home_red_cards?: number | null;
  away_red_cards?: number | null;
  home_yellow_cards?: number | null;
  away_yellow_cards?: number | null;
  home_corners?: number | null;
  away_corners?: number | null;
  home_team?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  away_team?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  competition?: Competition | null;
  // PHASE 3: Optional AI prediction (enriched when include_ai=true)
  aiPrediction?: AIPredictionOnMatch;
}

export interface MatchDiary {
  id: string;
  competition_id?: string;
  season_id?: string;
  match_time: number;
  status: number; // Backend uses 'status' not 'match_status'
  match_status?: number; // legacy/compat alias (some endpoints may still send this)
  minute?: number | null; // Phase 3C: Backend-calculated minute (from Minute Engine)
  minute_text: string; // Phase 4-4: UI-friendly display text (HT/45+/90+/FT/etc.) - REQUIRED, never null
  updated_at: string; // Phase 4-4: ISO timestamp of last DB update (for stale badge)
  age_sec?: number | null; // Phase 4-4: Optional age since last update (backend-calculated)
  stale_reason?: string | null; // Phase 4-4: Optional stale reason from Phase 4-3
  provider_update_time?: number | null; // Phase 4-4: Optional provider timestamp (epoch seconds)
  last_event_ts?: number | null; // Phase 4-4: Optional last event timestamp (epoch seconds)
  live_kickoff_time?: number | null; // legacy/compat (deprecated for minute calculation, kept for backward compat)
  home_team_id: string;
  away_team_id: string;
  home_score?: number;
  away_score?: number;
  home_score_regular?: number | null;
  away_score_regular?: number | null;
  home_score_overtime?: number | null;
  away_score_overtime?: number | null;
  home_score_penalties?: number | null;
  away_score_penalties?: number | null;
  home_red_cards?: number | null;
  away_red_cards?: number | null;
  home_yellow_cards?: number | null;
  away_yellow_cards?: number | null;
  home_corners?: number | null;
  away_corners?: number | null;
  home_team?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  away_team?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  competition?: Competition | null;
  // PHASE 3: Optional AI prediction (enriched when include_ai=true)
  aiPrediction?: AIPredictionOnMatch;
}

// Alias for compatibility
export type Match = MatchRecent | MatchDiary;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface MatchRecentResponse {
  results: MatchRecent[];
  total?: number;
  page?: number;
  limit?: number;
  err?: string; // TheSports API error message
}

export interface MatchDiaryResponse {
  results: MatchDiary[];
  total?: number;
  err?: string; // TheSports API error message
}

/**
 * Retry fetch with exponential backoff for 502/503/504 errors
 */
async function retryFetch(url: string, options?: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && (response.status === 502 || response.status === 503 || response.status === 504)) {
      if (retries > 0) {
        await new Promise(res => setTimeout(res, delay));
        return retryFetch(url, options, retries - 1, delay * 2);
      }
    }
    return response;
  } catch (error: any) {
    if ((error.name === 'TypeError' || error.name === 'AbortError') && retries > 0) {
      await new Promise(res => setTimeout(res, delay));
      return retryFetch(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Get recent matches
 */
export async function getRecentMatches(params?: {
  page?: number;
  limit?: number;
  date?: string;
}): Promise<MatchRecentResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.date) queryParams.append('date', params.date);

  const url = `${API_BASE_URL}/matches/recent?${queryParams}`;
  const response = await retryFetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error(`HTTP ${response.status}: Backend hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.`);
    }
    throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
  }

  const data: ApiResponse<MatchRecentResponse> = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch recent matches');
  }

  // Check for TheSports API error
  if (data.data.err) {
    throw new Error(data.data.err);
  }

  return data.data;
}

/**
 * Get live matches
 * Returns matches with status_id IN (2, 3, 4, 5, 7) that started within the last 4 hours
 * NO date filtering - only status and time-based filtering
 */
export async function getLiveMatches(): Promise<MatchDiaryResponse> {
  const url = `${API_BASE_URL}/matches/live`;

  // Add timeout (60 seconds) to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await retryFetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`HTTP ${response.status}: Backend hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.`);
      }
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data: ApiResponse<MatchDiaryResponse> = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch live matches');
    }

    // Check for TheSports API error
    if (data.data.err) {
      throw new Error(data.data.err);
    }

    // CRITICAL FIX: Ensure results is always an array
    const results = Array.isArray(data.data?.results) ? data.data.results : [];

    return {
      results,
      err: data.data?.err ?? undefined,
      total: data.data?.total,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Canlı maçlar çok uzun sürdü. Lütfen tekrar deneyin.');
    }
    throw error;
  }
}

/**
 * Get match diary for a specific date
 * @param date Date in YYYY-MM-DD format
 * @param status Optional status filter (e.g., '8' for finished, '1' for not started)
 */
export async function getMatchDiary(date?: string, status?: string): Promise<MatchDiaryResponse> {
  const queryParams = new URLSearchParams();
  if (date) {
    // Backend expects YYYY-MM-DD format, it will convert to YYYYMMDD internally
    queryParams.append('date', date);
  }
  // CRITICAL FIX: Add status filter if provided
  if (status) {
    queryParams.append('status', status);
  }

  const fullUrl = `${API_BASE_URL}/matches/diary?${queryParams}`;

  const response = await retryFetch(fullUrl);

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error(`HTTP ${response.status}: Backend hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.`);
    }
    throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
  }

  const data: ApiResponse<MatchDiaryResponse> = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch match diary');
  }

  // CRITICAL FIX: Ensure we unwrap the data correctly
  // Backend returns: { success: true, data: { results: [...], err: null } }
  // We need to return: { results: [...], err: null }
  const responseData = data.data;

  // Check for TheSports API error
  if (responseData?.err) {
    throw new Error(responseData.err);
  }

  // CRITICAL FIX: Ensure results is always an array
  const results = Array.isArray(responseData?.results) ? responseData.results : [];

  // Return safe structure: always return { results: array, err?: string }
  return {
    results,
    err: responseData?.err ?? undefined,
    total: responseData?.total,
  };
}

/**
 * Phase 6: Unified Matches Endpoint
 *
 * Get unified matches (diary + live merged server-side)
 * Single API call replaces separate diary + live fetches
 *
 * Benefits:
 * - Server-side merging (consistent logic)
 * - Cross-day live matches handled automatically
 * - PHASE 3: Optional AI predictions enrichment via LEFT JOIN
 * - Smart cache with event-driven invalidation
 * - Reduced network requests
 *
 * @param date Date in YYYY-MM-DD format (default: today)
 * @param includeLive Include cross-day live matches (default: true)
 * @param includeAI Include AI predictions via LEFT JOIN (default: true) - PHASE 3
 * @param status Optional comma-separated status IDs filter
 */
export async function getUnifiedMatches(params?: {
  date?: string;
  includeLive?: boolean;
  includeAI?: boolean;
  status?: string;
}): Promise<MatchDiaryResponse & { counts?: { total: number; diary: number; crossDayLive: number; live: number; aiPredictions?: number } }> {
  const queryParams = new URLSearchParams();
  if (params?.date) queryParams.append('date', params.date);
  if (params?.includeLive !== undefined) queryParams.append('include_live', String(params.includeLive));
  // PHASE 3: Add includeAI parameter (default: true)
  if (params?.includeAI !== undefined) queryParams.append('include_ai', String(params.includeAI));
  if (params?.status) queryParams.append('status', params.status);

  const url = `${API_BASE_URL}/matches/unified?${queryParams}`;

  // Add timeout (60 seconds) to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await retryFetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`HTTP ${response.status}: Backend hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.`);
      }
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data: ApiResponse<{
      results: MatchDiary[];
      counts?: { total: number; diary: number; crossDayLive: number; live: number };
      cacheStats?: any;
    }> = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch unified matches');
    }

    // CRITICAL FIX: Ensure results is always an array
    const results = Array.isArray(data.data?.results) ? data.data.results : [];

    return {
      results,
      total: data.data?.counts?.total,
      counts: data.data?.counts,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Unified matches fetch took too long.');
    }
    throw error;
  }
}

/**
 * Get single match by ID
 * Fetches match directly from database by external_id (works for any date)
 */
export async function getMatchById(matchId: string): Promise<Match> {
  const url = `${API_BASE_URL}/matches/${matchId}`;

  try {
    const response = await retryFetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Match not found');
      }
      const errorText = await response.text();
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`HTTP ${response.status}: Backend hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.`);
      }
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data: ApiResponse<Match> = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch match');
    }

    return data.data;
  } catch (error: any) {
    throw error;
  }
}

// ===== MATCH DETAIL API FUNCTIONS =====

/**
 * Get match analysis (H2H - Head to Head) - Legacy endpoint
 */
export async function getMatchAnalysis(matchId: string): Promise<any> {
  const url = `${API_BASE_URL}/matches/${matchId}/analysis`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get match H2H data (from database with API fallback)
 * Returns structured H2H data including summary, previous matches, and recent form
 */
export async function getMatchH2H(matchId: string): Promise<any> {
  const url = `${API_BASE_URL}/matches/${matchId}/h2h`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get match trend (minute-by-minute data)
 */
export async function getMatchTrend(matchId: string): Promise<any> {
  const url = `${API_BASE_URL}/matches/${matchId}/trend`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get match half-time stats
 */
export async function getMatchHalfStats(matchId: string): Promise<any> {
  const url = `${API_BASE_URL}/matches/${matchId}/half-stats`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get match lineup
 */
export async function getMatchLineup(matchId: string): Promise<any> {
  const url = `${API_BASE_URL}/matches/${matchId}/lineup`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get match live stats (combined stats from detail_live + team_stats)
 * GET /api/matches/:match_id/live-stats
 * Returns comprehensive match statistics (basic + detailed)
 */
export async function getMatchLiveStats(matchId: string): Promise<any> {
  const url = `${API_BASE_URL}/matches/${matchId}/live-stats`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get match team stats (from live stats feed for real-time data)
 */
export async function getMatchTeamStats(matchId: string): Promise<any> {
  // Try live stats first (for currently live matches)
  const liveUrl = `${API_BASE_URL}/matches/${matchId}/live-stats`;
  const teamStatsUrl = `${API_BASE_URL}/matches/${matchId}/team-stats`;

  try {
    // First try live stats (more comprehensive for live matches)
    const liveResponse = await fetch(liveUrl);
    if (liveResponse.ok) {
      const liveData: ApiResponse<any> = await liveResponse.json();
      if (liveData.data?.stats?.length > 0) {
        return liveData.data;
      }
    }

    // Fallback to team-stats endpoint
    const response = await fetch(teamStatsUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get match player stats (for ratings and detailed stats)
 * GET /api/matches/:match_id/player-stats
 */
export async function getMatchPlayerStats(matchId: string): Promise<any> {
  const url = `${API_BASE_URL}/matches/${matchId}/player-stats`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}


/**
 * Get match detail live (score, events, stats)
 * API returns all live matches, so we filter for the specific matchId
 */
export async function getMatchDetailLive(matchId: string): Promise<any> {
  const url = `${API_BASE_URL}/matches/${matchId}/detail-live`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();

    // API returns array of all live matches, find the specific match
    const results = data.data?.results || [];
    const matchData = results.find((m: any) => m.id === matchId);

    if (matchData) {
      const result = {
        incidents: matchData.incidents || [],
        stats: matchData.stats || [],
        score: matchData.score || null,
        tlive: matchData.tlive || []
      };
      console.log(`[getMatchDetailLive] ✓ Found ${result.incidents.length} incidents for ${matchId}`);
      return result;
    }

    // Match not found in live results (may have ended or not started)
    console.warn(`[getMatchDetailLive] ❌ Match ${matchId} not found in ${results.length} results`);
    return { incidents: [], stats: [], score: null, tlive: [] };
  } catch (error) {
    console.error('[getMatchDetailLive] Error:', error);
    throw error;
  }
}

/**
 * Get season standings
 */
export async function getSeasonStandings(seasonId: string): Promise<any> {
  const url = `${API_BASE_URL}/seasons/${seasonId}/standings`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

// ===== TEAM API FUNCTIONS =====

/**
 * Get team by ID
 * Returns team info, competition, and recent form
 */
export async function getTeamById(teamId: string): Promise<any> {
  const url = `${API_BASE_URL}/teams/${teamId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Team not found');
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get team fixtures (past and upcoming matches)
 */
export async function getTeamFixtures(teamId: string, seasonId?: string): Promise<any> {
  let url = `${API_BASE_URL}/teams/${teamId}/fixtures`;
  if (seasonId) {
    url += `?season_id=${seasonId}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get team standings position
 */
export async function getTeamStandings(teamId: string, seasonId?: string): Promise<any> {
  let url = `${API_BASE_URL}/teams/${teamId}/standings`;
  if (seasonId) {
    url += `?season_id=${seasonId}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}


/**
 * Search teams by name
 */
export async function searchTeams(query: string): Promise<any> {
  const url = `${API_BASE_URL}/teams/search?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data; // Backend returns array directly in data property?
    // Checking controller: reply.send({ success: true, data: result.rows... })
    // Yes, data.data will be the array of teams
  } catch (error) {
    throw error;
  }
}

/**
 * Get players by team ID (Squad)
 */
export async function getPlayersByTeam(teamId: string): Promise<any> {
  const url = `${API_BASE_URL}/teams/${teamId}/players`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data.data; // Backend returns { players: [...] } or just array?
    // Controller player.controller.ts: return reply.send({ players: result.rows });
    // So data.data will be { players: [...] }
  } catch (error) {
    throw error;
  }
}

/**
 * Get player details by ID
 */
export async function getPlayerById(playerId: string): Promise<any> {
  const url = `${API_BASE_URL}/players/${playerId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data; // Backend returns { player: ..., matches: ... } directly or wrapped?
    // Controller: reply.send({ player, matches })
    // Standard wrapper not used in player controller yet?
    // Wait, let me double check player.controller.ts return.
    // It says: return reply.send({ player, matches });
    // It does NOT wrap in success/data standard envelope in that specific controller method.
    // But fastify might not auto-wrap.
    // Let's assume raw return for now based on code I saw.
  } catch (error) {
    throw error;
  }
}
// ===== LEAGUE/COMPETITION API FUNCTIONS =====

/**
 * Get league by ID
 */
export async function getLeagueById(leagueId: string): Promise<any> {
  const url = `${API_BASE_URL}/leagues/${leagueId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('League not found');
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data; // Backend returns { league: ..., currentSeason: ... }
  } catch (error) {
    throw error;
  }
}

/**
 * Get league fixtures
 */
export async function getLeagueFixtures(leagueId: string, params?: { limit?: number; status?: 'upcoming' | 'finished' | 'live' }): Promise<any> {
  let url = `${API_BASE_URL}/leagues/${leagueId}/fixtures`;
  const queryParams = new URLSearchParams();

  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);

  const queryString = queryParams.toString();
  if (queryString) url += `?${queryString}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data; // returns { fixtures: [...] }
  } catch (error) {
    throw error;
  }
}

/**
 * Get league standings
 */
export async function getLeagueStandings(leagueId: string): Promise<any> {
  const url = `${API_BASE_URL}/leagues/${leagueId}/standings`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data; // returns { standings: [...], season_id: ... }
  } catch (error) {
    throw error;
  }
}

/**
 * Get league teams
 */
export async function getLeagueTeams(leagueId: string): Promise<any> {
  const url = `${API_BASE_URL}/leagues/${leagueId}/teams`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data; // returns { teams: [...] }
  } catch (error) {
    throw error;
  }
}

/**
 * Get matched AI predictions
 * Returns predictions joined with match data
 */
export async function getMatchedPredictions(limit = 100): Promise<any> {
  const url = `${API_BASE_URL}/predictions/matched?limit=${limit}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ApiResponse<any> = await response.json();
    return data; // returns { predictions: [...] }
  } catch (error) {
    throw error;
  }
}
