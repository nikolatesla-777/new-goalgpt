import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { TrendUp, Target, Flag, Fire, TrendDown, Trophy, Coins } from '@phosphor-icons/react';
import { useTrendsAnalysis } from '../../api/hooks';
import { publishTrendsToTwitter, publishSingleMatchTweet } from '../../api/client';

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
  over15: number;
  ht_over05: number;
  avg_goals: number;
  xg_total: number;
  corners: number;
  cards: number;
  corner_over75: number;
  card_over35: number;
  home_scored: number;
  home_conceded: number;
  away_scored: number;
  away_conceded: number;
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

type TwitterPublishState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

function generateMatchTweet(match: GoalTrend): string {
  const time = new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });
  const lines: string[] = [
    `⚽ ${match.home_name} - ${match.away_name}`,
    ``,
    `🏆 ${match.league_name} | ⏰ ${time}`,
    ``,
    `1️⃣  KG VAR: %${match.btts}`,
    `2️⃣  2.5 ÜST: %${match.over25}`,
    `3️⃣  1.5 ÜST: %${match.over15}`,
    `4️⃣  IY 0.5 ÜST: %${match.ht_over05}`,
    `5️⃣  Korner 7.5 ÜST: %${match.corner_over75}`,
    `6️⃣  Sarı Kart 3.5 ÜST: %${match.card_over35}`,
    ``,
    `🤖 GoalGPT #Futbol #YapayZeka`,
    ``,
    `👉 https://t.co/d7uu85YIG6`,
  ];
  return lines.join('\n');
}

export default function TrendsAnalysisPage() {
  const [activeTab, setActiveTab] = useState<'goals' | 'corners' | 'cards' | 'form' | 'value'>('goals');
  const [twitterState, setTwitterState] = useState<TwitterPublishState>({ status: 'idle' });

  // React Query hook replaces manual state management
  const { data, isLoading, isError, error: queryError, refetch } = useTrendsAnalysis();

  const handleTwitterPublish = async () => {
    setTwitterState({ status: 'loading' });
    try {
      const result = await publishTrendsToTwitter();
      if (result.success) {
        if (result.skipped) {
          setTwitterState({ status: 'success', message: `Atlandı: ${result.skip_reason}` });
        } else if (result.dry_run) {
          setTwitterState({ status: 'success', message: `✓ DRY_RUN: ${result.tweet_count} tweet formatlandı` });
        } else {
          setTwitterState({ status: 'success', message: `✓ Yayınlandı! ${result.tweet_count} tweet` });
        }
      } else {
        setTwitterState({ status: 'error', message: result.error || 'Bilinmeyen hata' });
      }
    } catch (err: any) {
      setTwitterState({ status: 'error', message: err.message || 'Bağlantı hatası' });
    }
    // Reset after 5 seconds
    setTimeout(() => setTwitterState({ status: 'idle' }), 5000);
  };

  const trends: TrendsData = (data?.trends as any) || {
    goalTrends: [],
    cornerTrends: [],
    cardsTrends: [],
    formTrends: [],
    valueBets: []
  };
  const totalMatches = data?.totalMatches || 0;
  const error = isError ? (queryError instanceof Error ? queryError.message : 'Veriler yüklenemedi') : null;

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
                {isLoading ? 'Yükleniyor...' : `${totalMatches} maçtan filtrelenmiş trendler`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <TrendUp className="w-4 h-4" />
              Yenile
            </button>

            {/* Twitter Publish Button */}
            {twitterState.status === 'idle' && (
              <button
                onClick={handleTwitterPublish}
                className="px-4 py-2 bg-black hover:bg-gray-900 text-white rounded-lg transition-colors flex items-center gap-2 border border-gray-700"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Twitter'a Yayınla
              </button>
            )}

            {twitterState.status === 'loading' && (
              <button
                disabled
                className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg flex items-center gap-2 cursor-not-allowed border border-gray-700"
              >
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                  <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                </svg>
                Yayınlanıyor...
              </button>
            )}

            {twitterState.status === 'success' && (
              <span className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg flex items-center gap-2 text-sm font-semibold border border-green-500/30">
                {twitterState.message}
              </span>
            )}

            {twitterState.status === 'error' && (
              <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg flex items-center gap-2 text-sm font-semibold border border-red-500/30">
                ✗ {twitterState.message}
              </span>
            )}
          </div>
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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <svg className="w-10 h-10 text-purple-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="3" className="opacity-20" />
              <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="3" className="opacity-80" />
            </svg>
            <p className="text-gray-400 text-sm">Trendler yükleniyor...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-red-400 text-lg">❌ Yükleme hatası</div>
            <div className="text-gray-500 text-sm">{error}</div>
            <button
              onClick={() => refetch()}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
            >
              Tekrar Dene
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'goals' && <GoalTrends matches={trends.goalTrends} />}
            {activeTab === 'corners' && <CornerTrends matches={trends.cornerTrends} />}
            {activeTab === 'cards' && <CardsTrends matches={trends.cardsTrends} />}
            {activeTab === 'form' && <FormTrends matches={trends.formTrends} />}
            {activeTab === 'value' && <ValueBets matches={trends.valueBets} />}
          </>
        )}
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
  const [tweetModal, setTweetModal] = useState<{ match: GoalTrend; text: string; imageBase64?: string } | null>(null);
  const [capturingId, setCapturingId] = useState<number | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handlePaylas = async (match: GoalTrend) => {
    setCapturingId(match.fs_id);
    let imageBase64: string | undefined;
    const cardEl = cardRefs.current.get(match.fs_id);
    if (cardEl) {
      try {
        const canvas = await html2canvas(cardEl, {
          backgroundColor: '#1f2937',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        imageBase64 = canvas.toDataURL('image/png').replace('data:image/png;base64,', '');
      } catch {
        // proceed without image if capture fails
      }
    }
    setCapturingId(null);
    setTweetModal({ match, text: generateMatchTweet(match), imageBase64 });
  };

  if (matches.length === 0) {
    return <EmptyState message="Gol trendi bulunamadı" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {tweetModal && (
        <MatchTweetModal
          match={tweetModal.match}
          initialText={tweetModal.text}
          imageBase64={tweetModal.imageBase64}
          onClose={() => setTweetModal(null)}
        />
      )}
      {matches.map((match) => (
        <div
          key={match.fs_id}
          ref={(el) => { if (el) cardRefs.current.set(match.fs_id, el); else cardRefs.current.delete(match.fs_id); }}
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

          {/* Stats Grid — Gol İstatistikleri */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            <StatBox label="KG VAR" value={`${match.btts}%`} highlight={match.btts >= 70} color="green" />
            <StatBox label="2.5 ÜST" value={`${match.over25}%`} highlight={match.over25 >= 70} color="green" />
            <StatBox label="1.5 ÜST" value={`${match.over15}%`} highlight={match.over15 >= 75} color="emerald" />
            <StatBox label="IY 0.5Ü" value={`${match.ht_over05}%`} highlight={match.ht_over05 >= 70} color="teal" />
          </div>
          {/* Stats Grid — Fiziksel & Beklenti */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            <StatBox label="AVG Gol" value={match.avg_goals.toFixed(1)} highlight={match.avg_goals >= 3} color="blue" />
            <StatBox label="xG" value={match.xg_total.toFixed(1)} highlight={match.xg_total >= 2.5} color="blue" />
            <StatBox label="Korner 7.5Ü" value={match.corner_over75 > 0 ? `${match.corner_over75}%` : '—'} highlight={match.corner_over75 >= 70} color="orange" />
            <StatBox label="Sarı Kart 3.5Ü" value={match.card_over35 > 0 ? `${match.card_over35}%` : '—'} highlight={match.card_over35 >= 65} color="red" />
          </div>

          {/* Stats Grid — Sezon Gol Ortalaması (Ev/Dep) */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <StatBox label="Ev Attı" value={match.home_scored > 0 ? match.home_scored.toFixed(2) : '—'} highlight={match.home_scored >= 1.5} color="green" />
            <StatBox label="Ev Yedi" value={match.home_conceded > 0 ? match.home_conceded.toFixed(2) : '—'} highlight={match.home_conceded >= 1.5} color="red" />
            <StatBox label="Dep Attı" value={match.away_scored > 0 ? match.away_scored.toFixed(2) : '—'} highlight={match.away_scored >= 1.5} color="emerald" />
            <StatBox label="Dep Yedi" value={match.away_conceded > 0 ? match.away_conceded.toFixed(2) : '—'} highlight={match.away_conceded >= 1.5} color="orange" />
          </div>

          {/* Confidence Badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full font-semibold">
              {match.trend_type}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePaylas(match)}
                disabled={capturingId === match.fs_id}
                className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-black text-gray-400 hover:text-white rounded text-xs transition-colors border border-gray-600 hover:border-gray-400 disabled:opacity-50 disabled:cursor-wait"
                title="Twitter'da Paylaş"
              >
                {capturingId === match.fs_id ? (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                    <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                )}
                Paylaş
              </button>
              <ConfidenceMeter confidence={match.confidence} />
            </div>
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
function StatBox({
  label,
  value,
  highlight,
  color = 'green',
}: {
  label: string;
  value: string;
  highlight: boolean;
  color?: 'green' | 'emerald' | 'teal' | 'blue' | 'orange' | 'red';
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    green:   { bg: 'bg-green-500/20',   border: 'border-green-500/30',   text: 'text-green-400'   },
    emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    teal:    { bg: 'bg-teal-500/20',    border: 'border-teal-500/30',    text: 'text-teal-400'    },
    blue:    { bg: 'bg-blue-500/20',    border: 'border-blue-500/30',    text: 'text-blue-400'    },
    orange:  { bg: 'bg-orange-500/20',  border: 'border-orange-500/30',  text: 'text-orange-400'  },
    red:     { bg: 'bg-red-500/20',     border: 'border-red-500/30',     text: 'text-red-400'     },
  };
  const c = colorMap[color];
  return (
    <div className={`text-center p-2 rounded ${
      highlight ? `${c.bg} border ${c.border}` : 'bg-gray-700/50'
    }`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? c.text : 'text-white'}`}>
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

function MatchTweetModal({
  match,
  initialText,
  imageBase64,
  onClose,
}: {
  match: GoalTrend;
  initialText: string;
  imageBase64?: string;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [publishState, setPublishState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [withImage, setWithImage] = useState(!!imageBase64);

  const charCount = text.length;
  const isOverLimit = charCount > 280;
  const isDisabled = isOverLimit || charCount === 0 || publishState === 'loading';

  const handlePublish = async () => {
    if (isDisabled) return;
    setPublishState('loading');
    try {
      const result = await publishSingleMatchTweet(
        text.trim(),
        withImage && imageBase64 ? imageBase64 : undefined
      );
      if (result.success) {
        setPublishState('success');
        setTimeout(() => onClose(), 2000);
      } else {
        setErrorMsg(result.error || 'Bilinmeyen hata');
        setPublishState('error');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bağlantı hatası');
      setPublishState('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg border border-gray-700">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-white font-semibold">Twitter'da Paylaş</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
            disabled={publishState === 'loading'}
          >
            ×
          </button>
        </div>

        {/* Match Info */}
        <div className="px-4 pt-3 pb-0">
          <p className="text-xs text-gray-400">
            {match.home_name} vs {match.away_name} · {match.league_name}
          </p>
        </div>

        {/* Card Image Preview */}
        {imageBase64 && (
          <div className="px-4 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Maç kartı görüntüsü</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <span className="text-xs text-gray-400">Görüntüyle gönder</span>
                <div
                  onClick={() => setWithImage((v) => !v)}
                  className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${withImage ? 'bg-blue-500' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${withImage ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {withImage && (
              <div className="rounded-lg overflow-hidden border border-gray-600 opacity-90">
                <img
                  src={`data:image/png;base64,${imageBase64}`}
                  alt="Maç kartı"
                  className="w-full"
                  style={{ maxHeight: '260px', objectFit: 'contain', objectPosition: 'center' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Tweet Textarea */}
        <div className="p-4">
          <textarea
            className="w-full bg-gray-700 text-white text-sm rounded-lg p-3 resize-none border border-gray-600 focus:border-blue-500 focus:outline-none font-mono"
            rows={10}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPublishState('idle');
              setErrorMsg('');
            }}
            placeholder="Tweet metni..."
            disabled={publishState === 'loading'}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">Metni düzenleyebilirsiniz</span>
            <span className={`text-xs font-mono ${
              isOverLimit ? 'text-red-400 font-bold' : charCount > 250 ? 'text-yellow-400' : 'text-gray-400'
            }`}>
              {charCount}/280
            </span>
          </div>
          {isOverLimit && (
            <p className="text-xs text-red-400 mt-1">
              ⚠️ Tweet 280 karakteri aşıyor ({charCount - 280} fazla karakter)
            </p>
          )}
        </div>

        {/* Status Messages */}
        {publishState === 'success' && (
          <div className="mx-4 mb-3 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
            ✓ Tweet başarıyla yayınlandı!
          </div>
        )}
        {publishState === 'error' && (
          <div className="mx-4 mb-3 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            ✗ {errorMsg}
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
            disabled={publishState === 'loading'}
          >
            İptal
          </button>
          <button
            onClick={handlePublish}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              publishState === 'loading'
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : isOverLimit || charCount === 0
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-black hover:bg-gray-900 text-white border border-gray-600 hover:border-gray-400'
            }`}
          >
            {publishState === 'loading' ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                  <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                </svg>
                Yayınlanıyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Yayınla
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
