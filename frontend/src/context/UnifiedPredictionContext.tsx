/**
 * Unified Predictions Context
 * 
 * Single source of truth for prediction data across all pages.
 * Serves: /admin/predictions, /ai-predictions, /admin/bots, /admin/bots/[botName]
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Types matching backend response
export interface UnifiedPrediction {
    id: string;
    external_id: string;
    bot_name: string;
    canonical_bot_name: string;
    league_name: string;
    home_team_name: string;
    away_team_name: string;
    home_team_logo: string | null;
    away_team_logo: string | null;
    score_at_prediction: string;
    minute_at_prediction: number;
    prediction_type: string;
    prediction_value: string;
    display_prediction: string | null;
    match_id: string | null;
    match_time: number | null;
    match_status: number;
    result: 'pending' | 'won' | 'lost' | 'cancelled';
    final_score: string | null;
    confidence: number;
    access_type: 'VIP' | 'FREE';
    created_at: string;
    resulted_at: string | null;
}

export interface PredictionStats {
    total: number;
    pending: number;
    matched: number;
    won: number;
    lost: number;
    winRate: string;
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

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PredictionFilter {
    status?: 'all' | 'pending' | 'matched' | 'won' | 'lost';
    bot?: string;
    date?: string;
    access?: 'all' | 'vip' | 'free';
    page?: number;
    limit?: number;
}

interface PredictionContextState {
    predictions: UnifiedPrediction[];
    stats: PredictionStats | null;
    bots: BotStat[];
    pagination: Pagination | null;
    loading: boolean;
    error: string | null;
    filter: PredictionFilter;

    // Actions
    fetchPredictions: (filter?: PredictionFilter) => Promise<void>;
    setFilter: (filter: Partial<PredictionFilter>) => void;
    refreshData: () => Promise<void>;
}

const defaultStats: PredictionStats = {
    total: 0,
    pending: 0,
    matched: 0,
    won: 0,
    lost: 0,
    winRate: 'N/A'
};

const defaultPagination: Pagination = {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
};

const PredictionContext = createContext<PredictionContextState | undefined>(undefined);

export function PredictionProvider({ children }: { children: ReactNode }) {
    const [predictions, setPredictions] = useState<UnifiedPrediction[]>([]);
    const [stats, setStats] = useState<PredictionStats | null>(null);
    const [bots, setBots] = useState<BotStat[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilterState] = useState<PredictionFilter>({
        status: 'all',
        page: 1,
        limit: 50
    });

    const fetchPredictions = useCallback(async (newFilter?: PredictionFilter) => {
        const currentFilter = newFilter || filter;
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (currentFilter.status && currentFilter.status !== 'all') {
                params.set('status', currentFilter.status);
            }
            if (currentFilter.bot) {
                params.set('bot', currentFilter.bot);
            }
            if (currentFilter.date) {
                params.set('date', currentFilter.date);
            }
            if (currentFilter.access && currentFilter.access !== 'all') {
                params.set('access', currentFilter.access);
            }
            if (currentFilter.page) {
                params.set('page', currentFilter.page.toString());
            }
            if (currentFilter.limit) {
                params.set('limit', currentFilter.limit.toString());
            }

            const url = `${API_BASE}/predictions/unified${params.toString() ? '?' + params.toString() : ''}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch predictions: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success && data.data) {
                setPredictions(data.data.predictions || []);
                setStats(data.data.stats || defaultStats);
                setBots(data.data.bots || []);
                setPagination(data.data.pagination || defaultPagination);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err) {
            console.error('Fetch predictions error:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch predictions');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    const setFilter = useCallback((newFilter: Partial<PredictionFilter>) => {
        setFilterState(prev => {
            const updated = { ...prev, ...newFilter };
            // Reset page when changing filters (except page itself)
            if (!('page' in newFilter)) {
                updated.page = 1;
            }
            return updated;
        });
    }, []);

    const refreshData = useCallback(async () => {
        await fetchPredictions(filter);
    }, [fetchPredictions, filter]);

    const value: PredictionContextState = {
        predictions,
        stats,
        bots,
        pagination,
        loading,
        error,
        filter,
        fetchPredictions,
        setFilter,
        refreshData
    };

    return (
        <PredictionContext.Provider value={value}>
            {children}
        </PredictionContext.Provider>
    );
}

// Main hook
export function usePredictions() {
    const context = useContext(PredictionContext);
    if (context === undefined) {
        throw new Error('usePredictions must be used within a PredictionProvider');
    }
    return context;
}

// Convenience hooks
export function usePredictionStats() {
    const { stats } = usePredictions();
    return stats;
}

export function useBotList() {
    const { bots } = usePredictions();
    return bots;
}

export function useBotDetail(botName: string) {
    const { bots, predictions, filter, fetchPredictions } = usePredictions();

    const bot = bots.find(b =>
        b.name.toLowerCase().includes(botName.toLowerCase())
    );

    const botPredictions = predictions.filter(p =>
        p.canonical_bot_name?.toLowerCase().includes(botName.toLowerCase())
    );

    const fetchBotPredictions = useCallback(async (page = 1, limit = 50) => {
        await fetchPredictions({ ...filter, bot: botName, page, limit });
    }, [fetchPredictions, filter, botName]);

    return { bot, predictions: botPredictions, fetchBotPredictions };
}
