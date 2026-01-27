import { useState, useEffect } from 'react';
import { getDailyTips } from '../../api/telegram';
import { Target } from '@phosphor-icons/react';

interface TipMatch {
  fs_id: number;
  home_name: string;
  away_name: string;
  league: string;
  date_unix: number;
  confidence: number;
  tip_type: 'btts' | 'over25';
}

export default function DailyTipsPage() {
  const [bttsMatches, setBttsMatches] = useState<TipMatch[]>([]);
  const [over25Matches, setOver25Matches] = useState<TipMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTips();
  }, []);

  async function loadTips() {
    try {
      setLoading(true);
      setError(null);
      const data = await getDailyTips();
      setBttsMatches(data.btts_picks || []);
      setOver25Matches(data.over25_picks || []);
    } catch (err: any) {
      console.error('Failed to load tips:', err);
      setError(err.message || 'Failed to load daily tips');
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
            onClick={loadTips}
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
            <Target className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Günün Önerileri</h1>
            <p className="text-gray-400">FootyStats AI tarafından seçilmiş yüksek güvenilirlik tahminleri</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BTTS Section */}
        <div>
          <div className="bg-gray-800 rounded-xl p-6 mb-4">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-2xl">⚽</span>
              BTTS (Karşılıklı Gol)
            </h2>
            <p className="text-sm text-gray-400">Her iki takımın da gol atma ihtimali yüksek</p>
          </div>

          <div className="space-y-3">
            {bttsMatches.map((match) => (
              <TipMatchCard key={match.fs_id} match={match} />
            ))}
            {bttsMatches.length === 0 && (
              <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
                Bugün için BTTS önerisi yok
              </div>
            )}
          </div>
        </div>

        {/* Over 2.5 Section */}
        <div>
          <div className="bg-gray-800 rounded-xl p-6 mb-4">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              Over 2.5
            </h2>
            <p className="text-sm text-gray-400">2.5 üstü gol atılma ihtimali yüksek</p>
          </div>

          <div className="space-y-3">
            {over25Matches.map((match) => (
              <TipMatchCard key={match.fs_id} match={match} />
            ))}
            {over25Matches.length === 0 && (
              <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
                Bugün için Over 2.5 önerisi yok
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Match Card Component
function TipMatchCard({ match }: { match: TipMatch }) {
  const matchDate = new Date(match.date_unix * 1000);
  const confidenceColor = match.confidence >= 80 ? 'text-green-400' :
                          match.confidence >= 70 ? 'text-yellow-400' :
                          'text-gray-400';

  return (
    <div className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-colors border border-gray-700/50">
      {/* League & Time */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">{match.league}</span>
        <span className="text-xs text-gray-500">
          {matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Teams */}
      <div className="mb-3">
        <div className="text-white font-semibold mb-1">{match.home_name}</div>
        <div className="text-gray-400 text-sm">vs</div>
        <div className="text-white font-semibold mt-1">{match.away_name}</div>
      </div>

      {/* Confidence Badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Güven</span>
        <span className={`text-lg font-bold ${confidenceColor}`}>
          %{match.confidence}
        </span>
      </div>
    </div>
  );
}
