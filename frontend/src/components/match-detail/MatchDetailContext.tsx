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
} from '../../api/matches';
import type { Match } from '../../api/matches';

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

  // All tab data (eager loaded)
  tabData: AllTabData;
  tabDataLoading: boolean;

  // WebSocket connection status
  isSocketConnected: boolean;

  // Manual refresh functions
  refreshMatch: () => Promise<void>;
  refreshTabData: (tabKey?: keyof AllTabData) => Promise<void>;
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
  const [tabDataLoading, setTabDataLoading] = useState(true);

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
  // FETCH ALL TAB DATA (EAGER LOADING)
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

  const fetchAllTabData = useCallback(async () => {
    if (!matchId) return;

    setTabDataLoading(true);

    try {
      // ALL fetches in PARALLEL - no sequential blocking!
      const [statsResult, h2hResult, standingsResult, aiResult] = await Promise.allSettled([
        // Stats
        (async () => {
          const [liveStats, halfStats] = await Promise.allSettled([
            fetchWithTimeout(getMatchLiveStats(matchId), 2000),
            fetchWithTimeout(getMatchHalfStats(matchId), 2000),
          ]);
          const liveData = liveStats.status === 'fulfilled' ? liveStats.value : null;
          const halfData = halfStats.status === 'fulfilled' ? halfStats.value : null;
          return {
            fullTime: liveData?.fullTime ?? liveData ?? null,
            halfTime: halfData ?? null,
            firstHalfStats: liveData?.firstHalfStats ?? null,
          } as StatsData;
        })(),

        // H2H
        (async () => {
          const h2h = await fetchWithTimeout(getMatchH2H(matchId), 2000);
          return {
            summary: h2h?.summary ?? null,
            h2hMatches: h2h?.h2hMatches ?? [],
            homeRecentForm: h2h?.homeRecentForm ?? [],
            awayRecentForm: h2h?.awayRecentForm ?? [],
          } as H2HData;
        })(),

        // Standings
        (async () => {
          if (!match?.season_id) return { results: [] } as StandingsData;
          const standings = await fetchWithTimeout(getSeasonStandings(match.season_id), 2000);
          return { results: standings?.data?.results ?? [] } as StandingsData;
        })(),

        // AI predictions
        (async () => {
          const response = await fetchWithTimeout(fetch(`/api/predictions/match/${matchId}`), 2000);
          if (response?.ok) {
            const data = await response.json();
            return { predictions: data.predictions ?? [] } as AIData;
          }
          return { predictions: [] } as AIData;
        })(),
      ]);

      // Update state - all data fetched in parallel
      setTabData({
        stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
        events: null,
        h2h: h2hResult.status === 'fulfilled' ? h2hResult.value : null,
        standings: standingsResult.status === 'fulfilled' ? standingsResult.value : null,
        lineup: null,
        trend: null,
        ai: aiResult.status === 'fulfilled' ? aiResult.value : null,
      });
    } catch (err) {
      console.error('[MatchDetailContext] Error fetching tab data:', err);
    } finally {
      setTabDataLoading(false);
    }
  }, [matchId, match?.season_id]);

  // ============================================================================
  // REFRESH FUNCTIONS
  // ============================================================================

  const refreshMatch = useCallback(async () => {
    await fetchMatch();
  }, [fetchMatch]);

  const refreshTabData = useCallback(async (_tabKey?: keyof AllTabData) => {
    // For now, refresh all tab data
    // In future, could be optimized to refresh only specific tab
    await fetchAllTabData();
  }, [fetchAllTabData]);

  // Debounced refresh for WebSocket events
  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchAllTabData();
    }, 500);
  }, [fetchAllTabData]);

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
            console.log(`🎉 AITab INSTANT WIN: ${p.prediction_value} (${totalGoals} > ${threshold})`);
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

      // Refresh tab data (debounced)
      debouncedRefresh();
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
              console.log(`❌ AITab INSTANT LOSE (HT): ${p.prediction_value}`);
              return { ...p, result: 'lost', prediction_result: 'loser' };
            }

            // Status 8 (Maç sonu): MS tahminleri lose
            if (event.statusId === 8 && !isFirstHalf) {
              console.log(`❌ AITab INSTANT LOSE (FT): ${p.prediction_value}`);
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

      // Refresh all tab data on status change
      debouncedRefresh();
    },
    onAnyEvent: () => {
      // Refresh tab data for any event
      debouncedRefresh();
    },
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch match on mount
  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  // Fetch tab data when match is loaded
  useEffect(() => {
    if (match) {
      fetchAllTabData();
    }
  }, [match?.id, match?.season_id]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: MatchDetailContextValue = {
    match,
    matchId,
    loading,
    error,
    tabData,
    tabDataLoading,
    isSocketConnected,
    refreshMatch,
    refreshTabData,
  };

  return (
    <MatchDetailContext.Provider value={value}>
      {children}
    </MatchDetailContext.Provider>
  );
}

export default MatchDetailContext;
