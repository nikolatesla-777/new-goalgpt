/**
 * Admin Predictions Page
 * 
 * Lists all AI predictions with filtering and search.
 * Uses unified prediction context for centralized data management.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin.css';
import { useSocket } from '../../hooks/useSocket';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Types matching unified backend response
interface UnifiedPrediction {
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
    // Enhanced Data
    country_name?: string;
    country_logo?: string;
    live_match_status?: number;
    live_match_minute?: number;
    home_score_display?: number;
    away_score_display?: number;
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

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

type FilterType = 'all' | 'pending' | 'matched' | 'won' | 'lost';

export function AdminPredictions() {
    const navigate = useNavigate();

    // State
    const [predictions, setPredictions] = useState<UnifiedPrediction[]>([]); // Corrected this line
    const [stats, setStats] = useState<PredictionStats | null>(null);
    const [bots, setBots] = useState<BotStat[]>([]);
    // Pagination state removed as it was unused and causing build error
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);

    // Fetch unified data
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
                    // setPagination(data.data.pagination || null);
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

    // Client-side search filter
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

    // Real-time updates
    const { lastEvent } = useSocket();

    useEffect(() => {
        if (lastEvent) {
            // Trigger refresh on any match/prediction event
            // Debouncing is handled implicitly by ensuring we don't fetch too often if desired,
            // but for now simple trigger is fine for Admin
            fetchData();
        }
    }, [lastEvent]); // Trigger fetchData when a new event arrives

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
        });
    };

    const handleEditClick = (pred: UnifiedPrediction) => {
        setEditingId(pred.id);
        setEditValue(pred.display_prediction || '');
    };

    const handleSaveDisplay = async (predId: string) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/predictions/${predId}/display`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_prediction: editValue })
            });
            if (res.ok) {
                setPredictions(prev => prev.map(p =>
                    p.id === predId ? { ...p, display_prediction: editValue } : p
                ));
                setEditingId(null);
            } else {
                alert('Kayıt başarısız');
            }
        } catch (err) {
            console.error('Save display error:', err);
            alert('Kayıt hatası');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditValue('');
    };

    const getResultBadge = (prediction: UnifiedPrediction) => {
        if (prediction.result === 'pending') {
            return <span className="admin-badge warning">Bekliyor</span>;
        }
        if (prediction.result === 'won') {
            return <span className="admin-badge success">Kazandı</span>;
        }
        if (prediction.result === 'lost') {
            return <span className="admin-badge error">Kaybetti</span>;
        }
        return <span className="admin-badge neutral">Eşleşti</span>;
    };

    const filters: { key: FilterType; label: string }[] = [
        { key: 'all', label: 'Tümü' },
        { key: 'pending', label: 'Bekleyen' },
        { key: 'matched', label: 'Eşleşen' },
        { key: 'won', label: 'Kazanan' },
        { key: 'lost', label: 'Kaybeden' },
    ];

    return (
        <>
            <header className="admin-header">
                <div>
                    <h1 className="admin-header-title">AI Tahminleri</h1>
                    <p className="admin-header-subtitle">Dış yapay zekadan gelen tüm tahminler</p>
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
                            <div className="admin-stat-value">{stats.won}</div>
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
                            <div className="admin-stat-value">{stats.lost}</div>
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
                        <button className="admin-btn admin-btn-secondary" onClick={fetchData}>
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
                                    <th>Ülke</th>
                                    <th>Bot (Başarı)</th>
                                    <th>Lig</th>
                                    <th>Maç</th>
                                    <th>Paylaşım Anı</th>
                                    <th>Tahmin</th>
                                    <th>Canlı Durum</th>
                                    <th>Zaman</th>
                                    <th>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPredictions.map((pred) => (
                                    <tr
                                        key={pred.id}
                                        onClick={() => pred.match_id && navigate(`/match/${pred.match_id}`)}
                                        style={{ cursor: pred.match_id ? 'pointer' : 'default' }}
                                        className={pred.match_id ? 'clickable-row' : ''}
                                    >
                                        <td style={{ textAlign: 'center' }}>
                                            {pred.country_logo ? (
                                                <img src={pred.country_logo} alt={pred.country_name} title={pred.country_name} style={{ width: '20px', height: '15px', objectFit: 'cover', borderRadius: '2px' }} />
                                            ) : (
                                                <span style={{ fontSize: '11px', color: '#666' }}>-</span>
                                            )}
                                        </td>
                                        <td> // Bot (Başarı)
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span className="admin-badge neutral">{pred.canonical_bot_name || pred.bot_name}</span>
                                                <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px' }}>
                                                    {(() => {
                                                        const b = bots.find(b => b.name === (pred.canonical_bot_name || pred.bot_name));
                                                        return b ? `%${b.winRate} Başarı` : '-';
                                                    })()}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--admin-text-secondary)', fontSize: '13px' }}>
                                            {pred.league_name || '-'}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>
                                            {pred.home_team_name} - {pred.away_team_name}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '13px' }}> // Paylaşım Anı (Merge)
                                            <span style={{ color: '#aaa' }}>{pred.minute_at_prediction}'</span>
                                            <span style={{ margin: '0 4px', color: '#555' }}>|</span>
                                            <span style={{ fontWeight: 600 }}>{pred.score_at_prediction || '0-0'}</span>
                                        </td>
                                        <td> // Tahmin (Editable Display)
                                            {editingId === pred.id ? (
                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        placeholder="Kullanıcıya gösterilecek metin..."
                                                        style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            border: '1px solid var(--admin-border)',
                                                            fontSize: '13px',
                                                            width: '180px'
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveDisplay(pred.id);
                                                            if (e.key === 'Escape') handleCancelEdit();
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleSaveDisplay(pred.id)}
                                                        disabled={saving}
                                                        style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            background: 'var(--admin-accent)',
                                                            color: 'white',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        {saving ? '...' : '✓'}
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            background: 'var(--admin-bg-tertiary)',
                                                            color: 'var(--admin-text-secondary)',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); handleEditClick(pred); }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                    title="Düzenlemek için tıklayın"
                                                >
                                                    {pred.display_prediction ? (
                                                        <span style={{ color: 'var(--admin-accent)', fontWeight: 600 }}>
                                                            {pred.display_prediction}
                                                        </span>
                                                    ) : (
                                                        // Fallback to type/value if no custom display
                                                        <span style={{ fontWeight: 500 }}>
                                                            {pred.prediction_type} {pred.prediction_value}
                                                        </span>
                                                    )}
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
                                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {(pred.live_match_status || 0) === 8 ? (
                                                <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '12px' }}>MS {pred.home_score_display}-{pred.away_score_display}</span>
                                            ) : (pred.live_match_status || 0) >= 2 ? (
                                                <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '12px' }} className="animate-pulse">
                                                    {pred.live_match_minute}' {pred.home_score_display}-{pred.away_score_display}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#f59e0b', fontSize: '12px' }}>
                                                    {pred.match_time ? new Date(Number(pred.match_time) * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Bekliyor'}
                                                </span>
                                            )}
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
