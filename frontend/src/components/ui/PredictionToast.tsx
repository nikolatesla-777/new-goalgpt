/**
 * PredictionToast - Real-time notification for prediction settlements
 *
 * Shows a toast notification when AI predictions are settled (won/lost)
 * via WebSocket PREDICTION_SETTLED events.
 */

import { useEffect, useState } from 'react';
import { Trophy, WarningCircle, X } from '@phosphor-icons/react';
import { useAIPredictions, type PredictionSettledEvent } from '../../context/AIPredictionsContext';

interface ToastItem {
    id: string;
    event: PredictionSettledEvent;
    visible: boolean;
}

export function PredictionToast() {
    const { lastSettlement } = useAIPredictions();
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    // Add new toast when settlement occurs
    useEffect(() => {
        if (lastSettlement) {
            const toastId = `${lastSettlement.predictionId}-${lastSettlement.timestamp}`;

            // Avoid duplicate toasts
            setToasts(prev => {
                if (prev.some(t => t.id === toastId)) return prev;

                const newToast: ToastItem = {
                    id: toastId,
                    event: lastSettlement,
                    visible: true
                };

                // Keep max 3 toasts
                const updated = [newToast, ...prev].slice(0, 3);
                return updated;
            });

            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                setToasts(prev => prev.map(t =>
                    t.id === toastId ? { ...t, visible: false } : t
                ));
            }, 5000);

            // Remove from DOM after animation
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== toastId));
            }, 5500);
        }
    }, [lastSettlement]);

    const dismissToast = (id: string) => {
        setToasts(prev => prev.map(t =>
            t.id === id ? { ...t, visible: false } : t
        ));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    };

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((toast, index) => {
                const isWon = toast.event.result === 'won';

                return (
                    <div
                        key={toast.id}
                        style={{
                            transform: toast.visible ? 'translateX(0)' : 'translateX(120%)',
                            opacity: toast.visible ? 1 : 0,
                            transitionDelay: `${index * 50}ms`
                        }}
                        className={`
                            flex items-center gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-md
                            transition-all duration-300 ease-out min-w-[300px] max-w-[400px]
                            ${isWon
                                ? 'bg-green-500/90 border-green-400/50 text-white'
                                : 'bg-red-500/90 border-red-400/50 text-white'
                            }
                        `}
                    >
                        {/* Icon */}
                        <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                            ${isWon ? 'bg-white/20' : 'bg-white/20'}
                        `}>
                            {isWon ? (
                                <Trophy size={24} weight="fill" className="text-white" />
                            ) : (
                                <WarningCircle size={24} weight="fill" className="text-white" />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm mb-0.5">
                                {isWon ? 'Tahmin Kazandi!' : 'Tahmin Kaybetti'}
                            </div>
                            <div className="text-xs opacity-90 truncate">
                                {toast.event.botName}: {toast.event.prediction}
                            </div>
                            <div className="text-xs opacity-75 truncate">
                                {toast.event.homeTeam} vs {toast.event.awayTeam}
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => dismissToast(toast.id)}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
