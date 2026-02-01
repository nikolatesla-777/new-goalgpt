/**
 * League Standings Page - Admin Panel
 *
 * Multi-league standings viewer with TheSports + FootyStats data
 * Supports: Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Süper Lig, etc.
 */

import { useState, useEffect } from 'react';
import {
  Trophy,
  ArrowsClockwise,
  Check,
  Warning,
  ChartBar,
  Target,
  Database,
  CaretDown
} from '@phosphor-icons/react';
import axios from 'axios';
import leaguesRegistry from '../../config/leagues_registry.json';

interface StandingsRow {
  position: number;
  team_id: string;
  team_name: string;
  mp: number;
  won: number;
  draw: number;
  loss: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  last_5: string[];
  ppg: number;
  cs_percent: number;
  btts_percent: number;
  xgf: number | null;
  over_15_percent: number;
  over_25_percent: number;
  avg_goals: number;
  // Live standings fields
  live_points?: number;
  live_position?: number;
  points_diff?: number;
}

interface StandingsResponse {
  competition_id: string;
  season_id: string;
  updated_at: string;
  has_live_matches: boolean;
  standings: StandingsRow[];
}

export default function LeagueStandingsPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDataSource, setShowDataSource] = useState(false);
  const [selectedView, setSelectedView] = useState<'overall' | 'home' | 'away'>('overall');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('super-lig'); // Default: Süper Lig

  // Get competition ID from selected league
  const selectedLeague = leaguesRegistry.leagues.find(l => l.id === selectedLeagueId);
  const competitionId = selectedLeague?.thesports.competition_id || '8y39mp1h6jmojxg';

  const fetchStandings = async (view: 'overall' | 'home' | 'away' = 'overall') => {
    if (!competitionId) {
      setError('Selected league not available in database');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `/api/admin/standings/${competitionId}`,
        { params: { view } }
      );

      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncStandings = async () => {
    if (!competitionId) return;

    setSyncing(true);

    try {
      await axios.post(
        `/api/admin/standings/sync/${competitionId}`
      );

      // Refresh data
      await fetchStandings(selectedView);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchStandings(selectedView);
  }, [selectedView, selectedLeagueId]);

  const getFormBadgeColor = (result: string) => {
    switch (result) {
      case 'W': return 'bg-green-500';
      case 'D': return 'bg-yellow-500';
      case 'L': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getLastUpdatedTime = () => {
    if (!data) return '';
    const date = new Date(data.updated_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} saat önce`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} gün önce`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-[1800px] mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-700 flex items-center justify-center shadow-lg">
              <Trophy className="w-8 h-8 text-white" weight="fill" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {selectedLeague?.display_name || 'League Standings'}
              </h1>
              <p className="text-gray-400">
                {selectedLeague?.country} • 2025-2026 Season
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* League Selector */}
            <div className="relative">
              <select
                value={selectedLeagueId}
                onChange={(e) => setSelectedLeagueId(e.target.value)}
                className="appearance-none px-6 py-3 pr-10 bg-gray-800 border border-gray-700 text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-750 transition-all cursor-pointer"
              >
                {leaguesRegistry.leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.country === 'Turkey' ? '🇹🇷' : league.country === 'England' ? '🏴󠁧󠁢󠁥󠁮󠁧󠁿' : league.country === 'Spain' ? '🇪🇸' : league.country === 'Germany' ? '🇩🇪' : league.country === 'Italy' ? '🇮🇹' : league.country === 'France' ? '🇫🇷' : '🌍'} {league.display_name}
                  </option>
                ))}
              </select>
              <CaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <button
              onClick={syncStandings}
              disabled={syncing || loading}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg disabled:cursor-not-allowed"
            >
              <ArrowsClockwise
                className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`}
              />
              {syncing ? 'Syncing...' : 'Sync Data'}
            </button>
          </div>
        </div>

        {/* Data Source Info Banner */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-700/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <Database className="w-6 h-6 text-blue-400 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                Veri Kaynakları
                <button
                  onClick={() => setShowDataSource(!showDataSource)}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  {showDataSource ? 'Gizle' : 'Detayları Göster'}
                </button>
              </h3>

              {!showDataSource ? (
                <p className="text-gray-300 text-sm">
                  <strong className="text-yellow-400">TheSports API</strong> (temel puan durumu) +
                  <strong className="text-green-400"> ts_matches</strong> (hesaplanmış istatistikler)
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* TheSports */}
                  <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ChartBar className="w-5 h-5 text-yellow-400" />
                      <h4 className="font-semibold text-yellow-400">TheSports API</h4>
                    </div>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>✓ Position, MP, W, D, L</li>
                      <li>✓ GF, GA, GD, Points</li>
                      <li>✓ Home/Away breakdown</li>
                      <li>✓ Real-time sync</li>
                    </ul>
                    <p className="text-xs text-gray-500 mt-2 italic">
                      Endpoint: /season/recent/table/detail
                    </p>
                  </div>

                  {/* Calculated Stats */}
                  <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-green-400" />
                      <h4 className="font-semibold text-green-400">Hesaplanmış İstatistikler</h4>
                    </div>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>✓ Last 5 Form (ts_matches)</li>
                      <li>✓ CS%, BTTS% (ts_matches)</li>
                      <li>✓ Over 1.5%, Over 2.5%</li>
                      <li>✓ PPG, AVG Goals</li>
                    </ul>
                    <p className="text-xs text-gray-500 mt-2 italic">
                      Kaynak: Son 20 maçın analizi
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {data && data.standings && (
            <div className="mt-4 pt-4 border-t border-blue-700/30 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Check className="w-4 h-4 text-green-400" />
                <span>Son güncelleme: {getLastUpdatedTime()}</span>
              </div>
              <div className="text-gray-400">
                {data.standings.length} takım • {data.standings.length} satır veri
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Warning className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-red-400 font-semibold">Hata</p>
                <p className="text-gray-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* View Selector (HOME/AWAY) */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Görünüm:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedView('overall')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedView === 'overall'
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                📊 Genel
              </button>
              <button
                onClick={() => setSelectedView('home')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedView === 'home'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🏠 İç Saha
              </button>
              <button
                onClick={() => setSelectedView('away')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedView === 'away'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ✈️ Deplasman
              </button>
            </div>
            <div className="ml-auto text-xs text-gray-500">
              {selectedView === 'overall' && '(Tüm maçlar)'}
              {selectedView === 'home' && '(Sadece ev sahibi maçlar)'}
              {selectedView === 'away' && '(Sadece deplasman maçlar)'}
            </div>
          </div>
        </div>
      </div>

      {/* Standings Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <ArrowsClockwise className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Puan durumu yükleniyor...</p>
          </div>
        </div>
      ) : data ? (
        <div className="max-w-[1800px] mx-auto">
          <div className="bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
            {/* Scrollable Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-300 border-b border-gray-700">
                    <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-gray-900 z-10">Sıra</th>
                    <th className="px-4 py-3 text-left font-semibold sticky left-[60px] bg-gray-900 z-10 min-w-[200px]">Takım</th>

                    {/* TheSports Columns */}
                    <th className="px-3 py-3 text-center font-semibold bg-yellow-900/20" title="Maç Played">MP</th>
                    <th className="px-3 py-3 text-center font-semibold bg-yellow-900/20" title="Won">W</th>
                    <th className="px-3 py-3 text-center font-semibold bg-yellow-900/20" title="Draw">D</th>
                    <th className="px-3 py-3 text-center font-semibold bg-yellow-900/20" title="Loss">L</th>
                    <th className="px-3 py-3 text-center font-semibold bg-yellow-900/20" title="Goals For">GF</th>
                    <th className="px-3 py-3 text-center font-semibold bg-yellow-900/20" title="Goals Against">GA</th>
                    <th className="px-3 py-3 text-center font-semibold bg-yellow-900/20" title="Goal Difference">GD</th>
                    <th className="px-3 py-3 text-center font-semibold bg-yellow-900/20" title="Points">Pts</th>

                    {/* Calculated Columns */}
                    <th className="px-3 py-3 text-center font-semibold bg-green-900/20 min-w-[140px]" title="Last 5">Last 5</th>
                    <th className="px-3 py-3 text-center font-semibold bg-green-900/20" title="Points Per Game">PPG</th>
                    <th className="px-3 py-3 text-center font-semibold bg-green-900/20" title="Clean Sheet %">CS%</th>
                    <th className="px-3 py-3 text-center font-semibold bg-green-900/20" title="Both Teams To Score %">BTTS%</th>
                    <th className="px-3 py-3 text-center font-semibold bg-green-900/20" title="Expected Goals For">xGF</th>
                    <th className="px-3 py-3 text-center font-semibold bg-green-900/20" title="Over 1.5 Goals %">1.5+%</th>
                    <th className="px-3 py-3 text-center font-semibold bg-green-900/20" title="Over 2.5 Goals %">2.5+%</th>
                    <th className="px-3 py-3 text-center font-semibold bg-green-900/20" title="Average Goals">AVG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {(data?.standings || []).map((team) => (
                    <tr
                      key={team.team_id}
                      className={`
                        hover:bg-gray-700/50 transition-colors
                        ${team.position <= 5 ? 'bg-green-900/10' : ''}
                        ${team.position >= 16 ? 'bg-red-900/10' : ''}
                      `}
                    >
                      {/* Position */}
                      <td className="px-4 py-3 text-left font-bold sticky left-0 bg-gray-800 z-10">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm
                          ${team.position <= 5 ? 'bg-green-600 text-white' : ''}
                          ${team.position >= 16 ? 'bg-red-600 text-white' : ''}
                          ${team.position > 5 && team.position < 16 ? 'bg-gray-700 text-gray-300' : ''}
                        `}>
                          {team.position}
                        </div>
                      </td>

                      {/* Team Name */}
                      <td className="px-4 py-3 font-semibold text-white sticky left-[60px] bg-gray-800 z-10">
                        <div className="flex items-center gap-2">
                          <span>{team.team_name}</span>
                          {team.live_points !== undefined && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                              LIVE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TheSports Data */}
                      <td className="px-3 py-3 text-center text-gray-300 bg-yellow-900/5">{team.mp}</td>
                      <td className="px-3 py-3 text-center text-green-400 bg-yellow-900/5">{team.won}</td>
                      <td className="px-3 py-3 text-center text-yellow-400 bg-yellow-900/5">{team.draw}</td>
                      <td className="px-3 py-3 text-center text-red-400 bg-yellow-900/5">{team.loss}</td>
                      <td className="px-3 py-3 text-center text-gray-300 bg-yellow-900/5">{team.goals_for}</td>
                      <td className="px-3 py-3 text-center text-gray-300 bg-yellow-900/5">{team.goals_against}</td>
                      <td className={`px-3 py-3 text-center bg-yellow-900/5 ${team.goal_diff > 0 ? 'text-green-400' : team.goal_diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {team.goal_diff > 0 ? '+' : ''}{team.goal_diff}
                      </td>
                      <td className="px-3 py-3 text-center font-bold bg-yellow-900/5">
                        {team.live_points !== undefined ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-gray-400 line-through text-sm">{team.points}</span>
                            <span className="text-xl">→</span>
                            <span className={`font-bold text-lg animate-pulse ${
                              (team.points_diff ?? 0) > 0 ? 'text-green-400' :
                              (team.points_diff ?? 0) < 0 ? 'text-red-400' :
                              'text-gray-400'
                            }`}>{team.live_points}</span>
                          </div>
                        ) : (
                          <span className="text-white">{team.points}</span>
                        )}
                      </td>

                      {/* Calculated Data */}
                      <td className="px-3 py-3 bg-green-900/5">
                        <div className="flex items-center justify-center gap-1">
                          {(team.last_5 || []).map((result, i) => (
                            <div
                              key={i}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${getFormBadgeColor(result)}`}
                            >
                              {result}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-300 bg-green-900/5">{team.ppg?.toFixed(2) || '-'}</td>
                      <td className="px-3 py-3 text-center text-gray-300 bg-green-900/5">{team.cs_percent ?? '-'}%</td>
                      <td className="px-3 py-3 text-center text-gray-300 bg-green-900/5">{team.btts_percent ?? '-'}%</td>
                      <td className="px-3 py-3 text-center text-gray-300 bg-green-900/5">{team.xgf || '-'}</td>
                      <td className="px-3 py-3 text-center text-gray-300 bg-green-900/5">{team.over_15_percent ?? '-'}%</td>
                      <td className="px-3 py-3 text-center text-gray-300 bg-green-900/5">{team.over_25_percent ?? '-'}%</td>
                      <td className="px-3 py-3 text-center text-gray-300 bg-green-900/5">{team.avg_goals?.toFixed(2) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="bg-gray-900 border-t border-gray-700 px-6 py-4">
              <div className="flex flex-wrap gap-6 text-xs text-gray-400">
                <div>
                  <span className="text-yellow-400 font-semibold">● TheSports API:</span> MP, W, D, L, GF, GA, GD, Pts
                </div>
                <div>
                  <span className="text-green-400 font-semibold">● Hesaplanmış:</span> Last 5, PPG, CS%, BTTS%, 1.5+%, 2.5+%, AVG
                </div>
                <div className="ml-auto">
                  <span className="text-green-500">🟢 Şampiyonlar Ligi</span> •
                  <span className="text-red-500 ml-2">🔴 Küme Düşme</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
