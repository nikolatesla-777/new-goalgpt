/**
 * DiaryTab (Livescore)
 *
 * Displays all matches for the selected date (Bulten / Diary)
 * Uses LivescoreContext for data
 */

import { useLivescore } from '../../../context/LivescoreContext';
import { MatchList } from '../../MatchList';
import { CalendarBlank } from '@phosphor-icons/react';

export function DiaryTab() {
  const { matches, isLoading, error, liveMatches, finishedMatches, upcomingMatches } = useLivescore();

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
        <span style={{ color: '#94a3b8' }}>Bulten yukleniyor...</span>
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

  return (
    <div>
      {/* Stats Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div style={{
          padding: '16px',
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc' }}>
            {matches.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Toplam</div>
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid rgba(34, 197, 94, 0.2)',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>
            {liveMatches.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#22c55e' }}>Canli</div>
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(100, 116, 139, 0.1)',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid rgba(100, 116, 139, 0.2)',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#94a3b8' }}>
            {finishedMatches.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Biten</div>
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>
            {upcomingMatches.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>Baslamamis</div>
        </div>
      </div>

      {matches.length === 0 ? (
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
            <CalendarBlank size={32} color="#475569" />
          </div>
          <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px' }}>
            Bu tarihte mac yok
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Baska bir tarih secin veya TheSports sync calistirin
          </p>
        </div>
      ) : (
        <MatchList
          view="diary"
          prefetchedMatches={matches}
          skipInternalUpdates={true}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

export default DiaryTab;
