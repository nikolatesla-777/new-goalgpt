import { useState, useEffect } from 'react';

// Inline SVG Icons
const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const RefreshCwIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
);

const TargetIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface Match {
  fs_id: number;
  home_name: string;
  away_name: string;
  league_name: string;
  date_unix: number;
  confidence: number;
  reason: string;
  potentials?: {
    btts?: number;
    over25?: number;
    avg?: number;
  };
  xg?: {
    home?: number;
    away?: number;
  };
  odds?: {
    home?: number;
    draw?: number;
    away?: number;
  };
}

interface DailyList {
  market: string;
  title: string;
  emoji: string;
  matches_count: number;
  avg_confidence: number;
  matches: Match[];
  preview: string;
  generated_at: number;
}

interface DailyListsResponse {
  success: boolean;
  lists_count: number;
  lists: DailyList[];
  generated_at: number;
  message?: string;
}

const MARKET_LABELS: Record<string, string> = {
  OVER_25: '2.5 ÜST',
  BTTS: 'BTTS (Karşılıklı Gol)',
  HT_OVER_05: 'İY 0.5 ÜST',
  CORNERS: 'KORNER',
  CARDS: 'KART',
};

const MARKET_COLORS: Record<string, string> = {
  OVER_25: 'bg-blue-100 text-blue-800 border-blue-300',
  BTTS: 'bg-green-100 text-green-800 border-green-300',
  HT_OVER_05: 'bg-purple-100 text-purple-800 border-purple-300',
  CORNERS: 'bg-orange-100 text-orange-800 border-orange-300',
  CARDS: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

export function TelegramDailyLists() {
  const [lists, setLists] = useState<DailyList[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchLists = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/telegram/daily-lists/today');
      if (!response.ok) throw new Error('API hatası');

      const data: DailyListsResponse = await response.json();
      setLists(data.lists || []);
      setLastUpdated(data.generated_at);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const publishLists = async () => {
    if (!confirm('Tüm listeleri Telegram\'a yayınlamak istediğinizden emin misiniz?')) {
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const response = await fetch('/api/telegram/publish/daily-lists', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Yayınlama hatası');

      const result = await response.json();

      if (result.success) {
        alert(`✅ Başarılı!\n\n${result.lists_published} liste yayınlandı.`);
        await fetchLists(); // Refresh
      } else {
        alert(`⚠️ ${result.message || 'Yayınlama başarısız'}`);
      }
    } catch (err: any) {
      setError(err.message);
      alert(`❌ Hata: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Listeler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                📊 Günlük Telegram Listeleri
              </h1>
              <p className="text-gray-600">
                Otomatik oluşturulan günlük tahmin listeleri
              </p>
              {lastUpdated && (
                <p className="text-sm text-gray-500 mt-2">
                  Son güncelleme: {new Date(lastUpdated).toLocaleString('tr-TR')}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchLists}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCwIcon className="w-4 h-4" />
                Yenile
              </button>
              <button
                onClick={publishLists}
                disabled={publishing || lists.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SendIcon className="w-4 h-4" />
                {publishing ? 'Yayınlanıyor...' : 'Telegram\'a Yayınla'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <strong className="font-bold">Hata: </strong>
            <span>{error}</span>
          </div>
        )}

        {/* Lists */}
        {lists.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Bugün için uygun maç bulunamadı
            </h3>
            <p className="text-gray-500">
              Yeterli güven skoruna sahip maç olmadığında listeler oluşturulmaz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {lists.map((list) => (
              <div key={list.market} className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* List Header */}
                <div className={`p-4 border-b-2 ${MARKET_COLORS[list.market]}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <span>{list.emoji}</span>
                      <span>{MARKET_LABELS[list.market]}</span>
                    </h2>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <TrendingUpIcon className="w-4 h-4" />
                      {list.avg_confidence}/100
                    </div>
                  </div>
                  <p className="text-sm opacity-80">
                    {list.matches_count} maç seçildi
                  </p>
                </div>

                {/* Matches */}
                <div className="p-4 space-y-3">
                  {list.matches.map((match, idx) => (
                    <div
                      key={match.fs_id}
                      className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 text-sm mb-1">
                            {['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][idx]} {match.home_name} vs {match.away_name}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <ClockIcon className="w-3 h-3" />
                            {new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            <span className="mx-1">•</span>
                            <span>{match.league_name || 'Bilinmiyor'}</span>
                          </div>
                        </div>
                        <div
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            match.confidence >= 70
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {match.confidence >= 70 ? '🔥' : '⭐'} {match.confidence}
                        </div>
                      </div>

                      {/* Match Stats */}
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <TargetIcon className="w-3 h-3" />
                          <span>{match.reason}</span>
                        </div>
                        {match.xg && (
                          <div className="text-gray-500">
                            xG: {match.xg.home?.toFixed(1)} - {match.xg.away?.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview Section */}
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <details className="cursor-pointer">
                    <summary className="text-sm font-semibold text-gray-700 hover:text-blue-600">
                      📱 Telegram Mesaj Önizleme
                    </summary>
                    <pre className="mt-3 text-xs bg-white border border-gray-200 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                      {list.preview}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
