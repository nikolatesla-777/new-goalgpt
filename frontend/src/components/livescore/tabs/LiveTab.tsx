/**
 * LiveTab
 *
 * Displays live matches using Sofascore-style design
 * Features:
 * - Header with live indicator and match count
 * - Matches grouped by league
 * - Compact match rows with live minute indicators
 */

import { useMemo } from 'react';
import { useLivescore } from '../../../context/LivescoreContext';
import { SofascoreLeagueSection } from '../SofascoreLeagueSection';
import { Circle, WifiHigh } from '@phosphor-icons/react';
import type { Match, Competition } from '../../../api/matches';

export function LiveTab() {
  const { liveMatches, isLoading, error, isConnected } = useLivescore();

  // Group matches by competition (league)
  const groupedByLeague = useMemo(() => {
    if (!Array.isArray(liveMatches) || liveMatches.length === 0) {
      return [];
    }

    // Group by competition_id
    const grouped = new Map<string, {
      competition: Competition | null;
      matches: Match[];
      countryName: string;
    }>();

    liveMatches.forEach((match) => {
      if (!match || typeof match !== 'object' || !match.id) return;

      const comp = match.competition || null;
      const countryName = comp?.country_name || 'Diğer';
      const compId = match.competition_id || 'unknown';
      const groupKey = `${countryName}|${compId}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          competition: comp,
          matches: [],
          countryName,
        });
      }
      grouped.get(groupKey)!.matches.push(match);
    });

    // Sort matches within each group by minute (descending)
    grouped.forEach((group) => {
      group.matches.sort((a, b) => {
        const minuteA = (a as any).minute ?? 0;
        const minuteB = (b as any).minute ?? 0;
        return minuteB - minuteA;
      });
    });

    // Sort groups by country name
    return Array.from(grouped.entries())
      .sort((a, b) => a[1].countryName.localeCompare(b[1].countryName, 'tr'))
      .map(([key, value]) => ({ key, ...value }));
  }, [liveMatches]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        gap: '16px',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #ef4444',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Canlı maçlar yükleniyor...</span>
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
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        margin: '1rem',
      }}>
        <p style={{ marginBottom: '8px', fontWeight: '600', fontSize: '1rem' }}>Hata</p>
        <p style={{ fontSize: '0.875rem', color: '#f87171' }}>{error}</p>
      </div>
    );
  }

  if (liveMatches.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <Circle size={32} weight="fill" color="#9ca3af" />
        </div>
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '8px',
        }}>
          Şu anda canlı maç yok
        </h3>
        <p style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          maxWidth: '280px',
        }}>
          Canlı maçlar başladığında burada görünecek
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px' }}>
      {/* Live Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderRadius: '10px',
        border: '1px solid rgba(239, 68, 68, 0.15)',
      }}>
        {/* Left: Live indicator + Count */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            backgroundColor: '#ef4444',
            borderRadius: '8px',
          }}>
            <Circle size={14} weight="fill" color="#fff" style={{ animation: 'livePulse 1.5s ease-in-out infinite' }} />
          </div>
          <div>
            <div style={{
              fontSize: '1rem',
              fontWeight: '700',
              color: '#ef4444',
            }}>
              {liveMatches.length} Canlı Maç
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: '#6b7280',
            }}>
              {groupedByLeague.length} farklı lig
            </div>
          </div>
        </div>

        {/* Right: Connection status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderRadius: '20px',
        }}>
          <WifiHigh size={14} weight="bold" color={isConnected ? '#22c55e' : '#ef4444'} />
          <span style={{
            fontSize: '0.75rem',
            fontWeight: '500',
            color: isConnected ? '#22c55e' : '#ef4444',
          }}>
            {isConnected ? 'Canlı' : 'Bağlantı yok'}
          </span>
        </div>
      </div>

      {/* Grouped Matches by League */}
      <div>
        {groupedByLeague.map((group) => (
          <SofascoreLeagueSection
            key={group.key}
            competition={group.competition}
            matches={group.matches}
            countryName={group.countryName}
            defaultExpanded={true}
          />
        ))}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

export default LiveTab;
