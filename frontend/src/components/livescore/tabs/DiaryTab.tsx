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
      {/* Stats Summary - Light theme */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div style={{
          padding: '16px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
            {matches.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Toplam</div>
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: '#f0fdf4',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid #bbf7d0',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#16a34a' }}>
            {liveMatches.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Canli</div>
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: '#f1f5f9',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid #cbd5e1',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#475569' }}>
            {finishedMatches.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#475569' }}>Biten</div>
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: '#eff6ff',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid #bfdbfe',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2563eb' }}>
            {upcomingMatches.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>Baslamamis</div>
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
            backgroundColor: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CalendarBlank size={32} color="#64748b" />
          </div>
          <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px', color: '#334155' }}>
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
