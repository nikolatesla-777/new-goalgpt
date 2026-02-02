import { useState, useMemo } from 'react';
import { getTodayInTurkey, getYesterdayInTurkey, formatTimestampToTSI, formatMillisecondsToTSI, formatDateStringToLongTurkish, TSI_OFFSET_MS } from '../../utils/dateUtils';
import {
  useTelegramDailyListsToday,
  useTelegramDailyListsRange,
  usePublishDailyList,
} from '../../api/hooks';

// ============================================================================
// INTERFACES
// ============================================================================

interface Match {
  fs_id: number;
  match_id?: string | null;
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
  // Settlement fields
  match_finished?: boolean | null;
  final_score?: {
    home: number;
    away: number;
  } | null;
  result?: 'won' | 'lost' | 'void' | 'pending';
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
    label: 'Korner 7.5 ÜST',
    gradient: 'from-orange-500 to-orange-600',
    icon: '🚩',
    color: 'text-orange-600',
    lightBg: 'bg-orange-50',
    darkBg: 'bg-orange-100',
  },
  CARDS: {
    label: 'Sarı Kart 3.5 ÜST',
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

// Date filter types
type DateRange = 'today' | 'yesterday' | 'last7days' | 'thismonth';

interface DateData {
  date: string;
  lists: DailyList[];
  lists_count: number;
}

export function TelegramDailyLists() {
  const [expandedList, setExpandedList] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange>('today');
  const [publishingMarket, setPublishingMarket] = useState<string | null>(null);

  // Compute date range based on selected range
  const { start, end } = useMemo(() => {
    return getDateRange(selectedRange);
  }, [selectedRange]);

  // React Query hooks
  const isToday = selectedRange === 'today';
  const todayQuery = useTelegramDailyListsToday();
  const rangeQuery = useTelegramDailyListsRange(start, end, !isToday);
  const publishMutation = usePublishDailyList();

  // Select active query based on range
  const activeQuery = isToday ? todayQuery : rangeQuery;
  const { data, isLoading, isError, error: queryError, refetch } = activeQuery;

  // Extract lists and metadata from response
  const lists = isToday && data ? (data as any).lists || [] : [];
  const historicalData: DateData[] = !isToday && data ? (data as any).data || [] : [];

  // DEBUG: Log settlement data
  if (isToday && lists.length > 0) {
    const btts = lists.find((l: any) => l.market === 'BTTS');
    if (btts && btts.matches && btts.matches.length > 0) {
      console.log('🔍 [DEBUG] BTTS First Match:', btts.matches[0]);
      console.log('🔍 [DEBUG] First Match Settlement Data:', {
        result: btts.matches[0].result,
        match_finished: btts.matches[0].match_finished,
        final_score: btts.matches[0].final_score,
      });
    }
  }

  // Read generated_at from appropriate source based on view mode
  const lastUpdated = isToday
    ? ((data as any)?.generated_at || null)
    : (historicalData.length > 0 && historicalData[0].lists.length > 0
        ? historicalData[0].lists[0].generated_at
        : null);
  const isHistoricalView = !isToday;
  const loading = isLoading;
  const error = isError ? (queryError instanceof Error ? queryError.message : 'Bir hata oluştu') : null;

  // Calculate date ranges in Istanbul timezone (UTC+3)
  function getDateRange(range: DateRange): { start: string; end: string } {
    // Get today's date in Istanbul timezone (YYYY-MM-DD)
    const today = getTodayInTurkey();

    switch (range) {
      case 'today':
        return { start: today, end: today };
      case 'yesterday':
        const yesterday = getYesterdayInTurkey();
        return { start: yesterday, end: yesterday };
      case 'last7days':
        // Calculate 7 days ago in Istanbul timezone
        const tsiMs = Date.now() + TSI_OFFSET_MS;
        const sevenDaysAgoMs = tsiMs - (6 * 24 * 60 * 60 * 1000);
        const sevenDaysAgoDate = new Date(sevenDaysAgoMs);
        const start = `${sevenDaysAgoDate.getUTCFullYear()}-${String(sevenDaysAgoDate.getUTCMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgoDate.getUTCDate()).padStart(2, '0')}`;
        return { start, end: today };
      case 'thismonth':
        // First day of current month in Istanbul timezone
        const [year, month] = today.split('-');
        return { start: `${year}-${month}-01`, end: today };
      default:
        return { start: today, end: today };
    }
  };

  // Publish single list handler
  const publishSingleList = async (list: DailyList) => {
    if (!confirm(`"${list.title}" listesini Telegram'a yayınlamak istediğinizden emin misiniz?`)) {
      return;
    }

    setPublishingMarket(list.market);
    try {
      const result = await publishMutation.mutateAsync({
        market: list.market,
        options: {}
      });

      if (result.success) {
        alert(`✅ Başarılı!\n\n"${list.title}" Telegram'a yayınlandı.\nMesaj ID: ${result.telegram_message_id}`);
      } else {
        alert(`⚠️ ${result.message || 'Yayınlama başarısız'}`);
      }
    } catch (err: any) {
      alert(`❌ Hata: ${err instanceof Error ? err.message : 'Yayınlama hatası'}`);
    } finally {
      setPublishingMarket(null);
    }
  };

  // Calculate stats based on view mode
  const displayLists = isHistoricalView
    ? historicalData.flatMap(d => d.lists)
    : lists;

  const totalMatches = displayLists.reduce((sum: number, list: DailyList) => sum + list.matches_count, 0);
  const avgConfidence = displayLists.length > 0
    ? Math.round(displayLists.reduce((sum: number, list: DailyList) => sum + list.avg_confidence, 0) / displayLists.length)
    : 0;

  // Calculate total performance across all lists by counting individual match results
  const totalPerformance = useMemo(() => {
    let total = 0;
    let won = 0;
    let lost = 0;
    let pending = 0;
    let voidCount = 0;

    displayLists.forEach((list: DailyList) => {
      // Count results from each match
      list.matches.forEach((match: Match) => {
        if (match.result === 'won') {
          won++;
          total++;
        } else if (match.result === 'lost') {
          lost++;
          total++;
        } else if (match.result === 'void') {
          voidCount++;
          // Void matches are not counted in total
        } else {
          // No result yet - pending (match not finished or not settled)
          pending++;
        }
      });
    });

    return { total, won, lost, pending, void: voidCount };
  }, [displayLists]);

  const overallWinRate = totalPerformance.total > 0
    ? Math.round((totalPerformance.won / totalPerformance.total) * 100)
    : 0;

  // For stats card display
  const statsListsCount = isHistoricalView ? historicalData.length : displayLists.length;

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
                Günlük Liste Tahminleri
              </h1>
              <p className="text-gray-600 text-lg">
                {isHistoricalView
                  ? `Tarih aralığı: ${selectedRange === 'yesterday' ? 'Dün' : selectedRange === 'last7days' ? 'Son 7 Gün' : 'Bu Ay'}`
                  : 'AI Destekli Listeler, Özenle Seçilmiş Tahminler'
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Date Filter Buttons */}
              <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-xl p-1">
                <button
                  onClick={() => setSelectedRange('today')}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedRange === 'today'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Bugün
                </button>
                <button
                  onClick={() => setSelectedRange('yesterday')}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedRange === 'yesterday'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Dün
                </button>
                <button
                  onClick={() => setSelectedRange('last7days')}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedRange === 'last7days'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Son 7 Gün
                </button>
                <button
                  onClick={() => setSelectedRange('thismonth')}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedRange === 'thismonth'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Bu Ay
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => refetch()}
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
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    {isHistoricalView ? 'Toplam Gün' : 'Toplam Liste'}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{statsListsCount}</p>
                  {isHistoricalView && displayLists.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {displayLists.length} liste
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">{isHistoricalView ? '📅' : '📋'}</span>
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

            {/* NEW: Daily Performance Card */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-emerald-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="w-full">
                  <p className="text-sm font-medium text-gray-500 mb-2">Günlük Performans</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-bold text-emerald-600">{totalPerformance.won}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-2xl font-bold text-gray-900">{totalPerformance.total}</span>
                  </div>
                  {totalPerformance.total > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            overallWinRate >= 70 ? 'bg-emerald-500' :
                            overallWinRate >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${overallWinRate}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${
                        overallWinRate >= 70 ? 'text-emerald-600' :
                        overallWinRate >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {overallWinRate}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center ml-3">
                  <span className="text-2xl">✅</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Son Güncelleme</p>
                  <p className="text-sm font-bold text-gray-900">
                    {lastUpdated ? formatTimestampToTSI(Math.floor(lastUpdated / 1000)) : '--:--'}
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
              Son güncelleme: {formatMillisecondsToTSI(lastUpdated)}
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

        {/* Historical View (Multiple Dates) */}
        {isHistoricalView ? (
          <div className="space-y-8">
            {historicalData.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-xl p-16 text-center border-2 border-gray-100">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-700 mb-3">
                  Seçilen tarih aralığında veri bulunamadı
                </h3>
                <p className="text-gray-500 text-lg max-w-md mx-auto">
                  Bu tarih aralığında oluşturulmuş liste bulunmuyor.
                </p>
              </div>
            ) : (
              historicalData.map((dateData) => {
                // Calculate stats for this date
                const dateTotalMatches = dateData.lists.reduce((sum, list) => sum + list.matches_count, 0);
                const dateAvgConfidence = dateData.lists.length > 0
                  ? Math.round(dateData.lists.reduce((sum, list) => sum + list.avg_confidence, 0) / dateData.lists.length)
                  : 0;
                // Calculate performance by counting individual match results
                const dateTotalPerformance = dateData.lists.reduce((acc, list) => {
                  list.matches.forEach((match: Match) => {
                    if (match.result === 'won') {
                      acc.won++;
                      acc.total++;
                    } else if (match.result === 'lost') {
                      acc.lost++;
                      acc.total++;
                    } else if (match.result === 'void') {
                      // Void matches not counted in total
                    } else {
                      acc.pending++;
                    }
                  });
                  return acc;
                }, { total: 0, won: 0, lost: 0, pending: 0 });
                const dateWinRate = dateTotalPerformance.total > 0
                  ? Math.round((dateTotalPerformance.won / dateTotalPerformance.total) * 100)
                  : 0;

                return (
                  <div key={dateData.date} className="space-y-4">
                    {/* Date Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-bold mb-2">
                            📅 {formatDateStringToLongTurkish(dateData.date)}
                          </h2>
                          <p className="text-blue-100">
                            {dateData.lists_count} liste • {dateTotalMatches} maç • Ortalama Güven: {dateAvgConfidence}%
                          </p>
                        </div>
                        {dateTotalPerformance.total > 0 && (
                          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl px-6 py-3">
                            <p className="text-sm font-medium opacity-90 mb-1">Performans</p>
                            <p className="text-3xl font-bold">
                              {dateTotalPerformance.won}/{dateTotalPerformance.total}
                            </p>
                            <p className="text-sm mt-1">
                              {dateWinRate}% {dateWinRate >= 70 ? '✅' : dateWinRate >= 50 ? '⚠️' : '❌'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lists Grid for this date */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      {dateData.lists.map((list) => {
                        const config = MARKET_CONFIG[list.market];

                        return (
                          <div
                            key={`${dateData.date}-${list.market}`}
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
                                  <div className="mt-4 space-y-2">
                                    {/* Performance Bar */}
                                    <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold opacity-90">Performans</span>
                                        <span className="text-lg font-bold">
                                          {list.performance.won}/{list.performance.total}
                                          {list.performance.pending === 0 && (
                                            <span className="text-xs ml-1 opacity-80">
                                              ({list.performance.win_rate}%)
                                            </span>
                                          )}
                                        </span>
                                      </div>

                                      {/* Progress Bar */}
                                      <div className="w-full h-2.5 bg-white bg-opacity-30 rounded-full overflow-hidden">
                                        <div className="h-full flex">
                                          {/* Won segment */}
                                          <div
                                            className="bg-green-500"
                                            style={{ width: `${(list.performance.won / list.performance.total) * 100}%` }}
                                          />
                                          {/* Lost segment */}
                                          <div
                                            className="bg-red-500"
                                            style={{ width: `${(list.performance.lost / list.performance.total) * 100}%` }}
                                          />
                                          {/* Pending segment */}
                                          <div
                                            className="bg-gray-400"
                                            style={{ width: `${(list.performance.pending / list.performance.total) * 100}%` }}
                                          />
                                        </div>
                                      </div>

                                      {/* Stats breakdown */}
                                      <div className="flex items-center gap-3 mt-2 text-xs">
                                        <div className="flex items-center gap-1">
                                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                          <span className="opacity-90">✅ {list.performance.won} Kazandı</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                          <span className="opacity-90">❌ {list.performance.lost} Kaybetti</span>
                                        </div>
                                        {list.performance.pending > 0 && (
                                          <div className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                            <span className="opacity-90">🕒 {list.performance.pending} Bekliyor</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Summary View (no expand/collapse for historical) */}
                            <div className="p-6">
                              <div className="text-sm text-gray-600 mb-3">
                                {list.matches.slice(0, 3).map((match) => {
                                  // Generate tooltip for historical matches
                                  const historicalTooltip = match.result === 'won'
                                    ? `✅ Kazandı - ${list.market}: Tahmin tuttu!${match.final_score ? ` (${match.final_score.home}-${match.final_score.away})` : ''}`
                                    : match.result === 'lost'
                                    ? `❌ Kaybetti - ${list.market}: Tahmin tutmadı.${match.final_score ? ` (${match.final_score.home}-${match.final_score.away})` : ''}`
                                    : match.result === 'void'
                                    ? `⚪ Geçersiz - TheSports API eşleştirmesi başarısız.`
                                    : `Sonuç bekleniyor...`;

                                  return (
                                    <div
                                      key={match.fs_id}
                                      title={historicalTooltip}
                                      className="mb-2 pb-2 border-b border-gray-100 last:border-0 cursor-help"
                                    >
                                      <p className="font-medium text-gray-900">
                                        {match.home_name} vs {match.away_name}
                                        {match.result && (
                                          <span className={`ml-2 text-xs ${
                                            match.result === 'won' ? 'text-green-600' :
                                            match.result === 'lost' ? 'text-red-600' :
                                            'text-gray-500'
                                          }`}>
                                            {match.result === 'won' ? '✅' : match.result === 'lost' ? '❌' : '⚪'}
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {match.league_name} • Güven: {match.confidence}%
                                        {match.final_score && (
                                          <span className="ml-2 font-bold text-gray-700">
                                            {match.final_score.home}-{match.final_score.away}
                                          </span>
                                        )}
                                        {match.live_score && !match.final_score && (
                                          <span className="ml-2 font-bold text-blue-600">
                                            {match.live_score.home}-{match.live_score.away}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  );
                                })}
                                {list.matches.length > 3 && (
                                  <p className="text-xs text-gray-400 mt-2 text-center">
                                    ... ve {list.matches.length - 3} maç daha
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Normal Lists Grid (Today View) */
          <>
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
            {lists.map((list: DailyList) => {
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
                        <div className="mt-4 space-y-2">
                          {/* Performance Bar */}
                          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold opacity-90">Performans</span>
                              <span className="text-lg font-bold">
                                {list.performance.won}/{list.performance.total}
                                {list.performance.pending === 0 && (
                                  <span className="text-xs ml-1 opacity-80">
                                    ({list.performance.win_rate}%)
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-2.5 bg-white bg-opacity-30 rounded-full overflow-hidden">
                              <div className="h-full flex">
                                {/* Won segment */}
                                <div
                                  className="bg-green-500"
                                  style={{ width: `${(list.performance.won / list.performance.total) * 100}%` }}
                                />
                                {/* Lost segment */}
                                <div
                                  className="bg-red-500"
                                  style={{ width: `${(list.performance.lost / list.performance.total) * 100}%` }}
                                />
                                {/* Pending segment */}
                                <div
                                  className="bg-gray-400"
                                  style={{ width: `${(list.performance.pending / list.performance.total) * 100}%` }}
                                />
                              </div>
                            </div>

                            {/* Stats breakdown */}
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="opacity-90">✅ {list.performance.won}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                <span className="opacity-90">❌ {list.performance.lost}</span>
                              </div>
                              {list.performance.pending > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                  <span className="opacity-90">🕒 {list.performance.pending}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Matches Preview */}
                  <div className="p-6">
                    <div className="space-y-3 mb-4">
                      {list.matches.slice(0, isExpanded ? undefined : 3).map((match: Match, idx: number) => {
                        // DEBUG: Log every match during render
                        if (match.home_name.includes('Boca')) {
                          console.log('🚨 RENDERING BOCA JUNIORS:', {
                            home: match.home_name,
                            away: match.away_name,
                            match_finished: match.match_finished,
                            final_score: match.final_score,
                            result: match.result,
                            'Has all fields?': !!(match.match_finished && match.final_score && match.result)
                          });
                        }

                        // Determine match status (use backend values when available)
                        const now = Math.floor(Date.now() / 1000);
                        const matchStarted = match.date_unix <= now;
                        // Use backend's match_finished (from TheSports only)
                        const matchFinished = match.match_finished ?? (match.date_unix <= (now - 2 * 60 * 60));

                        // Generate tooltip text based on match status
                        const tooltipText = match.result === 'won'
                          ? `✅ Kazandı - ${list.market}: Tahmin tuttu!${match.final_score ? ` (${match.final_score.home}-${match.final_score.away})` : ''}`
                          : match.result === 'lost'
                          ? `❌ Kaybetti - ${list.market}: Tahmin tutmadı.${match.final_score ? ` (${match.final_score.home}-${match.final_score.away})` : ''}`
                          : match.result === 'void'
                          ? `⚪ Geçersiz - TheSports API eşleştirmesi başarısız. Maç settle edilemedi.`
                          : matchFinished
                          ? `⏳ Settlement Bekliyor - Maç bitti, sonuç değerlendirmesi yapılıyor...`
                          : matchStarted
                          ? `▶️ Maç devam ediyor${match.live_score ? ` (${match.live_score.home}-${match.live_score.away} ${match.live_score.minute}')` : ''}`
                          : `⏰ Maç ${new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} saatinde başlayacak`;

                        return (
                          <div
                            key={match.fs_id}
                            title={tooltipText}
                            className={`${config.lightBg} rounded-xl p-4 border-2 border-transparent hover:border-gray-200 transition-all duration-200 cursor-help ${
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

                                  {/* Match Status & Score - Settlement-Aware */}
                                  {(() => {
                                    // CASE 1: Settlement completed (final_score and result available)
                                    if (match.match_finished && match.final_score && match.result) {
                                      return (
                                        <>
                                          {/* Final Score Badge */}
                                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-gray-200 text-gray-700">
                                            FT {match.final_score.home}-{match.final_score.away}
                                          </span>

                                          {/* Result Badge */}
                                          {match.result === 'won' && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-700">
                                              ✅ Kazandı
                                            </span>
                                          )}
                                          {match.result === 'lost' && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700">
                                              ❌ Kaybetti
                                            </span>
                                          )}
                                          {match.result === 'void' && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-600">
                                              ⚪ Geçersiz
                                            </span>
                                          )}
                                        </>
                                      );
                                    }

                                    // CASE 2: Match finished but settlement pending
                                    if (matchFinished && !match.result) {
                                      return (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-600 animate-pulse">
                                          ⏳ Settle Bekliyor
                                        </span>
                                      );
                                    }

                                    // CASE 3: Match is live (TheSports data)
                                    // SAFETY: Don't show CANLI if match is finished (status="Bitti") or has final settlement (won/lost)
                                    // NOTE: Show CANLI for VOID matches too (they're still live, just unmapped)
                                    if (match.live_score
                                        && match.live_score.status !== 'Bitti'
                                        && matchStarted
                                        && !matchFinished
                                        && match.result !== 'won'
                                        && match.result !== 'lost') {
                                      return (
                                        <>
                                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-600 animate-pulse">
                                            🔴 CANLI
                                          </span>
                                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700">
                                            {match.live_score.home}-{match.live_score.away} {match.live_score.minute}'
                                          </span>
                                        </>
                                      );
                                    }

                                    // CASE 4: Match started but NO MAPPING (match_id is null)
                                    if (matchStarted && !matchFinished && !match.match_id) {
                                      return (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-600">
                                          ⚠️ Eşleştirme Yok
                                        </span>
                                      );
                                    }

                                    // CASE 5: Match not started yet (default - show nothing, time is shown elsewhere)
                                    return null;
                                  })()}
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
          </>
        )}
      </div>
    </div>
  );
}
