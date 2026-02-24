import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { TrendUp, Target, Flag, Fire, TrendDown, Trophy, Coins } from '@phosphor-icons/react';
import { useTrendsAnalysis } from '../../api/hooks';
import { publishTrendsToTwitter, publishSingleMatchTweet, getMatchTrends, postInstagramStory } from '../../api/client';

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

const TWEET_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

function generateMatchTweet(match: GoalTrend): string {
  const time = new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });

  const MIN = 60;
  const stats: Array<{ label: string; value: number }> = [
    { label: 'KG VAR',             value: match.btts },
    { label: '2.5 ÜST',            value: match.over25 },
    { label: '1.5 ÜST',            value: match.over15 },
    { label: 'IY 0.5 ÜST',         value: match.ht_over05 },
    { label: 'Korner 7.5 ÜST',     value: match.corner_over75 },
    { label: 'Sarı Kart 3.5 ÜST',  value: match.card_over35 },
  ].filter(s => s.value >= MIN);

  const statLines = stats.map((s, i) => `${TWEET_EMOJIS[i]}  ${s.label}: %${s.value}`);

  const lines: string[] = [
    `⚽ ${match.home_name} - ${match.away_name}`,
    ``,
    `🏆 ${match.league_name} | ⏰ ${time}`,
    ``,
    ...statLines,
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
  const [trendModal, setTrendModal] = useState<{
    match: GoalTrend;
    homeTrends: { text: string }[];
    awayTrends: { text: string }[];
  } | null>(null);
  const [trendLoadingId, setTrendLoadingId] = useState<number | null>(null);
  const [storyStates, setStoryStates] = useState<Map<number, 'idle' | 'loading' | 'success' | 'error'>>(new Map());
  // captureRefs points only to the stats area (without the bottom badge/button row)
  const captureRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const setStoryState = (id: number, state: 'idle' | 'loading' | 'success' | 'error') => {
    setStoryStates(prev => new Map(prev).set(id, state));
  };

  const handleTrend = async (match: GoalTrend) => {
    setTrendLoadingId(match.fs_id);
    try {
      const data = await getMatchTrends(match.fs_id);
      setTrendModal({
        match,
        homeTrends: data.trends?.home || [],
        awayTrends: data.trends?.away || [],
      });
    } catch {
      // silently ignore
    } finally {
      setTrendLoadingId(null);
    }
  };

  const captureCardImage = async (match: GoalTrend): Promise<string | undefined> => {
    const captureEl = captureRefs.current.get(match.fs_id);
    if (!captureEl) return undefined;
    try {
      const imgEls = Array.from(captureEl.querySelectorAll('img')) as HTMLImageElement[];
      const origSrcs = imgEls.map(img => img.src);
      imgEls.forEach(img => {
        if (img.src && (img.src.startsWith('http://') || img.src.startsWith('https://'))) {
          img.src = `/api/proxy/image?url=${encodeURIComponent(img.src)}`;
        }
      });
      await Promise.all(imgEls.map(img => new Promise<void>(resolve => {
        if (img.complete) { resolve(); return; }
        img.onload = () => resolve();
        img.onerror = () => resolve();
      })));
      const cardCanvas = await html2canvas(captureEl, {
        backgroundColor: '#1f2937',
        scale: 2,
        useCORS: false,
        allowTaint: false,
        logging: false,
      });
      imgEls.forEach((img, i) => { img.src = origSrcs[i]; });

      // Wrap card into a 9:16 Story canvas (1080×1920)
      const STORY_W = 1080;
      const STORY_H = 1920;
      const storyCanvas = document.createElement('canvas');
      storyCanvas.width = STORY_W;
      storyCanvas.height = STORY_H;
      const ctx = storyCanvas.getContext('2d')!;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, STORY_H);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(1, '#1f2937');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, STORY_W, STORY_H);

      // Scale card to fit width with padding
      const padding = 60;
      const maxW = STORY_W - padding * 2;
      const scale = Math.min(maxW / cardCanvas.width, 1);
      const cardW = cardCanvas.width * scale;
      const cardH = cardCanvas.height * scale;
      const cardX = (STORY_W - cardW) / 2;
      const cardY = (STORY_H - cardH) / 2;

      // Card shadow
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 40;
      ctx.drawImage(cardCanvas, cardX, cardY, cardW, cardH);
      ctx.shadowBlur = 0;

      // GoalGPT branding at bottom
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GoalGPT', STORY_W / 2, STORY_H - 80);

      const b64 = storyCanvas.toDataURL('image/png').replace('data:image/png;base64,', '');
      return b64;
    } catch {
      return undefined;
    }
  };

  const handleStory = async (match: GoalTrend) => {
    setStoryState(match.fs_id, 'loading');
    try {
      const imageBase64 = await captureCardImage(match);
      if (!imageBase64) {
        setStoryState(match.fs_id, 'error');
        setTimeout(() => setStoryState(match.fs_id, 'idle'), 3000);
        return;
      }
      const result = await postInstagramStory(imageBase64);
      if (result.success) {
        setStoryState(match.fs_id, 'success');
        setTimeout(() => setStoryState(match.fs_id, 'idle'), 4000);
      } else {
        setStoryState(match.fs_id, 'error');
        setTimeout(() => setStoryState(match.fs_id, 'idle'), 3000);
      }
    } catch {
      setStoryState(match.fs_id, 'error');
      setTimeout(() => setStoryState(match.fs_id, 'idle'), 3000);
    }
  };

  const handlePaylas = async (match: GoalTrend) => {
    setCapturingId(match.fs_id);
    let imageBase64: string | undefined;
    const captureEl = captureRefs.current.get(match.fs_id);
    if (captureEl) {
      try {
        // Replace external logo URLs with backend-proxied URLs to avoid CORS issues
        const imgEls = Array.from(captureEl.querySelectorAll('img')) as HTMLImageElement[];
        const origSrcs = imgEls.map(img => img.src);
        imgEls.forEach(img => {
          if (img.src && (img.src.startsWith('http://') || img.src.startsWith('https://'))) {
            img.src = `/api/proxy/image?url=${encodeURIComponent(img.src)}`;
          }
        });
        // Wait for proxied images to load
        await Promise.all(imgEls.map(img => new Promise<void>(resolve => {
          if (img.complete) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })));

        const canvas = await html2canvas(captureEl, {
          backgroundColor: '#1f2937',
          scale: 2,
          useCORS: false,
          allowTaint: false,
          logging: false,
        });
        imageBase64 = canvas.toDataURL('image/png').replace('data:image/png;base64,', '');

        // Restore original logo URLs
        imgEls.forEach((img, i) => { img.src = origSrcs[i]; });
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
      {trendModal && (
        <TrendModal
          match={trendModal.match}
          homeTrends={trendModal.homeTrends}
          awayTrends={trendModal.awayTrends}
          onClose={() => setTrendModal(null)}
        />
      )}
      {matches.map((match) => (
        <div
          key={match.fs_id}
          className="bg-gray-800 rounded-xl overflow-hidden hover:bg-gray-750 transition-colors border border-gray-700/50"
        >
          {/* ── CAPTURE AREA: only this div is screenshotted ── */}
          <div
            ref={(el) => { if (el) captureRefs.current.set(match.fs_id, el); else captureRefs.current.delete(match.fs_id); }}
            className="p-5"
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
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Ev Attı" value={match.home_scored > 0 ? match.home_scored.toFixed(2) : '—'} highlight={match.home_scored >= 1.5} color="green" />
              <StatBox label="Ev Yedi" value={match.home_conceded > 0 ? match.home_conceded.toFixed(2) : '—'} highlight={match.home_conceded >= 1.5} color="red" />
              <StatBox label="Dep Attı" value={match.away_scored > 0 ? match.away_scored.toFixed(2) : '—'} highlight={match.away_scored >= 1.5} color="emerald" />
              <StatBox label="Dep Yedi" value={match.away_conceded > 0 ? match.away_conceded.toFixed(2) : '—'} highlight={match.away_conceded >= 1.5} color="orange" />
            </div>
          </div>
          {/* ── END CAPTURE AREA ── */}

          {/* Confidence Badge — outside capture area, not included in screenshot */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700/50">
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
              <button
                onClick={() => handleTrend(match)}
                disabled={trendLoadingId === match.fs_id}
                className="flex items-center gap-1 px-2 py-1 bg-purple-900/50 hover:bg-purple-700/60 text-purple-300 hover:text-white rounded text-xs transition-colors border border-purple-700/50 hover:border-purple-500 disabled:opacity-50 disabled:cursor-wait"
                title="Trend Şablonunu Göster"
              >
                {trendLoadingId === match.fs_id ? (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                    <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                  </svg>
                ) : (
                  <span>⚡</span>
                )}
                Trend
              </button>
              <button
                onClick={() => handleStory(match)}
                disabled={storyStates.get(match.fs_id) === 'loading'}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors border disabled:cursor-wait ${
                  storyStates.get(match.fs_id) === 'success'
                    ? 'bg-pink-600/80 text-white border-pink-500'
                    : storyStates.get(match.fs_id) === 'error'
                    ? 'bg-red-600/80 text-white border-red-500'
                    : 'bg-gradient-to-r from-purple-900/50 to-pink-900/50 hover:from-purple-700/60 hover:to-pink-700/60 text-pink-300 hover:text-white border-pink-700/50 hover:border-pink-500'
                }`}
                title="Instagram Story olarak paylaş"
              >
                {storyStates.get(match.fs_id) === 'loading' ? (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                    <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                  </svg>
                ) : (
                  <span>📸</span>
                )}
                {storyStates.get(match.fs_id) === 'success' ? '✓' : storyStates.get(match.fs_id) === 'error' ? '✗' : 'Story'}
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

// ─────────────────────────────────────────────────────────────
// TrendModal — Şablon önizlemesi
// ─────────────────────────────────────────────────────────────
function TrendModal({
  match,
  homeTrends,
  awayTrends,
  onClose,
}: {
  match: GoalTrend;
  homeTrends: { text: string }[];
  awayTrends: { text: string }[];
  onClose: () => void;
}) {
  const SEPARATOR = '──────────────────';

  const tweetText = [
    '⚡️ TREND ANALİZİ ⚡️',
    '',
    `🏠 ${match.home_name.toUpperCase()}`,
    SEPARATOR,
    ...(homeTrends.length > 0
      ? homeTrends.map(t => `👉 ${t.text}`)
      : ['👉 Trend verisi bulunamadı.']),
    '',
    ` ✈️  ${match.away_name.toUpperCase()}`,
    SEPARATOR,
    ...(awayTrends.length > 0
      ? awayTrends.map(t => `👉 ${t.text}`)
      : ['👉 Trend verisi bulunamadı.']),
  ].join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(tweetText);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg border border-purple-700/50 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡️</span>
            <span className="text-white font-semibold">Trend Şablonu</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Match info */}
        <div className="px-4 pt-3 pb-1 flex-shrink-0">
          <p className="text-xs text-gray-400">
            {match.home_name} vs {match.away_name} · {match.league_name}
          </p>
        </div>

        {/* Tweet preview */}
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <pre className="text-sm text-gray-100 whitespace-pre-wrap font-sans leading-relaxed bg-gray-900/60 rounded-lg p-4 border border-gray-700">
            {tweetText}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700 flex-shrink-0">
          <span className="text-xs text-gray-500">
            {homeTrends.length} ev + {awayTrends.length} deplasman trendi
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs transition-colors font-semibold"
          >
            📋 Kopyala
          </button>
        </div>
      </div>
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
  const [trendText, setTrendText] = useState('');
  const [trendLoading, setTrendLoading] = useState(true);
  const [withTrend, setWithTrend] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [withImage, setWithImage] = useState(!!imageBase64);

  const SEPARATOR = '──────────────────';

  // Fetch trend template on mount
  useEffect(() => {
    setTrendLoading(true);
    getMatchTrends(match.fs_id)
      .then(data => {
        const home = data.trends?.home || [];
        const away = data.trends?.away || [];
        if (home.length > 0 || away.length > 0) {
          const lines = [
            '⚡️ TREND ANALİZİ ⚡️',
            '',
            `🏠 ${(data.home_name || match.home_name).toUpperCase()}`,
            SEPARATOR,
            ...(home.length > 0 ? home.map((t: { text: string }) => `👉 ${t.text}`) : ['👉 Trend verisi bulunamadı.']),
            '',
            ` ✈️  ${(data.away_name || match.away_name).toUpperCase()}`,
            SEPARATOR,
            ...(away.length > 0 ? away.map((t: { text: string }) => `👉 ${t.text}`) : ['👉 Trend verisi bulunamadı.']),
          ];
          setTrendText(lines.join('\n'));
          setWithTrend(true);
        }
      })
      .catch(() => {})
      .finally(() => setTrendLoading(false));
  }, [match.fs_id]);

  const [igState, setIgState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [igError, setIgError] = useState('');

  const handleInstagramStory = async () => {
    if (!imageBase64) return;
    setIgState('loading');
    try {
      const result = await postInstagramStory(imageBase64);
      if (result.success) {
        setIgState('success');
        setTimeout(() => setIgState('idle'), 4000);
      } else {
        setIgError(result.error || 'Hata');
        setIgState('error');
        setTimeout(() => setIgState('idle'), 4000);
      }
    } catch (err: any) {
      setIgError(err.message || 'Bağlantı hatası');
      setIgState('error');
      setTimeout(() => setIgState('idle'), 4000);
    }
  };

  const charCount = text.length;
  const isOverLimit = charCount > 280;
  const isDisabled = isOverLimit || charCount === 0 || publishState === 'loading';

  const handlePublish = async () => {
    if (isDisabled) return;
    setPublishState('loading');
    try {
      const result = await publishSingleMatchTweet(
        text.trim(),
        withImage && imageBase64 ? imageBase64 : undefined,
        withTrend && trendText.trim() ? trendText.trim() : undefined
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

        {/* Trend Thread Reply Section */}
        <div className="px-4 pb-2">
          <div className="border border-purple-700/40 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-purple-900/20 border-b border-purple-700/30">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M3 10h10a4 4 0 010 8H9m-6-8l3-3m-3 3l3 3" />
                </svg>
                <span className="text-xs text-purple-300 font-medium">⚡️ Thread Yanıtı (Trend Şablonu)</span>
                {trendLoading && (
                  <svg className="w-3 h-3 text-purple-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="3" className="opacity-25" />
                    <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="3" className="opacity-75" />
                  </svg>
                )}
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <span className="text-xs text-gray-500">{withTrend ? 'Açık' : 'Kapalı'}</span>
                <div
                  onClick={() => setWithTrend(v => !v)}
                  className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${withTrend ? 'bg-purple-500' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${withTrend ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>

            {withTrend && (
              <div className="p-3">
                {trendLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-700 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-700 rounded animate-pulse w-full" />
                    <div className="h-3 bg-gray-700 rounded animate-pulse w-5/6" />
                  </div>
                ) : (
                  <>
                    <textarea
                      className="w-full bg-gray-700 text-white text-xs rounded-lg p-3 resize-none border border-purple-700/30 focus:border-purple-500 focus:outline-none font-sans leading-relaxed"
                      rows={10}
                      value={trendText}
                      onChange={(e) => {
                        setTrendText(e.target.value);
                        setPublishState('idle');
                        setErrorMsg('');
                      }}
                      placeholder="Trend şablonu yükleniyor..."
                      disabled={publishState === 'loading'}
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">Ana tweetin altına yanıt olarak gönderilir</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {publishState === 'success' && (
          <div className="mx-4 mb-3 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
            ✓ {withTrend ? '2 tweet thread olarak yayınlandı!' : 'Tweet başarıyla yayınlandı!'}
          </div>
        )}
        {publishState === 'error' && (
          <div className="mx-4 mb-3 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            ✗ {errorMsg}
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
            disabled={publishState === 'loading'}
          >
            İptal
          </button>

          <div className="flex items-center gap-2">
            {/* Instagram Story Button */}
            {imageBase64 && (
              <button
                onClick={handleInstagramStory}
                disabled={igState === 'loading'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  igState === 'success'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : igState === 'error'
                    ? 'bg-red-600/80 text-white'
                    : igState === 'loading'
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white'
                }`}
                title="Instagram Story olarak paylaş"
              >
                {igState === 'loading' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                      <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                    </svg>
                    Story...
                  </>
                ) : igState === 'success' ? (
                  '✓ Story Paylaşıldı!'
                ) : igState === 'error' ? (
                  `✗ ${igError}`
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Story
                  </>
                )}
              </button>
            )}

            {/* Twitter Publish Button */}
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
    </div>
  );
}
