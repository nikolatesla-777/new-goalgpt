/**
 * Admin Bot Detail Page
 * Shows predictions for a specific bot
 *
 * Note: Uses dedicated bot endpoint for pagination support.
 * Context's getBotPredictions is limited to cached predictions.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAIPredictions } from '../../context/AIPredictionsContext';
import { useSocket } from '../../hooks/useSocket';
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
    result?: string; // 'pending' | 'won' | 'lost'
}

interface Country {
    id: string;
    name: string;
    logo: string | null;
}

interface Competition {
    id: string;
    name: string;
    logo: string | null;
    country_id: string | null;
    country_name: string | null;
}

interface LocationStat {
    country_id?: string;
    country_name: string;
    country_logo?: string | null;
    competition_id?: string;
    competition_name?: string;
    competition_logo?: string | null;
    total: number;
    wins: number;
    losses: number;
    pending: number;
    win_rate: number;
}

interface DetailedStats {
    overall: {
        total: number;
        wins: number;
        losses: number;
        pending: number;
        win_rate: number;
    };
    by_country: LocationStat[];
    by_competition: LocationStat[];
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function AdminBotDetail() {
    const { botName } = useParams<{ botName: string }>();
    const navigate = useNavigate();
    const { botRules, updateBotRule, refreshBotRules } = useAIPredictions();

    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<{ total: number; pending: number; matched: number; winners: number; losers: number }>({
        total: 0, pending: 0, matched: 0, winners: 0, losers: 0
    });

    // Exclusion management state
    const [showSettings, setShowSettings] = useState(false);
    const [countries, setCountries] = useState<Country[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [countrySearch, setCountrySearch] = useState('');
    const [competitionSearch, setCompetitionSearch] = useState('');
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingCountries, setLoadingCountries] = useState(false);
    const [loadingCompetitions, setLoadingCompetitions] = useState(false);

    // Detailed stats state
    const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null);
    const [loadingDetailedStats, setLoadingDetailedStats] = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [breakdownTab, setBreakdownTab] = useState<'country' | 'competition'>('country');

    // Get match IDs for WebSocket filtering
    const matchIds = useMemo(() => {
        return new Set(predictions.filter(p => p.match_external_id).map(p => p.match_external_id!));
    }, [predictions]);

    // WEBSOCKET: Instant Win - Gol geldiğinde ANLIK güncelle
    useSocket({
        onScoreChange: (event) => {
            if (!matchIds.has(event.matchId)) return;

            const totalGoals = event.homeScore + event.awayScore;

            setPredictions(prev => prev.map(p => {
                if (p.match_external_id !== event.matchId) return p;

                // Sadece pending tahminleri kontrol et
                if (p.prediction_result === 'winner' || p.prediction_result === 'loser') return p;

                // Threshold hesapla
                const scoreAtPred = p.score_at_prediction || '0-0';
                const [predHome, predAway] = scoreAtPred.split('-').map(s => parseInt(s.trim()) || 0);
                const threshold = predHome + predAway + 0.5;

                // INSTANT WIN!
                if (totalGoals > threshold) {
                    console.log(`🎉 AdminBotDetail INSTANT WIN: ${p.prediction_value} (${totalGoals} > ${threshold})`);
                    return {
                        ...p,
                        prediction_result: 'winner',
                        result: 'won',
                        processed: true
                    };
                }
                return p;
            }));

            // Stats'ı da güncelle
            setStats(prev => {
                const newWinners = predictions.filter(p =>
                    p.match_external_id === event.matchId &&
                    !p.prediction_result
                ).filter(p => {
                    const scoreAtPred = p.score_at_prediction || '0-0';
                    const [predHome, predAway] = scoreAtPred.split('-').map(s => parseInt(s.trim()) || 0);
                    const threshold = predHome + predAway + 0.5;
                    return totalGoals > threshold;
                }).length;

                return {
                    ...prev,
                    winners: prev.winners + newWinners,
                    pending: Math.max(0, prev.pending - newWinners)
                };
            });
        },
        onMatchStateChange: (event) => {
            if (!matchIds.has(event.matchId)) return;

            // INSTANT LOSE: Devre arası veya maç sonu
            if (event.statusId === 3 || event.statusId === 8) {
                let newLosses = 0;

                setPredictions(prev => prev.map(p => {
                    if (p.match_external_id !== event.matchId) return p;

                    // Skip if already settled
                    if (p.prediction_result === 'winner' || p.prediction_result === 'loser') return p;

                    const minute = p.minute_at_prediction || 0;
                    const isFirstHalf = minute < 45;

                    // Status 3 (HT): IY tahminleri lose
                    if (event.statusId === 3 && isFirstHalf) {
                        console.log(`❌ AdminBotDetail INSTANT LOSE (HT): ${p.prediction_value}`);
                        newLosses++;
                        return { ...p, prediction_result: 'loser', result: 'lost' };
                    }

                    // Status 8 (FT): MS tahminleri lose
                    if (event.statusId === 8 && !isFirstHalf) {
                        console.log(`❌ AdminBotDetail INSTANT LOSE (FT): ${p.prediction_value}`);
                        newLosses++;
                        return { ...p, prediction_result: 'loser', result: 'lost' };
                    }

                    return p;
                }));

                // Update stats
                if (newLosses > 0) {
                    setStats(prev => ({
                        ...prev,
                        losers: prev.losers + newLosses,
                        pending: Math.max(0, prev.pending - newLosses)
                    }));
                }
            }
        }
    });

    // Get current bot rule
    const currentRule = botRules.find(r => r.bot_display_name === decodeURIComponent(botName || ''));

    // Initialize selections from current rule
    useEffect(() => {
        if (currentRule) {
            setSelectedCountries(currentRule.excluded_countries || []);
            setSelectedCompetitions(currentRule.excluded_competitions || []);
        }
    }, [currentRule]);

    // Fetch countries
    const fetchCountries = useCallback(async (search?: string) => {
        setLoadingCountries(true);
        try {
            const url = search
                ? `${API_BASE}/predictions/countries?search=${encodeURIComponent(search)}`
                : `${API_BASE}/predictions/countries`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setCountries(data.countries || []);
                }
            }
        } catch (err) {
            console.error('Fetch countries error:', err);
        } finally {
            setLoadingCountries(false);
        }
    }, []);

    // Fetch competitions
    const fetchCompetitions = useCallback(async (search?: string) => {
        setLoadingCompetitions(true);
        try {
            const url = search
                ? `${API_BASE}/predictions/competitions?search=${encodeURIComponent(search)}`
                : `${API_BASE}/predictions/competitions`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setCompetitions(data.competitions || []);
                }
            }
        } catch (err) {
            console.error('Fetch competitions error:', err);
        } finally {
            setLoadingCompetitions(false);
        }
    }, []);

    // Load data when settings panel opens
    useEffect(() => {
        if (showSettings) {
            fetchCountries();
            fetchCompetitions();
        }
    }, [showSettings, fetchCountries, fetchCompetitions]);

    // Debounced search for countries
    useEffect(() => {
        if (!showSettings) return;
        const timer = setTimeout(() => {
            fetchCountries(countrySearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [countrySearch, showSettings, fetchCountries]);

    // Debounced search for competitions
    useEffect(() => {
        if (!showSettings) return;
        const timer = setTimeout(() => {
            fetchCompetitions(competitionSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [competitionSearch, showSettings, fetchCompetitions]);

    // Save exclusions
    const handleSaveExclusions = async () => {
        if (!currentRule) return;
        setSaving(true);
        try {
            const success = await updateBotRule(currentRule.id, {
                excluded_countries: selectedCountries,
                excluded_competitions: selectedCompetitions
            });
            if (success) {
                refreshBotRules();
                setShowSettings(false);
            }
        } finally {
            setSaving(false);
        }
    };

    // Toggle country exclusion
    const toggleCountry = (countryId: string) => {
        setSelectedCountries(prev =>
            prev.includes(countryId)
                ? prev.filter(id => id !== countryId)
                : [...prev, countryId]
        );
    };

    // Toggle competition exclusion
    const toggleCompetition = (competitionId: string) => {
        setSelectedCompetitions(prev =>
            prev.includes(competitionId)
                ? prev.filter(id => id !== competitionId)
                : [...prev, competitionId]
        );
    };

    // Fetch detailed stats with country/competition breakdown
    const fetchDetailedStats = useCallback(async () => {
        if (!botName) return;
        setLoadingDetailedStats(true);
        try {
            const res = await fetch(`${API_BASE}/predictions/stats/bot/${encodeURIComponent(botName)}/detailed`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setDetailedStats({
                        overall: data.overall,
                        by_country: data.by_country || [],
                        by_competition: data.by_competition || []
                    });
                }
            }
        } catch (err) {
            console.error('Fetch detailed stats error:', err);
        } finally {
            setLoadingDetailedStats(false);
        }
    }, [botName]);

    useEffect(() => {
        if (botName) {
            fetchPredictions();
            fetchDetailedStats();
        }
    }, [botName, fetchDetailedStats]);

    const fetchPredictions = async () => {
        if (!botName) return;

        setLoading(true);
        try {
            // Use the new unified bot endpoint
            const res = await fetch(`${API_BASE}/predictions/bot/${encodeURIComponent(botName)}?limit=100`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.data) {
                    // Map unified format to local format
                    const preds = (data.data.predictions || []).map((p: any) => ({
                        id: p.id,
                        external_id: p.external_id,
                        bot_name: p.canonical_bot_name || p.bot_name,
                        league_name: p.league_name,
                        home_team_name: p.home_team_name,
                        away_team_name: p.away_team_name,
                        score_at_prediction: p.score_at_prediction,
                        minute_at_prediction: p.minute_at_prediction,
                        prediction_type: p.prediction_type,
                        prediction_value: p.prediction_value,
                        processed: p.result !== 'pending',
                        created_at: p.created_at,
                        match_external_id: p.match_id,
                        overall_confidence: p.confidence,
                        prediction_result: p.result === 'won' ? 'winner' : p.result === 'lost' ? 'loser' : null
                    }));
                    setPredictions(preds);

                    // Use stats from response if available
                    const botStat = data.data.bot;
                    if (botStat) {
                        setStats({
                            total: botStat.total || preds.length,
                            pending: botStat.pending || preds.filter((p: Prediction) => !p.processed).length,
                            matched: preds.filter((p: Prediction) => p.match_external_id).length,
                            winners: botStat.won || 0,
                            losers: botStat.lost || 0
                        });
                    } else {
                        // Calculate stats from predictions
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
                }
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
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="admin-btn admin-btn-secondary"
                        onClick={() => setShowSettings(!showSettings)}
                        title="Bot Ayarları"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                        </svg>
                        Ayarlar
                    </button>
                    <button className="admin-btn admin-btn-primary" onClick={fetchPredictions}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                        </svg>
                        Yenile
                    </button>
                </div>
            </header>

            <div className="admin-content">
                {/* Settings Panel */}
                {showSettings && (
                    <div className="admin-table-container" style={{ marginBottom: '24px' }}>
                        <div className="admin-table-header" style={{ borderBottom: '1px solid var(--admin-border)' }}>
                            <h3 className="admin-table-title">Bot Exclusion Ayarları</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="admin-btn admin-btn-secondary"
                                    onClick={() => setShowSettings(false)}
                                    disabled={saving}
                                >
                                    İptal
                                </button>
                                <button
                                    className="admin-btn admin-btn-primary"
                                    onClick={handleSaveExclusions}
                                    disabled={saving}
                                >
                                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            {/* Countries Panel */}
                            <div>
                                <h4 style={{ color: 'var(--admin-text-primary)', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
                                    Hariç Tutulan Ülkeler ({selectedCountries.length})
                                </h4>
                                <input
                                    type="text"
                                    placeholder="Ülke ara..."
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid var(--admin-border)',
                                        borderRadius: '8px',
                                        background: 'var(--admin-bg-secondary)',
                                        color: 'var(--admin-text-primary)',
                                        marginBottom: '12px'
                                    }}
                                />
                                <div style={{
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    border: '1px solid var(--admin-border)',
                                    borderRadius: '8px',
                                    background: 'var(--admin-bg-secondary)'
                                }}>
                                    {loadingCountries ? (
                                        <div style={{ padding: '24px', textAlign: 'center' }}>
                                            <div className="admin-spinner" />
                                        </div>
                                    ) : countries.length === 0 ? (
                                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
                                            Ülke bulunamadı
                                        </div>
                                    ) : (
                                        countries.map(country => (
                                            <div
                                                key={country.id}
                                                onClick={() => toggleCountry(country.id)}
                                                style={{
                                                    padding: '10px 12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--admin-border)',
                                                    background: selectedCountries.includes(country.id) ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                                    transition: 'background 0.15s'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCountries.includes(country.id)}
                                                    onChange={() => { }}
                                                    style={{ accentColor: '#ef4444' }}
                                                />
                                                {country.logo && (
                                                    <img
                                                        src={country.logo}
                                                        alt=""
                                                        style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px' }}
                                                    />
                                                )}
                                                <span style={{
                                                    color: selectedCountries.includes(country.id) ? '#ef4444' : 'var(--admin-text-primary)',
                                                    fontSize: '13px'
                                                }}>
                                                    {country.name}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Competitions Panel */}
                            <div>
                                <h4 style={{ color: 'var(--admin-text-primary)', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
                                    Hariç Tutulan Ligler ({selectedCompetitions.length})
                                </h4>
                                <input
                                    type="text"
                                    placeholder="Lig ara..."
                                    value={competitionSearch}
                                    onChange={(e) => setCompetitionSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid var(--admin-border)',
                                        borderRadius: '8px',
                                        background: 'var(--admin-bg-secondary)',
                                        color: 'var(--admin-text-primary)',
                                        marginBottom: '12px'
                                    }}
                                />
                                <div style={{
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    border: '1px solid var(--admin-border)',
                                    borderRadius: '8px',
                                    background: 'var(--admin-bg-secondary)'
                                }}>
                                    {loadingCompetitions ? (
                                        <div style={{ padding: '24px', textAlign: 'center' }}>
                                            <div className="admin-spinner" />
                                        </div>
                                    ) : competitions.length === 0 ? (
                                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
                                            Lig bulunamadı
                                        </div>
                                    ) : (
                                        competitions.map(competition => (
                                            <div
                                                key={competition.id}
                                                onClick={() => toggleCompetition(competition.id)}
                                                style={{
                                                    padding: '10px 12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--admin-border)',
                                                    background: selectedCompetitions.includes(competition.id) ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                                    transition: 'background 0.15s'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCompetitions.includes(competition.id)}
                                                    onChange={() => { }}
                                                    style={{ accentColor: '#ef4444' }}
                                                />
                                                {competition.logo && (
                                                    <img
                                                        src={competition.logo}
                                                        alt=""
                                                        style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                                                    />
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        color: selectedCompetitions.includes(competition.id) ? '#ef4444' : 'var(--admin-text-primary)',
                                                        fontSize: '13px',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {competition.name}
                                                    </div>
                                                    {competition.country_name && (
                                                        <div style={{ color: 'var(--admin-text-secondary)', fontSize: '11px' }}>
                                                            {competition.country_name}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Currently Excluded Summary */}
                        {(selectedCountries.length > 0 || selectedCompetitions.length > 0) && (
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid var(--admin-border)',
                                background: 'rgba(239, 68, 68, 0.05)'
                            }}>
                                <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                                    HARIÇ TUTULANLAR
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {selectedCountries.map(id => {
                                        const country = countries.find(c => c.id === id);
                                        return (
                                            <span
                                                key={`country-${id}`}
                                                onClick={() => toggleCountry(id)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                {country?.name || id}
                                                <span style={{ fontWeight: 'bold' }}>×</span>
                                            </span>
                                        );
                                    })}
                                    {selectedCompetitions.map(id => {
                                        const competition = competitions.find(c => c.id === id);
                                        return (
                                            <span
                                                key={`comp-${id}`}
                                                onClick={() => toggleCompetition(id)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                {competition?.name || id}
                                                <span style={{ fontWeight: 'bold' }}>×</span>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

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

                {/* Performance Breakdown Panel */}
                <div className="admin-table-container" style={{ marginBottom: '24px' }}>
                    <div
                        className="admin-table-header"
                        style={{ cursor: 'pointer', borderBottom: showBreakdown ? '1px solid var(--admin-border)' : 'none' }}
                        onClick={() => setShowBreakdown(!showBreakdown)}
                    >
                        <h3 className="admin-table-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                style={{ transform: showBreakdown ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                            >
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                            Performans Analizi
                            {detailedStats && (
                                <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 'normal' }}>
                                    ({detailedStats.by_country.length} ülke, {detailedStats.by_competition.length} lig)
                                </span>
                            )}
                        </h3>
                        {detailedStats && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    background: detailedStats.overall.win_rate >= 60 ? 'rgba(34, 197, 94, 0.15)' :
                                        detailedStats.overall.win_rate >= 40 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: detailedStats.overall.win_rate >= 60 ? '#22c55e' :
                                        detailedStats.overall.win_rate >= 40 ? '#eab308' : '#ef4444'
                                }}>
                                    %{detailedStats.overall.win_rate} Başarı
                                </span>
                            </div>
                        )}
                    </div>

                    {showBreakdown && (
                        <div style={{ padding: '16px' }}>
                            {loadingDetailedStats ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                                    <div className="admin-spinner" />
                                </div>
                            ) : detailedStats ? (
                                <>
                                    {/* Tab Buttons */}
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                        <button
                                            onClick={() => setBreakdownTab('country')}
                                            style={{
                                                padding: '8px 16px',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                background: breakdownTab === 'country' ? 'var(--admin-primary)' : 'var(--admin-bg-secondary)',
                                                color: breakdownTab === 'country' ? 'white' : 'var(--admin-text-secondary)'
                                            }}
                                        >
                                            Ülke Bazlı ({detailedStats.by_country.length})
                                        </button>
                                        <button
                                            onClick={() => setBreakdownTab('competition')}
                                            style={{
                                                padding: '8px 16px',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                background: breakdownTab === 'competition' ? 'var(--admin-primary)' : 'var(--admin-bg-secondary)',
                                                color: breakdownTab === 'competition' ? 'white' : 'var(--admin-text-secondary)'
                                            }}
                                        >
                                            Lig Bazlı ({detailedStats.by_competition.length})
                                        </button>
                                    </div>

                                    {/* Stats Table */}
                                    <div style={{
                                        border: '1px solid var(--admin-border)',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        maxHeight: '400px',
                                        overflowY: 'auto'
                                    }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--admin-bg-secondary)', position: 'sticky', top: 0 }}>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>
                                                        {breakdownTab === 'country' ? 'ÜLKE' : 'LİG'}
                                                    </th>
                                                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>TOPLAM</th>
                                                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>WIN</th>
                                                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>LOSS</th>
                                                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#eab308', fontWeight: 600 }}>PENDING</th>
                                                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>WIN RATE</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(breakdownTab === 'country' ? detailedStats.by_country : detailedStats.by_competition).map((item, idx) => (
                                                    <tr
                                                        key={item.country_id || item.competition_id || idx}
                                                        style={{ borderBottom: '1px solid var(--admin-border)' }}
                                                    >
                                                        <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            {(item.country_logo || item.competition_logo) && (
                                                                <img
                                                                    src={item.country_logo || item.competition_logo || ''}
                                                                    alt=""
                                                                    style={{
                                                                        width: breakdownTab === 'country' ? '24px' : '20px',
                                                                        height: breakdownTab === 'country' ? '16px' : '20px',
                                                                        objectFit: breakdownTab === 'country' ? 'cover' : 'contain',
                                                                        borderRadius: '2px'
                                                                    }}
                                                                />
                                                            )}
                                                            <div>
                                                                <div style={{ color: 'var(--admin-text-primary)', fontSize: '13px' }}>
                                                                    {breakdownTab === 'country' ? item.country_name : item.competition_name}
                                                                </div>
                                                                {breakdownTab === 'competition' && item.country_name && (
                                                                    <div style={{ color: 'var(--admin-text-secondary)', fontSize: '11px' }}>
                                                                        {item.country_name}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center', color: 'var(--admin-text-primary)', fontSize: '13px' }}>{item.total}</td>
                                                        <td style={{ padding: '12px', textAlign: 'center', color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>{item.wins}</td>
                                                        <td style={{ padding: '12px', textAlign: 'center', color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>{item.losses}</td>
                                                        <td style={{ padding: '12px', textAlign: 'center', color: '#eab308', fontSize: '13px' }}>{item.pending}</td>
                                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                                            <span style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                background: item.win_rate >= 60 ? 'rgba(34, 197, 94, 0.15)' :
                                                                    item.win_rate >= 40 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                                color: item.win_rate >= 60 ? '#22c55e' :
                                                                    item.win_rate >= 40 ? '#eab308' : '#ef4444'
                                                            }}>
                                                                %{item.win_rate}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {(breakdownTab === 'country' ? detailedStats.by_country : detailedStats.by_competition).length === 0 && (
                                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
                                                Henüz veri yok
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
                                    İstatistik verisi bulunamadı
                                </div>
                            )}
                        </div>
                    )}
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
