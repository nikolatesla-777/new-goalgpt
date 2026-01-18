/**
 * LivescoreContext
 *
 * Unified state management for Livescore page
 * - Single WebSocket connection for all match updates
 * - Combines matches + AI predictions
 * - Filters by status (live, finished, upcoming, ai)
 * - Progressive loading with skeleton support
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getUnifiedMatches, getMatchedPredictions } from '../api/matches';
import type { Match, MatchDiary } from '../api/matches';
import { useSocket, type ScoreChangeEvent, type MatchStateChangeEvent, type MinuteUpdateEvent, type PredictionSettledEvent } from '../hooks/useSocket';
import { isLiveMatch, isFinishedMatch, MatchState } from '../utils/matchStatus';

// AI Prediction type (from matched predictions API)
export interface MatchedPrediction {
  id: string;
  match_external_id: string;
  match_id?: string;
  canonical_bot_name: string;
  prediction: string;
  prediction_threshold: number;
  result: 'pending' | 'won' | 'lost' | 'cancelled';
  result_reason: string | null;
  access_type: 'VIP' | 'FREE';
  minute_at_prediction: number;
  score_at_prediction: string;
  created_at: string;
  resulted_at: string | null;
  // Match data from join
  home_team_name: string;
  away_team_name: string;
  home_team_logo?: string;
  away_team_logo?: string;
  league_name: string;
  league_logo?: string;
  country_name?: string;
  match_time: number;
  status?: number;
  status_id?: number;
  home_score?: number;
  away_score?: number;
  minute_text?: string;
}

// Extended Match with AI prediction
export interface MatchWithPrediction extends MatchDiary {
  prediction?: MatchedPrediction;
  hasPrediction?: boolean;
}

interface LivescoreContextValue {
  // All matches for the selected date
  matches: MatchWithPrediction[];

  // Filtered matches by status
  liveMatches: MatchWithPrediction[];
  finishedMatches: MatchWithPrediction[];
  upcomingMatches: MatchWithPrediction[];
  aiMatches: MatchWithPrediction[]; // Matches with AI predictions

  // AI Predictions
  predictions: MatchedPrediction[];
  predictionsByMatch: Map<string, MatchedPrediction>;

  // State
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;

  // WebSocket status
  isConnected: boolean;

  // Selected date (YYYYMMDD format)
  selectedDate: string;
  setSelectedDate: (date: string) => void;

  // Actions
  refresh: () => Promise<void>;

  // Last settlement event (for toast notifications)
  lastSettlement: PredictionSettledEvent | null;
}

const LivescoreContext = createContext<LivescoreContextValue | null>(null);

export function useLivescore() {
  const context = useContext(LivescoreContext);
  if (!context) {
    throw new Error('useLivescore must be used within a LivescoreProvider');
  }
  return context;
}

// Get today's date in YYYYMMDD format (Turkey timezone)
function getTodayTurkey(): string {
  const now = new Date();
  // Turkey is UTC+3
  const turkeyOffset = 3 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const turkeyMinutes = utcMinutes + turkeyOffset;

  let date = new Date(now);
  if (turkeyMinutes >= 24 * 60) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

// Convert YYYYMMDD to YYYY-MM-DD
function formatDateForAPI(date: string): string {
  if (date.includes('-')) return date;
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

interface LivescoreProviderProps {
  children: React.ReactNode;
  initialDate?: string;
}

export function LivescoreProvider({ children, initialDate }: LivescoreProviderProps) {
  // State
  const [matches, setMatches] = useState<MatchWithPrediction[]>([]);
  const [predictions, setPredictions] = useState<MatchedPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState(initialDate || getTodayTurkey());
  const [lastSettlement, setLastSettlement] = useState<PredictionSettledEvent | null>(null);

  // Refs for debouncing
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // Create prediction lookup map
  const predictionsByMatch = useMemo(() => {
    const map = new Map<string, MatchedPrediction>();
    predictions.forEach(p => {
      const matchId = p.match_external_id || p.match_id;
      if (matchId) {
        map.set(matchId, p);
      }
    });
    return map;
  }, [predictions]);

  // Filter matches by status
  const liveMatches = useMemo(() =>
    matches.filter(m => isLiveMatch(m.status ?? 0)),
    [matches]
  );

  const finishedMatches = useMemo(() =>
    matches.filter(m => isFinishedMatch(m.status ?? 0)),
    [matches]
  );

  const upcomingMatches = useMemo(() =>
    matches.filter(m => (m.status ?? 0) === MatchState.NOT_STARTED),
    [matches]
  );

  const aiMatches = useMemo(() =>
    matches.filter(m => m.hasPrediction),
    [matches]
  );

  // Fetch all data
  const fetchData = useCallback(async (showLoading = true) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (showLoading && !hasLoadedRef.current) {
        setIsLoading(true);
      }
      setError(null);

      const dateForAPI = formatDateForAPI(selectedDate);

      // Parallel fetch: matches + predictions
      const [matchesResponse, predictionsResponse] = await Promise.all([
        getUnifiedMatches({
          date: dateForAPI,
          includeLive: true,
          includeAI: true
        }),
        getMatchedPredictions(200)
      ]);

      const matchesData = matchesResponse.results || [];
      const predictionsData = predictionsResponse.predictions || [];

      // Filter predictions by selected date
      const dayStart = new Date(dateForAPI).getTime() / 1000;
      const dayEnd = dayStart + 24 * 60 * 60;

      const filteredPredictions = predictionsData.filter((p: MatchedPrediction) => {
        const matchTime = Number(p.match_time);
        return matchTime >= dayStart && matchTime < dayEnd;
      });

      // Create prediction map for enrichment
      const predMap = new Map<string, MatchedPrediction>();
      filteredPredictions.forEach((p: MatchedPrediction) => {
        const matchId = p.match_external_id || p.match_id;
        if (matchId) {
          predMap.set(matchId, p);
        }
      });

      // Enrich matches with prediction info
      const enrichedMatches: MatchWithPrediction[] = matchesData.map((match: Match) => {
        const prediction = predMap.get(match.id);
        return {
          ...match,
          prediction,
          hasPrediction: !!prediction,
        };
      });

      setMatches(enrichedMatches);
      setPredictions(filteredPredictions);
      setLastUpdate(new Date());
      hasLoadedRef.current = true;

    } catch (err: any) {
      console.error('[LivescoreContext] Fetch error:', err);
      setError(err.message || 'Veri yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [selectedDate]);

  // Debounced refresh (for WebSocket events)
  const debouncedRefresh = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchData(false);
    }, 500);
  }, [fetchData]);

  // Handle score change
  const handleScoreChange = useCallback((event: ScoreChangeEvent) => {
    // Update match in state immediately (optimistic update)
    setMatches(prev => prev.map(match => {
      if (match.id === event.matchId) {
        return {
          ...match,
          home_score: event.homeScore,
          away_score: event.awayScore,
        };
      }
      return match;
    }));

    // Also refresh from API to get complete data
    debouncedRefresh();
  }, [debouncedRefresh]);

  // Handle match state change
  const handleMatchStateChange = useCallback((event: MatchStateChangeEvent) => {
    // Update match status immediately
    setMatches(prev => prev.map(match => {
      if (match.id === event.matchId) {
        return {
          ...match,
          status: event.statusId,
        };
      }
      return match;
    }));

    debouncedRefresh();
  }, [debouncedRefresh]);

  // Handle minute update
  const handleMinuteUpdate = useCallback((event: MinuteUpdateEvent) => {
    setMatches(prev => prev.map(match => {
      if (match.id === event.matchId) {
        return {
          ...match,
          minute: event.minute,
          status: event.statusId,
        };
      }
      return match;
    }));
  }, []);

  // Handle prediction settlement
  const handlePredictionSettled = useCallback((event: PredictionSettledEvent) => {
    // Update prediction in state
    setPredictions(prev => prev.map(pred => {
      if (pred.id === event.predictionId || pred.match_external_id === event.matchId) {
        return {
          ...pred,
          result: event.result,
          result_reason: event.resultReason,
        };
      }
      return pred;
    }));

    // Update match's prediction
    setMatches(prev => prev.map(match => {
      if (match.id === event.matchId && match.prediction) {
        return {
          ...match,
          prediction: {
            ...match.prediction,
            result: event.result,
            result_reason: event.resultReason,
          },
        };
      }
      return match;
    }));

    // Set last settlement for toast notification
    setLastSettlement(event);
  }, []);

  // WebSocket connection
  const { isConnected } = useSocket({
    onScoreChange: handleScoreChange,
    onMatchStateChange: handleMatchStateChange,
    onMinuteUpdate: handleMinuteUpdate,
    onPredictionSettled: handlePredictionSettled,
  });

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling fallback (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isFetchingRef.current) {
        fetchData(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // Context value
  const value: LivescoreContextValue = {
    matches,
    liveMatches,
    finishedMatches,
    upcomingMatches,
    aiMatches,
    predictions,
    predictionsByMatch,
    isLoading,
    error,
    lastUpdate,
    isConnected,
    selectedDate,
    setSelectedDate,
    refresh: () => fetchData(false),
    lastSettlement,
  };

  return (
    <LivescoreContext.Provider value={value}>
      {children}
    </LivescoreContext.Provider>
  );
}

export default LivescoreContext;
