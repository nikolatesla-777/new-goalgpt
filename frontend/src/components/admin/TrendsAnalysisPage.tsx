import { useState, useEffect } from 'react';
import { TrendUp, Target, Flag, Fire, TrendDown, Trophy, Coins } from '@phosphor-icons/react';

interface TrendMatch {
  fs_id: number;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
  league_name: string;
  date_unix: number;
  trend_type: string;
  confidence: number;
}

interface GoalTrend extends TrendMatch {
  btts: number;
  over25: number;
  avg_goals: number;
  xg_total: number;
}

interface CornerTrend extends TrendMatch {
  corners: number;
  over9_5: number;
  over10_5: number;
}

interface CardsTrend extends TrendMatch {
  cards: number;
  over3_5: number;
  over4_5: number;
}

interface FormTrend extends TrendMatch {
  home_xg: number;
  away_xg: number;
  xg_diff: number;
  favorite: 'home' | 'away';
  favorite_name: string;
}

interface ValueBet extends TrendMatch {
  btts: number;
  over25: number;
  xg_total: number;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
}

interface TrendsData {
  goalTrends: GoalTrend[];
  cornerTrends: CornerTrend[];
  cardsTrends: CardsTrend[];
  formTrends: FormTrend[];
  valueBets: ValueBet[];
}

export default function TrendsAnalysisPage() {
  const [trends, setTrends] = useState<TrendsData>({
    goalTrends: [],
    cornerTrends: [],
    cardsTrends: [],
    formTrends: [],
    valueBets: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'goals' | 'corners' | 'cards' | 'form' | 'value'>('goals');
  const [totalMatches, setTotalMatches] = useState(0);

  useEffect(() => {
    loadTrends();
  }, []);

  async function loadTrends() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/footystats/trends-analysis');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load trends');
      }

      setTrends(data.trends);
      setTotalMatches(data.totalMatches);
    } catch (err: any) {
      console.error('Failed to load trends:', err);
      setError(err.message || 'Failed to load trends');
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
            onClick={loadTrends}
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <TrendUp className="w-7 h-7 text-white" weight="bold" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Trend Analizi</h1>
              <p className="text-gray-400">
                {totalMatches} maçtan filtrelenmiş trendler
              </p>
            </div>
          </div>
          <button
            onClick={loadTrends}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <TrendUp className="w-4 h-4" />
            Yenile
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <TabButton
            active={activeTab === 'goals'}
            onClick={() => setActiveTab('goals')}
            icon={<Target className="w-5 h-5" />}
            label="Gol Trendleri"
            count={trends.goalTrends.length}
            color="from-green-500 to-emerald-500"
          />
          <TabButton
            active={activeTab === 'corners'}
            onClick={() => setActiveTab('corners')}
            icon={<Flag className="w-5 h-5" />}
            label="Korner Trendleri"
            count={trends.cornerTrends.length}
            color="from-orange-500 to-amber-500"
          />
          <TabButton
            active={activeTab === 'cards'}
            onClick={() => setActiveTab('cards')}
            icon={<Fire className="w-5 h-5" />}
            label="Kart Trendleri"
            count={trends.cardsTrends.length}
            color="from-red-500 to-rose-500"
          />
          <TabButton
            active={activeTab === 'form'}
            onClick={() => setActiveTab('form')}
            icon={<TrendDown className="w-5 h-5" />}
            label="Form Trendleri"
            count={trends.formTrends.length}
            color="from-blue-500 to-cyan-500"
          />
          <TabButton
            active={activeTab === 'value'}
            onClick={() => setActiveTab('value')}
            icon={<Coins className="w-5 h-5" />}
            label="Değer Bahisleri"
            count={trends.valueBets.length}
            color="from-purple-500 to-pink-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'goals' && <GoalTrends matches={trends.goalTrends} />}
        {activeTab === 'corners' && <CornerTrends matches={trends.cornerTrends} />}
        {activeTab === 'cards' && <CardsTrends matches={trends.cardsTrends} />}
        {activeTab === 'form' && <FormTrends matches={trends.formTrends} />}
        {activeTab === 'value' && <ValueBets matches={trends.valueBets} />}
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({ active, onClick, icon, label, count, color }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${
        active
          ? `bg-gradient-to-r ${color} text-white shadow-lg`
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`}
    >
      {icon}
      <span className="font-semibold">{label}</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
        active ? 'bg-white/20' : 'bg-gray-700'
      }`}>
        {count}
      </span>
    </button>
  );
}

// Goal Trends Component
function GoalTrends({ matches }: { matches: GoalTrend[] }) {
  if (matches.length === 0) {
    return <EmptyState message="Gol trendi bulunamadı" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {matches.map((match) => (
        <div
          key={match.fs_id}
          className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-colors border border-gray-700/50"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-400">{match.league_name}</span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              {match.home_logo && (
                <img
                  src={match.home_logo}
                  alt={match.home_name}
                  className="w-8 h-8 object-contain"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <span className="text-white font-semibold text-sm">{match.home_name}</span>
            </div>
            <div className="px-4">
              <span className="text-gray-500 text-sm">vs</span>
            </div>
            <div className="flex items-center gap-3 flex-1 justify-end">
              <span className="text-white font-semibold text-sm">{match.away_name}</span>
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

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <StatBox label="BTTS" value={`${match.btts}%`} highlight={match.btts >= 70} />
            <StatBox label="O2.5" value={`${match.over25}%`} highlight={match.over25 >= 70} />
            <StatBox label="AVG" value={match.avg_goals.toFixed(1)} highlight={match.avg_goals >= 3} />
            <StatBox label="xG" value={match.xg_total.toFixed(1)} highlight={match.xg_total >= 2.5} />
          </div>

          {/* Confidence Badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full font-semibold">
              {match.trend_type}
            </span>
            <ConfidenceMeter confidence={match.confidence} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Corner Trends Component
function CornerTrends({ matches }: { matches: CornerTrend[] }) {
  if (matches.length === 0) {
    return <EmptyState message="Korner trendi bulunamadı" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {matches.map((match) => (
        <div
          key={match.fs_id}
          className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-colors border border-orange-700/30"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-400">{match.league_name}</span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              {match.home_logo && (
                <img src={match.home_logo} alt={match.home_name} className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              )}
              <span className="text-white font-semibold text-sm">{match.home_name}</span>
            </div>
            <div className="px-4">
              <span className="text-gray-500 text-sm">vs</span>
            </div>
            <div className="flex items-center gap-3 flex-1 justify-end">
              <span className="text-white font-semibold text-sm">{match.away_name}</span>
              {match.away_logo && (
                <img src={match.away_logo} alt={match.away_name} className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              )}
            </div>
          </div>

          {/* Corner Stats */}
          <div className="bg-orange-500/10 rounded-lg p-4 mb-3">
            <div className="text-center mb-2">
              <div className="text-4xl font-bold text-orange-400">{match.corners.toFixed(1)}</div>
              <div className="text-xs text-gray-400">Tahmini Korner</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="text-center">
                <div className="text-xs text-gray-400">O9.5</div>
                <div className="text-lg font-bold text-orange-300">{match.over9_5}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">O10.5</div>
                <div className="text-lg font-bold text-orange-300">{match.over10_5}%</div>
              </div>
            </div>
          </div>

          {/* Confidence */}
          <div className="flex items-center justify-between">
            <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full font-semibold">
              🚩 {match.trend_type}
            </span>
            <ConfidenceMeter confidence={match.confidence} color="orange" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Cards Trends Component
function CardsTrends({ matches }: { matches: CardsTrend[] }) {
  if (matches.length === 0) {
    return <EmptyState message="Kart trendi bulunamadı" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {matches.map((match) => (
        <div
          key={match.fs_id}
          className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-colors border border-red-700/30"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-400">{match.league_name}</span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              {match.home_logo && (
                <img src={match.home_logo} alt={match.home_name} className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              )}
              <span className="text-white font-semibold text-sm">{match.home_name}</span>
            </div>
            <div className="px-4">
              <span className="text-gray-500 text-sm">vs</span>
            </div>
            <div className="flex items-center gap-3 flex-1 justify-end">
              <span className="text-white font-semibold text-sm">{match.away_name}</span>
              {match.away_logo && (
                <img src={match.away_logo} alt={match.away_name} className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              )}
            </div>
          </div>

          {/* Cards Stats */}
          <div className="bg-red-500/10 rounded-lg p-4 mb-3">
            <div className="text-center mb-2">
              <div className="text-4xl font-bold text-red-400">{match.cards.toFixed(1)}</div>
              <div className="text-xs text-gray-400">Tahmini Kart</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="text-center">
                <div className="text-xs text-gray-400">O3.5</div>
                <div className="text-lg font-bold text-red-300">{match.over3_5}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">O4.5</div>
                <div className="text-lg font-bold text-red-300">{match.over4_5}%</div>
              </div>
            </div>
          </div>

          {/* Confidence */}
          <div className="flex items-center justify-between">
            <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full font-semibold">
              🔥 {match.trend_type}
            </span>
            <ConfidenceMeter confidence={match.confidence} color="red" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Form Trends Component
function FormTrends({ matches }: { matches: FormTrend[] }) {
  if (matches.length === 0) {
    return <EmptyState message="Form trendi bulunamadı" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {matches.map((match) => (
        <div
          key={match.fs_id}
          className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-colors border border-blue-700/30"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-400">{match.league_name}</span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {/* Teams with xG */}
          <div className="space-y-3 mb-4">
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              match.favorite === 'home' ? 'bg-cyan-500/10' : 'bg-gray-700/50'
            }`}>
              <div className="flex items-center gap-3">
                {match.home_logo && (
                  <img src={match.home_logo} alt={match.home_name} className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
                <span className={`font-semibold text-sm ${
                  match.favorite === 'home' ? 'text-cyan-400' : 'text-white'
                }`}>
                  {match.home_name}
                </span>
              </div>
              <div className="text-lg font-bold text-cyan-400">
                xG: {match.home_xg.toFixed(2)}
              </div>
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg ${
              match.favorite === 'away' ? 'bg-orange-500/10' : 'bg-gray-700/50'
            }`}>
              <div className="flex items-center gap-3">
                {match.away_logo && (
                  <img src={match.away_logo} alt={match.away_name} className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
                <span className={`font-semibold text-sm ${
                  match.favorite === 'away' ? 'text-orange-400' : 'text-white'
                }`}>
                  {match.away_name}
                </span>
              </div>
              <div className="text-lg font-bold text-orange-400">
                xG: {match.away_xg.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Favorite Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full font-semibold">
                ⭐ {match.favorite_name} Favorili
              </span>
              <span className="text-xs text-gray-500">
                Δ{match.xg_diff.toFixed(2)} xG
              </span>
            </div>
            <ConfidenceMeter confidence={match.confidence} color="blue" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Value Bets Component
function ValueBets({ matches }: { matches: ValueBet[] }) {
  if (matches.length === 0) {
    return <EmptyState message="Değer bahsi bulunamadı" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {matches.map((match) => (
        <div
          key={match.fs_id}
          className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-colors border border-purple-700/30"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-400">{match.league_name}</span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              {match.home_logo && (
                <img src={match.home_logo} alt={match.home_name} className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              )}
              <span className="text-white font-semibold text-sm">{match.home_name}</span>
            </div>
            <div className="px-4">
              <span className="text-gray-500 text-sm">vs</span>
            </div>
            <div className="flex items-center gap-3 flex-1 justify-end">
              <span className="text-white font-semibold text-sm">{match.away_name}</span>
              {match.away_logo && (
                <img src={match.away_logo} alt={match.away_name} className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              )}
            </div>
          </div>

          {/* Predictions + Odds */}
          <div className="space-y-3 mb-3">
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="BTTS" value={`${match.btts}%`} highlight={match.btts >= 65} />
              <StatBox label="O2.5" value={`${match.over25}%`} highlight={match.over25 >= 65} />
              <StatBox label="xG" value={match.xg_total.toFixed(1)} highlight={match.xg_total >= 2.5} />
            </div>

            <div className="bg-purple-500/10 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2">Oranlar</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className="text-xs text-gray-500">1</div>
                  <div className="text-sm font-bold text-purple-300">{match.odds_home}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">X</div>
                  <div className="text-sm font-bold text-purple-300">{match.odds_draw}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">2</div>
                  <div className="text-sm font-bold text-purple-300">{match.odds_away}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Value Badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full font-semibold">
              💎 {match.trend_type}
            </span>
            <ConfidenceMeter confidence={match.confidence} color="purple" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper Components
function StatBox({ label, value, highlight }: { label: string; value: string; highlight: boolean }) {
  return (
    <div className={`text-center p-2 rounded ${
      highlight ? 'bg-green-500/20 border border-green-500/30' : 'bg-gray-700/50'
    }`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

function ConfidenceMeter({ confidence, color = 'green' }: { confidence: number; color?: string }) {
  const colorMap: any = {
    green: 'text-green-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
    blue: 'text-cyan-400',
    purple: 'text-purple-400'
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Güven:</span>
      <span className={`text-sm font-bold ${colorMap[color]}`}>
        {confidence}%
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-12 text-center">
      <TrendUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
      <p className="text-gray-400">{message}</p>
    </div>
  );
}
