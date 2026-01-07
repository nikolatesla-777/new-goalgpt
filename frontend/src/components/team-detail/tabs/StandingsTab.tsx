/**
 * Standings Tab
 *
 * Displays league standings table with team highlighted.
 */

import { useNavigate } from 'react-router-dom';
import { useTeamDetail } from '../TeamDetailContext';

export function StandingsTab() {
  const navigate = useNavigate();
  const { teamId, team, standing, allStandings } = useTeamDetail();

  if (!standing) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        Puan durumu bilgisi bulunamadi.
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Lig Puan Durumu</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
              <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
              <th style={{ padding: '8px', textAlign: 'left' }}>Takim</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>O</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>G</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>B</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>M</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>Av</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>P</th>
            </tr>
          </thead>
          <tbody>
            {allStandings.map((s) => (
              <tr key={s.team_id} style={{
                borderBottom: '1px solid #f3f4f6',
                backgroundColor: s.team_id === teamId ? '#f0f9ff' : 'transparent'
              }}>
                <td style={{ padding: '10px 8px', fontWeight: s.team_id === teamId ? 'bold' : 'normal' }}>
                  {s.position}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <span
                    onClick={() => s.team_id !== teamId && navigate(`/team/${s.team_id}/overview`)}
                    style={{
                      fontWeight: s.team_id === teamId ? '600' : 'normal',
                      cursor: s.team_id !== teamId ? 'pointer' : 'default',
                      color: s.team_id !== teamId ? '#2563eb' : 'inherit',
                    }}
                  >
                    {s.team_name || (s.team_id === teamId ? team?.name : s.team_id.slice(-6))}
                  </span>
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.played}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.won}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.drawn}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.lost}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  {s.goal_diff > 0 ? '+' : ''}{s.goal_diff}
                </td>
                <td style={{
                  padding: '10px 8px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: s.team_id === teamId ? '#3b82f6' : 'inherit'
                }}>
                  {s.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '16px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
        Toplam {allStandings.length} takim
      </div>
    </div>
  );
}

export default StandingsTab;
