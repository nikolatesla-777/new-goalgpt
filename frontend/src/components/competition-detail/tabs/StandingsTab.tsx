/**
 * Standings Tab
 *
 * Displays full league standings table.
 */

import { useNavigate } from 'react-router-dom';
import { useCompetitionDetail } from '../CompetitionDetailContext';

export function StandingsTab() {
  const navigate = useNavigate();
  const { standings } = useCompetitionDetail();

  if (standings.length === 0) {
    return (
      <div className="p-12 text-center bg-slate-800/50 rounded-xl border border-slate-700/50 text-slate-500">
        Puan durumu bulunamadi.
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
            <th className="p-4 text-left font-medium w-14">Poz</th>
            <th className="p-4 text-left font-medium">Takim</th>
            <th className="p-4 text-center font-medium w-12 bg-slate-800/50">O</th>
            <th className="p-4 text-center font-medium w-12">G</th>
            <th className="p-4 text-center font-medium w-12">B</th>
            <th className="p-4 text-center font-medium w-12">M</th>
            <th className="p-4 text-center font-medium w-14">Avg</th>
            <th className="p-4 text-center font-bold text-white w-14 bg-slate-800/50">Puan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {standings.map((s, idx) => (
            <tr key={s.team_id} className="hover:bg-slate-700/30 transition-colors group">
              <td className="p-4">
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                  ${idx < 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    idx < 4 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    idx >= standings.length - 3 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-slate-700/30 text-slate-400'}
                `}>
                  {s.position}
                </div>
              </td>
              <td className="p-4">
                <div className="flex items-center gap-4">
                  {s.team_logo ? (
                    <img src={s.team_logo} alt="" className="w-8 h-8 object-contain transition-transform group-hover:scale-110" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">T</div>
                  )}
                  <span
                    onClick={() => navigate(`/team/${s.team_id}/overview`)}
                    className="text-white font-medium hover:text-blue-400 hover:underline cursor-pointer text-base"
                  >
                    {s.team_name}
                  </span>
                </div>
              </td>
              <td className="p-4 text-center text-slate-300 bg-slate-800/30 font-medium">{s.played}</td>
              <td className="p-4 text-center text-emerald-400">{s.won}</td>
              <td className="p-4 text-center text-slate-400">{s.drawn}</td>
              <td className="p-4 text-center text-red-400">{s.lost}</td>
              <td className="p-4 text-center text-slate-300 font-medium">{s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}</td>
              <td className="p-4 text-center font-bold text-lg text-white bg-slate-800/30 shadow-inner">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StandingsTab;
