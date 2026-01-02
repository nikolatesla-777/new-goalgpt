/**
 * Team Card Page
 * 
 * Displays team information, standings, fixtures
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTeamById, getTeamFixtures, getTeamStandings, getPlayersByTeam } from '../../api/matches';

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

interface Player {
  external_id: string;
  name: string;
  short_name: string | null;
  logo: string | null;
  position: string | null;
  shirt_number: number | null;
  age: number | null;
  nationality: string | null;
  market_value: number | null;
  market_value_currency: string | null;
  season_stats: any;
}

export function TeamCardPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();

  const [team, setTeam] = useState<TeamData | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [allStandings, setAllStandings] = useState<Standing[]>([]);
  const [fixtures, setFixtures] = useState<{
    past_matches: FixtureMatch[];
    upcoming_matches: FixtureMatch[];
  } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'fixtures' | 'standings' | 'stage' | 'players'>('overview');

  useEffect(() => {
    if (!teamId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setActiveTab('overview');

      try {
        // Fetch all data in parallel
        const [teamData, standingsData, fixturesData, playersData] = await Promise.all([
          getTeamById(teamId),
          getTeamStandings(teamId).catch(() => null),
          getTeamFixtures(teamId).catch(() => null),
          getPlayersByTeam(teamId).catch(() => ({ players: [] })),
        ]);

        setTeam(teamData);
        setStanding(standingsData?.standing || null);
        setAllStandings(standingsData?.standings || []);
        setFixtures(fixturesData ? {
          past_matches: fixturesData.past_matches || [],
          upcoming_matches: fixturesData.upcoming_matches || [],
        } : null);
        setPlayers(playersData?.players || []);
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
                <div
                  onClick={() => team.competition && navigate(`/competition/${team.competition.external_id}`)}
                  style={{
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'rgba(255,255,255,0.8)',
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
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
          {[
            { id: 'overview', label: '📊 Genel' },
            { id: 'fixtures', label: '📅 Fikstür' },
            { id: 'standings', label: '🏆 Puan Durumu' },
            { id: 'stage', label: '📍 Stage' },
            { id: 'players', label: '👥 Kadro' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                padding: '16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? '600' : '400',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                whiteSpace: 'nowrap',
                minWidth: '100px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
        {activeTab === 'overview' && (
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
                  ⏳ Sıradaki Maç
                </h3>
                <MatchCard match={fixtures.upcoming_matches[0]} teamId={teamId!} navigate={navigate} />
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
                  📜 Son Maçlar
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {fixtures.past_matches.slice(0, 5).map((match) => (
                    <MatchCard key={match.id} match={match} teamId={teamId!} navigate={navigate} />
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
                  📊 Puan Durumu Özeti
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

        {activeTab === 'standings' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            {standing ? (
              <>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>🏆 Lig Puan Durumu</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Takım</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>O</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>G</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>B</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>M</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Av</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStandings.map((s: any) => (
                      <tr key={s.team_id} style={{
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor: s.team_id === teamId ? '#f0f9ff' : 'transparent'
                      }}>
                        <td style={{ padding: '10px 8px', fontWeight: s.team_id === teamId ? 'bold' : 'normal' }}>{s.position}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span
                            onClick={() => s.team_id !== teamId && navigate(`/team/${s.team_id}`)}
                            style={{
                              fontWeight: s.team_id === teamId ? '600' : 'normal',
                              cursor: s.team_id !== teamId ? 'pointer' : 'default',
                              color: s.team_id !== teamId ? '#2563eb' : 'inherit',
                              textDecoration: s.team_id !== teamId ? 'none' : 'none'
                            }}
                            onMouseOver={(e) => s.team_id !== teamId && (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {s.team_name || (s.team_id === teamId ? team?.name : s.team_id.slice(-6))}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.played}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.won}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.drawn}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.lost}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.goal_diff > 0 ? '+' : ''}{s.goal_diff}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: s.team_id === teamId ? '#3b82f6' : 'inherit' }}>{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '16px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
                  Toplam {allStandings.length} takım
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Puan durumu bilgisi bulunamadı.</div>
            )}
          </div>
        )}

        {activeTab === 'stage' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>📍 Stage (Aşama) Bilgisi</h3>
            <div style={{ padding: '24px', textAlign: 'center', color: '#4b5563', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              {team?.competition ? (
                <>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>{team.competition.name}</div>
                  {/* If we have stage/round info in matches, we can calculate it. For now generic info */}
                  <div>Mevcut Sezon</div>
                </>
              ) : (
                <div>Lig/Kupa bilgisi mevcut değil.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'players' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>👥 Kadro ({players.length})</h3>
            {players.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
                {players.map(player => (
                  <div
                    key={player.external_id}
                    onClick={() => navigate(`/player/${player.external_id}`)}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: '#fff'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {player.logo ? (
                      <img src={player.logo} alt={player.name} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 8px' }} />
                    ) : (
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f3f4f6', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>👤</div>
                    )}
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{player.name}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{player.position} {player.shirt_number ? `• #${player.shirt_number}` : ''}</div>
                    {player.market_value && (
                      <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: '500' }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumSignificantDigits: 3 }).format(player.market_value)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280' }}>Kadro bilgisi bulunamadı.</div>
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

