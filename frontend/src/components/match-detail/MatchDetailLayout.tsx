/**
 * Match Detail Layout
 *
 * Main layout component for match detail page with header, score, tabs, and content outlet.
 * Shows live match information with real-time updates.
 */

import { useParams, useNavigate, NavLink, Outlet } from 'react-router-dom';
import { MatchDetailProvider, useMatchDetail } from './MatchDetailContext';

// Status text mapping
const STATUS_TEXT: Record<number, string> = {
  1: 'Baslamadi',
  2: '1. Yari',
  3: 'Devre Arasi',
  4: '2. Yari',
  5: 'Uzatma',
  7: 'Penaltilar',
  8: 'Bitti',
  9: 'Ertelendi',
  10: 'Iptal',
};

// Status colors
const STATUS_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#f3f4f6', text: '#6b7280' },
  2: { bg: '#dcfce7', text: '#16a34a' },
  3: { bg: '#fef3c7', text: '#d97706' },
  4: { bg: '#dcfce7', text: '#16a34a' },
  5: { bg: '#dbeafe', text: '#2563eb' },
  7: { bg: '#fce7f3', text: '#db2777' },
  8: { bg: '#f3f4f6', text: '#374151' },
  9: { bg: '#fee2e2', text: '#dc2626' },
  10: { bg: '#fee2e2', text: '#dc2626' },
};

function MatchDetailLayoutInner() {
  const navigate = useNavigate();
  const { matchId, match, loading, error } = useMatchDetail();

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div style={{ fontSize: '18px' }}>Yukleniyor...</div>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: '#ef4444' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{error || 'Mac bulunamadi'}</div>
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

  const isLive = [2, 3, 4, 5, 7].includes(match.status_id);
  const statusColors = STATUS_COLORS[match.status_id] || STATUS_COLORS[1];
  const matchDate = new Date(match.match_time * 1000);

  const tabs = [
    { id: 'stats', path: 'stats', label: 'Istatistik' },
    { id: 'events', path: 'events', label: 'Olaylar' },
    { id: 'h2h', path: 'h2h', label: 'H2H' },
    { id: 'standings', path: 'standings', label: 'Puan' },
    { id: 'lineup', path: 'lineup', label: 'Kadro' },
    { id: 'trend', path: 'trend', label: 'Trend' },
    { id: 'ai', path: 'ai', label: 'AI' },
    { id: 'forum', path: 'forum', label: 'Forum' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
        color: 'white',
        padding: '16px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Back Button & Competition */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ← Geri
            </button>

            {match.competition && (
              <div
                onClick={() => navigate(`/competition/${match.competition?.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {match.competition.logo_url && (
                  <img
                    src={match.competition.logo_url}
                    alt=""
                    style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                  />
                )}
                {match.competition.name}
              </div>
            )}
          </div>

          {/* Match Score Card */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '20px'
          }}>
            {/* Status Badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <div style={{
                backgroundColor: statusColors.bg,
                color: statusColors.text,
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {isLive && (
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#16a34a',
                    animation: 'pulse 2s infinite'
                  }} />
                )}
                {match.minute_text || STATUS_TEXT[match.status_id]}
              </div>
            </div>

            {/* Teams & Score */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '16px',
              alignItems: 'center'
            }}>
              {/* Home Team */}
              <div
                onClick={() => navigate(`/team/${match.home_team_id}`)}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                {match.home_team?.logo_url ? (
                  <img
                    src={match.home_team.logo_url}
                    alt={match.home_team?.name}
                    style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto' }}
                  />
                ) : (
                  <div style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    fontSize: '24px'
                  }}>
                    H
                  </div>
                )}
                <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: '500' }}>
                  {match.home_team?.name || 'Ev Sahibi'}
                </div>
              </div>

              {/* Score */}
              <div style={{ textAlign: 'center' }}>
                {match.status_id === 1 ? (
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                    {matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                ) : (
                  <div style={{
                    fontSize: '48px',
                    fontWeight: 'bold',
                    letterSpacing: '4px'
                  }}>
                    {match.home_score ?? 0} - {match.away_score ?? 0}
                  </div>
                )}
                {/* Extra time / Penalties */}
                {(match.home_score_overtime > 0 || match.away_score_overtime > 0) && (
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                    Uzatma: {match.home_score_overtime} - {match.away_score_overtime}
                  </div>
                )}
                {(match.home_score_penalties > 0 || match.away_score_penalties > 0) && (
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                    Penalti: {match.home_score_penalties} - {match.away_score_penalties}
                  </div>
                )}
              </div>

              {/* Away Team */}
              <div
                onClick={() => navigate(`/team/${match.away_team_id}`)}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                {match.away_team?.logo_url ? (
                  <img
                    src={match.away_team.logo_url}
                    alt={match.away_team?.name}
                    style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto' }}
                  />
                ) : (
                  <div style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    fontSize: '24px'
                  }}>
                    D
                  </div>
                )}
                <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: '500' }}>
                  {match.away_team?.name || 'Deplasman'}
                </div>
              </div>
            </div>

            {/* Quick Stats (Red Cards, Corners) */}
            {(match.home_red_cards > 0 || match.away_red_cards > 0 ||
              match.home_corners > 0 || match.away_corners > 0) && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '24px',
                marginTop: '16px',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.7)'
              }}>
                {(match.home_red_cards > 0 || match.away_red_cards > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      width: '12px',
                      height: '16px',
                      backgroundColor: '#ef4444',
                      borderRadius: '2px'
                    }} />
                    {match.home_red_cards} - {match.away_red_cards}
                  </div>
                )}
                {(match.home_corners > 0 || match.away_corners > 0) && (
                  <div>
                    Korner: {match.home_corners} - {match.away_corners}
                  </div>
                )}
              </div>
            )}

            {/* Match Date */}
            <div style={{
              textAlign: 'center',
              marginTop: '12px',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.5)'
            }}>
              {matchDate.toLocaleDateString('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>
          </div>
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
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={`/match/${matchId}/${tab.path}`}
              style={({ isActive }) => ({
                flex: '0 0 auto',
                padding: '14px 16px',
                textDecoration: 'none',
                textAlign: 'center',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? '#3b82f6' : '#6b7280',
                borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                whiteSpace: 'nowrap',
                fontSize: '14px'
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

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export function MatchDetailLayout() {
  const { matchId } = useParams<{ matchId: string }>();

  if (!matchId) {
    return <div>Match ID gerekli</div>;
  }

  return (
    <MatchDetailProvider matchId={matchId}>
      <MatchDetailLayoutInner />
    </MatchDetailProvider>
  );
}

export default MatchDetailLayout;
