/**
 * AI Predictions Context
 * 
 * Provides AI prediction data to child components.
 * Uses the unified predictions endpoint for consistent data across all pages.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';

export interface AIPrediction {
    id: string;
    match_external_id: string | null;
    prediction_type: string;
    prediction_value: string;
    overall_confidence: number;
    bot_name?: string;
    canonical_bot_name?: string;
    minute_at_prediction?: number;
    prediction_result?: 'pending' | 'winner' | 'loser' | null;
    created_at: string;
    league_name?: string;
    home_team_name?: string;
    away_team_name?: string;
    score_at_prediction?: string;
    status_id?: number;
    // Enhanced fields
    home_team_logo?: string;
    away_team_logo?: string;
    competition_name?: string;
    competition_logo?: string;
    country_name?: string;
    country_logo?: string;
    match_status_id?: number;
    match_minute?: number;
    home_score_display?: string;
    away_score_display?: string;
    final_home_score?: number;
    final_away_score?: number;
    display_prediction?: string;
    access_type?: 'VIP' | 'FREE';
    result?: 'pending' | 'won' | 'lost' | 'cancelled';
    final_score?: string;
}

interface AIPredictionsContextType {
    matchIds: Set<string>;
    predictions: Map<string, AIPrediction>; // Keyed by matchId (latest prediction)
    allPredictions: AIPrediction[]; // Full list of all predictions
    loading: boolean;
    refresh: () => void;
}

const AIPredictionsContext = createContext<AIPredictionsContextType>({
    matchIds: new Set(),
    predictions: new Map(),
    allPredictions: [],
    loading: true,
    refresh: () => { },
});

export function useAIPredictions() {
    return useContext(AIPredictionsContext);
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface AIPredictionsProviderProps {
    children: ReactNode;
}

export function AIPredictionsProvider({ children }: AIPredictionsProviderProps) {
    const [matchIds, setMatchIds] = useState<Set<string>>(new Set());
    const [predictions, setPredictions] = useState<Map<string, AIPrediction>>(new Map());
    const [allPredictions, setAllPredictions] = useState<AIPrediction[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPredictions = useCallback(async () => {
        try {
            // Use the unified endpoint
            const res = await fetch(`${API_BASE}/predictions/unified?limit=100`);
            if (res.ok) {
                const data = await res.json();

                if (data.success && data.data && data.data.predictions) {
                    const preds = data.data.predictions;

                    const idsSet = new Set<string>();
                    const predsMap = new Map<string, AIPrediction>();
                    const allPredsList: AIPrediction[] = [];

                    for (const pred of preds) {
                        // Map unified format to legacy format for backward compatibility
                        const predictionObj: AIPrediction = {
                            id: pred.id,
                            match_external_id: pred.match_id,
                            prediction_type: pred.prediction_type,
                            prediction_value: pred.prediction_value,
                            overall_confidence: pred.confidence || 0,
                            bot_name: pred.bot_name,
                            canonical_bot_name: pred.canonical_bot_name,
                            minute_at_prediction: pred.minute_at_prediction,
                            prediction_result: pred.result === 'won' ? 'winner' : pred.result === 'lost' ? 'loser' : 'pending',
                            created_at: pred.created_at,
                            league_name: pred.league_name,
                            home_team_name: pred.home_team_name,
                            away_team_name: pred.away_team_name,
                            score_at_prediction: pred.score_at_prediction,
                            status_id: pred.match_status,
                            // Enhanced fields
                            home_team_logo: pred.home_team_logo,
                            away_team_logo: pred.away_team_logo,
                            competition_name: pred.league_name, // Fallback/Alias
                            competition_logo: pred.competition_logo,
                            country_name: pred.country_name,
                            country_logo: pred.country_logo,

                            // Use live status from join if available
                            match_status_id: pred.live_match_status ?? pred.match_status,

                            // Use live scores from join
                            home_score_display: pred.home_score_display?.toString(),
                            away_score_display: pred.away_score_display?.toString(),

                            // Live minute
                            match_minute: pred.live_match_minute,
                            display_prediction: pred.display_prediction,
                            access_type: pred.access_type,
                            result: pred.result,
                            final_score: pred.final_score,
                        };

                        allPredsList.push(predictionObj);

                        if (pred.match_id) {
                            idsSet.add(pred.match_id);
                            predsMap.set(pred.match_id, predictionObj);
                        }
                    }

                    setMatchIds(idsSet);
                    setPredictions(predsMap);
                    setAllPredictions(allPredsList);
                }
            }
        } catch (error) {
            console.error('[AIPredictionsContext] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPredictions();

        // Refresh every 60 seconds
        const interval = setInterval(fetchPredictions, 60000);
        return () => clearInterval(interval);
    }, [fetchPredictions]);

    // Real-time updates
    useSocket({
        onScoreChange: (event) => {
            if (matchIds.has(event.matchId)) {
                setPredictions(prev => {
                    const next = new Map(prev);
                    const pred = next.get(event.matchId);
                    if (pred) {
                        next.set(event.matchId, {
                            ...pred,
                            home_score_display: event.homeScore.toString(),
                            away_score_display: event.awayScore.toString(),
                            // Also update legacy display field if used
                            display_prediction: pred.display_prediction // Keep as is
                        });
                    }
                    return next;
                });

                // Also update the list
                setAllPredictions(prev => prev.map(p => {
                    if (p.match_external_id === event.matchId) {
                        return {
                            ...p,
                            home_score_display: event.homeScore.toString(),
                            away_score_display: event.awayScore.toString()
                        };
                    }
                    return p;
                }));
            }
        },
        onMatchStateChange: (event) => {
            if (matchIds.has(event.matchId)) {
                setPredictions(prev => {
                    const next = new Map(prev);
                    const pred = next.get(event.matchId);
                    if (pred) {
                        next.set(event.matchId, {
                            ...pred,
                            match_status_id: event.statusId,
                            status_id: event.statusId
                        });
                    }
                    return next;
                });

                setAllPredictions(prev => prev.map(p => {
                    if (p.match_external_id === event.matchId) {
                        return {
                            ...p,
                            match_status_id: event.statusId,
                            status_id: event.statusId
                        };
                    }
                    return p;
                }));

                // If match ended (8), fetch fresh data after a short delay to get final results
                if (event.statusId === 8) {
                    setTimeout(fetchPredictions, 2000);
                }
            }
        }
    });

    return (
        <AIPredictionsContext.Provider value={{ matchIds, predictions, allPredictions, loading, refresh: fetchPredictions }}>
            {children}
        </AIPredictionsContext.Provider>
    );
}
