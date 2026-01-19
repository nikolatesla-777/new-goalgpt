/**
 * Standings Tab
 *
 * Shows league standings with team positions highlighted
 */

import { useNavigate } from 'react-router-dom';
import { useMatchDetail } from '../MatchDetailContext';

export function StandingsTab() {
  const navigate = useNavigate();
  const { standings, standingsLoading, match } = useMatchDetail();

  if (standingsLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        Puan durumu yukleniyor...
      </div>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: 'white',
        borderRadius: '12px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          Puan Durumu Bulunamadi
        </div>
        <div style={{ fontSize: '14px' }}>
          Bu lig icin puan durumu verisi yok.
        </div>
      </div>
    );
  }

  const homeTeamId = match?.home_team_id;
  const awayTeamId = match?.away_team_id;

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr 40px 40px 40px 40px 50px 50px 50px',
        padding: '12px 16px',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        fontWeight: '600',
        fontSize: '11px',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        <div>#</div>
        <div style={{ textAlign: 'left' }}>Takim</div>
        <div>O</div>
        <div>G</div>
        <div>B</div>
        <div>M</div>
        <div>AG</div>
        <div>Av</div>
        <div>P</div>
      </div>

      {/* Teams */}
      {standings.map((team, idx) => {
        const isHomeTeam = team.team_id === homeTeamId;
        const isAwayTeam = team.team_id === awayTeamId;
        const isHighlighted = isHomeTeam || isAwayTeam;

        return (
          <div
            key={team.team_id || idx}
            onClick={() => navigate(`/team/${team.team_id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 40px 40px 40px 40px 50px 50px 50px',
              padding: '12px 16px',
              borderBottom: idx < standings.length - 1 ? '1px solid #f3f4f6' : 'none',
              backgroundColor: isHighlighted
                ? isHomeTeam ? '#dbeafe' : '#fee2e2'
                : 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              textAlign: 'center',
              fontSize: '13px'
            }}
          >
            <div style={{
              fontWeight: '600',
              color: team.position <= 4 ? '#22c55e' :
                team.position > standings.length - 3 ? '#ef4444' : '#374151'
            }}>
              {team.position}
            </div>
            <div style={{
              textAlign: 'left',
              fontWeight: isHighlighted ? '600' : '400',
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {team.team_logo && (
                <img
                  src={team.team_logo}
                  alt=""
                  style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                />
              )}
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {team.team_name}
              </span>
              {isHomeTeam && <span style={{ color: '#3b82f6', fontSize: '11px' }}>(E)</span>}
              {isAwayTeam && <span style={{ color: '#ef4444', fontSize: '11px' }}>(D)</span>}
            </div>
            <div style={{ color: '#6b7280' }}>{team.played}</div>
            <div style={{ color: '#22c55e' }}>{team.won}</div>
            <div style={{ color: '#eab308' }}>{team.drawn}</div>
            <div style={{ color: '#ef4444' }}>{team.lost}</div>
            <div style={{ color: '#6b7280' }}>{team.goals_for}-{team.goals_against}</div>
            <div style={{
              color: team.goal_diff > 0 ? '#22c55e' : team.goal_diff < 0 ? '#ef4444' : '#6b7280'
            }}>
              {team.goal_diff > 0 ? '+' : ''}{team.goal_diff}
            </div>
            <div style={{ fontWeight: '700', color: '#1f2937' }}>{team.points}</div>
          </div>
        );
      })}
    </div>
  );
}

export default StandingsTab;
