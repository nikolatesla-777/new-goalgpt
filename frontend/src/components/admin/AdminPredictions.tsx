/**
 * Admin Predictions Page
 * Lists all AI predictions with filtering and search
 */

import { useEffect, useState } from 'react';
import './admin.css';

interface Prediction {
    id: string;
    external_id: string;
    bot_name: string;
    league_name: string;
    home_team_name: string;
    away_team_name: string;
    score_at_prediction: string;
    minute_at_prediction: number;
    prediction_type: string;
    prediction_value: string;
    processed: boolean;
    created_at: string;
    // From joined match data
    overall_confidence?: number;
    prediction_result?: string;
    match_external_id?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

type FilterType = 'all' | 'pending' | 'matched' | 'winners' | 'losers';

interface Stats {
    total: number;
    pending: number;
    matched: number;
    winners: number;
    losers: number;
    winRate: string;
}

export function AdminPredictions() {
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        fetchStats();
        fetchPredictions();
    }, [filter]);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/predictions/stats`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setStats({
                        total: data.stats.predictions.total || 0,
                        pending: data.stats.predictions.pending || 0,
                        matched: data.stats.predictions.matched || 0,
                        winners: data.stats.predictions.winners || 0,
                        losers: data.stats.predictions.losers || 0,
                        winRate: data.stats.predictions.win_rate || 'N/A'
                    });
                }
            }
        } catch (err) {
            console.error('Fetch stats error:', err);
        }
    };

    const fetchPredictions = async () => {
        setLoading(true);
        try {
            let endpoint = '/predictions/pending?limit=100';
            if (filter === 'matched' || filter === 'winners' || filter === 'losers') {
                endpoint = '/predictions/matched?limit=100';
            }

            const res = await fetch(`${API_BASE}${endpoint}`);
            if (res.ok) {
                const data = await res.json();
                let results = data.predictions || [];

                // Client-side filter for winners/losers
                if (filter === 'winners') {
                    results = results.filter((p: Prediction) => p.prediction_result === 'winner');
                } else if (filter === 'losers') {
                    results = results.filter((p: Prediction) => p.prediction_result === 'loser');
                }

                setPredictions(results);
            }
        } catch (err) {
            console.error('Fetch predictions error:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredPredictions = predictions.filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            p.home_team_name?.toLowerCase().includes(q) ||
            p.away_team_name?.toLowerCase().includes(q) ||
            p.bot_name?.toLowerCase().includes(q) ||
            p.league_name?.toLowerCase().includes(q)
        );
    });

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
        });
    };

    const getResultBadge = (prediction: Prediction) => {
        if (!prediction.processed) {
            return <span className="admin-badge warning">Bekliyor</span>;
        }
        if (prediction.prediction_result === 'winner') {
            return <span className="admin-badge success">Kazandı</span>;
        }
        if (prediction.prediction_result === 'loser') {
            return <span className="admin-badge error">Kaybetti</span>;
        }
        return <span className="admin-badge neutral">Eşleşti</span>;
    };

    const filters: { key: FilterType; label: string }[] = [
        { key: 'all', label: 'Tümü' },
        { key: 'pending', label: 'Bekleyen' },
        { key: 'matched', label: 'Eşleşen' },
        { key: 'winners', label: 'Kazanan' },
        { key: 'losers', label: 'Kaybeden' },
    ];

    return (
        <>
            <header className="admin-header">
                <div>
                    <h1 className="admin-header-title">AI Tahminleri</h1>
                    <p className="admin-header-subtitle">Dış yapay zekadan gelen tüm tahminler</p>
                </div>
                <button className="admin-btn admin-btn-primary" onClick={() => { fetchStats(); fetchPredictions(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                    </svg>
                    Yenile
                </button>
            </header>

            <div className="admin-content">
                {/* Stats Cards */}
                {stats && (
                    <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
                        <div className="admin-stat-card">
                            <div className="admin-stat-card-header">
                                <div className="admin-stat-icon blue">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="admin-stat-value">{stats.total}</div>
                            <div className="admin-stat-label">Toplam Tahmin</div>
                        </div>
                        <div className="admin-stat-card">
                            <div className="admin-stat-card-header">
                                <div className="admin-stat-icon yellow">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 6v6l4 2" />
                                        <circle cx="12" cy="12" r="10" />
                                    </svg>
                                </div>
                            </div>
                            <div className="admin-stat-value">{stats.pending}</div>
                            <div className="admin-stat-label">Bekleyen</div>
                        </div>
                        <div className="admin-stat-card">
                            <div className="admin-stat-card-header">
                                <div className="admin-stat-icon green">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="admin-stat-value">{stats.winners}</div>
                            <div className="admin-stat-label">Kazanan</div>
                        </div>
                        <div className="admin-stat-card">
                            <div className="admin-stat-card-header">
                                <div className="admin-stat-icon red">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                            </div>
                            <div className="admin-stat-value">{stats.losers}</div>
                            <div className="admin-stat-label">Kaybeden</div>
                        </div>
                        <div className="admin-stat-card">
                            <div className="admin-stat-card-header">
                                <div className="admin-stat-icon purple">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M16 8v8m-8-8v8M8 8h8a4 4 0 014 4 4 4 0 01-4 4H8a4 4 0 01-4-4 4 4 0 014-4z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="admin-stat-value">{stats.winRate}</div>
                            <div className="admin-stat-label">Kazanma Oranı</div>
                        </div>
                    </div>
                )}

                {/* Filters and Search */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <div className="admin-filter-pills">
                        {filters.map((f) => (
                            <button
                                key={f.key}
                                className={`admin-filter-pill ${filter === f.key ? 'active' : ''}`}
                                onClick={() => setFilter(f.key)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="admin-search">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Takım veya lig ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Predictions Table */}
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h3 className="admin-table-title">
                            {filteredPredictions.length} Tahmin
                        </h3>
                        <button className="admin-btn admin-btn-secondary" onClick={fetchPredictions}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                <path d="M21 3v5h-5" />
                            </svg>
                            Yenile
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
                            <div className="admin-spinner" />
                        </div>
                    ) : filteredPredictions.length === 0 ? (
                        <div className="admin-empty-state">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                            <h3>Tahmin bulunamadı</h3>
                            <p>Bu filtreye uygun tahmin yok</p>
                        </div>
                    ) : (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Bot</th>
                                    <th>Lig</th>
                                    <th>Maç</th>
                                    <th>Skor</th>
                                    <th>Dk</th>
                                    <th>Tahmin</th>
                                    <th>Güven</th>
                                    <th>Zaman</th>
                                    <th>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPredictions.map((pred) => (
                                    <tr key={pred.id}>
                                        <td>
                                            <span className="admin-badge neutral">{pred.bot_name}</span>
                                        </td>
                                        <td style={{ color: 'var(--admin-text-secondary)', fontSize: '13px' }}>
                                            {pred.league_name || '-'}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>
                                            {pred.home_team_name} - {pred.away_team_name}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{pred.score_at_prediction}</td>
                                        <td>{pred.minute_at_prediction}'</td>
                                        <td>
                                            <span style={{ color: 'var(--admin-accent)', fontWeight: 600 }}>
                                                {pred.prediction_type} {pred.prediction_value}
                                            </span>
                                        </td>
                                        <td>
                                            {pred.overall_confidence
                                                ? `${(pred.overall_confidence * 100).toFixed(0)}%`
                                                : '-'}
                                        </td>
                                        <td style={{ color: 'var(--admin-text-secondary)', fontSize: '13px' }}>
                                            {formatTime(pred.created_at)}
                                        </td>
                                        <td>{getResultBadge(pred)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
}
