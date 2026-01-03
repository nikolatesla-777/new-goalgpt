/**
 * Admin Bot Detail Page
 * Shows predictions for a specific bot
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    match_external_id: string | null;
    overall_confidence: number | null;
    prediction_result: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function AdminBotDetail() {
    const { botName } = useParams<{ botName: string }>();
    const navigate = useNavigate();
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<{ total: number; pending: number; matched: number; winners: number; losers: number }>({
        total: 0, pending: 0, matched: 0, winners: 0, losers: 0
    });

    useEffect(() => {
        if (botName) {
            fetchPredictions();
        }
    }, [botName]);

    const fetchPredictions = async () => {
        if (!botName) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/predictions/bot-history?botName=${encodeURIComponent(botName)}&limit=100`);
            if (res.ok) {
                const data = await res.json();
                const preds = data.predictions || [];
                setPredictions(preds);

                // Calculate stats
                const pending = preds.filter((p: Prediction) => !p.processed).length;
                const matched = preds.filter((p: Prediction) => p.processed).length;
                const winners = preds.filter((p: Prediction) => p.prediction_result === 'winner').length;
                const losers = preds.filter((p: Prediction) => p.prediction_result === 'loser').length;

                setStats({
                    total: preds.length,
                    pending,
                    matched,
                    winners,
                    losers
                });
            }
        } catch (err) {
            console.error('Fetch predictions error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (prediction: Prediction) => {
        if (prediction.prediction_result === 'winner') {
            return <span className="admin-badge success">Kazandı</span>;
        }
        if (prediction.prediction_result === 'loser') {
            return <span className="admin-badge error">Kaybetti</span>;
        }
        if (prediction.processed) {
            return <span className="admin-badge info">Eşleşti</span>;
        }
        return <span className="admin-badge warning">Bekliyor</span>;
    };

    const getConfidenceBadge = (confidence: number | null) => {
        if (!confidence) return null;
        const percent = Math.round(confidence * 100);
        const colorClass = percent >= 80 ? 'success' : percent >= 60 ? 'warning' : 'error';
        return <span className={`admin-badge ${colorClass}`}>{percent}%</span>;
    };

    return (
        <>
            <header className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        className="admin-btn admin-btn-secondary"
                        onClick={() => navigate('/admin/bots')}
                        style={{ padding: '8px 12px' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="admin-header-title">{botName}</h1>
                        <p className="admin-header-subtitle">Bot tahmin geçmişi</p>
                    </div>
                </div>
                <button className="admin-btn admin-btn-primary" onClick={fetchPredictions}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                    </svg>
                    Yenile
                </button>
            </header>

            <div className="admin-content">
                {/* Stats Cards */}
                <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
                    <div className="admin-stat-card">
                        <div className="admin-stat-card-header">
                            <div className="admin-stat-icon blue">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
                                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="admin-stat-value">{stats.pending}</div>
                        <div className="admin-stat-label">Bekleyen</div>
                    </div>
                    <div className="admin-stat-card">
                        <div className="admin-stat-card-header">
                            <div className="admin-stat-icon teal">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </div>
                        </div>
                        <div className="admin-stat-value">{stats.matched}</div>
                        <div className="admin-stat-label">Eşleşen</div>
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
                </div>

                {/* Predictions List */}
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h3 className="admin-table-title">{predictions.length} Tahmin</h3>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
                            <div className="admin-spinner" />
                        </div>
                    ) : predictions.length === 0 ? (
                        <div className="admin-empty-state">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h3>Tahmin bulunamadı</h3>
                            <p>Bu bot için henüz tahmin geçmişi yok</p>
                        </div>
                    ) : (
                        <div className="admin-logs-list">
                            {predictions.map((pred) => (
                                <div key={pred.id} className={`admin-log-card ${pred.processed ? 'success' : ''}`}>
                                    <div className="admin-log-card-header" style={{ cursor: 'default' }}>
                                        <div className="admin-log-main">
                                            <div className="admin-log-status">
                                                {getStatusBadge(pred)}
                                                {getConfidenceBadge(pred.overall_confidence)}
                                            </div>
                                            <div className="admin-log-info">
                                                <div className="admin-log-endpoint" style={{ color: 'var(--admin-text-primary)', fontFamily: 'inherit' }}>
                                                    {pred.home_team_name} vs {pred.away_team_name}
                                                </div>
                                                <div className="admin-log-meta">
                                                    <span>{pred.league_name || 'Bilinmeyen Lig'}</span>
                                                    <span className="admin-log-separator">•</span>
                                                    <span>{pred.score_at_prediction} ({pred.minute_at_prediction}')</span>
                                                    <span className="admin-log-separator">•</span>
                                                    <span className="admin-log-time">{formatTime(pred.created_at)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="admin-log-result">
                                            <span className="admin-badge info" style={{ fontWeight: 600 }}>
                                                {pred.prediction_type || pred.prediction_value || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
