import { useState, useEffect } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

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
    over15?: number;
    corners?: number;
    cards?: number;
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
  live_score?: {
    home: number;
    away: number;
    minute: string;
    status: string;
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
  performance?: {
    total: number;
    won: number;
    lost: number;
    pending: number;
    win_rate: number;
  };
}

interface DailyListsResponse {
  success: boolean;
  lists_count: number;
  lists: DailyList[];
  generated_at: number;
  message?: string;
}

// ============================================================================
// MARKET CONFIGURATIONS
// ============================================================================

const MARKET_CONFIG: Record<string, {
  label: string;
  gradient: string;
  icon: string;
  color: string;
  lightBg: string;
  darkBg: string;
}> = {
  OVER_25: {
    label: '2.5 ÜST',
    gradient: 'from-blue-500 to-blue-600',
    icon: '📈',
    color: 'text-blue-600',
    lightBg: 'bg-blue-50',
    darkBg: 'bg-blue-100',
  },
  OVER_15: {
    label: '1.5 ÜST',
    gradient: 'from-indigo-500 to-indigo-600',
    icon: '🎯',
    color: 'text-indigo-600',
    lightBg: 'bg-indigo-50',
    darkBg: 'bg-indigo-100',
  },
  BTTS: {
    label: 'Karşılıklı Gol',
    gradient: 'from-green-500 to-green-600',
    icon: '⚽',
    color: 'text-green-600',
    lightBg: 'bg-green-50',
    darkBg: 'bg-green-100',
  },
  HT_OVER_05: {
    label: 'İY 0.5 ÜST',
    gradient: 'from-purple-500 to-purple-600',
    icon: '⏱️',
    color: 'text-purple-600',
    lightBg: 'bg-purple-50',
    darkBg: 'bg-purple-100',
  },
  CORNERS: {
    label: 'KORNER',
    gradient: 'from-orange-500 to-orange-600',
    icon: '🚩',
    color: 'text-orange-600',
    lightBg: 'bg-orange-50',
    darkBg: 'bg-orange-100',
  },
  CARDS: {
    label: 'KART',
    gradient: 'from-yellow-500 to-yellow-600',
    icon: '🟨',
    color: 'text-yellow-600',
    lightBg: 'bg-yellow-50',
    darkBg: 'bg-yellow-100',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TelegramDailyLists() {
  const [lists, setLists] = useState<DailyList[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingMarket, setPublishingMarket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [expandedList, setExpandedList] = useState<string | null>(null);

  const fetchLists = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/telegram/daily-lists/today');
      if (!response.ok) throw new Error('API hatası');

      const data: DailyListsResponse = await response.json();
      console.log('📊 Daily Lists API Response:', data.lists_count, 'lists');
      console.log('Markets:', data.lists.map(l => l.market));
      setLists(data.lists || []);
      setLastUpdated(data.generated_at);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const publishSingleList = async (list: DailyList) => {
    if (!confirm(`"${list.title}" listesini Telegram'a yayınlamak istediğinizden emin misiniz?`)) {
      return;
    }

    setPublishingMarket(list.market);
    setError(null);
    try {
      const response = await fetch(`/api/telegram/publish/daily-list/${list.market}`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Yayınlama hatası');

      const result = await response.json();

      if (result.success) {
        alert(`✅ Başarılı!\n\n"${list.title}" Telegram'a yayınlandı.\nMesaj ID: ${result.telegram_message_id}`);
        await fetchLists();
      } else {
        alert(`⚠️ ${result.message || 'Yayınlama başarısız'}`);
      }
    } catch (err: any) {
      setError(err.message);
      alert(`❌ Hata: ${err.message}`);
    } finally {
      setPublishingMarket(null);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  // Calculate stats
  const totalMatches = lists.reduce((sum, list) => sum + list.matches_count, 0);
  const avgConfidence = lists.length > 0
    ? Math.round(lists.reduce((sum, list) => sum + list.avg_confidence, 0) / lists.length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Listeler yükleniyor...</h3>
          <p className="text-gray-500">Günün maçları analiz ediliyor</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <span className="text-5xl">📊</span>
                Günlük Telegram Listeleri
              </h1>
              <p className="text-gray-600 text-lg">
                AI destekli tahmin listeleri - Her pazar için özelleştirilmiş
              </p>
            </div>
            <button
              onClick={fetchLists}
              disabled={loading}
              className="group relative px-6 py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors ${loading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="font-medium text-gray-700 group-hover:text-blue-600">Yenile</span>
              </div>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Toplam Liste</p>
                  <p className="text-3xl font-bold text-gray-900">{lists.length}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📋</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-green-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Toplam Maç</p>
                  <p className="text-3xl font-bold text-gray-900">{totalMatches}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⚽</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-purple-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Ort. Güven</p>
                  <p className="text-3xl font-bold text-gray-900">{avgConfidence}%</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Son Güncelleme</p>
                  <p className="text-sm font-bold text-gray-900">
                    {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🕐</span>
                </div>
              </div>
            </div>
          </div>

          {lastUpdated && (
            <p className="text-sm text-gray-500 text-center">
              Son güncelleme: {new Date(lastUpdated).toLocaleString('tr-TR')}
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-red-800 mb-1">Hata Oluştu</h4>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Lists Grid */}
        {lists.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border-2 border-gray-100">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-700 mb-3">
              Bugün için uygun maç bulunamadı
            </h3>
            <p className="text-gray-500 text-lg max-w-md mx-auto">
              Yeterli güven skoruna sahip maç olmadığında listeler oluşturulmaz. Lütfen daha sonra tekrar deneyin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {lists.map((list) => {
              const config = MARKET_CONFIG[list.market];
              const isExpanded = expandedList === list.market;
              const isPublishing = publishingMarket === list.market;

              return (
                <div
                  key={list.market}
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-gray-100 hover:border-gray-200"
                >
                  {/* Card Header */}
                  <div className={`bg-gradient-to-r ${config.gradient} p-6 text-white relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">{config.icon}</span>
                          <div>
                            <h3 className="text-xl font-bold">{config.label}</h3>
                            <p className="text-sm opacity-90">{list.matches_count} Maç Seçildi</p>
                          </div>
                        </div>
                        <div className="bg-white bg-opacity-25 backdrop-blur-sm rounded-xl px-4 py-2">
                          <p className="text-xs font-medium opacity-90">Ortalama Güven</p>
                          <p className="text-2xl font-bold">{list.avg_confidence}%</p>
                        </div>
                      </div>

                      {/* Confidence Bar */}
                      <div className="bg-white bg-opacity-20 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-white h-full rounded-full transition-all duration-1000"
                          style={{ width: `${list.avg_confidence}%` }}
                        ></div>
                      </div>

                      {/* Performance Stats (if available) */}
                      {list.performance && list.performance.total > 0 && (
                        <div className="mt-3 flex items-center gap-3 text-sm">
                          <div className="bg-white bg-opacity-25 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                            <span className="font-medium opacity-90">Performans:</span>
                            <span className="font-bold">
                              {list.performance.won}/{list.performance.total}
                            </span>
                            {list.performance.pending === 0 && (
                              <span className="text-xs">
                                ({list.performance.win_rate}% {list.performance.win_rate >= 70 ? '✅' : list.performance.win_rate >= 50 ? '⚠️' : '❌'})
                              </span>
                            )}
                          </div>
                          {list.performance.pending > 0 && (
                            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-1 text-xs">
                              <span className="animate-pulse">⏳</span>
                              <span>{list.performance.pending} bekliyor</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Matches Preview */}
                  <div className="p-6">
                    <div className="space-y-3 mb-4">
                      {list.matches.slice(0, isExpanded ? undefined : 3).map((match, idx) => {
                        // Determine match status
                        const now = Math.floor(Date.now() / 1000);
                        const matchStarted = match.date_unix <= now;
                        const matchFinished = match.date_unix <= (now - 2 * 60 * 60); // 2 hours after start = finished

                        return (
                          <div
                            key={match.fs_id}
                            className={`${config.lightBg} rounded-xl p-4 border-2 border-transparent hover:border-gray-200 transition-all duration-200 ${
                              matchStarted ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                                  <span className={`text-sm font-bold truncate ${matchStarted ? 'text-gray-500' : 'text-gray-900'}`}>
                                    {match.home_name} vs {match.away_name}
                                  </span>
                                  {matchStarted && (
                                    <>
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                        matchFinished
                                          ? 'bg-gray-200 text-gray-600'
                                          : 'bg-red-100 text-red-600 animate-pulse'
                                      }`}>
                                        {matchFinished ? 'BİTTİ' : 'CANLI'}
                                      </span>
                                      {match.live_score && (
                                        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700">
                                          {match.live_score.home}-{match.live_score.away} {match.live_score.minute}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  <span className="truncate">{match.league_name}</span>
                                </div>
                              </div>
                              <div className={`px-3 py-1 rounded-lg font-bold text-sm ${
                                match.confidence >= 80 ? 'bg-green-100 text-green-700' :
                                match.confidence >= 70 ? 'bg-blue-100 text-blue-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {match.confidence >= 80 ? '🔥' : match.confidence >= 70 ? '⭐' : '💡'} {match.confidence}
                              </div>
                            </div>

                            {match.xg && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                xG: {match.xg.home?.toFixed(1)} - {match.xg.away?.toFixed(1)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Show More/Less Button */}
                    {list.matches.length > 3 && (
                      <button
                        onClick={() => setExpandedList(isExpanded ? null : list.market)}
                        className="w-full py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                      >
                        {isExpanded ? (
                          <>
                            <span>Daha az göster</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <span>{list.matches.length - 3} maç daha göster</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    )}

                    {/* Publish Button */}
                    <button
                      onClick={() => publishSingleList(list)}
                      disabled={isPublishing}
                      className={`
                        w-full mt-4 py-4 rounded-xl font-bold text-white
                        bg-gradient-to-r ${config.gradient}
                        hover:shadow-xl hover:scale-[1.02]
                        active:scale-[0.98]
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-200
                        flex items-center justify-center gap-3
                      `}
                    >
                      {isPublishing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Yayınlanıyor...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          <span>Telegram'a Yayınla</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
