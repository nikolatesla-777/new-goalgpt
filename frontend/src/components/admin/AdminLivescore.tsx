/**
 * Admin Livescore Page
 * Live match scores with premium admin styling
 */

import { useState } from 'react';
import { MatchList } from '../MatchList';
import { getTodayInTurkey } from '../../utils/dateUtils';
import './admin.css';

type ViewType = 'diary' | 'live' | 'finished' | 'not_started';
type SortType = 'league' | 'time';

export function AdminLivescore() {
    const [view, setView] = useState<ViewType>('diary');
    const [sortBy, setSortBy] = useState<SortType>('league');
    const [selectedDate, setSelectedDate] = useState<string>(getTodayInTurkey());

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
