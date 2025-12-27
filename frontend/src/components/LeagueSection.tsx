import type { Match } from '../api/matches';
import { MatchCard } from './MatchCard';
import type { Competition } from '../api/matches';

interface LeagueSectionProps {
  competition: Competition | null;
  matches: Match[];
}

export function LeagueSection({ competition, matches }: LeagueSectionProps) {
  // CRITICAL FIX: Safety checks
  if (!Array.isArray(matches)) {
    console.error('❌ [LeagueSection] matches is not an array:', typeof matches, matches);
    return (
      <div style={{ padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '8px', marginBottom: '1rem' }}>
        <p style={{ color: '#991b1b', margin: 0 }}>❌ Geçersiz maç verisi</p>
      </div>
    );
  }

  // Show "Country - League" format if country_name is available
  const leagueName = competition?.name || (competition?.id ? `Competition ID: ${competition.id}` : 'Bilinmeyen Lig');
  const competitionName = competition?.country_name
    ? `${competition.country_name} - ${leagueName}`
    : leagueName;
  const competitionLogo = competition?.logo_url;
  const safeMatches = matches.filter(match => match && typeof match === 'object' && match.id);

  if (safeMatches.length === 0) {
    return null; // Don't render empty sections
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* League Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}>
        {competitionLogo && (
          <img
            src={competitionLogo}
            alt={competitionName}
            style={{
              width: '32px',
              height: '32px',
              objectFit: 'contain',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: '600',
          color: '#1f2937',
          margin: 0,
        }}>
          {competitionName}
        </h3>
        <span style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          marginLeft: 'auto',
        }}>
          {safeMatches.length} maç
        </span>
      </div>

      {/* Matches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {safeMatches.map((match) => {
          // CRITICAL FIX: Validate match before rendering
          if (!match || !match.id) {
            console.warn('⚠️ [LeagueSection] Invalid match skipped:', match);
            return null;
          }
          return <MatchCard key={match.id} match={match} />;
        })}
      </div>
    </div>
  );
}

