/**
 * Livescore Context
 *
 * Provides shared state for livescore page including:
 * - Selected date
 * - Sort preference (league/time)
 * - Match counts for each tab
 * - All matches data (single fetch, client-side filtering)
 * - WebSocket connection state
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { getUnifiedMatches, getMatchedPredictions } from '../../api/matches';
import type { Match } from '../../api/matches';
import { getTodayInTurkey } from '../../utils/dateUtils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SortType = 'league' | 'time';

export interface MatchCounts {
  diary: number;
  live: number;
  finished: number;
  notStarted: number;
  ai: number;
}

export interface LivescoreContextValue {
  // Filters
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  sortBy: SortType;
  setSortBy: (sort: SortType) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Counts (for badge display on tabs)
  counts: MatchCounts;

  // Match data
  allMatches: Match[];
  liveMatches: Match[];
  finishedMatches: Match[];
  notStartedMatches: Match[];
  aiMatches: Match[];

  // Loading state
  loading: boolean;
  error: string | null;

  // WebSocket state
  isSocketConnected: boolean;
  lastUpdate: Date | null;

  // Actions
  refresh: () => Promise<void>;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const LivescoreContext = createContext<LivescoreContextValue | null>(null);

/**
 * Hook for consuming livescore context
 * Must be used within LivescoreProvider
 */
export function useLivescore(): LivescoreContextValue {
  const context = useContext(LivescoreContext);
  if (!context) {
    throw new Error('useLivescore must be used within LivescoreProvider');
  }
  return context;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a match is currently live
 */
function isLiveMatch(statusId: number | undefined): boolean {
  if (!statusId) return false;
  // Status IDs: 2=First Half, 3=Half Time, 4=Second Half, 5=Extra Time, 7=Penalty
  return [2, 3, 4, 5, 7].includes(statusId);
}

/**
 * Check if a match is finished
 */
function isFinishedMatch(statusId: number | undefined): boolean {
  if (!statusId) return false;
  // Status IDs: 8=Finished, 9=Abandoned, 10=Interrupted, 11=Cancelled, 12=Postponed
  return [8, 9, 10, 11, 12].includes(statusId);
}

/**
 * Check if a match has not started
 */
function isNotStartedMatch(statusId: number | undefined): boolean {
  if (!statusId) return true;
  // Status ID: 1=Not Started
  return statusId === 1;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface LivescoreProviderProps {
  children: ReactNode;
}

export function LivescoreProvider({ children }: LivescoreProviderProps) {
  // Filter state
  const [selectedDate, setSelectedDate] = useState<string>(getTodayInTurkey());
  const [sortBy, setSortBy] = useState<SortType>('league');
  const [searchQuery, setSearchQuery] = useState('');

  // Match data state
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [aiMatches, setAiMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket state
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Refs
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  // ============================================================================
  // FETCH MATCHES
  // ============================================================================

  /**
   * Phase 6: Unified Endpoint
   *
   * Single API call replaces separate diary + live fetches.
   * Server-side merging handles:
   * - Cross-day live matches
   * - Score updates from live data
   * - Deduplication
   * - Smart cache with event-driven invalidation
   */
  const fetchMatches = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      // Phase 6: Single unified endpoint call
      const response = await getUnifiedMatches({
        date: selectedDate,
        includeLive: true,  // Always include cross-day live matches
      });

      const matches = response?.results || [];

      if (mountedRef.current) {
        setAllMatches(matches);
        setError(null);
        setLastUpdate(new Date());
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch matches');
        console.error('[LivescoreContext] Fetch error:', err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedDate]);

  const fetchAiMatches = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const response = await getMatchedPredictions(100);
      if (mountedRef.current) {
        // FIX: Extract predictions array from response object
        // response format: { success: true, count: N, predictions: [...] }
        const predictions = response?.predictions || [];
        setAiMatches(predictions);
      }
    } catch (err) {
      console.warn('[LivescoreContext] AI matches fetch failed:', err);
    }
  }, []);

  // ============================================================================
  // REFRESH FUNCTION
  // ============================================================================

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMatches(), fetchAiMatches()]);
  }, [fetchMatches, fetchAiMatches]);

  // ============================================================================
  // FILTERED MATCHES (Client-side filtering for instant tab switching)
  // ============================================================================

  const liveMatches = useMemo(() =>
    allMatches.filter(m => isLiveMatch((m as any).status_id ?? m.status)),
    [allMatches]
  );

  const finishedMatches = useMemo(() =>
    allMatches.filter(m => isFinishedMatch((m as any).status_id ?? m.status)),
    [allMatches]
  );

  const notStartedMatches = useMemo(() =>
    allMatches.filter(m => isNotStartedMatch((m as any).status_id ?? m.status)),
    [allMatches]
  );

  // Filter AI matches by selected date (using created_at)
  const filteredAiMatches = useMemo(() => {
    if (!aiMatches || aiMatches.length === 0) return [];

    // Parse selectedDate (YYYYMMDD format)
    const year = parseInt(selectedDate.substring(0, 4));
    const month = parseInt(selectedDate.substring(4, 6)) - 1;
    const day = parseInt(selectedDate.substring(6, 8));

    // Create date boundaries for the selected day (local time)
    const dayStart = new Date(year, month, day, 0, 0, 0);
    const dayEnd = new Date(year, month, day, 23, 59, 59);

    return aiMatches.filter((p: any) => {
      const predDate = new Date(p.created_at);
      return predDate >= dayStart && predDate <= dayEnd;
    });
  }, [aiMatches, selectedDate]);

  // ============================================================================
  // COUNTS FOR TAB BADGES
  // ============================================================================

  const counts: MatchCounts = useMemo(() => ({
    diary: allMatches.length,
    live: liveMatches.length,
    finished: finishedMatches.length,
    notStarted: notStartedMatches.length,
    ai: filteredAiMatches.length,
  }), [allMatches.length, liveMatches.length, finishedMatches.length, notStartedMatches.length, filteredAiMatches.length]);

  // ============================================================================
  // WEBSOCKET CONNECTION
  // ============================================================================

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[LivescoreContext] WebSocket connected');
          setIsSocketConnected(true);
        };

        ws.onclose = () => {
          console.log('[LivescoreContext] WebSocket disconnected');
          setIsSocketConnected(false);
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (error) => {
          console.error('[LivescoreContext] WebSocket error:', error);
          setIsSocketConnected(false);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // Handle score changes and match state changes
            if (message.type === 'GOAL' || message.type === 'SCORE_CHANGE' || message.type === 'MATCH_STATE_CHANGE') {
              // Phase 6: Optimistic Update - Apply instantly if available
              if (message.optimistic && message.matchId) {
                setAllMatches(prevMatches => {
                  return prevMatches.map(match => {
                    if (match.id === message.matchId) {
                      // Apply optimistic updates instantly
                      const updatedMatch = { ...match };

                      if (message.optimistic.homeScore !== undefined) {
                        (updatedMatch as any).home_score = message.optimistic.homeScore;
                      }
                      if (message.optimistic.awayScore !== undefined) {
                        (updatedMatch as any).away_score = message.optimistic.awayScore;
                      }
                      if (message.optimistic.statusId !== undefined) {
                        (updatedMatch as any).status_id = message.optimistic.statusId;
                        (updatedMatch as any).status = message.optimistic.statusId;
                      }
                      if (message.optimistic.minute !== undefined) {
                        (updatedMatch as any).minute = message.optimistic.minute;
                      }
                      if (message.optimistic.minuteText !== undefined) {
                        (updatedMatch as any).minute_text = message.optimistic.minuteText;
                      }

                      return updatedMatch;
                    }
                    return match;
                  });
                });
                setLastUpdate(new Date());
              }

              // Debounced full refresh for eventual consistency (2 seconds)
              // Smart cache ensures this is fast (event-driven invalidation already cleared stale data)
              if (fetchTimerRef.current) {
                clearTimeout(fetchTimerRef.current);
              }
              fetchTimerRef.current = setTimeout(() => {
                fetchMatches();
              }, 2000);  // Phase 6: Increased to 2s since optimistic update handles instant feedback
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        wsRef.current = ws;
      } catch (e) {
        console.error('[LivescoreContext] WebSocket connection error:', e);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
      }
    };
  }, [fetchMatches]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initial fetch and polling
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    refresh();

    // Polling every 15 seconds
    const pollInterval = setInterval(() => {
      fetchMatches();
    }, 15000);

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
    };
  }, [selectedDate, refresh, fetchMatches]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: LivescoreContextValue = {
    selectedDate,
    setSelectedDate,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    counts,
    allMatches,
    liveMatches,
    finishedMatches,
    notStartedMatches,
    aiMatches,
    loading,
    error,
    isSocketConnected,
    lastUpdate,
    refresh,
  };

  return (
    <LivescoreContext.Provider value={value}>
      {children}
    </LivescoreContext.Provider>
  );
}

export default LivescoreContext;
