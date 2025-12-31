/**
 * Admin Livescore Page
 * Live match scores with premium admin styling
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MatchList } from '../MatchList';
import { getTodayInTurkey } from '../../utils/dateUtils';
import { searchTeams } from '../../api/matches';
import './admin.css';

type ViewType = 'diary' | 'live' | 'finished' | 'not_started';
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

                {/* Match List */}
                <div className="admin-livescore-content">
                    <MatchList
                        view={view}
                        date={selectedDate}
                        sortBy={sortBy}
                    />
                </div>
            </div>
        </>
    );
}
