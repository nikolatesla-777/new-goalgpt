/**
 * LiveTab
 *
 * Displays live matches (status 2, 3, 4, 5, 7)
 * Uses LivescoreContext for data
 */

import { useLivescore } from '../../../context/LivescoreContext';
import { MatchList } from '../../MatchList';
import { Circle } from '@phosphor-icons/react';

export function LiveTab() {
  const { liveMatches, isLoading, error } = useLivescore();

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
        <span style={{ color: '#94a3b8' }}>Canli maclar yukleniyor...</span>
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

  if (liveMatches.length === 0) {
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
          <Circle size={32} weight="fill" color="#475569" />
        </div>
        <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px' }}>
          Su anda canli mac yok
        </p>
        <p style={{ fontSize: '0.875rem' }}>
          Canli maclar basladiginda burada gorunecek
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Live indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(34, 197, 94, 0.2)',
      }}>
        <Circle size={10} weight="fill" color="#22c55e" style={{ animation: 'pulse 2s infinite' }} />
        <span style={{ color: '#22c55e', fontWeight: '600' }}>
          {liveMatches.length} canli mac
        </span>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>

      {/* Match List - using prefetchedMatches to avoid double fetching */}
      <MatchList
        view="live"
        prefetchedMatches={liveMatches}
        skipInternalUpdates={true}
        isLoading={isLoading}
      />
    </div>
  );
}

export default LiveTab;
