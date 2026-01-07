/**
 * Overview Tab
 *
 * Displays team overview with next match, recent matches, and standings summary.
 */

import { useTeamDetail } from '../TeamDetailContext';
import { MatchCard } from '../MatchCard';

export function OverviewTab() {
  const { teamId, team, fixtures, standing } = useTeamDetail();

  return (
    <div>
      {/* Next Match Teaser */}
      {fixtures?.upcoming_matches && fixtures.upcoming_matches.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
            Siradaki Mac
          </h3>
          <MatchCard match={fixtures.upcoming_matches[0]} teamId={teamId} />
        </div>
      )}

      {/* Recent Matches Teaser */}
      {fixtures?.past_matches && fixtures.past_matches.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
            Son Maclar
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {fixtures.past_matches.slice(0, 5).map((match) => (
              <MatchCard key={match.id} match={match} teamId={teamId} />
            ))}
          </div>
        </div>
      )}

      {/* Standings Teaser */}
      {standing && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
            Puan Durumu Ozeti
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Pozisyon</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e3a5f' }}>#{standing.position}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Puan</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{standing.points}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Form</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {team?.recent_form?.slice(0, 3).map((m, i) => (
                  <span key={i} style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', color: 'white', fontWeight: 'bold',
                    backgroundColor: m.result === 'W' ? '#22c55e' : m.result === 'D' ? '#eab308' : '#ef4444'
                  }}>{m.result === 'W' ? 'G' : m.result === 'D' ? 'B' : 'M'}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OverviewTab;
