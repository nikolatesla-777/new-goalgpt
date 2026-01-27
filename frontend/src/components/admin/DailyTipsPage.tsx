import { useState, useEffect } from 'react';
import { getDailyTips } from '../../api/telegram';
import { Target, Trophy, TrendUp, CalendarBlank } from '@phosphor-icons/react';

interface Match {
  fs_id: number;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
  league_name: string;
  country: string | null;
  date_unix: number;
  status: string;
  score: string;
  potentials: {
    btts: number;
    over25: number;
    avg: number;
    over15: number;
    corners: number;
    cards: number;
  };
  xg: {
    home: number;
    away: number;
  };
  odds: {
    home: number;
    draw: number;
    away: number;
  };
}

export default function DailyTipsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    try {
      setLoading(true);
      setError(null);
      const data = await getDailyTips();
      setMatches(data.matches || []);
    } catch (err: any) {
      console.error('Failed to load matches:', err);
      setError(err.message || 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-white">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="text-red-400 mb-4">❌ Hata</div>
          <div className="text-gray-400">{error}</div>
          <button
            onClick={loadMatches}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <Target className="w-7 h-7 text-white" weight="fill" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Bugünün Maçları</h1>
            <p className="text-gray-400">FootyStats AI tahminleri ile {matches.length} maç</p>
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      <div className="max-w-7xl mx-auto">
        {matches.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <CalendarBlank className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Bugün için maç bulunamadı</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {matches.map((match) => (
              <MatchCard key={match.fs_id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const matchDate = new Date(match.date_unix * 1000);
  const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Highlight high confidence predictions
  const isHighBTTS = match.potentials.btts >= 70;
  const isHighOver25 = match.potentials.over25 >= 70;

  return (
    <div className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-colors border border-gray-700/50">
      {/* League & Time */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-400">{match.league_name}</span>
        </div>
        <span className="text-xs text-gray-500">{timeStr}</span>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between mb-4">
        {/* Home Team */}
        <div className="flex items-center gap-3 flex-1">
          {match.home_logo && (
            <img
              src={match.home_logo}
              alt={match.home_name}
              className="w-8 h-8 object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          <span className="text-white font-semibold text-sm truncate">{match.home_name}</span>
        </div>

        {/* Score */}
        <div className="px-4">
          <span className="text-gray-500 text-sm">vs</span>
        </div>

        {/* Away Team */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="text-white font-semibold text-sm truncate">{match.away_name}</span>
          {match.away_logo && (
            <img
              src={match.away_logo}
              alt={match.away_name}
              className="w-8 h-8 object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
        </div>
      </div>

      {/* Predictions Grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {/* BTTS */}
        <div className={`text-center p-2 rounded ${isHighBTTS ? 'bg-green-500/20 border border-green-500/30' : 'bg-gray-700/50'}`}>
          <div className="text-xs text-gray-400 mb-1">BTTS</div>
          <div className={`text-lg font-bold ${isHighBTTS ? 'text-green-400' : 'text-white'}`}>
            {match.potentials.btts}%
          </div>
        </div>

        {/* Over 2.5 */}
        <div className={`text-center p-2 rounded ${isHighOver25 ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-gray-700/50'}`}>
          <div className="text-xs text-gray-400 mb-1">O2.5</div>
          <div className={`text-lg font-bold ${isHighOver25 ? 'text-blue-400' : 'text-white'}`}>
            {match.potentials.over25}%
          </div>
        </div>

        {/* AVG Goals */}
        <div className="text-center p-2 rounded bg-gray-700/50">
          <div className="text-xs text-gray-400 mb-1">AVG</div>
          <div className="text-lg font-bold text-purple-400">{match.potentials.avg}</div>
        </div>

        {/* Corners */}
        <div className="text-center p-2 rounded bg-gray-700/50">
          <div className="text-xs text-gray-400 mb-1">Corners</div>
          <div className="text-lg font-bold text-orange-400">{match.potentials.corners.toFixed(1)}</div>
        </div>
      </div>

      {/* xG */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>xG: {match.xg.home.toFixed(2)}</span>
        <TrendUp className="w-4 h-4" />
        <span>xG: {match.xg.away.toFixed(2)}</span>
      </div>

      {/* Odds (optional - can be shown on hover) */}
      {match.odds && (
        <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs">
          <span className="text-gray-500">1: {match.odds.home}</span>
          <span className="text-gray-500">X: {match.odds.draw}</span>
          <span className="text-gray-500">2: {match.odds.away}</span>
        </div>
      )}

      {/* High confidence badge */}
      {(isHighBTTS || isHighOver25) && (
        <div className="mt-3 flex gap-2">
          {isHighBTTS && (
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full font-semibold">
              🔥 High BTTS
            </span>
          )}
          {isHighOver25 && (
            <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full font-semibold">
              🔥 High O2.5
            </span>
          )}
        </div>
      )}
    </div>
  );
}
