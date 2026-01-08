/**
 * Standings Tab
 *
 * Displays league standings table with highlighted teams.
 * NOW WITH LAZY LOADING: Fetches data only when tab is clicked.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchDetail } from '../MatchDetailContext';

export function StandingsTab() {
  const navigate = useNavigate();
  const { match, tabData, tabLoadingStates, fetchTabData } = useMatchDetail();

  // LAZY LOADING: Trigger fetch on mount
  useEffect(() => {
    fetchTabData('standings');
  }, [fetchTabData]);

  const loading = tabLoadingStates.standings;
  const standings = tabData.standings?.results || [];

  // Show loading state while fetching
  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
        <span className="ml-3 text-gray-600">Puan durumu yükleniyor...</span>
      </div>
    );
  }

  if (!standings.length) {
    return (
      <div className="text-center p-8 md:p-10 text-gray-600 bg-white rounded-xl">
        Puan durumu bulunamadı
      </div>
    );
  }

  const homeTeamId = match?.home_team_id || '';
  const awayTeamId = match?.away_team_id || '';

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 sm:p-3 text-left font-semibold sticky left-0 bg-gray-50 z-10">#</th>
              <th className="p-2 sm:p-3 text-left font-semibold min-w-[120px] sm:min-w-[150px]">Takım</th>
              <th className="p-2 sm:p-3 text-center font-semibold">O</th>
              <th className="p-2 sm:p-3 text-center font-semibold">G</th>
              <th className="p-2 sm:p-3 text-center font-semibold">B</th>
              <th className="p-2 sm:p-3 text-center font-semibold">M</th>
              <th className="p-2 sm:p-3 text-center font-semibold">P</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team: any, idx: number) => {
              const isHighlighted = team.team_id === homeTeamId || team.team_id === awayTeamId;
              return (
                <tr key={idx} className={`border-b border-gray-100 ${isHighlighted ? 'bg-blue-50' : 'bg-white'}`}>
                  <td className="p-2 sm:p-3 font-semibold sticky left-0 bg-inherit z-10">{team.position || idx + 1}</td>
                  <td className="p-2 sm:p-3">
                    <div
                      onClick={() => navigate(`/team/${team.team_id}`)}
                      className="flex items-center gap-2 cursor-pointer text-blue-700 hover:text-blue-900"
                      style={{ fontWeight: isHighlighted ? '600' : '400' }}
                    >
                      {team.team_logo && (
                        <img
                          src={team.team_logo}
                          alt=""
                          className="w-4 h-4 sm:w-5 sm:h-5 object-contain flex-shrink-0"
                        />
                      )}
                      <span className="truncate">{team.team_name || `Takım ${idx + 1}`}</span>
                    </div>
                  </td>
                  <td className="p-2 sm:p-3 text-center">{team.played}</td>
                  <td className="p-2 sm:p-3 text-center">{team.won}</td>
                  <td className="p-2 sm:p-3 text-center">{team.drawn}</td>
                  <td className="p-2 sm:p-3 text-center">{team.lost}</td>
                  <td className="p-2 sm:p-3 text-center font-semibold">{team.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StandingsTab;
