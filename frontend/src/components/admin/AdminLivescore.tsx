/**
 * Admin Livescore Page
 * Live match scores with premium admin styling
 */

import { useState } from 'react';
import { MatchList } from '../MatchList';
import { getTodayInTurkey } from '../../utils/dateUtils';
import './admin.css';

type ViewType = 'recent' | 'diary' | 'live';

export function AdminLivescore() {
    const [view, setView] = useState<ViewType>('diary');
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
                            className={`admin-filter-btn ${view === 'recent' ? 'active' : ''}`}
                            onClick={() => setView('recent')}
                        >
                            Son Maçlar
                        </button>
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
                    </div>

                    {view === 'diary' && (
                        <div className="admin-date-picker">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="admin-date-input"
                            />
                        </div>
                    )}
                </div>

                {/* Match List */}
                <div className="admin-livescore-content">
                    <MatchList view={view} date={view === 'diary' ? selectedDate : undefined} />
                </div>
            </div>
        </>
    );
}
