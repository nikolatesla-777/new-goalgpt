/**
 * League Page
 * 
 * Displays league information with 4 tabs:
 * 1. Genel Bilgi (General Info)
 * 2. Fikstür (Fixtures)
 * 3. Takımlar (Teams)
 * 4. Puan Durumu (Standings)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface League {
  id: string;
  external_id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  country_id: string | null;
  country_name: string | null;
}

interface Team {
  external_id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
}

interface Fixture {
  id: string;
  match_time: number;
  status_id: number;
  round: number | null;
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
}

interface Standing {
  position: number;
  team_id: string;
  team_name: string;
  team_logo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

type TabType = 'info' | 'fixtures' | 'teams' | 'standings';

export function LeaguePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  
  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('info');

  useEffect(() => {
    if (!leagueId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [leagueRes, teamsRes, fixturesRes, standingsRes] = await Promise.all([
          fetch(`/api/leagues/${leagueId}`).then(r => r.json()),
          fetch(`/api/leagues/${leagueId}/teams`).then(r => r.json()).catch(() => ({ teams: [] })),
          fetch(`/api/leagues/${leagueId}/fixtures?limit=50`).then(r => r.json()).catch(() => ({ fixtures: [] })),
          fetch(`/api/leagues/${leagueId}/standings`).then(r => r.json()).catch(() => ({ standings: [] })),
        ]);

        if (leagueRes.error) {
          throw new Error(leagueRes.error);
        }

        setLeague(leagueRes.league);
        setTeams(teamsRes.teams || []);
        setFixtures(fixturesRes.fixtures || []);
        setStandings(standingsRes.standings || []);
      } catch (err: any) {
        setError(err.message || 'Lig bilgileri yüklenemedi');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl mb-4">❌ {error || 'Lig bulunamadı'}</p>
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

  // Group fixtures by round
  const upcomingFixtures = fixtures.filter(f => f.status_id === 1);
  const recentFixtures = fixtures.filter(f => f.status_id === 8);
  const liveFixtures = fixtures.filter(f => [2, 3, 4, 5, 7].includes(f.status_id));

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

          {/* League Info */}
          <div className="flex items-center gap-6">
            {league.logo_url ? (
              <img 
                src={league.logo_url} 
                alt={league.name}
                className="w-20 h-20 object-contain"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-700 rounded-xl flex items-center justify-center text-4xl">
                🏆
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{league.name}</h1>
              {league.country_name && (
                <div className="mt-2 text-gray-400">
                  📍 {league.country_name}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="hidden md:flex gap-6 ml-auto text-center">
              <div>
                <div className="text-2xl font-bold text-emerald-400">{teams.length}</div>
                <div className="text-xs text-gray-500">Takım</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{fixtures.length}</div>
                <div className="text-xs text-gray-500">Maç</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 bg-[#111113] overflow-x-auto">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1 min-w-max">
            {[
              { id: 'info' as TabType, label: 'Genel Bilgi', icon: '📊' },
              { id: 'fixtures' as TabType, label: 'Fikstür', icon: '📅' },
              { id: 'teams' as TabType, label: 'Takımlar', icon: '👥' },
              { id: 'standings' as TabType, label: 'Puan Durumu', icon: '🏆' },
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
            {/* Live Matches */}
            {liveFixtures.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4 border-l-4 border-red-500">
                <h3 className="text-lg font-semibold mb-4 text-red-400">🔴 Canlı Maçlar</h3>
                <div className="space-y-2">
                  {liveFixtures.map((match) => (
                    <MatchCard key={match.id} match={match} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Matches */}
            {upcomingFixtures.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">⏳ Yaklaşan Maçlar</h3>
                <div className="space-y-2">
                  {upcomingFixtures.slice(0, 5).map((match) => (
                    <MatchCard key={match.id} match={match} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Matches */}
            {recentFixtures.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">📜 Son Maçlar</h3>
                <div className="space-y-2">
                  {recentFixtures.slice(0, 5).map((match) => (
                    <MatchCard key={match.id} match={match} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {/* Top Teams */}
            {standings.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">🏆 Lider Takımlar</h3>
                <div className="space-y-2">
                  {standings.slice(0, 5).map((team) => (
                    <button
                      key={team.team_id}
                      onClick={() => navigate(`/team/${team.team_id}`)}
                      className="w-full flex items-center gap-4 p-3 bg-[#2a2a2d] rounded-lg hover:bg-[#3a3a3d] transition-colors"
                    >
                      <span className="w-6 text-center font-bold text-emerald-400">{team.position}</span>
                      {team.team_logo && (
                        <img src={team.team_logo} alt="" className="w-8 h-8 object-contain" />
                      )}
                      <span className="flex-1 text-left font-medium">{team.team_name}</span>
                      <span className="text-blue-400 font-bold">{team.points} P</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fixtures Tab */}
        {activeTab === 'fixtures' && (
          <div className="space-y-6">
            {liveFixtures.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4 border-l-4 border-red-500">
                <h3 className="text-lg font-semibold mb-4 text-red-400">🔴 Canlı ({liveFixtures.length})</h3>
                <div className="space-y-2">
                  {liveFixtures.map((match) => (
                    <MatchCard key={match.id} match={match} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {upcomingFixtures.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">📅 Gelecek Maçlar ({upcomingFixtures.length})</h3>
                <div className="space-y-2">
                  {upcomingFixtures.map((match) => (
                    <MatchCard key={match.id} match={match} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {recentFixtures.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">📜 Geçmiş Maçlar ({recentFixtures.length})</h3>
                <div className="space-y-2">
                  {recentFixtures.map((match) => (
                    <MatchCard key={match.id} match={match} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {fixtures.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">📅</div>
                <p>Fikstür bilgisi bulunamadı</p>
              </div>
            )}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="bg-[#1a1a1d] rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">👥 Takımlar ({teams.length})</h3>
            {teams.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {teams.map((team) => (
                  <button
                    key={team.external_id}
                    onClick={() => navigate(`/team/${team.external_id}`)}
                    className="flex items-center gap-3 p-3 bg-[#2a2a2d] rounded-lg hover:bg-[#3a3a3d] transition-colors"
                  >
                    {team.logo_url ? (
                      <img src={team.logo_url} alt="" className="w-10 h-10 object-contain" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                        ⚽
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium truncate">{team.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">👥</div>
                <p>Takım bilgisi bulunamadı</p>
              </div>
            )}
          </div>
        )}

        {/* Standings Tab */}
        {activeTab === 'standings' && (
          <div className="bg-[#1a1a1d] rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">🏆 Puan Durumu</h3>
            {standings.length > 0 ? (
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
                    {standings.map((s) => (
                      <tr
                        key={s.team_id}
                        onClick={() => navigate(`/team/${s.team_id}`)}
                        className="border-b border-gray-800 cursor-pointer hover:bg-[#2a2a2d] transition-colors"
                      >
                        <td className="py-2 px-2 font-medium">{s.position}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {s.team_logo && (
                              <img src={s.team_logo} alt="" className="w-6 h-6 object-contain" />
                            )}
                            <span>{s.team_name}</span>
                          </div>
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
      </div>
    </div>
  );
}

function MatchCard({ match, navigate }: { match: Fixture; navigate: any }) {
  const isFinished = match.status_id === 8;
  const isLive = [2, 3, 4, 5, 7].includes(match.status_id);

  return (
    <div
      onClick={() => navigate(`/match/${match.id}`)}
      className="flex items-center p-3 bg-[#2a2a2d] rounded-lg cursor-pointer hover:bg-[#3a3a3d] transition-colors"
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
        <div className="flex-1 flex items-center justify-end gap-2">
          <span className="text-sm truncate">{match.home_team.name}</span>
          {match.home_team.logo_url && <img src={match.home_team.logo_url} alt="" className="w-6 h-6 object-contain" />}
        </div>

        <div className={`w-14 text-center font-bold ${isLive ? 'text-red-500' : ''}`}>
          {(isFinished || isLive) ? `${match.home_score ?? 0} - ${match.away_score ?? 0}` : 'vs'}
        </div>

        <div className="flex-1 flex items-center gap-2">
          {match.away_team.logo_url && <img src={match.away_team.logo_url} alt="" className="w-6 h-6 object-contain" />}
          <span className="text-sm truncate">{match.away_team.name}</span>
        </div>
      </div>

      {/* Round */}
      {match.round && <div className="w-10 text-right text-xs text-gray-500">H{match.round}</div>}
    </div>
  );
}

export default LeaguePage;



