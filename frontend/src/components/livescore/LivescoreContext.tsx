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
import { getUnifiedMatches } from '../../api/matches';
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
  matchesWithAI: Match[]; // PHASE 4: Renamed from aiMatches, now filtered from allMatches.aiPrediction

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
  // PHASE 4: REMOVED aiMatches state - now computed from allMatches.aiPrediction
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
   * PHASE 4: AI Predictions Integration
   *
   * Single API call replaces separate diary + live fetches.
   * Server-side merging handles:
   * - Cross-day live matches
   * - Score updates from live data
   * - Deduplication
   * - PHASE 4: AI predictions via LEFT JOIN LATERAL
   * - Smart cache with event-driven invalidation
   */
  const fetchMatches = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      // Phase 6 + PHASE 4: Single unified endpoint call with AI predictions
      const response = await getUnifiedMatches({
        date: selectedDate,
        includeLive: true,   // Always include cross-day live matches
        includeAI: true,     // PHASE 4: Include AI predictions via LEFT JOIN
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

  // PHASE 4: REMOVED fetchAiMatches - AI predictions now included in fetchMatches via LEFT JOIN

  // ============================================================================
  // REFRESH FUNCTION
  // ============================================================================

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchMatches(); // PHASE 4: Single fetch includes AI predictions
  }, [fetchMatches]);

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

  // PHASE 4: Compute matches with AI predictions (from aiPrediction field)
  const matchesWithAI = useMemo(() =>
    allMatches.filter(m => (m as any).aiPrediction !== undefined),
    [allMatches]
  );

  // ============================================================================
  // COUNTS FOR TAB BADGES
  // ============================================================================

  const counts: MatchCounts = useMemo(() => ({
    diary: allMatches.length,
    live: liveMatches.length,
    finished: finishedMatches.length,
    notStarted: notStartedMatches.length,
    ai: matchesWithAI.length, // PHASE 4: Updated to use matchesWithAI
  }), [allMatches.length, liveMatches.length, finishedMatches.length, notStartedMatches.length, matchesWithAI.length]);

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

        // Client-side PING to keep connection alive (25s interval)
        let clientPingInterval: ReturnType<typeof setInterval> | null = null;

        const startClientPing = () => {
          clientPingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
            }
          }, 25000);
        };

        // Start ping after connection is established
        ws.addEventListener('open', startClientPing);

        ws.onclose = () => {
          console.log('[LivescoreContext] WebSocket disconnected');
          setIsSocketConnected(false);
          if (clientPingInterval) clearInterval(clientPingInterval);
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

            // Handle score changes, match state changes, and minute updates
            if (message.type === 'GOAL' || message.type === 'SCORE_CHANGE' || message.type === 'MATCH_STATE_CHANGE' || message.type === 'MINUTE_UPDATE') {
              // CRITICAL FIX (2026-01-13): Handle MINUTE_UPDATE with direct message format
              // Backend sends: { type: 'MINUTE_UPDATE', matchId, minute, statusId }
              // NOT wrapped in optimistic object like MQTT events
              if (message.type === 'MINUTE_UPDATE' && message.matchId && (message.minute !== undefined || message.optimistic?.minute !== undefined)) {
                const newMinute = message.optimistic?.minute ?? message.minute;
                const newStatusId = message.optimistic?.statusId ?? message.statusId;

                setAllMatches(prevMatches => {
                  const matchIndex = prevMatches.findIndex(m => m.id === message.matchId);
                  if (matchIndex === -1) return prevMatches;

                  const match = prevMatches[matchIndex];
                  const currentMinute = (match as any).minute;
                  const currentStatus = (match as any).status_id;

                  // Only update if values changed
                  if (currentMinute === newMinute && (newStatusId === undefined || currentStatus === newStatusId)) {
                    return prevMatches;
                  }

                  const updatedMatch = { ...match };
                  (updatedMatch as any).minute = newMinute;
                  if (newStatusId !== undefined) {
                    (updatedMatch as any).status_id = newStatusId;
                    (updatedMatch as any).status = newStatusId;
                  }

                  const newMatches = [...prevMatches];
                  newMatches[matchIndex] = updatedMatch;
                  return newMatches;
                });
                setLastUpdate(new Date());
              }

              // Phase 6: Optimistic Update - Apply instantly if available (for GOAL/SCORE_CHANGE/MATCH_STATE_CHANGE)
              else if (message.optimistic && message.matchId) {
                setAllMatches(prevMatches => {
                  // Find match index first
                  const matchIndex = prevMatches.findIndex(m => m.id === message.matchId);
                  if (matchIndex === -1) return prevMatches; // Match not found, don't update

                  const match = prevMatches[matchIndex];

                  // Check if any value actually changed (avoid unnecessary updates)
                  let hasChanges = false;
                  const updatedMatch = { ...match };

                  if (message.optimistic.homeScore !== undefined && (match as any).home_score !== message.optimistic.homeScore) {
                    (updatedMatch as any).home_score = message.optimistic.homeScore;
                    hasChanges = true;
                  }
                  if (message.optimistic.awayScore !== undefined && (match as any).away_score !== message.optimistic.awayScore) {
                    (updatedMatch as any).away_score = message.optimistic.awayScore;
                    hasChanges = true;
                  }
                  if (message.optimistic.statusId !== undefined && (match as any).status_id !== message.optimistic.statusId) {
                    (updatedMatch as any).status_id = message.optimistic.statusId;
                    (updatedMatch as any).status = message.optimistic.statusId;
                    hasChanges = true;
                  }
                  if (message.optimistic.minute !== undefined && (match as any).minute !== message.optimistic.minute) {
                    (updatedMatch as any).minute = message.optimistic.minute;
                    hasChanges = true;
                  }
                  if (message.optimistic.minuteText !== undefined && (match as any).minute_text !== message.optimistic.minuteText) {
                    (updatedMatch as any).minute_text = message.optimistic.minuteText;
                    hasChanges = true;
                  }

                  // Only update if something actually changed
                  if (!hasChanges) return prevMatches;

                  // Create new array only with updated match
                  const newMatches = [...prevMatches];
                  newMatches[matchIndex] = updatedMatch;
                  return newMatches;
                });
                setLastUpdate(new Date());
              }

              // PHASE 6 FIX: Debounced refetch DISABLED
              // Trust MQTT/WebSocket data as the sole source of truth
              // Backend now returns correct columns (home_score_display), no need to refetch
              // Refetch was causing score reversion when backend had stale cache
              /*
              if (fetchTimerRef.current) {
                clearTimeout(fetchTimerRef.current);
              }
              fetchTimerRef.current = setTimeout(() => {
                fetchMatches();
              }, 5000);
              */
            }

            // PHASE 5: Handle PREDICTION_SETTLED event
            if (message.type === 'PREDICTION_SETTLED') {
              setAllMatches(prevMatches => {
                const matchIndex = prevMatches.findIndex(m => m.id === message.matchId);
                if (matchIndex === -1) return prevMatches;

                const match = prevMatches[matchIndex];
                // Check if this match has aiPrediction and it matches the predictionId
                if (!(match as any).aiPrediction || (match as any).aiPrediction.id !== message.predictionId) {
                  return prevMatches;
                }

                // Optimistic update: Update prediction result immediately
                const updatedMatch = {
                  ...match,
                  aiPrediction: {
                    ...(match as any).aiPrediction,
                    result: message.result,
                    result_reason: message.resultReason,
                    final_score: message.finalScore || (match as any).aiPrediction.final_score,
                    resulted_at: new Date().toISOString(),
                  },
                };

                const newMatches = [...prevMatches];
                newMatches[matchIndex] = updatedMatch as any;
                return newMatches;
              });

              setLastUpdate(new Date());

              // PHASE 6 FIX: Debounced refetch DISABLED (trust WebSocket data)
              /*
              if (fetchTimerRef.current) {
                clearTimeout(fetchTimerRef.current);
              }
              fetchTimerRef.current = setTimeout(() => fetchMatches(), 5000);
              */
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

    // OPTIMIZATION: Polling only when WebSocket is disconnected
    // When WebSocket is active, we get real-time updates via onmessage
    // This prevents duplicate API calls and reduces server load
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (!isSocketConnected) {
      pollInterval = setInterval(() => {
        fetchMatches();
      }, 15000);
      console.log('[LivescoreContext] ⏱️ Polling ENABLED (WebSocket disconnected) - 15s interval');
    } else {
      console.log('[LivescoreContext] ✅ Polling DISABLED (WebSocket connected) - using real-time updates');
    }

    return () => {
      mountedRef.current = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [selectedDate, refresh, fetchMatches, isSocketConnected]);

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
    matchesWithAI, // PHASE 4: Updated from aiMatches
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
