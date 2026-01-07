/**
 * AI Predictions Context - Phase 5 Refactor
 *
 * TEK MERKEZİ KAYNAK - Tüm AI tahmin sayfaları buradan beslenir:
 * - /admin/predictions
 * - /admin/bots
 * - /admin/bots/{botName}
 * - /admin/manual-predictions
 * - /match/{id}/ai
 * - /ai-predictions
 *
 * WebSocket Events:
 * - SCORE_CHANGE: Live skor güncellemesi
 * - MATCH_STATE_CHANGE: Maç durumu değişimi (HT, FT)
 * - PREDICTION_SETTLED: Tahmin sonuçlandı (won/lost)
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

// ============================================================================
// TYPES - Yeni 29 kolon şemasına uygun
// ============================================================================

export interface AIPrediction {
  // Temel kimlik
  id: string;
  external_id: string;
  canonical_bot_name: string;

  // Maç bilgileri
  match_id: string | null;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  league_name: string;
  competition_id: string | null;
  country_id: string | null;

  // Tahmin detayları
  score_at_prediction: string;
  minute_at_prediction: number;
  prediction: string;              // "IY 0.5 ÜST", "MS 2.5 ÜST"
  prediction_threshold: number;    // 0.5, 1.5, 2.5

  // Sonuç takibi
  result: 'pending' | 'won' | 'lost' | 'cancelled';
  final_score: string | null;
  result_reason: string | null;
  resulted_at: string | null;

  // Erişim & meta
  access_type: 'VIP' | 'FREE';
  source: string;
  created_at: string;

  // Live data (ts_matches join)
  home_score_display?: number;
  away_score_display?: number;
  live_match_status?: number;
  live_match_minute?: number;

  // Enhanced data (joins)
  country_name?: string;
  country_logo?: string;
  competition_logo?: string;
}

export interface BotStat {
  name: string;
  displayName: string;
  total: number;
  pending: number;
  won: number;
  lost: number;
  winRate: string;
}

export interface PredictionStats {
  total: number;
  pending: number;
  matched: number;
  won: number;
  lost: number;
  winRate: string;
}

export interface PredictionFilter {
  status?: 'all' | 'pending' | 'matched' | 'won' | 'lost';
  bot?: string;
  date?: string;
  access?: 'all' | 'vip' | 'free';
  page?: number;
  limit?: number;
}

// Settlement event from WebSocket
export interface PredictionSettledEvent {
  type: 'PREDICTION_SETTLED';
  predictionId: string;
  matchId: string;
  botName: string;
  prediction: string;
  result: 'won' | 'lost';
  resultReason: string;
  homeTeam: string;
  awayTeam: string;
  finalScore?: string;
  timestamp: number;
}

interface AIPredictionsContextType {
  // Data
  predictions: AIPrediction[];
  predictionsByMatch: Map<string, AIPrediction>;
  stats: PredictionStats;
  botStats: BotStat[];

  // Loading state
  loading: boolean;
  error: string | null;

  // Pagination
  page: number;
  totalPages: number;
  setPage: (page: number) => void;

  // Filters
  filter: PredictionFilter;
  setFilter: (filter: PredictionFilter) => void;

  // Actions
  refresh: () => Promise<void>;
  getPredictionsByBot: (botName: string) => AIPrediction[];
  getPredictionByMatch: (matchId: string) => AIPrediction | undefined;

  // Real-time
  lastSettlement: PredictionSettledEvent | null;
  isConnected: boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AIPredictionsContext = createContext<AIPredictionsContextType | null>(null);

export function useAIPredictions() {
  const context = useContext(AIPredictionsContext);
  if (!context) {
    throw new Error('useAIPredictions must be used within AIPredictionsProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface AIPredictionsProviderProps {
  children: ReactNode;
}

export function AIPredictionsProvider({ children }: AIPredictionsProviderProps) {
  // State
  const [predictions, setPredictions] = useState<AIPrediction[]>([]);
  const [predictionsByMatch, setPredictionsByMatch] = useState<Map<string, AIPrediction>>(new Map());
  const [stats, setStats] = useState<PredictionStats>({
    total: 0, pending: 0, matched: 0, won: 0, lost: 0, winRate: 'N/A'
  });
  const [botStats, setBotStats] = useState<BotStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<PredictionFilter>({ limit: 100 });
  const [lastSettlement, setLastSettlement] = useState<PredictionSettledEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ============================================================================
  // FETCH DATA
  // ============================================================================

  const fetchPredictions = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const params = new URLSearchParams();
      if (filter.status && filter.status !== 'all') params.append('status', filter.status);
      if (filter.bot) params.append('bot', filter.bot);
      if (filter.date) params.append('date', filter.date);
      if (filter.access && filter.access !== 'all') params.append('access', filter.access);
      params.append('page', page.toString());
      params.append('limit', (filter.limit || 100).toString());

      const res = await fetch(`${API_BASE}/predictions/unified?${params}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.data) {
        const { predictions: preds, stats: s, bots, pagination } = data.data;

        // Map to context format
        const predsList: AIPrediction[] = preds.map((p: any) => ({
          id: p.id,
          external_id: p.external_id,
          canonical_bot_name: p.canonical_bot_name,
          match_id: p.match_id,
          home_team_name: p.home_team_name,
          away_team_name: p.away_team_name,
          home_team_logo: p.home_team_logo,
          away_team_logo: p.away_team_logo,
          league_name: p.league_name,
          competition_id: p.competition_id,
          country_id: p.country_id,
          score_at_prediction: p.score_at_prediction,
          minute_at_prediction: p.minute_at_prediction,
          prediction: p.prediction,
          prediction_threshold: p.prediction_threshold,
          result: p.result,
          final_score: p.final_score,
          result_reason: p.result_reason,
          resulted_at: p.resulted_at,
          access_type: p.access_type,
          source: p.source,
          created_at: p.created_at,
          home_score_display: p.home_score_display,
          away_score_display: p.away_score_display,
          live_match_status: p.live_match_status,
          live_match_minute: p.live_match_minute,
          country_name: p.country_name,
          country_logo: p.country_logo,
          competition_logo: p.competition_logo,
        }));

        // Create match -> prediction map
        const matchMap = new Map<string, AIPrediction>();
        for (const pred of predsList) {
          if (pred.match_id) {
            matchMap.set(pred.match_id, pred);
          }
        }

        if (mountedRef.current) {
          setPredictions(predsList);
          setPredictionsByMatch(matchMap);
          setStats(s);
          setBotStats(bots || []);
          setTotalPages(pagination?.totalPages || 1);
          setError(null);
        }
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch predictions');
        console.error('[AIPredictionsContext] Fetch error:', err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [filter, page]);

  // ============================================================================
  // WEBSOCKET CONNECTION
  // ============================================================================

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connect = () => {
      if (!mountedRef.current) return;

      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[AIPredictionsContext] WebSocket connected');
          setIsConnected(true);
        };

        ws.onclose = () => {
          console.log('[AIPredictionsContext] WebSocket disconnected');
          setIsConnected(false);
          // Reconnect after 5 seconds
          if (mountedRef.current) {
            reconnectTimeoutRef.current = setTimeout(connect, 5000);
          }
        };

        ws.onerror = (err) => {
          console.error('[AIPredictionsContext] WebSocket error:', err);
          setIsConnected(false);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (e) {
            // Ignore parse errors
          }
        };

        wsRef.current = ws;
      } catch (e) {
        console.error('[AIPredictionsContext] WebSocket connection error:', e);
      }
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================================
  // WEBSOCKET MESSAGE HANDLER
  // ============================================================================

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'SCORE_CHANGE':
      case 'GOAL':
        // Update live scores
        setPredictions(prev => prev.map(p => {
          if (p.match_id === message.matchId) {
            return {
              ...p,
              home_score_display: message.optimistic?.homeScore ?? p.home_score_display,
              away_score_display: message.optimistic?.awayScore ?? p.away_score_display,
              live_match_minute: message.optimistic?.minute ?? p.live_match_minute,
            };
          }
          return p;
        }));

        setPredictionsByMatch(prev => {
          const next = new Map(prev);
          const pred = next.get(message.matchId);
          if (pred) {
            next.set(message.matchId, {
              ...pred,
              home_score_display: message.optimistic?.homeScore ?? pred.home_score_display,
              away_score_display: message.optimistic?.awayScore ?? pred.away_score_display,
              live_match_minute: message.optimistic?.minute ?? pred.live_match_minute,
            });
          }
          return next;
        });
        break;

      case 'MATCH_STATE_CHANGE':
        // Update match status
        setPredictions(prev => prev.map(p => {
          if (p.match_id === message.matchId) {
            return {
              ...p,
              live_match_status: message.optimistic?.statusId ?? message.newStatus ?? p.live_match_status,
              live_match_minute: message.optimistic?.minute ?? p.live_match_minute,
            };
          }
          return p;
        }));

        // If match ended, refresh after delay for final results
        if (message.newStatus === 8 || message.optimistic?.statusId === 8) {
          setTimeout(() => fetchPredictions(), 3000);
        }
        break;

      case 'PREDICTION_SETTLED':
        // Phase 5: Real-time prediction result update
        const settlementEvent = message as PredictionSettledEvent;

        // Update the prediction instantly
        setPredictions(prev => prev.map(p => {
          if (p.id === settlementEvent.predictionId) {
            return {
              ...p,
              result: settlementEvent.result,
              result_reason: settlementEvent.resultReason,
              final_score: settlementEvent.finalScore || p.final_score,
              resulted_at: new Date().toISOString(),
            };
          }
          return p;
        }));

        setPredictionsByMatch(prev => {
          const next = new Map(prev);
          const pred = next.get(settlementEvent.matchId);
          if (pred && pred.id === settlementEvent.predictionId) {
            next.set(settlementEvent.matchId, {
              ...pred,
              result: settlementEvent.result,
              result_reason: settlementEvent.resultReason,
              final_score: settlementEvent.finalScore || pred.final_score,
              resulted_at: new Date().toISOString(),
            });
          }
          return next;
        });

        // Update stats locally
        setStats(prev => {
          const newStats = { ...prev };
          newStats.pending = Math.max(0, newStats.pending - 1);
          if (settlementEvent.result === 'won') {
            newStats.won += 1;
          } else if (settlementEvent.result === 'lost') {
            newStats.lost += 1;
          }
          // Recalculate win rate
          const total = newStats.won + newStats.lost;
          newStats.winRate = total > 0 ? ((newStats.won / total) * 100).toFixed(1) + '%' : 'N/A';
          return newStats;
        });

        // Store last settlement for UX (toast, animation)
        setLastSettlement(settlementEvent);

        console.log(`[AIPredictionsContext] Prediction settled: ${settlementEvent.botName} - ${settlementEvent.result}`);
        break;
    }
  }, [fetchPredictions]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getPredictionsByBot = useCallback((botName: string): AIPrediction[] => {
    return predictions.filter(p =>
      p.canonical_bot_name.toLowerCase().includes(botName.toLowerCase())
    );
  }, [predictions]);

  const getPredictionByMatch = useCallback((matchId: string): AIPrediction | undefined => {
    return predictionsByMatch.get(matchId);
  }, [predictionsByMatch]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initial fetch and on filter/page change
  useEffect(() => {
    mountedRef.current = true;
    fetchPredictions();
  }, [fetchPredictions]);

  // Polling every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchPredictions, 30000);
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: AIPredictionsContextType = {
    predictions,
    predictionsByMatch,
    stats,
    botStats,
    loading,
    error,
    page,
    totalPages,
    setPage,
    filter,
    setFilter,
    refresh: fetchPredictions,
    getPredictionsByBot,
    getPredictionByMatch,
    lastSettlement,
    isConnected,
  };

  return (
    <AIPredictionsContext.Provider value={value}>
      {children}
    </AIPredictionsContext.Provider>
  );
}

export default AIPredictionsContext;
