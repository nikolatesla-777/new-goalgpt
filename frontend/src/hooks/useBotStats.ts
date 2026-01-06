/**
 * Bot Stats Hook
 * 
 * Uses the unified predictions endpoint to fetch bot statistics.
 * All pages use the same data source for consistency.
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Legacy interface (for backward compatibility)
export interface BotStats {
    bot_name: string;
    total_predictions: number;
    wins: number;
    losses: number;
    pending: number;
    win_rate: number;
}

// New unified interface from backend
interface UnifiedBotStat {
    name: string;
    displayName: string;
    total: number;
    pending: number;
    won: number;
    lost: number;
    winRate: string;
}

interface UnifiedStats {
    total: number;
    pending: number;
    matched: number;
    won: number;
    lost: number;
    winRate: string;
}

export interface BotStatsResponse {
    success: boolean;
    global: BotStats;
    bots: BotStats[];
    timestamp: string;
}

// Convert unified format to legacy format for compatibility
function convertToLegacyFormat(unifiedBots: UnifiedBotStat[], unifiedStats: UnifiedStats): BotStatsResponse {
    const bots: BotStats[] = unifiedBots.map(b => ({
        bot_name: b.name,
        total_predictions: b.total,
        wins: b.won,
        losses: b.lost,
        pending: b.pending,
        win_rate: parseFloat(b.winRate.replace('%', '')) || 0
    }));

    const global: BotStats = {
        bot_name: 'Global',
        total_predictions: unifiedStats.total,
        wins: unifiedStats.won,
        losses: unifiedStats.lost,
        pending: unifiedStats.pending,
        win_rate: parseFloat(unifiedStats.winRate.replace('%', '')) || 0
    };

    return {
        success: true,
        global,
        bots,
        timestamp: new Date().toISOString()
    };
}

export function useBotStats(autoRefresh = true) {
    const [stats, setStats] = useState<BotStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            // Use the unified endpoint
            const response = await fetch(`${API_BASE}/predictions/unified?limit=1&v=${Date.now()}`);
            if (!response.ok) {
                throw new Error('Stats fetch failed');
            }
            const data = await response.json();

            if (data.success && data.data) {
                // Convert to legacy format for backward compatibility
                const legacyStats = convertToLegacyFormat(
                    data.data.bots || [],
                    data.data.stats || { total: 0, pending: 0, matched: 0, won: 0, lost: 0, winRate: 'N/A' }
                );
                setStats(legacyStats);
                setError(null);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err) {
            console.error('Failed to fetch bot stats:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();

        if (autoRefresh) {
            // Refresh every 60 seconds
            const interval = setInterval(fetchStats, 60000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, fetchStats]);

    return { stats, loading, error, refetch: fetchStats };
}
