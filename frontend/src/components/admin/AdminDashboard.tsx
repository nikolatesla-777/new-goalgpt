/**
 * Admin Dashboard Page
 * Shows overall AI prediction statistics
 */

import { useEffect, useState } from 'react';
import './admin.css';

interface PredictionStats {
    predictions: {
        total: number;
        pending: number;
        matched: number;
        winners: number;
        losers: number;
        win_rate: string;
        avg_confidence: string;
    };
    requests: {
        total: number;
        successful: number;
        failed: number;
        success_rate: string;
    };
}

interface RecentPrediction {
    id: string;
    bot_name: string;
    home_team_name: string;
    away_team_name: string;
    score_at_prediction: string;
    minute_at_prediction: number;
    prediction_type: string;
    prediction_value: string;
    created_at: string;
    processed: boolean;
}

// API base URL - uses same domain in production
const API_BASE = import.meta.env.VITE_API_URL || '';

export function AdminDashboard() {
    const [stats, setStats] = useState<PredictionStats | null>(null);
    const [recentPredictions, setRecentPredictions] = useState<RecentPrediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [statsRes, predictionsRes] = await Promise.all([
                fetch(`${API_BASE}/api/predictions/stats`),
                fetch(`${API_BASE}/api/predictions/pending?limit=10`),
            ]);

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setStats(statsData.stats);
            }

            if (predictionsRes.ok) {
                const predictionsData = await predictionsRes.json();
                setRecentPredictions(predictionsData.predictions || []);
            }

            setError(null);
        } catch (err) {
            setError('Veriler yüklenirken hata oluştu');
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
        });
    };

    return (
        <>
            <header className="admin-header">
                <div>
                    <h1 className="admin-header-title">AI Predictions Dashboard</h1>
                    <p className="admin-header-subtitle">Yapay zeka tahminlerinin genel durumu</p>
                </div>
                <button className="admin-btn admin-btn-primary" onClick={fetchData}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                    </svg>
                    Yenile
                </button>
            </header>

            <div className="admin-content">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
                        <div className="admin-spinner" />
                    </div>
                ) : error ? (
                    <div className="admin-empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <h3>{error}</h3>
                        <p>Lütfen daha sonra tekrar deneyin</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="admin-stats-grid">
                            <div className="admin-stat-card">
                                <div className="admin-stat-card-header">
                                    <div className="admin-stat-icon teal">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="admin-stat-value">{stats?.predictions.total || 0}</div>
                                <div className="admin-stat-label">Toplam Tahmin</div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="admin-stat-card-header">
                                    <div className="admin-stat-icon amber">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="admin-stat-value">{stats?.predictions.pending || 0}</div>
                                <div className="admin-stat-label">Bekleyen</div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="admin-stat-card-header">
                                    <div className="admin-stat-icon green">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="admin-stat-value">{stats?.predictions.matched || 0}</div>
                                <div className="admin-stat-label">Eşleşen</div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="admin-stat-card-header">
                                    <div className="admin-stat-icon green">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                    </div>
                                    <span className="admin-stat-change positive">
                                        {stats?.predictions.win_rate || 'N/A'}
                                    </span>
                                </div>
                                <div className="admin-stat-value">{stats?.predictions.winners || 0}</div>
                                <div className="admin-stat-label">Kazanan</div>
                            </div>
                        </div>

                        {/* Request Stats */}
                        <div className="admin-stats-grid" style={{ marginBottom: '32px' }}>
                            <div className="admin-stat-card">
                                <div className="admin-stat-card-header">
                                    <div className="admin-stat-icon teal">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="admin-stat-value">{stats?.requests.total || 0}</div>
                                <div className="admin-stat-label">Toplam İstek</div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="admin-stat-card-header">
                                    <div className="admin-stat-icon green">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="admin-stat-change positive">
                                        {stats?.requests.success_rate || 'N/A'}
                                    </span>
                                </div>
                                <div className="admin-stat-value">{stats?.requests.successful || 0}</div>
                                <div className="admin-stat-label">Başarılı</div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="admin-stat-card-header">
                                    <div className="admin-stat-icon red">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="admin-stat-value">{stats?.requests.failed || 0}</div>
                                <div className="admin-stat-label">Başarısız</div>
                            </div>
                        </div>

                        {/* Recent Predictions Table */}
                        <div className="admin-table-container">
                            <div className="admin-table-header">
                                <h3 className="admin-table-title">Son Gelen Tahminler</h3>
                            </div>

                            {recentPredictions.length === 0 ? (
                                <div className="admin-empty-state">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                    </svg>
                                    <h3>Henüz tahmin yok</h3>
                                    <p>Dış yapay zekadan tahmin bekleniyor</p>
                                </div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Bot</th>
                                            <th>Maç</th>
                                            <th>Skor</th>
                                            <th>Dakika</th>
                                            <th>Tahmin</th>
                                            <th>Zaman</th>
                                            <th>Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentPredictions.map((pred) => (
                                            <tr key={pred.id}>
                                                <td>
                                                    <span className="admin-badge neutral">{pred.bot_name}</span>
                                                </td>
                                                <td style={{ fontWeight: 500 }}>
                                                    {pred.home_team_name} - {pred.away_team_name}
                                                </td>
                                                <td>{pred.score_at_prediction}</td>
                                                <td>{pred.minute_at_prediction}'</td>
                                                <td>
                                                    <span style={{ color: 'var(--admin-accent)', fontWeight: 500 }}>
                                                        {pred.prediction_type} {pred.prediction_value}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--admin-text-secondary)' }}>
                                                    {formatTime(pred.created_at)}
                                                </td>
                                                <td>
                                                    <span className={`admin-badge ${pred.processed ? 'success' : 'warning'}`}>
                                                        {pred.processed ? 'İşlendi' : 'Bekliyor'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
