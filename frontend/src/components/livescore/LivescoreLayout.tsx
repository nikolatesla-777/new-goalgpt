/**
 * Livescore Layout
 *
 * Main layout component for livescore page with:
 * - Header
 * - Tab navigation (using NavLink for URL-based routing)
 * - Filter controls
 * - Outlet for nested routes
 */

import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LivescoreProvider, useLivescore } from './LivescoreContext';
import { useFavorites } from '../../context/FavoritesContext';
import { searchTeams } from '../../api/matches';
import '../admin/admin.css';

// ============================================================================
// TAB NAVIGATION COMPONENT
// ============================================================================

function LivescoreTabNavigation() {
  const { counts, selectedDate, setSelectedDate, sortBy, setSortBy } = useLivescore();
  const { favoritesCount } = useFavorites();

  return (
    <div className="admin-livescore-controls">
      <div className="admin-livescore-filters">
        <NavLink
          to="/livescore/diary"
          className={({ isActive }) => `admin-filter-btn ${isActive ? 'active' : ''}`}
        >
          Günün Maçları
          {counts.diary > 0 && (
            <span className="tab-badge">{counts.diary}</span>
          )}
        </NavLink>

        <NavLink
          to="/livescore/live"
          className={({ isActive }) => `admin-filter-btn ${isActive ? 'active' : ''}`}
        >
          <span className="live-indicator"></span>
          Canlı Maçlar
          {counts.live > 0 && (
            <span className="tab-badge live">{counts.live}</span>
          )}
        </NavLink>

        <NavLink
          to="/livescore/finished"
          className={({ isActive }) => `admin-filter-btn ${isActive ? 'active' : ''}`}
        >
          Bitenler
          {counts.finished > 0 && (
            <span className="tab-badge">{counts.finished}</span>
          )}
        </NavLink>

        <NavLink
          to="/livescore/not-started"
          className={({ isActive }) => `admin-filter-btn ${isActive ? 'active' : ''}`}
        >
          Başlamayanlar
          {counts.notStarted > 0 && (
            <span className="tab-badge">{counts.notStarted}</span>
          )}
        </NavLink>

        <NavLink
          to="/livescore/favorites"
          className={({ isActive }) =>
            `admin-filter-btn favorites-tab ${isActive ? 'active' : ''}`
          }
        >
          <span style={{ marginRight: '4px' }}>⭐</span>
          Favorilerim
          {favoritesCount > 0 && (
            <span className="tab-badge favorites">{favoritesCount}</span>
          )}
        </NavLink>

        <NavLink
          to="/livescore/ai"
          className={({ isActive }) =>
            `admin-filter-btn ai-tab ${isActive ? 'active' : ''}`
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
            <circle cx="7.5" cy="14.5" r="1.5" />
            <circle cx="16.5" cy="14.5" r="1.5" />
          </svg>
          YAPAY ZEKA
          {counts.ai > 0 && (
            <span className="tab-badge ai">{counts.ai}</span>
          )}
        </NavLink>
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
  );
}

// ============================================================================
// SEARCH BAR COMPONENT
// ============================================================================

function LivescoreSearchBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

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
    <div style={{ padding: '0 24px 16px', position: 'relative' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        padding: '8px 16px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
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
              onClick={() => {
                navigate(`/team/${team.id}`);
                setSearchQuery('');
                setSearchResults([]);
              }}
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
  );
}

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

function LivescoreLayoutContent() {
  const location = useLocation();
  const isAiTab = location.pathname.includes('/ai');

  return (
    <>
      <header className="admin-header">
        <div>
          <h1 className="admin-header-title">Canlı Skorlar</h1>
          <p className="admin-header-subtitle">TheSports API - Anlık Güncellemeler</p>
        </div>
      </header>

      <div className="admin-content">
        {/* Tab Navigation */}
        <LivescoreTabNavigation />

        {/* Search Bar (not shown on AI tab) */}
        {!isAiTab && <LivescoreSearchBar />}

        {/* Nested Route Content */}
        <div className="admin-livescore-content">
          <Outlet />
        </div>
      </div>
    </>
  );
}

// Wrap with provider
export function LivescoreLayout() {
  return (
    <LivescoreProvider>
      <LivescoreLayoutContent />
    </LivescoreProvider>
  );
}

export default LivescoreLayout;
