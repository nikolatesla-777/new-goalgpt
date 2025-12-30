/**
 * Team Card Page
 * 
 * Displays team information, standings, fixtures
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTeamById, getTeamFixtures, getTeamStandings } from '../../api/matches';

interface TeamData {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  country_id: string | null;
  competition: {
    external_id: string;
    name: string;
    logo_url: string | null;
  } | null;
  current_season_id: string | null;
  recent_form: Array<{
    match_id: string;
    result: 'W' | 'D' | 'L';
    score: string;
    opponent: string;
    isHome: boolean;
    date: string;
  }>;
}

interface Standing {
  position: number;
  team_id: string;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

interface FixtureMatch {
  id: string;
  match_time: number;
  status_id: number;
  home_team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  away_team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  is_home: boolean;
}

export function TeamCardPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  
  const [team, setTeam] = useState<TeamData | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [fixtures, setFixtures] = useState<{
    past_matches: FixtureMatch[];
    upcoming_matches: FixtureMatch[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'fixtures'>('overview');

  useEffect(() => {
    if (!teamId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all data in parallel
        const [teamData, standingsData, fixturesData] = await Promise.all([
          getTeamById(teamId),
          getTeamStandings(teamId).catch(() => null),
          getTeamFixtures(teamId).catch(() => null),
        ]);

        setTeam(teamData);
        setStanding(standingsData?.standing || null);
        setFixtures(fixturesData ? {
          past_matches: fixturesData.past_matches || [],
          upcoming_matches: fixturesData.upcoming_matches || [],
        } : null);
      } catch (err: any) {
        setError(err.message || 'Takım bilgileri yüklenemedi');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId]);

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
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          Yükleniyor...
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
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>❌</div>
          {error || 'Takım bulunamadı'}
          <div style={{ marginTop: '16px' }}>
            <button 
              onClick={() => navigate(-1)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Utility functions available for use in match card
  // const formatDate = (timestamp: number) => {
  //   const date = new Date(timestamp * 1000);
  //   return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  // };

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
            ← Geri
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
                ⚽
              </div>
            )}
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
                {team.name}
              </h1>
              {team.competition && (
                <div style={{ 
                  marginTop: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  color: 'rgba(255,255,255,0.8)'
                }}>
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
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              flex: 1,
              padding: '16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'overview' ? '600' : '400',
              color: activeTab === 'overview' ? '#3b82f6' : '#6b7280',
              borderBottom: activeTab === 'overview' ? '2px solid #3b82f6' : '2px solid transparent'
            }}
          >
            📊 Genel Bakış
          </button>
          <button
            onClick={() => setActiveTab('fixtures')}
            style={{
              flex: 1,
              padding: '16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'fixtures' ? '600' : '400',
              color: activeTab === 'fixtures' ? '#3b82f6' : '#6b7280',
              borderBottom: activeTab === 'fixtures' ? '2px solid #3b82f6' : '2px solid transparent'
            }}
          >
            📅 Fikstür
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
        {activeTab === 'overview' && (
          <div>
            {/* Standings Card */}
            {standing && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '12px', 
                padding: '20px',
                marginBottom: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                  📊 Puan Durumu
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)', 
                  gap: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    backgroundColor: '#f3f4f6', 
                    padding: '16px', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a5f' }}>
                      {standing.position}.
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Sıra</div>
                  </div>
                  <div style={{ 
                    backgroundColor: '#f3f4f6', 
                    padding: '16px', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>
                      {standing.points}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Puan</div>
                  </div>
                  <div style={{ 
                    backgroundColor: '#f3f4f6', 
                    padding: '16px', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e' }}>
                      {standing.won}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Galibiyet</div>
                  </div>
                  <div style={{ 
                    backgroundColor: '#f3f4f6', 
                    padding: '16px', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: standing.goal_diff >= 0 ? '#22c55e' : '#ef4444' }}>
                      {standing.goal_diff > 0 ? '+' : ''}{standing.goal_diff}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Averaj</div>
                  </div>
                </div>

                {/* Stats Row */}
                <div style={{ 
                  marginTop: '16px', 
                  display: 'flex', 
                  justifyContent: 'space-around',
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}>
                  <div><span style={{ color: '#6b7280' }}>O:</span> <strong>{standing.played}</strong></div>
                  <div><span style={{ color: '#6b7280' }}>G:</span> <strong style={{ color: '#22c55e' }}>{standing.won}</strong></div>
                  <div><span style={{ color: '#6b7280' }}>B:</span> <strong style={{ color: '#eab308' }}>{standing.drawn}</strong></div>
                  <div><span style={{ color: '#6b7280' }}>M:</span> <strong style={{ color: '#ef4444' }}>{standing.lost}</strong></div>
                  <div><span style={{ color: '#6b7280' }}>AG:</span> <strong>{standing.goals_for}</strong></div>
                  <div><span style={{ color: '#6b7280' }}>YG:</span> <strong>{standing.goals_against}</strong></div>
                </div>
              </div>
            )}

            {/* Upcoming Match */}
            {fixtures?.upcoming_matches && fixtures.upcoming_matches.length > 0 && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '12px', 
                padding: '20px',
                marginBottom: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                  ⏳ Sonraki Maç
                </h3>
                <MatchCard match={fixtures.upcoming_matches[0]} teamId={teamId!} navigate={navigate} />
              </div>
            )}

            {/* Recent Matches */}
            {fixtures?.past_matches && fixtures.past_matches.length > 0 && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                  📜 Son Maçlar
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {fixtures.past_matches.slice(0, 5).map((match) => (
                    <MatchCard key={match.id} match={match} teamId={teamId!} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'fixtures' && (
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
                  📅 Gelecek Maçlar ({fixtures.upcoming_matches.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {fixtures.upcoming_matches.map((match) => (
                    <MatchCard key={match.id} match={match} teamId={teamId!} navigate={navigate} />
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
                  📜 Geçmiş Maçlar ({fixtures.past_matches.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {fixtures.past_matches.map((match) => (
                    <MatchCard key={match.id} match={match} teamId={teamId!} navigate={navigate} />
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
                Fikstür bilgisi bulunamadı
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Match Card Component
function MatchCard({ match, teamId, navigate }: { match: FixtureMatch; teamId: string; navigate: any }) {
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
            animation: 'pulse 2s infinite'
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

export default TeamCardPage;

