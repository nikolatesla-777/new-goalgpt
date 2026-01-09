/**
 * Match Detail Context
 *
 * Provides shared state for match detail page including:
 * - Match info
 * - Tab data (eager loaded)
 * - WebSocket connection
 * - Refresh functions
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useMatchSocket } from '../../hooks/useSocket';
import {
  getMatchH2H,
  getMatchLiveStats,
  getSeasonStandings,
  getLiveMatches,
  getMatchHalfStats,
  getMatchById,
  getMatchTrend,
} from '../../api/matches';
import type { Match } from '../../api/matches';

// ============================================================================
// CONSTANTS
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TabType = 'ai' | 'stats' | 'h2h' | 'standings' | 'lineup' | 'trend' | 'events';

// Stats tab data
export interface StatsData {
  fullTime: {
    stats: any[];
    incidents: any[];
  } | null;
  halfTime: any | null;
  firstHalfStats: any[] | null;
}

// H2H tab data
export interface H2HData {
  summary: {
    total: number;
    homeWins: number;
    draws: number;
    awayWins: number;
  } | null;
  h2hMatches: any[];
  homeRecentForm: any[];
  awayRecentForm: any[];
}

// Standings tab data
export interface StandingsData {
  results: any[];
}

// Lineup tab data
export interface LineupData {
  home_formation: string | null;
  away_formation: string | null;
  home_lineup: any[];
  away_lineup: any[];
  home_subs: any[];
  away_subs: any[];
}

// Trend tab data
export interface TrendData {
  trend: {
    first_half: any[];
    second_half: any[];
    overtime?: any[];
  } | null;
  incidents: any[];
}

// Events tab data
export interface EventsData {
  incidents: any[];
}

// AI tab data
export interface AIData {
  predictions: any[];
}

// All tab data combined
export interface AllTabData {
  stats: StatsData | null;
  events: EventsData | null;
  h2h: H2HData | null;
  standings: StandingsData | null;
  lineup: LineupData | null;
  trend: TrendData | null;
  ai: AIData | null;
}

// Context value type
export interface MatchDetailContextValue {
  // Match info
  match: Match | null;
  matchId: string;
  loading: boolean;
  error: string | null;

  // All tab data (lazy loaded)
  tabData: AllTabData;

  // Per-tab loading states (replaces global tabDataLoading)
  tabLoadingStates: Record<TabType, boolean>;

  // WebSocket connection status
  isSocketConnected: boolean;

  // Manual refresh functions
  refreshMatch: () => Promise<void>;

  // Lazy loading function - fetches specific tab data on demand
  fetchTabData: (tab: TabType) => Promise<void>;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const MatchDetailContext = createContext<MatchDetailContextValue | null>(null);

/**
 * Hook for consuming match detail context
 * Must be used within MatchDetailProvider
 */
export function useMatchDetail(): MatchDetailContextValue {
  const context = useContext(MatchDetailContext);
  if (!context) {
    throw new Error('useMatchDetail must be used within MatchDetailProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface MatchDetailProviderProps {
  matchId: string;
  children: ReactNode;
}

export function MatchDetailProvider({ matchId, children }: MatchDetailProviderProps) {
  // Match state
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab data state
  const [tabData, setTabData] = useState<AllTabData>({
    stats: null,
    events: null,
    h2h: null,
    standings: null,
    lineup: null,
    trend: null,
    ai: null,
  });

  // Per-tab loading states (replaces global tabDataLoading)
  const [tabLoadingStates, setTabLoadingStates] = useState<Record<TabType, boolean>>({
    stats: false,
    events: false,
    h2h: false,
    standings: false,
    lineup: false,
    trend: false,
    ai: false,
  });

  // Cache metadata (5-minute TTL)
  const [tabCacheMetadata, setTabCacheMetadata] = useState<Record<TabType, {
    loadedAt: number | null;
    expiresAt: number | null;
  }>>({
    stats: { loadedAt: null, expiresAt: null },
    events: { loadedAt: null, expiresAt: null },
    h2h: { loadedAt: null, expiresAt: null },
    standings: { loadedAt: null, expiresAt: null },
    lineup: { loadedAt: null, expiresAt: null },
    trend: { loadedAt: null, expiresAt: null },
    ai: { loadedAt: null, expiresAt: null },
  });

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Active tab tracking (for WebSocket optimization)
  const [activeTab, setActiveTab] = useState<TabType | null>(null);

  // Cache helper functions
  const isCacheValid = useCallback((tab: TabType): boolean => {
    const metadata = tabCacheMetadata[tab];
    if (!metadata.expiresAt) return false;
    return Date.now() < metadata.expiresAt;
  }, [tabCacheMetadata]);

  const updateCacheTimestamp = useCallback((tab: TabType) => {
    const now = Date.now();
    setTabCacheMetadata(prev => ({
      ...prev,
      [tab]: { loadedAt: now, expiresAt: now + CACHE_TTL_MS }
    }));
  }, [CACHE_TTL_MS]);

  const invalidateCache = useCallback((tab: TabType) => {
    setTabCacheMetadata(prev => ({
      ...prev,
      [tab]: { loadedAt: null, expiresAt: null }
    }));
  }, []);

  // WebSocket state
  const [isSocketConnected, _setIsSocketConnected] = useState(false);

  // Refs for preventing unnecessary fetches
  const hasLoadedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================================
  // FETCH MATCH INFO
  // ============================================================================

  const fetchMatch = useCallback(async () => {
    if (!matchId) return;

    if (!hasLoadedRef.current) setLoading(true);

    try {
      let foundMatch: Match | undefined;

      // Step 1: Get match by ID first (FAST - ~0.3s)
      try {
        foundMatch = await getMatchById(matchId);
      } catch {
        // Match not found by ID
      }

      // Step 2: If match is LIVE, get fresh data from live endpoint
      if (foundMatch) {
        const isLiveStatus = [2, 3, 4, 5, 7].includes((foundMatch as any).status_id ?? 0);
        if (isLiveStatus) {
          try {
            const liveResponse = await getLiveMatches();
            const liveMatch = liveResponse.results?.find((m: Match) => m.id === matchId);
            if (liveMatch) {
              foundMatch = liveMatch;
            }
          } catch {
            // Keep foundMatch from getMatchById
          }
        }

        setMatch(foundMatch);
        setError(null);
      } else if (!match) {
        setError('Maç bulunamadı');
      }
    } catch (err: any) {
      if (!match) {
        setError(err.message || 'Maç yüklenirken hata oluştu');
      }
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [matchId, match]);

  // ============================================================================
  // LAZY LOADING: INDIVIDUAL TAB FETCH FUNCTIONS
  // ============================================================================

  // Helper: Fetch with timeout (3 seconds max for fast UX)
  const fetchWithTimeout = async <T,>(promise: Promise<T>, timeoutMs: number = 3000): Promise<T | null> => {
    try {
      const result = await Promise.race([
        promise,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
      ]);
      return result;
    } catch {
      return null;
    }
  };

  /**
   * Fetch Stats tab data
   * API: GET /api/matches/:id/live-stats + /api/matches/:id/half-stats
   * Time: ~500ms
   * @param silent - If true, don't show loading spinner (for background refresh)
   */
  const fetchStatsData = useCallback(async (silent = false) => {
    // Check cache
    if (tabData.stats !== null && isCacheValid('stats')) {
      // console.log(`[MatchDetail] ✓ Using cached stats`);
      return;
    }

    // Only show loading if not silent (user-initiated)
    if (!silent) {
      setTabLoadingStates(prev => ({ ...prev, stats: true }));
    }
    // console.log(`[MatchDetail] → Fetching stats for ${matchId}`);

    try {
      const [liveStats, halfStats] = await Promise.allSettled([
        fetchWithTimeout(getMatchLiveStats(matchId), 3000),
        fetchWithTimeout(getMatchHalfStats(matchId), 3000),
      ]);

      const liveData = liveStats.status === 'fulfilled' ? liveStats.value : null;
      const halfData = halfStats.status === 'fulfilled' ? halfStats.value : null;

      const statsData: StatsData = {
        fullTime: liveData?.fullTime ?? liveData ?? null,
        halfTime: halfData ?? null,
        firstHalfStats: liveData?.firstHalfStats ?? null,
      };

      setTabData(prev => ({ ...prev, stats: statsData }));
      updateCacheTimestamp('stats');
      // console.log(`[MatchDetail] ✓ Stats loaded`);
    } catch (error) {
      console.error('[MatchDetail] Failed to fetch stats:', error);
      setTabData(prev => ({ ...prev, stats: { fullTime: null, halfTime: null, firstHalfStats: null } }));
    } finally {
      setTabLoadingStates(prev => ({ ...prev, stats: false }));
    }
  }, [matchId, tabData.stats, isCacheValid, updateCacheTimestamp]);

  /**
   * Fetch Events tab data
   * API: GET /api/matches/:id/incidents (NEW - optimized endpoint)
   * Time: ~300ms (was 10,000ms with old endpoint)
   */
  const fetchEventsData = useCallback(async () => {
    if (tabData.events !== null && isCacheValid('events')) {
      // console.log(`[MatchDetail] ✓ Using cached events`);
      return;
    }

    setTabLoadingStates(prev => ({ ...prev, events: true }));
    // console.log(`[MatchDetail] → Fetching events for ${matchId}`);

    try {
      // NEW: Use optimized incidents endpoint
      const response = await fetch(`${API_BASE_URL}/matches/${matchId}/incidents`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      let incidents = data.data?.incidents || [];

      // CRITICAL FIX: Backend might return nested match objects instead of incidents array
      // Workaround for backend bug: Check if incidents array contains nested 'incidents'
      if (Array.isArray(incidents) && incidents.length > 0) {
        // If first element has 'incidents' property, it's likely a nested match object
        if (incidents[0] && typeof incidents[0] === 'object' && 'incidents' in incidents[0]) {
          // Find the object matching current matchId, or use the first one
          const matchObj = incidents.find((m: Record<string, unknown>) =>
            String(m.id) === String(matchId) || String(m.match_id) === String(matchId)
          ) || incidents[0];

          // Extract the actual incidents array
          if (Array.isArray(matchObj.incidents)) {
            // console.log(`[MatchDetail] Fixed nested incidents structure`);
            incidents = matchObj.incidents;
          }
        }
      }

      const eventsData: EventsData = {
        incidents: incidents,
      };

      setTabData(prev => ({ ...prev, events: eventsData }));
      updateCacheTimestamp('events');
      console.log(`[MatchDetail] ✓ Events loaded (${eventsData.incidents.length} incidents)`);
    } catch (error) {
      console.error('[MatchDetail] Failed to fetch events:', error);
      setTabData(prev => ({ ...prev, events: { incidents: [] } }));
    } finally {
      setTabLoadingStates(prev => ({ ...prev, events: false }));
    }
  }, [matchId, tabData.events, isCacheValid, updateCacheTimestamp]);

  /**
   * Fetch H2H tab data
   * API: GET /api/matches/:id/h2h
   * Time: ~400ms
   */
  const fetchH2HData = useCallback(async () => {
    if (tabData.h2h !== null && isCacheValid('h2h')) {
      // console.log(`[MatchDetail] ✓ Using cached H2H`);
      return;
    }

    setTabLoadingStates(prev => ({ ...prev, h2h: true }));
    // console.log(`[MatchDetail] → Fetching H2H for ${matchId}`);

    try {
      const h2h = await fetchWithTimeout(getMatchH2H(matchId), 3000);

      const h2hData: H2HData = {
        summary: h2h?.summary ?? null,
        h2hMatches: h2h?.h2hMatches ?? [],
        homeRecentForm: h2h?.homeRecentForm ?? [],
        awayRecentForm: h2h?.awayRecentForm ?? [],
      };

      setTabData(prev => ({ ...prev, h2h: h2hData }));
      updateCacheTimestamp('h2h');
      // console.log(`[MatchDetail] ✓ H2H loaded`);
    } catch (error) {
      console.error('[MatchDetail] Failed to fetch H2H:', error);
      setTabData(prev => ({
        ...prev,
        h2h: { summary: null, h2hMatches: [], homeRecentForm: [], awayRecentForm: [] }
      }));
    } finally {
      setTabLoadingStates(prev => ({ ...prev, h2h: false }));
    }
  }, [matchId, tabData.h2h, isCacheValid, updateCacheTimestamp]);

  /**
   * Fetch Standings tab data
   * API: GET /api/seasons/:id/standings
   * Time: ~300ms
   */
  const fetchStandingsData = useCallback(async () => {
    if (!match?.season_id) {
      // console.warn('[MatchDetail] Cannot fetch standings - no season_id');
      return;
    }

    if (tabData.standings !== null && isCacheValid('standings')) {
      // console.log(`[MatchDetail] ✓ Using cached standings`);
      return;
    }

    setTabLoadingStates(prev => ({ ...prev, standings: true }));
    // console.log(`[MatchDetail] → Fetching standings for season ${match.season_id}`);

    try {
      const standings = await fetchWithTimeout(getSeasonStandings(match.season_id), 3000);

      const standingsData: StandingsData = {
        results: standings?.data?.results ?? [],
      };

      setTabData(prev => ({ ...prev, standings: standingsData }));
      updateCacheTimestamp('standings');
      // console.log(`[MatchDetail] ✓ Standings loaded (${standingsData.results.length} teams)`);
    } catch (error) {
      console.error('[MatchDetail] Failed to fetch standings:', error);
      setTabData(prev => ({ ...prev, standings: { results: [] } }));
    } finally {
      setTabLoadingStates(prev => ({ ...prev, standings: false }));
    }
  }, [match?.season_id, tabData.standings, isCacheValid, updateCacheTimestamp]);

  /**
   * Fetch Lineup tab data
   * API: GET /api/matches/:id/lineup
   * Time: ~400ms
   */
  const fetchLineupData = useCallback(async () => {
    if (tabData.lineup !== null && isCacheValid('lineup')) {
      // console.log(`[MatchDetail] ✓ Using cached lineup`);
      return;
    }

    setTabLoadingStates(prev => ({ ...prev, lineup: true }));
    // console.log(`[MatchDetail] → Fetching lineup for ${matchId}`);

    try {
      const response = await fetch(`${API_BASE_URL}/matches/${matchId}/lineup`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const lineup = await response.json();
      const lineupData: LineupData = {
        home_formation: lineup?.data?.home_formation ?? null,
        away_formation: lineup?.data?.away_formation ?? null,
        home_lineup: lineup?.data?.home_lineup ?? [],
        away_lineup: lineup?.data?.away_lineup ?? [],
        home_subs: lineup?.data?.home_subs ?? [],
        away_subs: lineup?.data?.away_subs ?? [],
      };

      setTabData(prev => ({ ...prev, lineup: lineupData }));
      updateCacheTimestamp('lineup');
      // console.log(`[MatchDetail] ✓ Lineup loaded`);
    } catch (error) {
      console.error('[MatchDetail] Failed to fetch lineup:', error);
      setTabData(prev => ({
        ...prev,
        lineup: {
          home_formation: null,
          away_formation: null,
          home_lineup: [],
          away_lineup: [],
          home_subs: [],
          away_subs: [],
        }
      }));
    } finally {
      setTabLoadingStates(prev => ({ ...prev, lineup: false }));
    }
  }, [matchId, tabData.lineup, isCacheValid, updateCacheTimestamp]);

  /**
   * Fetch Trend tab data
   * API: GET /api/matches/:id/trend
   * Time: ~500ms
   */
  const fetchTrendData = useCallback(async () => {
    if (tabData.trend !== null && isCacheValid('trend')) {
      // console.log(`[MatchDetail] ✓ Using cached trend`);
      return;
    }

    setTabLoadingStates(prev => ({ ...prev, trend: true }));
    // console.log(`[MatchDetail] → Fetching trend for ${matchId}`);

    try {
      const trendResponse = await fetchWithTimeout(getMatchTrend(matchId), 3000);

      const trendData: TrendData = {
        trend: trendResponse?.trend ?? null,
        incidents: trendResponse?.incidents ?? [],
      };

      setTabData(prev => ({ ...prev, trend: trendData }));
      updateCacheTimestamp('trend');
      // console.log(`[MatchDetail] ✓ Trend loaded`);
    } catch (error) {
      console.error('[MatchDetail] Failed to fetch trend:', error);
      setTabData(prev => ({ ...prev, trend: { trend: null, incidents: [] } }));
    } finally {
      setTabLoadingStates(prev => ({ ...prev, trend: false }));
    }
  }, [matchId, tabData.trend, isCacheValid, updateCacheTimestamp]);

  /**
   * Fetch AI tab data
   * API: GET /api/predictions/match/:id
   * Time: ~200ms
   */
  const fetchAIData = useCallback(async () => {
    if (tabData.ai !== null && isCacheValid('ai')) {
      // console.log(`[MatchDetail] ✓ Using cached AI predictions`);
      return;
    }

    setTabLoadingStates(prev => ({ ...prev, ai: true }));
    // console.log(`[MatchDetail] → Fetching AI predictions for ${matchId}`);

    try {
      const response = await fetchWithTimeout(
        fetch(`${API_BASE_URL}/predictions/match/${matchId}`),
        3000
      );

      if (response?.ok) {
        const data = await response.json();
        const aiData: AIData = {
          predictions: data.predictions ?? [],
        };

        setTabData(prev => ({ ...prev, ai: aiData }));
        updateCacheTimestamp('ai');
        // console.log(`[MatchDetail] ✓ AI predictions loaded (${aiData.predictions.length} predictions)`);
      } else {
        setTabData(prev => ({ ...prev, ai: { predictions: [] } }));
      }
    } catch (error) {
      console.error('[MatchDetail] Failed to fetch AI predictions:', error);
      setTabData(prev => ({ ...prev, ai: { predictions: [] } }));
    } finally {
      setTabLoadingStates(prev => ({ ...prev, ai: false }));
    }
  }, [matchId, tabData.ai, isCacheValid, updateCacheTimestamp]);

  // ============================================================================
  // UNIFIED TAB FETCH DISPATCHER
  // ============================================================================

  /**
   * Unified tab fetch function
   * Dispatches to appropriate fetch function based on tab type
   * Also tracks active tab for WebSocket optimization
   */
  const fetchTabData = useCallback(async (tab: TabType) => {
    setActiveTab(tab); // Track active tab for WebSocket optimization

    switch (tab) {
      case 'stats':
        return fetchStatsData();
      case 'events':
        return fetchEventsData();
      case 'h2h':
        return fetchH2HData();
      case 'standings':
        return fetchStandingsData();
      case 'lineup':
        return fetchLineupData();
      case 'trend':
        return fetchTrendData();
      case 'ai':
        return fetchAIData();
      default:
        // console.warn(`[MatchDetail] Unknown tab: ${tab}`);
        return Promise.resolve();
    }
  }, [
    fetchStatsData,
    fetchEventsData,
    fetchH2HData,
    fetchStandingsData,
    fetchLineupData,
    fetchTrendData,
    fetchAIData,
  ]);

  // ============================================================================
  // REFRESH FUNCTIONS
  // ============================================================================

  const refreshMatch = useCallback(async () => {
    await fetchMatch();
  }, [fetchMatch]);

  // Debounced refresh for ACTIVE TAB ONLY (WebSocket optimization)
  // CRITICAL: Silent refresh - no loading spinner to prevent page flicker
  const debouncedRefreshActiveTab = useCallback(() => {
    if (!activeTab) {
      // console.log('[MatchDetail] No active tab, skipping refresh');
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      // console.log(`[MatchDetail] WebSocket refresh for active tab: ${activeTab}`);

      // Invalidate cache for active tab
      invalidateCache(activeTab);

      // CRITICAL FIX: Silent refresh (don't show loading spinner)
      // This prevents the white screen flicker that users see
      // We update data in background without disturbing the UI
      try {
        switch (activeTab) {
          case 'stats':
            await fetchStatsData(true); // silent=true
            break;
          case 'events':
            // Events tab - just invalidate cache, will refetch on next render
            break;
          case 'trend':
            // Trend tab - invalidate only
            break;
          // Other tabs don't need real-time refresh
        }
      } catch (err) {
        // Silent failure - don't disturb user
      }
    }, 500);
  }, [activeTab, invalidateCache, fetchStatsData]);

  // ============================================================================
  // WEBSOCKET INTEGRATION
  // ============================================================================

  useMatchSocket(matchId, {
    onScoreChange: (event) => {
      const totalGoals = (event.homeScore ?? 0) + (event.awayScore ?? 0);

      // Update match scores optimistically
      setMatch(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          home_score: event.homeScore ?? prev.home_score,
          away_score: event.awayScore ?? prev.away_score,
        };
      });

      // INSTANT WIN: AI tahminlerini ANLIK güncelle
      setTabData(prev => {
        if (!prev.ai?.predictions) return prev;

        const updatedPredictions = prev.ai.predictions.map((p: any) => {
          // Sadece pending tahminleri kontrol et
          if (p.result !== 'pending' && p.prediction_result !== 'pending' && p.prediction_result !== null) {
            return p;
          }

          // Tahmin anındaki skordan threshold hesapla
          const scoreAtPred = p.score_at_prediction || '0-0';
          const [predHome, predAway] = scoreAtPred.split('-').map((s: string) => parseInt(s.trim()) || 0);
          const threshold = predHome + predAway + 0.5;

          // totalGoals > threshold → INSTANT WIN!
          if (totalGoals > threshold) {
            // console.log(`🎉 AITab INSTANT WIN: ${p.prediction_value} (${totalGoals} > ${threshold})`);
            return {
              ...p,
              result: 'won',
              prediction_result: 'winner'
            };
          }
          return p;
        });

        return {
          ...prev,
          ai: { ...prev.ai, predictions: updatedPredictions }
        };
      });

      // NEW: Only refresh active tab if it's affected by score changes
      if (['stats', 'events', 'trend', 'ai'].includes(activeTab || '')) {
        debouncedRefreshActiveTab();
      }
    },
    onMatchStateChange: (event) => {
      // Update match status
      setMatch(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          status: event.statusId,
          status_id: event.statusId,
        } as any;
      });

      // INSTANT LOSE: Devre arası veya maç sonu - AI tahminlerini güncelle
      if (event.statusId === 3 || event.statusId === 8) {
        setTabData(prev => {
          if (!prev.ai?.predictions) return prev;

          const updatedPredictions = prev.ai.predictions.map((p: any) => {
            // Sadece pending tahminleri kontrol et
            if (p.result !== 'pending' && p.prediction_result !== 'pending' && p.prediction_result !== null) {
              return p;
            }

            const minute = p.minute_at_prediction || 0;
            const isFirstHalf = minute < 45;

            // Status 3 (Devre arası): IY tahminleri lose
            if (event.statusId === 3 && isFirstHalf) {
              // console.log(`❌ AITab INSTANT LOSE (HT): ${p.prediction_value}`);
              return { ...p, result: 'lost', prediction_result: 'loser' };
            }

            // Status 8 (Maç sonu): MS tahminleri lose
            if (event.statusId === 8 && !isFirstHalf) {
              // console.log(`❌ AITab INSTANT LOSE (FT): ${p.prediction_value}`);
              return { ...p, result: 'lost', prediction_result: 'loser' };
            }

            return p;
          });

          return {
            ...prev,
            ai: { ...prev.ai, predictions: updatedPredictions }
          };
        });
      }

      // NEW: Only refresh active tab on status change
      if (activeTab) {
        debouncedRefreshActiveTab();
      }
    },
    onAnyEvent: () => {
      // NEW: Only refresh active tab if it's affected by generic events
      if (['events', 'stats', 'trend'].includes(activeTab || '')) {
        debouncedRefreshActiveTab();
      }
    },
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch match on mount
  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  // NOTE: Old eager loading removed - tabs now load lazily when clicked

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: MatchDetailContextValue = {
    match,
    matchId,
    loading,
    error,
    tabData,
    tabLoadingStates,
    isSocketConnected,
    refreshMatch,
    fetchTabData,
  };

  return (
    <MatchDetailContext.Provider value={value}>
      {children}
    </MatchDetailContext.Provider>
  );
}

export default MatchDetailContext;
