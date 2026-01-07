/**
 * Match Card Component
 *
 * Reusable match card for fixtures display.
 */

import { useNavigate } from 'react-router-dom';
import type { FixtureMatch } from './TeamDetailContext';

interface MatchCardProps {
  match: FixtureMatch;
  teamId: string;
}

export function MatchCard({ match, teamId }: MatchCardProps) {
  const navigate = useNavigate();
  const isFinished = match.status_id === 8;
  const isLive = [2, 3, 4, 5, 7].includes(match.status_id);

  // Determine result for this team
  let resultColor = '#6b7280';
  if (isFinished && match.home_score !== null && match.away_score !== null) {
    const isHome = match.home_team.id === teamId;
    const teamScore = isHome ? match.home_score : match.away_score;
    const opponentScore = isHome ? match.away_score : match.home_score;

    if (teamScore > opponentScore) resultColor = '#22c55e';
    else if (teamScore < opponentScore) resultColor = '#ef4444';
    else resultColor = '#eab308';
  }

  return (
    <div
      onClick={() => navigate(`/match/${match.id}`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        borderLeft: `4px solid ${resultColor}`
      }}
    >
      {/* Date/Time */}
      <div style={{
        width: '70px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <div>{new Date(match.match_time * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>
        {!isFinished && !isLive && (
          <div style={{ fontWeight: '600', color: '#1e3a5f' }}>
            {new Date(match.match_time * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        {isLive && (
          <div style={{
            fontWeight: '600',
            color: '#ef4444',
          }}>
            CANLI
          </div>
        )}
      </div>

      {/* Teams */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Home Team */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'flex-end',
          fontWeight: match.home_team.id === teamId ? '600' : '400'
        }}>
          <span style={{ fontSize: '14px' }}>{match.home_team.name}</span>
          {match.home_team.logo_url && (
            <img src={match.home_team.logo_url} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          )}
        </div>

        {/* Score */}
        <div style={{
          width: '60px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '16px',
          color: isLive ? '#ef4444' : '#1e3a5f'
        }}>
          {(isFinished || isLive) ? (
            `${match.home_score ?? 0} - ${match.away_score ?? 0}`
          ) : (
            <span style={{ color: '#6b7280', fontWeight: '400' }}>vs</span>
          )}
        </div>

        {/* Away Team */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: match.away_team.id === teamId ? '600' : '400'
        }}>
          {match.away_team.logo_url && (
            <img src={match.away_team.logo_url} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          )}
          <span style={{ fontSize: '14px' }}>{match.away_team.name}</span>
        </div>
      </div>

      {/* Round */}
      {match.round && (
        <div style={{
          width: '50px',
          textAlign: 'right',
          fontSize: '12px',
          color: '#9ca3af'
        }}>
          H{match.round}
        </div>
      )}
    </div>
  );
}

export default MatchCard;
