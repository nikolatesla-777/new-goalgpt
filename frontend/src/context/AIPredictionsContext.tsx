/**
 * AI Predictions Context
 * Provides matched AI prediction data to child components
 */

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface AIPrediction {
    id: string;
    match_external_id: string | null;
    prediction_type: string;
    prediction_value: string;
    overall_confidence: number;
    bot_name?: string;
    minute_at_prediction?: number;
    prediction_result?: 'pending' | 'winner' | 'loser';
}

interface AIPredictionsContextType {
    matchIds: Set<string>;
    predictions: Map<string, AIPrediction>;
    loading: boolean;
    refresh: () => void;
}

const AIPredictionsContext = createContext<AIPredictionsContextType>({
    matchIds: new Set(),
    predictions: new Map(),
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
    const [loading, setLoading] = useState(true);

    const fetchPredictions = async () => {
        try {
            const res = await fetch(`${API_BASE}/predictions/matched?limit=100`);
            if (res.ok) {
                const data = await res.json();
                const preds = data.predictions || [];

                const idsSet = new Set<string>();
                const predsMap = new Map<string, AIPrediction>();

                for (const pred of preds) {
                    if (pred.match_external_id) {
                        idsSet.add(pred.match_external_id);
                        predsMap.set(pred.match_external_id, {
                            id: pred.id,
                            match_external_id: pred.match_external_id,
                            prediction_type: pred.prediction_type,
                            prediction_value: pred.prediction_value,
                            overall_confidence: pred.overall_confidence,
                            bot_name: pred.bot_name,
                            minute_at_prediction: pred.minute_at_prediction,
                            prediction_result: pred.prediction_result,
                        });
                    }
                }

                setMatchIds(idsSet);
                setPredictions(predsMap);
            }
        } catch (error) {
            console.error('[AIPredictionsContext] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPredictions();

        // Refresh every 60 seconds
        const interval = setInterval(fetchPredictions, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <AIPredictionsContext.Provider value={{ matchIds, predictions, loading, refresh: fetchPredictions }}>
            {children}
        </AIPredictionsContext.Provider>
    );
}
