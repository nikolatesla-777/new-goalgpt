/**
 * Team Detail Layout
 *
 * Main layout component for team detail page with header, tabs, and content outlet.
 */

import { useParams, useNavigate, NavLink, Outlet } from 'react-router-dom';
import { TeamDetailProvider, useTeamDetail } from './TeamDetailContext';

function TeamDetailLayoutInner() {
  const navigate = useNavigate();
  const { teamId, team, loading, error } = useTeamDetail();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>Yukleniyor...</div>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: '#ef4444' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{error || 'Takim bulunamadi'}</div>
          <button
            onClick={() => navigate(-1)}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Geri Don
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', path: 'overview', label: 'Genel' },
    { id: 'fixtures', path: 'fixtures', label: 'Fikstur' },
    { id: 'standings', path: 'standings', label: 'Puan Durumu' },
    { id: 'stage', path: 'stage', label: 'Stage' },
    { id: 'players', path: 'players', label: 'Kadro' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
        color: 'white',
        padding: '24px 16px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Geri
          </button>

          {/* Team Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {team.logo_url ? (
              <img
                src={team.logo_url}
                alt={team.name}
                style={{ width: '80px', height: '80px', objectFit: 'contain' }}
              />
            ) : (
              <div style={{
                width: '80px',
                height: '80px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px'
              }}>
                T
              </div>
            )}
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
                {team.name}
              </h1>
              {team.competition && (
                <div
                  onClick={() => team.competition && navigate(`/competition/${team.competition.external_id}`)}
                  style={{
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'rgba(255,255,255,0.8)',
                    cursor: 'pointer',
                  }}
                >
                  {team.competition.logo_url && (
                    <img
                      src={team.competition.logo_url}
                      alt=""
                      style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                    />
                  )}
                  {team.competition.name}
                </div>
              )}
            </div>
          </div>

          {/* Recent Form */}
          {team.recent_form && team.recent_form.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                Son Form
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {team.recent_form.slice(0, 5).map((match, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      backgroundColor: match.result === 'W' ? '#22c55e' :
                        match.result === 'D' ? '#eab308' : '#ef4444',
                      color: 'white'
                    }}
                    title={`${match.opponent} (${match.score})`}
                  >
                    {match.result === 'W' ? 'G' : match.result === 'D' ? 'B' : 'M'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', overflowX: 'auto' }}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={`/team/${teamId}/${tab.path}`}
              style={({ isActive }) => ({
                flex: 1,
                padding: '16px',
                textDecoration: 'none',
                textAlign: 'center',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? '#3b82f6' : '#6b7280',
                borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                whiteSpace: 'nowrap',
                minWidth: '100px'
              })}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
        <Outlet />
      </div>
    </div>
  );
}

export function TeamDetailLayout() {
  const { teamId } = useParams<{ teamId: string }>();

  if (!teamId) {
    return <div>Team ID gerekli</div>;
  }

  return (
    <TeamDetailProvider teamId={teamId}>
      <TeamDetailLayoutInner />
    </TeamDetailProvider>
  );
}

export default TeamDetailLayout;
