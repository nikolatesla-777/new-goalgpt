/**
 * Admin Predictions Page - Premium Design
 * Matching AdminBots quality
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Robot, Trophy, XCircle, Clock, TrendUp, CheckCircle, Link as LinkIcon, LinkBreak } from '@phosphor-icons/react';
import { useSocket } from '../../hooks/useSocket';
import './admin.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface UnifiedPrediction {
    id: string;
    external_id: string;
    canonical_bot_name: string;
    league_name: string;
    home_team_name: string;
    away_team_name: string;
    home_team_logo: string | null;
    away_team_logo: string | null;
    score_at_prediction: string;
    minute_at_prediction: number;
    prediction: string;
    prediction_threshold: number;
    match_id: string | null;
    result: 'pending' | 'won' | 'lost' | 'cancelled';
    final_score: string | null;
    result_reason: string | null;
    access_type: 'VIP' | 'FREE';
    source: string;
    created_at: string;
    country_name?: string;
    country_logo?: string;
    competition_name?: string;
    competition_logo?: string;
    live_match_status?: number;
    live_match_minute?: number;
    home_score_display?: number;
    away_score_display?: number;
    ht_home_score?: number;
    ht_away_score?: number;
}

interface PredictionStats {
    total: number;
    pending: number;
    matched: number;
    won: number;
    lost: number;
    winRate: string;
}

interface BotStat {
    name: string;
    displayName: string;
    total: number;
    pending: number;
    won: number;
    lost: number;
    winRate: string;
}

type FilterType = 'all' | 'pending' | 'won' | 'lost';

export function AdminPredictions() {
    const navigate = useNavigate();
    const [predictions, setPredictions] = useState<UnifiedPrediction[]>([]);
    const [stats, setStats] = useState<PredictionStats | null>(null);
    const [bots, setBots] = useState<BotStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== 'all') {
                params.set('status', filter);
            }
            params.set('limit', '100');

            const response = await fetch(`${API_BASE}/predictions/unified?${params.toString()}`);

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    setPredictions(data.data.predictions || []);
                    setStats(data.data.stats || null);
                    setBots(data.data.bots || []);
                }
            }
        } catch (err) {
            console.error('Fetch predictions error:', err);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredPredictions = predictions.filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            p.home_team_name?.toLowerCase().includes(q) ||
            p.away_team_name?.toLowerCase().includes(q) ||
            p.canonical_bot_name?.toLowerCase().includes(q) ||
            p.league_name?.toLowerCase().includes(q)
        );
    });

    // Optimized WebSocket handling: only refetch on score/status changes
    useSocket({
        onMinuteUpdate: (event) => {
            // Optimistic minute update - no API refetch needed
            setPredictions(prev => prev.map(p =>
                p.match_id === event.matchId
                    ? { ...p, live_match_minute: event.minute }
                    : p
            ));
        },
        onScoreChange: () => fetchData(), // Score changed - refetch for accuracy
        onMatchStateChange: () => fetchData(), // Status changed - refetch for accuracy
    });

    // Toggle access type
    const toggleAccessType = async (predictionId: string, currentType: 'VIP' | 'FREE') => {
        const newType = currentType === 'VIP' ? 'FREE' : 'VIP';
        try {
            const res = await fetch(`${API_BASE}/predictions/${predictionId}/access`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_type: newType })
            });
            if (res.ok) {
                setPredictions(prev => prev.map(p =>
                    p.id === predictionId ? { ...p, access_type: newType } : p
                ));
            }
        } catch (err) {
            console.error('Toggle access error:', err);
        }
    };

    // Get bot win rate
    const getBotWinRate = (botName: string) => {
        const bot = bots.find(b => b.name === botName || b.displayName === botName);
        return bot ? bot.winRate : null;
    };

    // Format time only
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Get live score display with HT-FT
    const getLiveScoreDisplay = (pred: UnifiedPrediction) => {
        const status = pred.live_match_status || 0;
        const minute = pred.live_match_minute ?? 0;
        const homeScore = pred.home_score_display ?? 0;
        const awayScore = pred.away_score_display ?? 0;
        const htHome = pred.ht_home_score ?? 0;
        const htAway = pred.ht_away_score ?? 0;

        // Match finished - show HT and FT
        if (status >= 8) {
            return {
                type: 'finished',
                status: 'MS',
                score: `${homeScore}-${awayScore}`,
                htScore: htHome > 0 || htAway > 0 ? `(${htHome}-${htAway})` : null
            };
        }

        // Halftime
        if (status === 3) {
            return {
                type: 'halftime',
                status: 'DY',
                score: `${homeScore}-${awayScore}`,
                htScore: null
            };
        }

        // Live
        if (status >= 2 && status < 8) {
            return {
                type: 'live',
                status: `${minute}'`,
                score: `${homeScore}-${awayScore}`,
                htScore: status >= 4 && (htHome > 0 || htAway > 0) ? `(${htHome}-${htAway})` : null
            };
        }

        // Not started
        if (status === 1) {
            return { type: 'notstarted', status: '-', score: '-', htScore: null };
        }

        return { type: 'unknown', status: '-', score: '-', htScore: null };
    };

    const filters: { key: FilterType; label: string; count?: number }[] = [
        { key: 'all', label: 'Tümü', count: stats?.total },
        { key: 'pending', label: 'Bekleyen', count: stats?.pending },
        { key: 'won', label: 'Kazanan', count: stats?.won },
        { key: 'lost', label: 'Kaybeden', count: stats?.lost },
    ];

    return (
        <div className="min-h-screen bg-[#090909] text-white p-8">
            <div className="max-w-[1800px] mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">AI Tahminleri</h1>
                        <p className="text-gray-400">Tüm bot tahminleri ve performans takibi</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-2"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                        </svg>
                        Yenile
                    </button>
                </header>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-12">
                        <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/20 transition-colors">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <TrendUp size={64} weight="duotone" className="text-blue-500" />
                            </div>
                            <div className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Toplam</div>
                            <div className="text-3xl font-black text-white">{stats.total}</div>
                        </div>

                        <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-yellow-500/20 transition-colors">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Clock size={64} weight="duotone" className="text-yellow-500" />
                            </div>
                            <div className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Bekleyen</div>
                            <div className="text-3xl font-black text-yellow-500">{stats.pending}</div>
                        </div>

                        <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-green-500/20 transition-colors">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Trophy size={64} weight="duotone" className="text-green-500" />
                            </div>
                            <div className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Kazanan</div>
                            <div className="text-3xl font-black text-green-500">{stats.won}</div>
                        </div>

                        <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-red-500/20 transition-colors">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <XCircle size={64} weight="duotone" className="text-red-500" />
                            </div>
                            <div className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Kaybeden</div>
                            <div className="text-3xl font-black text-red-500">{stats.lost}</div>
                        </div>

                        <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/20 transition-colors">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <CheckCircle size={64} weight="duotone" className="text-purple-500" />
                            </div>
                            <div className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Basari</div>
                            <div className="text-3xl font-black text-purple-500">{stats.winRate}</div>
                        </div>
                    </div>
                )}

                {/* Filters & Search */}
                <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                    <div className="flex gap-2">
                        {filters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                                    filter === f.key
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                                }`}
                            >
                                {f.label}
                                {f.count !== undefined && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        filter === f.key ? 'bg-white/20' : 'bg-white/10'
                                    }`}>
                                        {f.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 bg-[#151515] border border-white/10 rounded-xl px-4 py-2.5 min-w-[300px]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Takım, bot veya lig ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none outline-none text-white text-sm flex-1 placeholder:text-gray-500"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 border-3 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                            <span className="text-gray-400">Tahminler yukleniyor...</span>
                        </div>
                    ) : filteredPredictions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Robot size={64} weight="duotone" className="text-gray-600" />
                            <h3 className="text-xl font-bold text-white">Tahmin Bulunamadi</h3>
                            <p className="text-gray-500">Bu filtreye uygun tahmin yok</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-black/40">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ulke</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lig</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bot</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[220px]">Takimlar</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Paylasim Ani</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tahmin</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Canli Skor</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Sonuc</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Erisim</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Saat</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Eslesme</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredPredictions.map((pred) => {
                                        const liveScore = getLiveScoreDisplay(pred);
                                        const botWinRate = getBotWinRate(pred.canonical_bot_name);

                                        return (
                                            <tr
                                                key={pred.id}
                                                className={`hover:bg-white/[0.02] transition-colors ${
                                                    pred.result === 'won' ? 'bg-green-500/[0.03]' :
                                                    pred.result === 'lost' ? 'bg-red-500/[0.03]' : ''
                                                } ${pred.match_id ? 'cursor-pointer' : ''}`}
                                                onClick={() => pred.match_id && navigate(`/match/${pred.match_id}`)}
                                            >
                                                {/* Ulke */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {pred.country_logo ? (
                                                            <img
                                                                src={pred.country_logo}
                                                                alt=""
                                                                className="w-5 h-4 object-cover rounded-sm shadow"
                                                            />
                                                        ) : (
                                                            <span className="text-gray-600 text-sm">🌍</span>
                                                        )}
                                                        <span className="text-xs text-gray-400 truncate max-w-[80px]">
                                                            {pred.country_name || '-'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Lig */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {pred.competition_logo && (
                                                            <img src={pred.competition_logo} alt="" className="w-4 h-4 object-contain" />
                                                        )}
                                                        <span className="text-sm text-gray-300 truncate max-w-[120px]">
                                                            {pred.league_name || pred.competition_name || '-'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Bot */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-white">{pred.canonical_bot_name}</span>
                                                        {botWinRate && (
                                                            <span className="text-xs text-green-500 font-medium">{botWinRate}</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Takimlar */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                            {pred.home_team_logo && (
                                                                <img src={pred.home_team_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                                                            )}
                                                            <span className="text-sm text-white truncate">{pred.home_team_name}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-600 px-1">vs</span>
                                                        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                                            <span className="text-sm text-white truncate">{pred.away_team_name}</span>
                                                            {pred.away_team_logo && (
                                                                <img src={pred.away_team_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Paylasim Ani */}
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xs text-gray-500">{pred.minute_at_prediction}'</span>
                                                        <span className="text-sm font-bold text-white font-mono">{pred.score_at_prediction || '0-0'}</span>
                                                    </div>
                                                </td>

                                                {/* Tahmin */}
                                                <td className="px-4 py-3">
                                                    <span className="inline-block px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-xs font-bold text-white whitespace-nowrap">
                                                        {pred.prediction}
                                                    </span>
                                                </td>

                                                {/* Canli Skor */}
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-xs font-semibold ${
                                                            liveScore.type === 'live' ? 'text-green-500' :
                                                            liveScore.type === 'halftime' ? 'text-yellow-500' :
                                                            liveScore.type === 'finished' ? 'text-red-500' :
                                                            'text-gray-500'
                                                        }`}>
                                                            {liveScore.status}
                                                        </span>
                                                        <span className="text-sm font-bold text-white font-mono">{liveScore.score}</span>
                                                        {liveScore.htScore && (
                                                            <span className="text-[10px] text-gray-500">HT: {liveScore.htScore}</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Sonuc */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                        pred.result === 'won' ? 'bg-green-500/20 text-green-400' :
                                                        pred.result === 'lost' ? 'bg-red-500/20 text-red-400' :
                                                        pred.result === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                        {pred.result === 'won' && <CheckCircle size={12} weight="fill" />}
                                                        {pred.result === 'lost' && <XCircle size={12} weight="fill" />}
                                                        {pred.result === 'pending' && <Clock size={12} weight="fill" />}
                                                        {pred.result === 'won' ? 'KAZANDI' :
                                                         pred.result === 'lost' ? 'KAYBETTI' :
                                                         pred.result === 'pending' ? 'BEKLIYOR' : 'IPTAL'}
                                                    </span>
                                                </td>

                                                {/* Erisim - Toggle */}
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleAccessType(pred.id, pred.access_type);
                                                        }}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105 ${
                                                            pred.access_type === 'VIP'
                                                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20'
                                                                : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                                        }`}
                                                    >
                                                        {pred.access_type}
                                                    </button>
                                                </td>

                                                {/* Saat */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-xs text-gray-500 font-mono">
                                                        {formatTime(pred.created_at)}
                                                    </span>
                                                </td>

                                                {/* Eslesme */}
                                                <td className="px-4 py-3 text-center">
                                                    {pred.match_id ? (
                                                        <div className="flex items-center justify-center gap-1 text-green-500">
                                                            <LinkIcon size={14} weight="bold" />
                                                            <span className="text-xs font-semibold">EVET</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1 text-red-500">
                                                            <LinkBreak size={14} weight="bold" />
                                                            <span className="text-xs font-semibold">HAYIR</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
