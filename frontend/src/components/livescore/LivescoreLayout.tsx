/**
 * LivescoreLayout
 *
 * Main layout for Livescore page with:
 * - Header with connection status
 * - Tab navigation
 * - Date picker
 * - Outlet for tab content
 */

import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useLivescore, LivescoreProvider } from '../../context/LivescoreContext';
import { Circle, WifiHigh, WifiSlash, ArrowClockwise, CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';

// Inner component that uses the context
function LivescoreLayoutInner() {
  const {
    matches,
    liveMatches,
    finishedMatches,
    upcomingMatches,
    aiMatches,
    isLoading,
    isConnected,
    lastUpdate,
    selectedDate,
    setSelectedDate,
    refresh,
  } = useLivescore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Format date for display (YYYYMMDD -> "18 Ocak 2026")
  const formatDisplayDate = (dateStr: string): string => {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const date = new Date(`${year}-${month}-${day}`);

    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Navigate date
  const navigateDate = (direction: 'prev' | 'next') => {
    const year = parseInt(selectedDate.slice(0, 4));
    const month = parseInt(selectedDate.slice(4, 6)) - 1;
    const day = parseInt(selectedDate.slice(6, 8));

    const date = new Date(year, month, day);
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));

    const newDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    setSelectedDate(newDate);
  };

  // Check if today
  const isToday = (): boolean => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return selectedDate === todayStr;
  };

  // Go to today
  const goToToday = () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    setSelectedDate(todayStr);
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Tab style helper
  const getTabStyle = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: isActive ? '600' : '500',
    color: isActive ? '#fff' : '#94a3b8',
    backgroundColor: isActive ? '#3b82f6' : 'transparent',
    textDecoration: 'none',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1e293b',
        backgroundColor: '#1e293b',
      }}>
        {/* Top row: Title + Connection Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '1.75rem' }}>&#9917;</span>
            Canli Skor
          </h1>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            {/* Connection Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              fontSize: '0.75rem',
              fontWeight: '500',
            }}>
              {isConnected ? (
                <>
                  <WifiHigh size={14} weight="bold" color="#22c55e" />
                  <span style={{ color: '#22c55e' }}>Canli</span>
                </>
              ) : (
                <>
                  <WifiSlash size={14} weight="bold" color="#ef4444" />
                  <span style={{ color: '#ef4444' }}>Baglanti Yok</span>
                </>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#334155',
                cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
                opacity: isRefreshing || isLoading ? 0.6 : 1,
              }}
            >
              <ArrowClockwise
                size={18}
                weight="bold"
                color="#94a3b8"
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <button
              onClick={() => navigateDate('prev')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#334155',
                cursor: 'pointer',
              }}
            >
              <CaretLeft size={16} weight="bold" color="#94a3b8" />
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: '#334155',
              borderRadius: '8px',
            }}>
              <CalendarBlank size={16} color="#94a3b8" />
              <span style={{ fontWeight: '500' }}>{formatDisplayDate(selectedDate)}</span>
            </div>

            <button
              onClick={() => navigateDate('next')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#334155',
                cursor: 'pointer',
              }}
            >
              <CaretRight size={16} weight="bold" color="#94a3b8" />
            </button>

            {!isToday() && (
              <button
                onClick={goToToday}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Bugün
              </button>
            )}
          </div>

          {/* Last Update */}
          {lastUpdate && (
            <span style={{
              fontSize: '0.75rem',
              color: '#64748b',
            }}>
              Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
            </span>
          )}
        </div>

        {/* Tab Navigation */}
        <nav style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}>
          <NavLink
            to="diary"
            style={({ isActive }) => getTabStyle(isActive)}
          >
            Bulten
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              fontSize: '0.75rem',
            }}>
              {matches.length}
            </span>
          </NavLink>

          <NavLink
            to="live"
            style={({ isActive }) => getTabStyle(isActive)}
          >
            <Circle size={8} weight="fill" color={liveMatches.length > 0 ? '#22c55e' : '#64748b'} />
            Canli
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              fontSize: '0.75rem',
            }}>
              {liveMatches.length}
            </span>
          </NavLink>

          <NavLink
            to="finished"
            style={({ isActive }) => getTabStyle(isActive)}
          >
            Biten
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              fontSize: '0.75rem',
            }}>
              {finishedMatches.length}
            </span>
          </NavLink>

          <NavLink
            to="upcoming"
            style={({ isActive }) => getTabStyle(isActive)}
          >
            Baslamamis
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              fontSize: '0.75rem',
            }}>
              {upcomingMatches.length}
            </span>
          </NavLink>

          <NavLink
            to="ai"
            style={({ isActive }) => getTabStyle(isActive)}
          >
            <span style={{ fontSize: '1rem' }}>&#129302;</span>
            AI Tahminli
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: aiMatches.length > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.1)',
              fontSize: '0.75rem',
              color: aiMatches.length > 0 ? '#fbbf24' : 'inherit',
            }}>
              {aiMatches.length}
            </span>
          </NavLink>
        </nav>
      </div>

      {/* Content Area */}
      <div style={{ padding: '16px' }}>
        <Outlet />
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Wrapper component that provides the context
export function LivescoreLayout() {
  return (
    <LivescoreProvider>
      <LivescoreLayoutInner />
    </LivescoreProvider>
  );
}

export default LivescoreLayout;
