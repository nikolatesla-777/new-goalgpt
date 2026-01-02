/**
 * Admin Livescore Page
 * Live match scores with premium admin styling
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MatchList } from '../MatchList';
import { getTodayInTurkey } from '../../utils/dateUtils';
import { searchTeams } from '../../api/matches';
import './admin.css';

interface AIPrediction {
    id: string;
    home_team_name: string;
    away_team_name: string;
    league_name: string;
    score_at_prediction: string;
    minute_at_prediction: number;
    prediction_type: string;
    prediction_value: string;
    overall_confidence: number;
    match_external_id: string;
    created_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

type ViewType = 'diary' | 'live' | 'finished' | 'not_started' | 'ai';
type SortType = 'league' | 'time';

export function AdminLivescore() {
    const [view, setView] = useState<ViewType>('diary');
    const [sortBy, setSortBy] = useState<SortType>('league');
    const [selectedDate, setSelectedDate] = useState<string>(getTodayInTurkey());

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const navigate = useNavigate();

    // AI Predictions State
    const [aiPredictions, setAiPredictions] = useState<AIPrediction[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);

    // Fetch AI predictions when AI view is selected
    useEffect(() => {
        if (view === 'ai') {
            fetchAIPredictions();
        }
    }, [view]);

    const fetchAIPredictions = async () => {
        setLoadingAI(true);
        try {
            const res = await fetch(`${API_BASE}/predictions/matched?limit=50`);
            if (res.ok) {
                const data = await res.json();
                setAiPredictions(data.predictions || []);
            }
        } catch (error) {
            console.error('Fetch AI predictions error:', error);
        } finally {
            setLoadingAI(false);
        }
    };

    // Handle Search
    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const results = await searchTeams(query);
            setSearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <>
            <header className="admin-header">
                <div>
                    <h1 className="admin-header-title">Canlı Skorlar</h1>
                    <p className="admin-header-subtitle">TheSports API - Anlık Güncellemeler</p>
                </div>
            </header>

            <div className="admin-content">
                {/* Filter Controls */}
                <div className="admin-livescore-controls">
                    <div className="admin-livescore-filters">
                        <button
                            className={`admin-filter-btn ${view === 'diary' ? 'active' : ''}`}
                            onClick={() => setView('diary')}
                        >
                            Günün Maçları
                        </button>
                        <button
                            className={`admin-filter-btn ${view === 'live' ? 'active' : ''}`}
                            onClick={() => setView('live')}
                        >
                            <span className="live-indicator"></span>
                            Canlı Maçlar
                        </button>
                        <button
                            className={`admin-filter-btn ${view === 'finished' ? 'active' : ''}`}
                            onClick={() => setView('finished')}
                        >
                            Bitenler
                        </button>
                        <button
                            className={`admin-filter-btn ${view === 'not_started' ? 'active' : ''}`}
                            onClick={() => setView('not_started')}
                        >
                            Başlamayanlar
                        </button>
                        <button
                            className={`admin-filter-btn ${view === 'ai' ? 'active' : ''}`}
                            onClick={() => setView('ai')}
                            style={{ background: view === 'ai' ? 'linear-gradient(135deg, #8B5CF6, #6366F1)' : undefined, color: view === 'ai' ? 'white' : undefined }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                                <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
                                <circle cx="7.5" cy="14.5" r="1.5" />
                                <circle cx="16.5" cy="14.5" r="1.5" />
                            </svg>
                            YAPAY ZEKA
                        </button>
                    </div>

                    <div className="admin-livescore-options">
                        {/* Date Picker */}
                        <div className="admin-date-picker">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="admin-date-input"
                            />
                        </div>

                        {/* Sort Toggle */}
                        <div className="admin-sort-toggle">
                            <button
                                className={`admin-sort-btn ${sortBy === 'league' ? 'active' : ''}`}
                                onClick={() => setSortBy('league')}
                                title="Lige göre sırala"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M3 12h18M3 18h18" />
                                </svg>
                                Lig
                            </button>
                            <button
                                className={`admin-sort-btn ${sortBy === 'time' ? 'active' : ''}`}
                                onClick={() => setSortBy('time')}
                                title="Saate göre sırala"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 6v6l4 2" />
                                </svg>
                                Saat
                            </button>
                        </div>
                    </div>
                </div>

                {/* Team Search Bar */}
                <div style={{ padding: '0 24px 16px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f3f4f6', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <span style={{ fontSize: '18px', marginRight: '8px' }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Takım ara..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                outline: 'none',
                                flex: 1,
                                fontSize: '14px',
                                color: '#1f2937'
                            }}
                        />
                        {isSearching && <span style={{ fontSize: '12px', color: '#6b7280' }}>Aranıyor...</span>}
                    </div>

                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '24px',
                            right: '24px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            zIndex: 50,
                            maxHeight: '300px',
                            overflowY: 'auto',
                            border: '1px solid #e5e7eb',
                            marginTop: '4px'
                        }}>
                            {searchResults.map((team) => (
                                <div
                                    key={team.id}
                                    onClick={() => navigate(`/team/${team.id}`)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid #f3f4f6',
                                        transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                >
                                    {team.logo_url && (
                                        <img
                                            src={team.logo_url}
                                            alt={team.name}
                                            style={{ width: '24px', height: '24px', objectFit: 'contain', marginRight: '12px' }}
                                        />
                                    )}
                                    <span style={{ fontWeight: '500', color: '#1f2937' }}>{team.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Match List or AI Predictions */}
                <div className="admin-livescore-content">
                    {view === 'ai' ? (
                        // AI Predictions View
                        <div style={{ padding: '0 24px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '20px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
                                            <circle cx="7.5" cy="14.5" r="1.5" />
                                            <circle cx="16.5" cy="14.5" r="1.5" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
                                            AI Tahminleri ({aiPredictions.length})
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                            TheSports ile eşleşen yapay zeka tahminleri
                                        </p>
                                    </div>
                                </div>
                                <button
                                    className="admin-btn admin-btn-primary"
                                    onClick={fetchAIPredictions}
                                    disabled={loadingAI}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                        <path d="M21 3v5h-5" />
                                    </svg>
                                    Yenile
                                </button>
                            </div>

                            {loadingAI ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
                                    <div className="admin-spinner" />
                                </div>
                            ) : aiPredictions.length === 0 ? (
                                <div className="admin-empty-state">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                                    </svg>
                                    <h3>Eşleşmiş tahmin yok</h3>
                                    <p>Henüz TheSports ile eşleşen AI tahmini bulunmuyor</p>
                                </div>
                            ) : (
                                <div className="admin-logs-list">
                                    {aiPredictions.map((pred) => (
                                        <div
                                            key={pred.id}
                                            className="admin-log-card success"
                                            onClick={() => pred.match_external_id && navigate(`/match/${pred.match_external_id}`)}
                                            style={{ cursor: pred.match_external_id ? 'pointer' : 'default' }}
                                        >
                                            <div className="admin-log-card-header" style={{ cursor: 'inherit' }}>
                                                <div className="admin-log-main">
                                                    <div className="admin-log-status">
                                                        <span className="admin-badge success" style={{
                                                            background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                                                            border: 'none'
                                                        }}>
                                                            {Math.round((pred.overall_confidence || 0) * 100)}% Eşleşme
                                                        </span>
                                                        <span className="admin-badge info">
                                                            {pred.prediction_type || pred.prediction_value}
                                                        </span>
                                                    </div>
                                                    <div className="admin-log-info">
                                                        <div className="admin-log-endpoint" style={{
                                                            color: 'var(--admin-text-primary)',
                                                            fontFamily: 'inherit',
                                                            fontSize: '15px',
                                                            fontWeight: 600
                                                        }}>
                                                            {pred.home_team_name} vs {pred.away_team_name}
                                                        </div>
                                                        <div className="admin-log-meta">
                                                            <span>{pred.league_name || 'Bilinmeyen Lig'}</span>
                                                            <span className="admin-log-separator">•</span>
                                                            <span>Skor: {pred.score_at_prediction} ({pred.minute_at_prediction}')</span>
                                                            <span className="admin-log-separator">•</span>
                                                            <span className="admin-log-time">
                                                                {new Date(pred.created_at).toLocaleString('tr-TR', {
                                                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="admin-log-result">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--admin-accent)" strokeWidth="2">
                                                        <path d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <MatchList
                            view={view as 'diary' | 'live' | 'finished' | 'not_started'}
                            date={selectedDate}
                            sortBy={sortBy}
                        />
                    )}
                </div>
            </div>
        </>
    );
}
