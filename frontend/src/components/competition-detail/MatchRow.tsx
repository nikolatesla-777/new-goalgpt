/**
 * Match Row Component
 *
 * Reusable match row for fixtures display in competition pages.
 */

import { useNavigate } from 'react-router-dom';
import type { FixtureMatch } from './CompetitionDetailContext';

interface MatchRowProps {
  match: FixtureMatch;
}

export function MatchRow({ match }: MatchRowProps) {
  const navigate = useNavigate();
  const isFinished = match.status_id === 8;
  const isLive = [2, 3, 4, 5, 7].includes(match.status_id);
  const matchDate = new Date(match.match_time * 1000);

  return (
    <div
      onClick={() => navigate(`/match/${match.id}`)}
      className="p-4 flex items-center hover:bg-slate-700/30 transition-colors cursor-pointer group"
    >
      {/* Date/Time */}
      <div className="w-20 text-center flex flex-col justify-center text-xs text-slate-400 font-medium border-r border-slate-700/50 pr-4 mr-4">
        <span className="mb-1">{matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
        {isLive ? (
          <span className="text-red-500 font-bold animate-pulse">CANLI</span>
        ) : (
          <span className="text-slate-300">{matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      {/* Teams & Score */}
      <div className="flex-1 flex justify-between items-center relative">
        {/* Home */}
        <div className="flex-1 flex items-center justify-end gap-3 text-right">
          <span className="font-medium text-white group-hover:text-blue-400 transition-colors">{match.home_team.name}</span>
          {match.home_team.logo_url ? (
            <img src={match.home_team.logo_url} alt="" className="w-6 h-6 object-contain" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-700" />
          )}
        </div>

        {/* Score Box */}
        <div className="w-20 flex justify-center">
          {isFinished || isLive ? (
            <div className={`
              px-3 py-1 rounded-lg font-bold text-sm tracking-wider
              ${isLive ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-slate-700 text-white'}
            `}>
              {match.home_score} - {match.away_score}
            </div>
          ) : (
            <div className="text-slate-500 text-xs font-medium bg-slate-800 px-2 py-1 rounded">VS</div>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 flex items-center gap-3 text-left">
          {match.away_team.logo_url ? (
            <img src={match.away_team.logo_url} alt="" className="w-6 h-6 object-contain" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-700" />
          )}
          <span className="font-medium text-white group-hover:text-blue-400 transition-colors">{match.away_team.name}</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="hidden md:block pl-4 text-slate-600 group-hover:text-blue-500 transition-colors">
        {'>'}
      </div>
    </div>
  );
}

export default MatchRow;
