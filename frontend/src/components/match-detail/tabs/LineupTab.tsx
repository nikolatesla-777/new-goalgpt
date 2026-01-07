/**
 * Lineup Tab
 *
 * Displays team lineups for home and away teams.
 */

import { useNavigate } from 'react-router-dom';
import { useMatchDetail } from '../MatchDetailContext';

export function LineupTab() {
  const navigate = useNavigate();
  const { match, tabData } = useMatchDetail();

  if (!match) return null;

  const lineup = tabData.lineup;
  const homeLineup = lineup?.home_lineup || [];
  const awayLineup = lineup?.away_lineup || [];

  if (!homeLineup.length && !awayLineup.length) {
    return (
      <div className="text-center p-10 text-gray-600 bg-white rounded-xl">
        Kadro bilgisi henüz açıklanmadı
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
