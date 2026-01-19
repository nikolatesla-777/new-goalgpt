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
          border: '3px solid #cbd5e1',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: '#64748b' }}>Baslamamis maclar yukleniyor...</span>
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
          backgroundColor: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Clock size={32} weight="fill" color="#64748b" />
        </div>
        <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px', color: '#334155' }}>
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
        backgroundColor: '#eff6ff',
        borderRadius: '8px',
        border: '1px solid #bfdbfe',
      }}>
        <Clock size={18} weight="fill" color="#2563eb" />
        <span style={{ color: '#1d4ed8', fontWeight: '600' }}>
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
