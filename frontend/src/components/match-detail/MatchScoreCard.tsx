/**
 * Match Score Card
 *
 * Displays the match score, team logos, names, and live status.
 * Part of the modular match detail page architecture.
 */

import { useNavigate } from 'react-router-dom';
import { Users } from '@phosphor-icons/react';
import { useMatchDetail } from './MatchDetailContext';

/**
 * Get status text in Turkish
 */
function getStatusText(status: number, minuteText?: string): string {
  switch (status) {
    case 1: return 'Başlamadı';
    case 2: return '1. Yarı';
    case 3: return 'Devre Arası';
    case 4: return '2. Yarı';
    case 5: return 'Uzatmalar';
    case 7: return 'Penaltılar';
    case 8: return 'Maç Sonu';
    default: return minuteText || '';
  }
}

export function MatchScoreCard() {
  const navigate = useNavigate();
  const { match } = useMatchDetail();

  if (!match) return null;

  const status = (match as any).status ?? (match as any).status_id ?? (match as any).match_status ?? 0;
  const isLive = status >= 2 && status <= 7;
  const isFinished = status === 8;
  const minuteText = match.minute_text || '—';

  return (
    <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-white pt-4 md:pt-8 pb-6 md:pb-10 px-3 md:px-4 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-3xl mx-auto flex items-start justify-between gap-1 md:gap-2 lg:gap-8 relative z-10">
        {/* Home Team */}
        <div
          className="flex-1 flex flex-col items-center text-center cursor-pointer group"
          onClick={() => navigate(`/team/${match.home_team_id}`)}
        >
          {match.home_team?.logo_url ? (
            <div className="relative mb-2 md:mb-4 transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300"></div>
              <img
                src={match.home_team.logo_url}
                alt=""
                className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 object-contain drop-shadow-2xl filter group-hover:brightness-110 transition-all duration-300"
              />
            </div>
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl mb-2 md:mb-4 flex items-center justify-center shadow-xl border border-white/10 group-hover:scale-110 transition-all duration-300">
              <Users size={20} className="text-gray-400 md:w-[28px] md:h-[28px]" />
            </div>
          )}
          <p className="font-black text-xs sm:text-sm md:text-lg leading-tight w-full break-words px-1 text-white drop-shadow-lg group-hover:text-white/90 transition-colors">
            {match.home_team?.name || 'Ev Sahibi'}
          </p>
        </div>

        {/* Score & Live Status */}
        <div className="flex flex-col items-center shrink-0 w-[80px] sm:w-[100px] md:w-[140px] lg:w-[160px]">
          {/* Live/Status Badge */}
          <div className="flex items-center justify-center gap-1 md:gap-2 mb-2 md:mb-3 w-full flex-wrap">
            {isLive && (
              <>
                {status === 3 ? (
                  <span className="px-2 py-1 md:px-3 md:py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] md:text-xs font-black rounded-full whitespace-nowrap shadow-lg shadow-amber-500/50 border border-white/20">
                    İY
                  </span>
                ) : (
                  <span className="px-2 py-1 md:px-3 md:py-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] md:text-xs font-black rounded-full animate-pulse whitespace-nowrap shadow-lg shadow-red-500/50 border border-white/20">
                    CANLI
                  </span>
                )}
                {minuteText && minuteText !== '—' && (
                  <span className="px-2 py-1 md:px-3 md:py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] md:text-xs font-black rounded-full whitespace-nowrap min-w-[28px] md:min-w-[32px] text-center shadow-lg shadow-indigo-500/50 border border-white/20">
                    {minuteText}
                  </span>
                )}
              </>
            )}
            {isFinished && (
              <span className="px-2 py-1 md:px-4 md:py-1.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white text-[10px] md:text-xs font-black rounded-full shadow-lg border border-white/20">
                MS
              </span>
            )}
          </div>

          {/* Score Box */}
          <div className="relative bg-gradient-to-br from-white/15 via-white/10 to-white/5 rounded-xl md:rounded-2xl px-3 py-2 md:px-5 md:py-3 lg:px-6 lg:py-4 backdrop-blur-md border border-white/20 md:border-2 shadow-2xl w-full max-w-full">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl md:rounded-2xl"></div>
            <div className="relative text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-widest leading-none font-mono text-white drop-shadow-lg whitespace-nowrap">
              {match.home_score ?? 0}<span className="text-white/60 mx-1 md:mx-2">-</span>{match.away_score ?? 0}
            </div>
          </div>

          {/* Status Text */}
          <p className="text-[10px] md:text-xs text-gray-400 mt-1 md:mt-2 font-medium text-center">
            {getStatusText(status, match.minute_text)}
          </p>
        </div>

        {/* Away Team */}
        <div
          className="flex-1 flex flex-col items-center text-center cursor-pointer group"
          onClick={() => navigate(`/team/${match.away_team_id}`)}
        >
          {match.away_team?.logo_url ? (
            <div className="relative mb-2 md:mb-4 transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300"></div>
              <img
                src={match.away_team.logo_url}
                alt=""
                className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 object-contain drop-shadow-2xl filter group-hover:brightness-110 transition-all duration-300"
              />
            </div>
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl mb-2 md:mb-4 flex items-center justify-center shadow-xl border border-white/10 group-hover:scale-110 transition-all duration-300">
              <Users size={20} className="text-gray-400 md:w-[28px] md:h-[28px]" />
            </div>
          )}
          <p className="font-black text-xs sm:text-sm md:text-lg leading-tight w-full break-words px-1 text-white drop-shadow-lg group-hover:text-white/90 transition-colors">
            {match.away_team?.name || 'Deplasman'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default MatchScoreCard;
