/**
 * Lineup Tab - SIMPLIFIED
 *
 * Displays team lineups for home and away teams.
 * Now receives data via props (no Context).
 */

import { useNavigate } from 'react-router-dom';
import type { Match } from '../../../api/matches';

interface LineupTabProps {
  data: any;
  match: Match;
}

export function LineupTab({ data, match }: LineupTabProps) {
  const navigate = useNavigate();

  if (!match) return null;

  const lineup = data;
  const homeLineup = lineup?.home_lineup || [];
  const awayLineup = lineup?.away_lineup || [];

  if (!homeLineup.length && !awayLineup.length) {
    // Determine match status for context-aware messaging
    const statusId = (match as any).status_id || (match as any).status || 0;
    const isLive = [2, 3, 4, 5, 7].includes(statusId);
    const isNotStarted = statusId === 1;
    const isFinished = statusId === 8;

    let message = 'Kadro bilgisi henüz açıklanmadı';
    let subMessage = '';

    if (isLive) {
      message = 'Kadro bilgisi alınamadı';
      subMessage = 'Veri sağlayıcıdan kadro bilgisi gelmedi. Maç devam ederken tekrar deneyin.';
    } else if (isNotStarted) {
      message = 'Kadro bilgisi henüz açıklanmadı';
      subMessage = 'Takımlar maç öncesi kadroyu açıklamadı. Maç başlangıcına yakın tekrar kontrol edin.';
    } else if (isFinished) {
      message = 'Kadro bilgisi mevcut değil';
      subMessage = 'Bu maç için kadro verisi bulunmuyor.';
    }

    return (
      <div className="text-center p-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">{message}</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">{subMessage}</p>
        {isLive && (
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            Yenile
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Home Team */}
      <div className="bg-white p-5 rounded-xl">
        <h4 className="m-0 mb-4 font-semibold text-blue-600 text-center">
          {match.home_team?.name || 'Ev Sahibi'}
        </h4>
        {lineup?.home_formation && (
          <p className="text-center text-gray-500 text-sm mb-3">Formasyon: {lineup.home_formation}</p>
        )}
        {homeLineup.length > 0 ? (
          <div className="flex flex-col gap-2">
            {homeLineup.slice(0, 11).map((player: any, idx: number) => (
              <div
                key={idx}
                onClick={() => player.id && navigate(`/player/${player.id}`)}
                className={`p-2.5 bg-blue-50 rounded-lg text-sm ${player.id ? 'cursor-pointer hover:bg-blue-100 transition-all' : ''}`}
              >
                {player.shirt_number && (
                  <span className="font-bold mr-3 text-blue-600">{player.shirt_number}</span>
                )}
                {player.name || player.player_name || `Oyuncu ${idx + 1}`}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-600">Kadro bilgisi yok</p>
        )}

        {/* Home Subs */}
        {lineup?.home_subs && lineup.home_subs.length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-medium text-gray-500 mb-2">Yedekler</h5>
            <div className="flex flex-col gap-1">
              {lineup.home_subs.map((player: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => player.id && navigate(`/player/${player.id}`)}
                  className={`p-2 bg-gray-50 rounded text-xs ${player.id ? 'cursor-pointer hover:bg-gray-100 transition-all' : ''}`}
                >
                  {player.shirt_number && (
                    <span className="font-bold mr-2 text-gray-500">{player.shirt_number}</span>
                  )}
                  {player.name || player.player_name || `Oyuncu ${idx + 1}`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Away Team */}
      <div className="bg-white p-5 rounded-xl">
        <h4 className="m-0 mb-4 font-semibold text-red-600 text-center">
          {match.away_team?.name || 'Deplasman'}
        </h4>
        {lineup?.away_formation && (
          <p className="text-center text-gray-500 text-sm mb-3">Formasyon: {lineup.away_formation}</p>
        )}
        {awayLineup.length > 0 ? (
          <div className="flex flex-col gap-2">
            {awayLineup.slice(0, 11).map((player: any, idx: number) => (
              <div
                key={idx}
                onClick={() => player.id && navigate(`/player/${player.id}`)}
                className={`p-2.5 bg-red-50 rounded-lg text-sm ${player.id ? 'cursor-pointer hover:bg-red-100 transition-all' : ''}`}
              >
                {player.shirt_number && (
                  <span className="font-bold mr-3 text-red-600">{player.shirt_number}</span>
                )}
                {player.name || player.player_name || `Oyuncu ${idx + 1}`}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-600">Kadro bilgisi yok</p>
        )}

        {/* Away Subs */}
        {lineup?.away_subs && lineup.away_subs.length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-medium text-gray-500 mb-2">Yedekler</h5>
            <div className="flex flex-col gap-1">
              {lineup.away_subs.map((player: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => player.id && navigate(`/player/${player.id}`)}
                  className={`p-2 bg-gray-50 rounded text-xs ${player.id ? 'cursor-pointer hover:bg-gray-100 transition-all' : ''}`}
                >
                  {player.shirt_number && (
                    <span className="font-bold mr-2 text-gray-500">{player.shirt_number}</span>
                  )}
                  {player.name || player.player_name || `Oyuncu ${idx + 1}`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LineupTab;
