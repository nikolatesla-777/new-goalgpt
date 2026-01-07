/**
 * Fixtures Tab
 *
 * Displays team's upcoming and past matches.
 */

import { useTeamDetail } from '../TeamDetailContext';
import { MatchCard } from '../MatchCard';

export function FixturesTab() {
  const { teamId, fixtures } = useTeamDetail();

  return (
    <div>
      {/* Upcoming Matches */}
      {fixtures?.upcoming_matches && fixtures.upcoming_matches.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
            Gelecek Maclar ({fixtures.upcoming_matches.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {fixtures.upcoming_matches.map((match) => (
              <MatchCard key={match.id} match={match} teamId={teamId} />
            ))}
          </div>
        </div>
      )}

      {/* Past Matches */}
      {fixtures?.past_matches && fixtures.past_matches.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
            Gecmis Maclar ({fixtures.past_matches.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {fixtures.past_matches.map((match) => (
              <MatchCard key={match.id} match={match} teamId={teamId} />
            ))}
          </div>
        </div>
      )}

      {(!fixtures?.upcoming_matches?.length && !fixtures?.past_matches?.length) && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6b7280',
          backgroundColor: 'white',
          borderRadius: '12px'
        }}>
          Fikstur bilgisi bulunamadi
        </div>
      )}
    </div>
  );
}

export default FixturesTab;
