/**
 * Team Card Page
 * 
 * Displays team information with 5 tabs:
 * 1. Genel Bilgi (General Info)
 * 2. Kadro (Squad)
 * 3. Fikstür (Fixtures)
 * 4. Puan Durumu (Standings)
 * 5. Oyuncu İstatistikleri (Player Stats)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTeamById, getTeamFixtures, getTeamStandings } from '../../api/matches';

interface TeamData {
  id: string;
  external_id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  country_id: string | null;
  country_name?: string;
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
  season_stats: {
    matches_played?: number;
    goals?: number;
    assists?: number;
    yellow_cards?: number;
    red_cards?: number;
    rating_avg?: number;
  } | null;
}

type TabType = 'info' | 'squad' | 'fixtures' | 'standings' | 'player-stats';

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
  const [squad, setSquad] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('info');

  useEffect(() => {
    if (!teamId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all data in parallel
        const [teamData, standingsData, fixturesData, squadData] = await Promise.all([
          getTeamById(teamId),
          getTeamStandings(teamId).catch(() => null),
          getTeamFixtures(teamId).catch(() => null),
          fetch(`/api/players/team/${teamId}`).then(r => r.json()).catch(() => ({ players: [] })),
        ]);

        setTeam(teamData);
        setStanding(standingsData?.standing || null);
        setAllStandings(standingsData?.standings || []);
        setFixtures(fixturesData ? {
          past_matches: fixturesData.past_matches || [],
          upcoming_matches: fixturesData.upcoming_matches || [],
        } : null);
        setSquad(squadData.players || []);
      } catch (err: any) {
        setError(err.message || 'Takım bilgileri yüklenemedi');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId]);

  // Group players by position
  const groupedSquad = {
    goalkeepers: squad.filter(p => p.position === 'G' || p.position === 'GK'),
    defenders: squad.filter(p => p.position === 'D' || p.position === 'DF'),
    midfielders: squad.filter(p => p.position === 'M' || p.position === 'MF'),
    forwards: squad.filter(p => p.position === 'F' || p.position === 'FW'),
    unknown: squad.filter(p => !p.position || !['G', 'GK', 'D', 'DF', 'M', 'MF', 'F', 'FW'].includes(p.position)),
  };

  // Players with stats
  const playersWithStats = squad
    .filter(p => p.season_stats && (p.season_stats.matches_played || 0) > 0)
    .sort((a, b) => (b.season_stats?.goals || 0) - (a.season_stats?.goals || 0));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl mb-4">❌ {error || 'Takım bulunamadı'}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-emerald-400 hover:text-emerald-300"
          >
            ← Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a1d] to-[#2d2d30] border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <span>← Geri</span>
          </button>

          {/* Team Info */}
          <div className="flex items-center gap-6">
            {team.logo_url ? (
              <img 
                src={team.logo_url} 
                alt={team.name}
                className="w-20 h-20 object-contain"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-700 rounded-xl flex items-center justify-center text-4xl">
                ⚽
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{team.name}</h1>
              {team.competition && (
                <button
                  onClick={() => navigate(`/league/${team.competition?.external_id}`)}
                  className="mt-2 flex items-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors"
                >
                  {team.competition.logo_url && (
                    <img src={team.competition.logo_url} alt="" className="w-5 h-5 object-contain" />
                  )}
                  <span>{team.competition.name}</span>
                </button>
              )}
            </div>

            {/* Quick Stats */}
            {standing && (
              <div className="hidden md:flex gap-6 ml-auto text-center">
                <div>
                  <div className="text-2xl font-bold text-emerald-400">{standing.position}.</div>
                  <div className="text-xs text-gray-500">Sıra</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">{standing.points}</div>
                  <div className="text-xs text-gray-500">Puan</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{standing.won}</div>
                  <div className="text-xs text-gray-500">Galibiyet</div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Form */}
          {team.recent_form && team.recent_form.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gray-500 mb-2">Son Form</div>
              <div className="flex gap-2">
                {team.recent_form.slice(0, 5).map((match, idx) => (
                  <div
                    key={idx}
                    className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm text-white ${
                      match.result === 'W' ? 'bg-emerald-500' :
                      match.result === 'D' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
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
      <div className="border-b border-gray-800 bg-[#111113] overflow-x-auto">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1 min-w-max">
            {[
              { id: 'info' as TabType, label: 'Genel Bilgi', icon: '📊' },
              { id: 'squad' as TabType, label: 'Kadro', icon: '👥' },
              { id: 'fixtures' as TabType, label: 'Fikstür', icon: '📅' },
              { id: 'standings' as TabType, label: 'Puan Durumu', icon: '🏆' },
              { id: 'player-stats' as TabType, label: 'Oyuncu İst.', icon: '⚽' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Quick Stats */}
            {standing && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">📊 Genel Bakış</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <StatBox label="Sıra" value={`${standing.position}.`} color="text-emerald-400" />
                  <StatBox label="Puan" value={standing.points} color="text-blue-400" />
                  <StatBox label="Galibiyet" value={standing.won} color="text-yellow-400" />
                  <StatBox label="Averaj" value={standing.goal_diff > 0 ? `+${standing.goal_diff}` : standing.goal_diff} color={standing.goal_diff >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                </div>
                <div className="mt-4 flex justify-around py-3 bg-[#2a2a2d] rounded-lg text-sm">
                  <span><span className="text-gray-500">O:</span> <strong>{standing.played}</strong></span>
                  <span><span className="text-gray-500">G:</span> <strong className="text-emerald-400">{standing.won}</strong></span>
                  <span><span className="text-gray-500">B:</span> <strong className="text-yellow-400">{standing.drawn}</strong></span>
                  <span><span className="text-gray-500">M:</span> <strong className="text-red-400">{standing.lost}</strong></span>
                  <span><span className="text-gray-500">AG:</span> <strong>{standing.goals_for}</strong></span>
                  <span><span className="text-gray-500">YG:</span> <strong>{standing.goals_against}</strong></span>
                </div>
              </div>
            )}

            {/* Next Match */}
            {fixtures?.upcoming_matches && fixtures.upcoming_matches.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">⏳ Sonraki Maç</h3>
                <MatchCard match={fixtures.upcoming_matches[0]} teamId={teamId!} navigate={navigate} />
              </div>
            )}

            {/* Recent Matches */}
            {fixtures?.past_matches && fixtures.past_matches.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">📜 Son Maçlar</h3>
                <div className="space-y-2">
                  {fixtures.past_matches.slice(0, 5).map((match) => (
                    <MatchCard key={match.id} match={match} teamId={teamId!} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Squad Tab */}
        {activeTab === 'squad' && (
          <div className="space-y-6">
            {squad.length > 0 ? (
              <>
                {groupedSquad.goalkeepers.length > 0 && (
                  <SquadSection title="Kaleciler" players={groupedSquad.goalkeepers} navigate={navigate} />
                )}
                {groupedSquad.defenders.length > 0 && (
                  <SquadSection title="Defans" players={groupedSquad.defenders} navigate={navigate} />
                )}
                {groupedSquad.midfielders.length > 0 && (
                  <SquadSection title="Orta Saha" players={groupedSquad.midfielders} navigate={navigate} />
                )}
                {groupedSquad.forwards.length > 0 && (
                  <SquadSection title="Forvet" players={groupedSquad.forwards} navigate={navigate} />
                )}
                {groupedSquad.unknown.length > 0 && (
                  <SquadSection title="Diğer" players={groupedSquad.unknown} navigate={navigate} />
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">👥</div>
                <p>Kadro bilgisi bulunamadı</p>
              </div>
            )}
          </div>
        )}

        {/* Fixtures Tab */}
        {activeTab === 'fixtures' && (
          <div className="space-y-6">
            {/* Upcoming */}
            {fixtures?.upcoming_matches && fixtures.upcoming_matches.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">📅 Gelecek Maçlar ({fixtures.upcoming_matches.length})</h3>
                <div className="space-y-2">
                  {fixtures.upcoming_matches.map((match) => (
                    <MatchCard key={match.id} match={match} teamId={teamId!} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {fixtures?.past_matches && fixtures.past_matches.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">📜 Geçmiş Maçlar ({fixtures.past_matches.length})</h3>
                <div className="space-y-2">
                  {fixtures.past_matches.map((match) => (
                    <MatchCard key={match.id} match={match} teamId={teamId!} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {(!fixtures?.upcoming_matches?.length && !fixtures?.past_matches?.length) && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">📅</div>
                <p>Fikstür bilgisi bulunamadı</p>
              </div>
            )}
          </div>
        )}

        {/* Standings Tab */}
        {activeTab === 'standings' && (
          <div className="bg-[#1a1a1d] rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">🏆 Puan Durumu</h3>
            {allStandings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Takım</th>
                      <th className="text-center py-2 px-2">O</th>
                      <th className="text-center py-2 px-2">G</th>
                      <th className="text-center py-2 px-2">B</th>
                      <th className="text-center py-2 px-2">M</th>
                      <th className="text-center py-2 px-2">AG</th>
                      <th className="text-center py-2 px-2">YG</th>
                      <th className="text-center py-2 px-2">AV</th>
                      <th className="text-center py-2 px-2 font-semibold">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStandings.map((s) => (
                      <tr
                        key={s.team_id}
                        onClick={() => navigate(`/team/${s.team_id}`)}
                        className={`border-b border-gray-800 cursor-pointer hover:bg-[#2a2a2d] transition-colors ${
                          s.team_id === teamId ? 'bg-emerald-500/10' : ''
                        }`}
                      >
                        <td className="py-2 px-2 font-medium">{s.position}</td>
                        <td className="py-2 px-2">
                          <span className={s.team_id === teamId ? 'text-emerald-400 font-semibold' : ''}>
                            {s.team_name}
                          </span>
                        </td>
                        <td className="text-center py-2 px-2">{s.played}</td>
                        <td className="text-center py-2 px-2 text-emerald-400">{s.won}</td>
                        <td className="text-center py-2 px-2 text-yellow-400">{s.drawn}</td>
                        <td className="text-center py-2 px-2 text-red-400">{s.lost}</td>
                        <td className="text-center py-2 px-2">{s.goals_for}</td>
                        <td className="text-center py-2 px-2">{s.goals_against}</td>
                        <td className={`text-center py-2 px-2 ${s.goal_diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
                        </td>
                        <td className="text-center py-2 px-2 font-bold">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">🏆</div>
                <p>Puan durumu bilgisi bulunamadı</p>
              </div>
            )}
          </div>
        )}

        {/* Player Stats Tab */}
        {activeTab === 'player-stats' && (
          <div className="bg-[#1a1a1d] rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">⚽ Oyuncu İstatistikleri</h3>
            {playersWithStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-2 px-2">Oyuncu</th>
                      <th className="text-center py-2 px-2">Maç</th>
                      <th className="text-center py-2 px-2">Gol</th>
                      <th className="text-center py-2 px-2">Asist</th>
                      <th className="text-center py-2 px-2">SK</th>
                      <th className="text-center py-2 px-2">KK</th>
                      <th className="text-center py-2 px-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playersWithStats.map((player) => (
                      <tr
                        key={player.external_id}
                        onClick={() => navigate(`/player/${player.external_id}`)}
                        className="border-b border-gray-800 cursor-pointer hover:bg-[#2a2a2d] transition-colors"
                      >
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {player.logo ? (
                              <img src={player.logo} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                                👤
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{player.name}</div>
                              <div className="text-xs text-gray-500">{formatPosition(player.position)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-center py-2 px-2">{player.season_stats?.matches_played || 0}</td>
                        <td className="text-center py-2 px-2 text-emerald-400 font-semibold">{player.season_stats?.goals || 0}</td>
                        <td className="text-center py-2 px-2 text-blue-400">{player.season_stats?.assists || 0}</td>
                        <td className="text-center py-2 px-2 text-yellow-400">{player.season_stats?.yellow_cards || 0}</td>
                        <td className="text-center py-2 px-2 text-red-400">{player.season_stats?.red_cards || 0}</td>
                        <td className="text-center py-2 px-2">
                          {player.season_stats?.rating_avg ? player.season_stats.rating_avg.toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">📊</div>
                <p>Oyuncu istatistiği bulunamadı</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[#2a2a2d] rounded-lg p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function SquadSection({ title, players, navigate }: { title: string; players: Player[]; navigate: any }) {
  return (
    <div className="bg-[#1a1a1d] rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {players.map((player) => (
          <button
            key={player.external_id}
            onClick={() => navigate(`/player/${player.external_id}`)}
            className="flex items-center gap-3 p-3 bg-[#2a2a2d] rounded-lg hover:bg-[#3a3a3d] transition-colors text-left"
          >
            {player.logo ? (
              <img src={player.logo} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                👤
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{player.name}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                {player.shirt_number && <span>#{player.shirt_number}</span>}
                {player.nationality && <span>{player.nationality}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match, teamId, navigate }: { match: FixtureMatch; teamId: string; navigate: any }) {
  const isFinished = match.status_id === 8;
  const isLive = [2, 3, 4, 5, 7].includes(match.status_id);
  
  let resultColor = 'border-gray-700';
  if (isFinished && match.home_score !== null && match.away_score !== null) {
    const isHome = match.home_team.id === teamId;
    const teamScore = isHome ? match.home_score : match.away_score;
    const opponentScore = isHome ? match.away_score : match.home_score;
    
    if (teamScore > opponentScore) resultColor = 'border-emerald-500';
    else if (teamScore < opponentScore) resultColor = 'border-red-500';
    else resultColor = 'border-yellow-500';
  }

  return (
    <div
      onClick={() => navigate(`/match/${match.id}`)}
      className={`flex items-center p-3 bg-[#2a2a2d] rounded-lg cursor-pointer hover:bg-[#3a3a3d] transition-colors border-l-4 ${resultColor}`}
    >
      {/* Date/Time */}
      <div className="w-16 text-center text-xs text-gray-500">
        <div>{new Date(match.match_time * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>
        {!isFinished && !isLive && (
          <div className="font-semibold text-white">
            {new Date(match.match_time * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        {isLive && <div className="font-semibold text-red-500 animate-pulse">CANLI</div>}
      </div>

      {/* Teams */}
      <div className="flex-1 flex items-center gap-2">
        <div className={`flex-1 flex items-center justify-end gap-2 ${match.home_team.id === teamId ? 'font-semibold' : ''}`}>
          <span className="text-sm truncate">{match.home_team.name}</span>
          {match.home_team.logo_url && <img src={match.home_team.logo_url} alt="" className="w-6 h-6 object-contain" />}
        </div>

        <div className={`w-14 text-center font-bold ${isLive ? 'text-red-500' : ''}`}>
          {(isFinished || isLive) ? `${match.home_score ?? 0} - ${match.away_score ?? 0}` : 'vs'}
        </div>

        <div className={`flex-1 flex items-center gap-2 ${match.away_team.id === teamId ? 'font-semibold' : ''}`}>
          {match.away_team.logo_url && <img src={match.away_team.logo_url} alt="" className="w-6 h-6 object-contain" />}
          <span className="text-sm truncate">{match.away_team.name}</span>
        </div>
      </div>

      {/* Round */}
      {match.round && <div className="w-10 text-right text-xs text-gray-500">H{match.round}</div>}
    </div>
  );
}

function formatPosition(pos: string | null): string {
  const positions: Record<string, string> = {
    'G': 'Kaleci',
    'GK': 'Kaleci',
    'D': 'Defans',
    'DF': 'Defans',
    'M': 'Orta Saha',
    'MF': 'Orta Saha',
    'F': 'Forvet',
    'FW': 'Forvet',
  };
  return positions[pos || ''] || pos || '-';
}

export default TeamCardPage;
