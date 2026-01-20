import { useState, useMemo, useEffect } from 'react';
import { CaretLeft, ChartLineUp, Target, Trophy, Clock, X, ListBullets, Star } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { AIScanningWidget } from './AIScanningWidget';
import { TopPicksSlider } from './TopPicksSlider';
import { PredictionCard } from './PredictionCard';
import { useAIPredictions } from '../../context/AIPredictionsContext';
import { useBotStats, type BotStats } from '../../hooks/useBotStats';

type FeedTab = 'all' | 'favorites' | 'active' | 'won' | 'lost';
type DateFilter = 'today' | 'yesterday' | 'month';

export function AIPredictionsPage() {
    const navigate = useNavigate();
    const { predictions: contextPredictions, loading, lastSettlement, isConnected } = useAIPredictions();
    const { stats: botStatsResponse } = useBotStats(); // Fetch bot stats

    // Create a fast lookup map for bot stats
    const botStatsMap = useMemo(() => {
        if (!botStatsResponse) return {};
        // Normalize keys to support case-insensitive lookup if needed, though backend should be consistent
        return botStatsResponse.bots.reduce((acc, bot) => {
            acc[bot.bot_name] = bot;
            // Also store normalized versions just in case
            acc[bot.bot_name.toLowerCase()] = bot;
            return acc;
        }, {} as Record<string, BotStats>);
    }, [botStatsResponse]);

    // Default: Tümü tab + Bugün filter
    const [dateFilter, setDateFilter] = useState<DateFilter>('today');
    const [feedTab, setFeedTab] = useState<FeedTab>('all');

    // Favorites State (Persisted)
    const [favorites, setFavorites] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('ai_favorites');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const toggleFavorite = (id: string) => {
        setFavorites(prev => {
            const newFavs = prev.includes(id)
                ? prev.filter(fid => fid !== id)
                : [...prev, id];
            localStorage.setItem('ai_favorites', JSON.stringify(newFavs));
            return newFavs;
        });
    };

    // Sort by date desc
    const allPredictions = useMemo(() => {
        return [...(contextPredictions || [])].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }, [contextPredictions]);

    // Filter by date - CRITICAL: Use TSI timezone (UTC+3)
    const filteredByDate = useMemo(() => {
        // CRITICAL FIX: Calculate TSI boundaries correctly
        // TSI is UTC+3, so TSI midnight = UTC 21:00 previous day
        const tsiOffsetMs = 3 * 60 * 60 * 1000; // 3 hours in ms
        const tsiNowMs = Date.now() + tsiOffsetMs;
        const tsiNow = new Date(tsiNowMs);

        // Get TSI date components
        const tsiYear = tsiNow.getUTCFullYear();
        const tsiMonth = tsiNow.getUTCMonth();
        const tsiDate = tsiNow.getUTCDate();

        // Calculate TSI midnight boundaries in UTC
        // Example: TSI 2026-01-20 00:00 = UTC 2026-01-19 21:00
        const today = new Date(Date.UTC(tsiYear, tsiMonth, tsiDate) - tsiOffsetMs);
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const monthStart = new Date(Date.UTC(tsiYear, tsiMonth, 1) - tsiOffsetMs);

        return allPredictions.filter(p => {
            const predDate = new Date(p.created_at);
            if (dateFilter === 'today') {
                return predDate >= today;
            } else if (dateFilter === 'yesterday') {
                return predDate >= yesterday && predDate < today;
            } else {
                return predDate >= monthStart;
            }
        });
    }, [allPredictions, dateFilter]);

    // Calculate Stats based on date-filtered predictions
    const activePredictions = filteredByDate.filter(p => !p.result || p.result === 'pending');
    const wonPredictions = filteredByDate.filter(p => p.result === 'won');
    const lostPredictions = filteredByDate.filter(p => p.result === 'lost');
    const favoritePredictions = filteredByDate.filter(p => favorites.includes(p.id));

    const totalPredictions = filteredByDate.length;
    const wins = wonPredictions.length;
    const losses = lostPredictions.length;
    const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';

    // Filter by feed tab (on top of date filter)
    const displayedPredictions = useMemo(() => {
        switch (feedTab) {
            case 'favorites':
                return favoritePredictions;
            case 'active':
                return activePredictions;
            case 'won':
                return wonPredictions;
            case 'lost':
                return lostPredictions;
            case 'all':
            default:
                return filteredByDate;
        }
    }, [feedTab, filteredByDate, activePredictions, wonPredictions, lostPredictions, favoritePredictions]);

    // Get empty message based on tab
    const getEmptyMessage = () => {
        const dateText = dateFilter === 'today' ? 'bugün' : dateFilter === 'yesterday' ? 'dün' : 'bu ay';
        switch (feedTab) {
            case 'favorites':
                return `${dateText.charAt(0).toUpperCase() + dateText.slice(1)} için favori eklemediniz.`;
            case 'active':
                return `${dateText.charAt(0).toUpperCase() + dateText.slice(1)} için aktif tahmin bulunmuyor.`;
            case 'won':
                return `${dateText.charAt(0).toUpperCase() + dateText.slice(1)} için kazanan tahmin bulunmuyor.`;
            case 'lost':
                return `${dateText.charAt(0).toUpperCase() + dateText.slice(1)} için kaybeden tahmin bulunmuyor.`;
            default:
                return `${dateText.charAt(0).toUpperCase() + dateText.slice(1)} için tahmin bulunmuyor.`;
        }
    };

    // Tab configuration (5 Tabs now)
    const tabs: { key: FeedTab; label: string; icon: React.ReactNode; count: number }[] = [
        { key: 'all', label: 'Tümü', icon: <ListBullets size={16} weight="bold" />, count: filteredByDate.length },
        { key: 'favorites', label: 'Favorilerim', icon: <Star size={16} weight="fill" />, count: favoritePredictions.length },
        { key: 'active', label: 'Aktif', icon: <Clock size={16} weight="bold" />, count: activePredictions.length },
        { key: 'won', label: 'Kazandı', icon: <Trophy size={16} weight="fill" />, count: wonPredictions.length },
        { key: 'lost', label: 'Kaybetti', icon: <X size={16} weight="bold" />, count: lostPredictions.length },
    ];

    // Toast notifications for settlements
    useEffect(() => {
        if (lastSettlement) {
            const isWin = lastSettlement.result === 'won';
            const emoji = isWin ? '🏆' : '😔';
            const title = isWin ? 'Kazandınız!' : 'Kaybettiniz';

            toast.custom((t) => (
                <div
                    className={`${t.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-[#1A1A1A] shadow-lg rounded-2xl pointer-events-auto flex border ${isWin ? 'border-green-500/30' : 'border-red-500/30'
                        }`}
                >
                    <div className="flex-1 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <span className="text-2xl">{emoji}</span>
                            </div>
                            <div className="ml-3 flex-1">
                                <p className={`text-sm font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                                    {title}
                                </p>
                                <p className="mt-1 text-xs text-gray-400">
                                    <span className="font-semibold text-white">{lastSettlement.botName}</span>
                                    {' · '}
                                    {lastSettlement.prediction}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    {lastSettlement.homeTeam} vs {lastSettlement.awayTeam}
                                    {lastSettlement.finalScore && ` (${lastSettlement.finalScore})`}
                                </p>
                            </div>
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="ml-4 flex-shrink-0 text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={16} weight="bold" />
                            </button>
                        </div>
                    </div>
                </div>
            ), {
                duration: isWin ? 5000 : 3000,
                position: 'top-right',
            });
        }
    }, [lastSettlement]);

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white pb-20">
            {/* Toast Container */}
            <Toaster
                position="top-right"
                toastOptions={{
                    className: '',
                    style: {
                        background: 'transparent',
                        boxShadow: 'none',
                    },
                }}
            />

            {/* Connection Status Banner */}
            {!isConnected && (
                <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50 text-sm font-bold animate-pulse">
                    ⚠️ Bağlantı kesildi - Yeniden bağlanılıyor...
                </div>
            )}

            {/* Header */}
            <header className={`sticky ${!isConnected ? 'top-[36px]' : 'top-0'} z-30 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 transition-all`}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                        <CaretLeft size={24} className="text-gray-400" />
                    </button>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        Yapay Zeka
                    </h1>
                    {isConnected && (
                        <div className="ml-auto flex items-center gap-2 text-xs text-green-500">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="font-semibold">Canlı</span>
                        </div>
                    )}
                </div>
            </header>

            <div className="p-4 max-w-lg mx-auto">
                {/* Scanning Widget */}
                <AIScanningWidget />

                {/* Hot Picks Slider */}
                <TopPicksSlider predictions={contextPredictions || []} botStatsMap={botStatsMap} />

                {/* Win Rate Stats Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-lg">Win Rate</h2>
                        <div className="flex bg-[#1A1A1A] rounded-full p-1 border border-white/5">
                            {(['today', 'yesterday', 'month'] as const).map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setDateFilter(period)}
                                    className={`
                                        px-3 py-1 rounded-full text-xs font-bold transition-all
                                        ${dateFilter === period
                                            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
                                            : 'text-gray-500 hover:text-gray-300'}
                                    `}
                                >
                                    {period === 'today' ? 'Bugün' : period === 'yesterday' ? 'Dün' : 'Bu Ay'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {/* Total Match Card */}
                        <div className="bg-[#1A1A1A] p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center h-24">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center mb-2 shadow-lg shadow-green-500/20">
                                <Target size={16} weight="bold" className="text-black" />
                            </div>
                            <span className="text-xl font-black">{totalPredictions}</span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">Toplam Maç</span>
                        </div>

                        {/* Winning Card */}
                        <div className="bg-[#1A1A1A] p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center h-24 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors" />
                            <div className="w-8 h-8 rounded-full bg-[#111] border border-green-500/30 flex items-center justify-center mb-2 text-green-500 relative z-10">
                                <Trophy size={16} weight="fill" />
                            </div>
                            <span className="text-xl font-black text-green-400 relative z-10">{wins}</span>
                            <span className="text-[10px] text-green-500/70 font-bold uppercase relative z-10">Kazanan</span>
                        </div>

                        {/* Ratio Card */}
                        <div className="bg-[#1A1A1A] p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center h-24">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-2 text-blue-500">
                                <ChartLineUp size={16} weight="bold" />
                            </div>
                            <span className="text-xl font-black text-white">{winRate}%</span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">Başarı</span>
                        </div>
                    </div>
                </div>

                {/* Feed Tabs - 5 Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFeedTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${feedTab === tab.key
                                ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
                                : 'bg-[#1A1A1A] text-gray-400 border border-white/5 hover:bg-[#222]'
                                }`}
                        >
                            {tab.icon}
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Feed */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-10">
                            <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-500 text-sm">Veriler yükleniyor...</p>
                        </div>
                    ) : displayedPredictions.length > 0 ? (
                        displayedPredictions.map((pred) => (
                            <PredictionCard
                                key={pred.id}
                                prediction={pred}
                                isVip={pred.access_type === 'VIP'}
                                isFavorite={favorites.includes(pred.id)}
                                onToggleFavorite={() => toggleFavorite(pred.id)}
                                botStats={botStatsMap[pred.canonical_bot_name || ''] || botStatsMap[(pred.canonical_bot_name || '').toLowerCase()]}
                            />
                        ))
                    ) : (
                        <div className="text-center py-10 opacity-50">
                            <p>{getEmptyMessage()}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
