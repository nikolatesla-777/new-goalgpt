import { useState } from 'react';
import { Users, MagnifyingGlass } from '@phosphor-icons/react';
import { getLeaguePlayers } from '../../api/telegram';
import PlayerDetailModal from './PlayerDetailModal';

interface Player {
  id: number;
  full_name: string;
  known_as: string;
  age: number;
  position: string;
  nationality: string;
  club_team_id: number;
  appearances: number;
  goals: number;
  assists: number;
  minutes_played: number;
}

export default function PlayerSearchPage() {
  const [seasonId, setSeasonId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const positions = [
    { value: 'all', label: 'Tüm Pozisyonlar' },
    { value: 'goalkeeper', label: 'Kaleci' },
    { value: 'defender', label: 'Defans' },
    { value: 'midfielder', label: 'Orta Saha' },
    { value: 'forward', label: 'Forvet' },
  ];

  const handleSearch = async () => {
    if (!seasonId.trim()) {
      setError('Lütfen Season ID girin');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const filters = {
        search: searchQuery,
        position: positionFilter !== 'all' ? positionFilter : undefined,
      };

      const data = await getLeaguePlayers(seasonId, 1, filters);
      setPlayers(data.players || []);
    } catch (err: any) {
      console.error('Failed to load players:', err);
      setError(err.message || 'Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const getPositionEmoji = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('forward')) return '⚽';
    if (pos.includes('midfielder')) return '🎯';
    if (pos.includes('defender')) return '🛡️';
    if (pos.includes('goalkeeper')) return '🧤';
    return '👤';
  };

  const getPositionColor = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('forward')) return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (pos.includes('midfielder')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (pos.includes('defender')) return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (pos.includes('goalkeeper')) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Users className="w-7 h-7 text-white" weight="fill" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Oyuncu İstatistikleri</h1>
            <p className="text-gray-400">Lig oyuncularını ara ve istatistiklerini incele</p>
          </div>
        </div>

        {/* Search Form */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Season ID
              </label>
              <input
                type="text"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                placeholder="Örn: 2012"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Oyuncu Adı
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Oyuncu ara..."
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pozisyon
              </label>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                {positions.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="w-full px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors h-[42px]"
              >
                <MagnifyingGlass className="w-5 h-5" />
                {loading ? 'Yükleniyor...' : 'Ara'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {hasSearched && !loading && (
          <div>
            {players.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center">
                <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Oyuncu bulunamadı</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-400">
                    {players.length} oyuncu bulundu
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {players.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className="bg-gray-800 hover:bg-gray-750 rounded-xl p-5 text-left transition-colors border border-gray-700/50"
                    >
                      {/* Player Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1">
                            {player.known_as}
                          </h3>
                          <p className="text-xs text-gray-400">{player.nationality}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium border ${getPositionColor(player.position)}`}>
                          {getPositionEmoji(player.position)} {player.position}
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Maç</div>
                          <div className="text-lg font-bold text-cyan-400">{player.appearances}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Gol</div>
                          <div className="text-lg font-bold text-green-400">{player.goals}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Asist</div>
                          <div className="text-lg font-bold text-purple-400">{player.assists}</div>
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Yaş: {player.age}</span>
                        <span>{Math.round(player.minutes_played / 90)} tam maç</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Player Detail Modal */}
      {selectedPlayerId && (
        <PlayerDetailModal
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}
