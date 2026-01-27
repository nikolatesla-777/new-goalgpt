import { useState } from 'react';
import { Trophy, MagnifyingGlass } from '@phosphor-icons/react';
import LeagueStandingsTable from '../ai-lab/LeagueStandingsTable';

export default function LeagueStandingsPage() {
  const [seasonId, setSeasonId] = useState('');
  const [activeSeasonId, setActiveSeasonId] = useState('');
  const [leagueName, setLeagueName] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (seasonId.trim()) {
      setActiveSeasonId(seasonId.trim());
    }
  };

  // Popular leagues with season IDs (examples - users will need actual IDs)
  const popularLeagues = [
    { name: 'Premier League 2023/24', id: '2012', description: 'İngiltere' },
    { name: 'La Liga 2023/24', id: '2105', description: 'İspanya' },
    { name: 'Bundesliga 2023/24', id: '2074', description: 'Almanya' },
    { name: 'Serie A 2023/24', id: '2107', description: 'İtalya' },
    { name: 'Ligue 1 2023/24', id: '2100', description: 'Fransa' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
            <Trophy className="w-7 h-7 text-white" weight="fill" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Puan Durumu</h1>
            <p className="text-gray-400">Lig tabloları ve sıralamalar</p>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
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
              <p className="text-xs text-gray-500 mt-1">
                FootyStats Season ID'sini girin
              </p>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Lig Adı (Opsiyonel)
              </label>
              <input
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="Örn: Premier League"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors h-[42px]"
              >
                <MagnifyingGlass className="w-5 h-5" />
                Göster
              </button>
            </div>
          </div>
        </form>

        {/* Popular Leagues */}
        {!activeSeasonId && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Popüler Ligler</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {popularLeagues.map((league) => (
                <button
                  key={league.id}
                  onClick={() => {
                    setSeasonId(league.id);
                    setLeagueName(league.name);
                    setActiveSeasonId(league.id);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 rounded-lg p-4 text-left transition-colors"
                >
                  <div className="font-semibold text-white mb-1">{league.name}</div>
                  <div className="text-sm text-gray-400">{league.description}</div>
                  <div className="text-xs text-gray-500 mt-2">ID: {league.id}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-400">
              💡 <strong>Not:</strong> Season ID'leri FootyStats API'den alınır. Yukarıdaki örnekler demo amaçlıdır.
            </div>
          </div>
        )}
      </div>

      {/* Standings Table */}
      {activeSeasonId && (
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                setActiveSeasonId('');
                setSeasonId('');
                setLeagueName('');
              }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Geri
            </button>
          </div>
          <LeagueStandingsTable seasonId={activeSeasonId} leagueName={leagueName} />
        </div>
      )}
    </div>
  );
}
