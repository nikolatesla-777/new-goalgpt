/**
 * UpcomingTab
 *
 * Displays upcoming matches (status 1 - NOT_STARTED)
 * Uses LivescoreContext for data
 */

import { useLivescore } from '../../../context/LivescoreContext';
import { MatchList } from '../../MatchList';
import { Clock } from '@phosphor-icons/react';

export function UpcomingTab() {
  const { upcomingMatches, isLoading, error } = useLivescore();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        gap: '16px',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #334155',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: '#94a3b8' }}>Baslamamis maclar yukleniyor...</span>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
      }}>
        <p style={{ marginBottom: '8px', fontWeight: '600' }}>Hata</p>
        <p style={{ fontSize: '0.875rem', color: '#f87171' }}>{error}</p>
      </div>
    );
  }

  if (upcomingMatches.length === 0) {
    return (
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        color: '#64748b',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 16px',
          borderRadius: '50%',
          backgroundColor: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Clock size={32} weight="fill" color="#475569" />
        </div>
        <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px' }}>
          Baslamamis mac yok
        </p>
        <p style={{ fontSize: '0.875rem' }}>
          Gun icinde baslayacak maclar burada gorunecek
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Upcoming indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.2)',
      }}>
        <Clock size={18} weight="fill" color="#3b82f6" />
        <span style={{ color: '#60a5fa', fontWeight: '600' }}>
          {upcomingMatches.length} mac bekliyor
        </span>
      </div>

      {/* Match List - using prefetchedMatches to avoid double fetching */}
      <MatchList
        view="not_started"
        prefetchedMatches={upcomingMatches}
        skipInternalUpdates={true}
        isLoading={isLoading}
      />
    </div>
  );
}

export default UpcomingTab;
