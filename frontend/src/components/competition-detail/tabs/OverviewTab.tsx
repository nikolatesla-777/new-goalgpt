/**
 * Overview Tab
 *
 * Displays competition overview with upcoming matches and standings summary.
 */

import { useNavigate } from 'react-router-dom';
import { useCompetitionDetail } from '../CompetitionDetailContext';
import { MatchRow } from '../MatchRow';

export function OverviewTab() {
  const navigate = useNavigate();
  const { competitionId, upcomingMatches, standings } = useCompetitionDetail();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column: Upcoming Matches */}
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
            <h3 className="font-semibold text-white">Gelecek Maclar</h3>
            <button
              onClick={() => navigate(`/competition/${competitionId}/fixtures`)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              Tumunu Gor
            </button>
          </div>
          <div className="divide-y divide-slate-700/50">
            {upcomingMatches.length > 0 ? (
              upcomingMatches.slice(0, 5).map(match => (
                <MatchRow key={match.id} match={match} />
              ))
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm">Gelecek mac bulunamadi</div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Standings Summary */}
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
            <h3 className="font-semibold text-white">Zirve Yarisi</h3>
            <button
              onClick={() => navigate(`/competition/${competitionId}/standings`)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              Detayli Tablo
            </button>
          </div>
          {standings.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/50 bg-slate-800/30">
                  <th className="p-3 text-left font-medium w-10">#</th>
                  <th className="p-3 text-left font-medium">Takim</th>
                  <th className="p-3 text-center font-medium w-10">P</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {standings.slice(0, 5).map(s => (
                  <tr key={s.team_id} className="hover:bg-slate-700/30 transition-colors">
                    <td className={`p-3 font-semibold ${
                      s.position <= 1 ? 'text-yellow-400' :
                      s.position <= 4 ? 'text-blue-400' : 'text-slate-300'
                    }`}>{s.position}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {s.team_logo ? (
                          <img src={s.team_logo} alt="" className="w-6 h-6 object-contain" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">T</div>
                        )}
                        <span
                          onClick={() => navigate(`/team/${s.team_id}/overview`)}
                          className="text-white hover:text-blue-400 hover:underline cursor-pointer truncate max-w-[120px]"
                        >
                          {s.team_name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-bold text-white bg-slate-800/30">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-slate-500 text-sm">Puan durumu bulunamadi</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OverviewTab;
