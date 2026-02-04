import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useTodaysMatches,
  useTelegramHealth,
  usePublishToTelegram,
} from '../../api/hooks';
import { generateMatchAnalysis } from '../../api/client';

// ============================================================================
// INTERFACES
// ============================================================================

interface Match {
  id: number;
  home_name: string;
  away_name: string;
  home_logo?: string | null;
  away_logo?: string | null;
  competition_name?: string;
  date_unix: number;
  btts_potential?: number;
  o25_potential?: number;
  o15_potential?: number;
  team_a_xg_prematch?: number;
  team_b_xg_prematch?: number;
  odds_ft_1?: number;
  odds_ft_x?: number;
  odds_ft_2?: number;
  external_id?: string;
  corners_potential?: number;
  cards_potential?: number;
  shots_potential?: number;
  fouls_potential?: number;
  trends?: {
    home?: Array<{ sentiment: string; text: string }>;
    away?: Array<{ sentiment: string; text: string }>;
  };
  h2h?: {
    total_matches?: number;
    home_wins?: number;
    draws?: number;
    away_wins?: number;
    btts_pct?: number;
    avg_goals?: number;
    over15_pct?: number;
    over25_pct?: number;
    over35_pct?: number;
  };
}

interface Pick {
  market_type: string;
  label: string;
  emoji: string;
  odds?: number;
}

// ============================================================================
// MATCH ANALYSIS SECTION COMPONENT
// ============================================================================

function MatchAnalysisSection({ matchId }: { matchId: number }) {
  const [copied, setCopied] = useState(false);

  // Fetch analysis when component mounts
  const { data: analysisData, isLoading, isError, error } = useQuery({
    queryKey: ['match-analysis', matchId],
    queryFn: () => generateMatchAnalysis(matchId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Copy to clipboard
  const handleCopy = () => {
    if (!analysisData) return;
    navigator.clipboard.writeText(analysisData.formatted.copy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get confidence emoji
  const getConfidenceEmoji = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return '🔥';
      case 'medium': return '⭐';
      case 'low': return '💡';
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span className="text-lg">🍀</span>
          AI Maç Analizi
        </h4>
        {analysisData && (
          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-green-100 border border-green-300'
            }`}
          >
            {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-3"></div>
          <p className="text-sm text-gray-600">Analiz oluşturuluyor...</p>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
          <svg className="w-8 h-8 text-red-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Analiz oluşturulamadı'}</p>
        </div>
      )}

      {analysisData && (
        <div className="space-y-4">
          {/* Full Analysis - Always Open */}
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="bg-white rounded-lg p-3 border border-green-200 hover:border-green-300 transition-colors flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span>📄</span>
                  Detaylı Analiz
                </span>
                <svg
                  className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>
            <div className="mt-3 space-y-3">
              {analysisData.analysis.fullAnalysis.split('\n\n').map((section, idx) => {
                if (!section.trim()) return null;

                const isHeader = section.startsWith('**');
                if (isHeader) {
                  const headerMatch = section.match(/\*\*(.+?)\*\*/);
                  const header = headerMatch ? headerMatch[1] : '';
                  const content = section.replace(/\*\*.+?\*\*\n?/, '').trim();

                  return (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <h5 className="text-sm font-bold text-gray-900 mb-2">{header}</h5>
                      <p className="text-sm text-gray-700 leading-relaxed">{content}</p>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-700 leading-relaxed">{section}</p>
                  </div>
                );
              })}
            </div>
          </details>

          {/* Recommendations */}
          {analysisData.analysis.recommendations.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>📊</span>
                Öneriler ({analysisData.analysis.recommendations.length})
              </h5>
              {analysisData.analysis.recommendations.map((rec, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border-2 border-green-200 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">{getConfidenceEmoji(rec.confidence)}</span>
                    <div className="flex-1">
                      <div className="font-bold text-base text-gray-900 mb-2">
                        {rec.market} → {rec.prediction}
                      </div>
                      <div className="mb-2">
                        <span className="text-sm text-gray-600">Güven: </span>
                        <span className={`font-bold text-sm px-2 py-1 rounded ${
                          rec.confidence === 'high' ? 'bg-green-100 text-green-700' :
                          rec.confidence === 'medium' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {rec.confidence === 'high' ? 'Yüksek' : rec.confidence === 'medium' ? 'Orta' : 'Düşük'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{rec.reasoning}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-yellow-700 leading-relaxed">
              Bu analiz istatistiksel verilere dayanmaktadır. Lütfen kendi araştırmanızı da yapın ve sorumlu bir şekilde bahis oynayın.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AVAILABLE_PICKS: Pick[] = [
  { market_type: 'BTTS_YES', label: 'Karşılıklı Gol', emoji: '⚽' },
  { market_type: 'O25_OVER', label: '2.5 Üst', emoji: '📈' },
  { market_type: 'O15_OVER', label: '1.5 Üst', emoji: '🎯' },
  { market_type: 'HT_O05_OVER', label: 'İY 0.5 Üst', emoji: '⏱️' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function TelegramPublisher() {
  const [matchPicks, setMatchPicks] = useState<Record<number, string[]>>({});
  const [publishSuccess, setPublishSuccess] = useState<number | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [publishingMatchId, setPublishingMatchId] = useState<number | null>(null);

  // Date filter state - default to today
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
  });

  // React Query hooks replace manual state management
  const {
    data: matchesResponse,
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
  } = useTodaysMatches(selectedDate);

  const {
    data: botHealth,
  } = useTelegramHealth();

  const publishMutation = usePublishToTelegram();

  // Extract matches from response
  const matches = matchesResponse?.data || [];
  const error = isError ? (queryError instanceof Error ? queryError.message : 'Maçlar yüklenemedi') : null;

  const handlePickToggle = (matchId: number, marketType: string) => {
    const currentPicks = matchPicks[matchId] || [];
    if (currentPicks.includes(marketType)) {
      setMatchPicks({
        ...matchPicks,
        [matchId]: currentPicks.filter(p => p !== marketType)
      });
    } else {
      setMatchPicks({
        ...matchPicks,
        [matchId]: [...currentPicks, marketType]
      });
    }
  };

  const handlePublish = async (match: Match) => {
    if (!match.external_id) {
      alert('⚠️ Maç external_id\'ye sahip olmalı');
      return;
    }

    const picks = matchPicks[match.id] || [];
    if (picks.length === 0) {
      alert('⚠️ En az bir tahmin seçmelisiniz');
      return;
    }

    setPublishingMatchId(match.id);
    try {
      const pickObjects = picks.map(marketType => ({
        market_type: marketType,
        odds: undefined
      }));

      await publishMutation.mutateAsync({
        fsMatchId: match.id,
        matchId: match.external_id,
        picks: pickObjects,
      });

      setPublishSuccess(match.id);
      setTimeout(() => {
        setPublishSuccess(null);
      }, 3000);
    } catch (err: any) {
      alert(`❌ Yayınlama hatası: ${err.message || 'Bilinmeyen hata'}`);
    } finally {
      setPublishingMatchId(null);
    }
  };

  // Calculate stats
  const highConfidenceCount = matches.filter((m: Match) =>
    (m.btts_potential && m.btts_potential >= 70) ||
    (m.o25_potential && m.o25_potential >= 70)
  ).length;

  const avgBtts = matches.length > 0
    ? Math.round(matches.reduce((sum: number, m: Match) => sum + (m.btts_potential || 0), 0) / matches.length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Maçlar yükleniyor...</h3>
          <p className="text-gray-500">Bugünün tahminleri hazırlanıyor</p>
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
                <span className="text-5xl">📤</span>
                Telegram Yayın Sistemi
              </h1>
              <p className="text-gray-600 text-lg">
                FootyStats maçlarını Telegram'da yayınla
                {botHealth && (
                  <span className={`ml-3 ${botHealth.configured ? 'text-green-600' : 'text-red-600'}`}>
                    • Bot {botHealth.configured ? 'Aktif ✅' : 'Pasif ⚠️'}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Date Picker */}
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 focus:outline-none focus:border-blue-500 transition-all duration-300 text-gray-700 font-medium"
                  style={{ minWidth: '160px' }}
                />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Toplam Maç</p>
                  <p className="text-3xl font-bold text-gray-900">{matches.length}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⚽</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-green-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Yüksek Güven</p>
                  <p className="text-3xl font-bold text-gray-900">{highConfidenceCount}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🔥</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-purple-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Ort. BTTS</p>
                  <p className="text-3xl font-bold text-gray-900">{avgBtts}%</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Yayınlanan</p>
                  <p className="text-3xl font-bold text-gray-900">{publishSuccess ? 1 : 0}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✓</span>
                </div>
              </div>
            </div>
          </div>
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

        {/* Success Message */}
        {publishSuccess !== null && (
          <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-green-800 mb-1">Başarılı!</h4>
              <p className="text-green-600">Maç Telegram'da yayınlandı</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🎯</span>
              Bugünün Maçları ({matches.length})
            </h2>

              {matches.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">
                    Bugün için maç bulunamadı
                  </h3>
                  <p className="text-gray-500">
                    Yarın tekrar kontrol edin
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {matches.map((match: Match) => {
                    const isExpanded = expandedMatch === match.id;
                    const matchDate = new Date(match.date_unix * 1000);
                    const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                    const currentPicks = matchPicks[match.id] || [];
                    const isPublishing = publishingMatchId === match.id;
                    const isPublishSuccess = publishSuccess === match.id;

                    return (
                      <div
                        key={match.id}
                        className="rounded-xl p-5 border-2 transition-all duration-300 border-gray-200 bg-white hover:shadow-md"
                      >
                        {/* Match Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {timeStr}
                              <span className="mx-1">•</span>
                              <span className="font-medium">{match.competition_name || 'Bilinmeyen Lig'}</span>
                            </div>

                            {/* Team Names with Logos */}
                            <div className="flex items-center gap-3 overflow-hidden">
                              {/* Home Team */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {match.home_logo ? (
                                  <img src={match.home_logo} alt={match.home_name} className="w-8 h-8 object-contain flex-shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-lg">⚽</span>
                                  </div>
                                )}
                                <span className="text-lg font-bold text-gray-900 truncate">{match.home_name}</span>
                              </div>

                              {/* VS Separator */}
                              <span className="text-gray-400 font-normal px-2 flex-shrink-0">vs</span>

                              {/* Away Team */}
                              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                <span className="text-lg font-bold text-gray-900 truncate">{match.away_name}</span>
                                {match.away_logo ? (
                                  <img src={match.away_logo} alt={match.away_name} className="w-8 h-8 object-contain flex-shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-lg">⚽</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Stats Pills */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {match.btts_potential && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                              ⚽ BTTS {match.btts_potential}%
                            </span>
                          )}
                          {match.o25_potential && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                              📈 2.5Ü {match.o25_potential}%
                            </span>
                          )}
                          {match.o15_potential && (
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                              🎯 1.5Ü {match.o15_potential}%
                            </span>
                          )}
                          {match.team_a_xg_prematch !== undefined && match.team_b_xg_prematch !== undefined && (
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                              ⚡ xG {match.team_a_xg_prematch.toFixed(1)}-{match.team_b_xg_prematch.toFixed(1)}
                            </span>
                          )}
                        </div>

                        {/* Expand Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedMatch(isExpanded ? null : match.id);
                          }}
                          className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-2 mt-2 border-t border-gray-200 pt-3"
                        >
                          <span>{isExpanded ? 'Detayları Gizle' : 'Detayları Göster'}</span>
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-200 space-y-6">
                            {/* H2H Stats */}
                            {match.h2h && match.h2h.total_matches && match.h2h.total_matches > 0 && (
                              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                  <span className="text-lg">🤝</span>
                                  Kafa Kafaya ({match.h2h.total_matches} Maç)
                                </h4>

                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  <div className="bg-white rounded-lg p-2 text-center border border-purple-200">
                                    <div className="text-xs text-gray-500">Ev Galip</div>
                                    <div className="text-lg font-bold text-green-600">{match.h2h.home_wins || 0}</div>
                                  </div>
                                  <div className="bg-white rounded-lg p-2 text-center border border-purple-200">
                                    <div className="text-xs text-gray-500">Berabere</div>
                                    <div className="text-lg font-bold text-gray-600">{match.h2h.draws || 0}</div>
                                  </div>
                                  <div className="bg-white rounded-lg p-2 text-center border border-purple-200">
                                    <div className="text-xs text-gray-500">Dep Galip</div>
                                    <div className="text-lg font-bold text-blue-600">{match.h2h.away_wins || 0}</div>
                                  </div>
                                </div>

                                <div className="space-y-2 text-sm">
                                  {match.h2h.avg_goals && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">⚽ Ortalama Gol</span>
                                      <span className="font-semibold">{match.h2h.avg_goals.toFixed(1)}</span>
                                    </div>
                                  )}
                                  {match.h2h.btts_pct && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">🔄 BTTS</span>
                                      <span className="font-semibold">{match.h2h.btts_pct}%</span>
                                    </div>
                                  )}
                                  {match.h2h.over25_pct && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">📈 2.5 Üst</span>
                                      <span className="font-semibold">{match.h2h.over25_pct}%</span>
                                    </div>
                                  )}
                                  {match.h2h.over15_pct && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">🎯 1.5 Üst</span>
                                      <span className="font-semibold">{match.h2h.over15_pct}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Trends */}
                            {match.trends && (match.trends.home?.length || match.trends.away?.length) && (
                              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                  <span className="text-lg">📈</span>
                                  Form Trendleri
                                </h4>

                                {match.trends.home && match.trends.home.length > 0 && (
                                  <div className="mb-4">
                                    <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2 overflow-hidden">
                                      {match.home_logo ? (
                                        <img src={match.home_logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                                      ) : '⚽'}
                                      <span className="truncate">{match.home_name}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {match.trends.home.slice(0, 4).map((trend: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs">
                                          <span className={`
                                            ${trend.sentiment === 'great' ? 'text-green-600' : ''}
                                            ${trend.sentiment === 'good' ? 'text-blue-600' : ''}
                                            ${trend.sentiment === 'bad' ? 'text-red-600' : ''}
                                            ${trend.sentiment === 'neutral' ? 'text-gray-600' : ''}
                                          `}>•</span>
                                          <span className="text-gray-700">{trend.text}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {match.trends.away && match.trends.away.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2 overflow-hidden">
                                      {match.away_logo ? (
                                        <img src={match.away_logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                                      ) : '⚽'}
                                      <span className="truncate">{match.away_name}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {match.trends.away.slice(0, 4).map((trend: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs">
                                          <span className={`
                                            ${trend.sentiment === 'great' ? 'text-green-600' : ''}
                                            ${trend.sentiment === 'good' ? 'text-blue-600' : ''}
                                            ${trend.sentiment === 'bad' ? 'text-red-600' : ''}
                                            ${trend.sentiment === 'neutral' ? 'text-gray-600' : ''}
                                          `}>•</span>
                                          <span className="text-gray-700">{trend.text}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* AI Match Analysis Section */}
                            <MatchAnalysisSection matchId={match.id} />

                            {/* Telegram Publish Panel */}
                            <div className="pt-4 border-t-2 border-gray-100">
                              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-100">
                                {/* Panel Header */}
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                    <span className="text-2xl">📤</span>
                                  </div>
                                  <h3 className="text-xl font-bold text-gray-900">Yayın Paneli</h3>
                                </div>

                                {/* Selected Match Info */}
                                <div className="mb-5 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-blue-200/50">
                                  <div className="text-xs text-blue-600 mb-1 font-semibold uppercase tracking-wide">Seçili Maç</div>
                                  <div className="font-bold text-gray-900 truncate">
                                    {match.home_name} <span className="text-gray-400 font-normal">vs</span> {match.away_name}
                                  </div>
                                </div>

                                {/* Picks Selection */}
                                <div className="mb-5">
                                  <h4 className="text-sm font-bold text-gray-700 mb-3">Tahminleri Seç</h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    {AVAILABLE_PICKS.map((pick) => {
                                      const isSelected = currentPicks.includes(pick.market_type);
                                      return (
                                        <button
                                          key={pick.market_type}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePickToggle(match.id, pick.market_type);
                                          }}
                                          className={`
                                            p-4 rounded-xl border-2 text-left transition-all duration-200
                                            ${isSelected
                                              ? 'border-blue-500 bg-white shadow-lg'
                                              : 'border-gray-200 bg-white/60 hover:border-gray-300 hover:bg-white hover:shadow-md'}
                                          `}
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-2xl">{pick.emoji}</span>
                                            <div
                                              className={`
                                                w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                                                ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}
                                              `}
                                            >
                                              {isSelected && (
                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                            </div>
                                          </div>
                                          <span className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                            {pick.label}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Publish Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePublish(match);
                                  }}
                                  disabled={isPublishing || currentPicks.length === 0}
                                  className={`
                                    w-full py-4 rounded-xl font-bold text-white text-lg
                                    bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600
                                    hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700
                                    hover:shadow-2xl hover:scale-[1.02]
                                    active:scale-[0.98]
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-all duration-200
                                    flex items-center justify-center gap-3
                                    ${isPublishSuccess ? 'bg-gradient-to-r from-green-600 to-emerald-600' : ''}
                                  `}
                                >
                                  {isPublishing ? (
                                    <>
                                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      <span>Yayınlanıyor...</span>
                                    </>
                                  ) : isPublishSuccess ? (
                                    <>
                                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>Yayınlandı ✓</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                      </svg>
                                      <span>Telegram'a Yayınla</span>
                                    </>
                                  )}
                                </button>

                                {currentPicks.length === 0 && (
                                  <p className="text-xs text-gray-600 text-center mt-3 font-medium">
                                    En az bir tahmin seçmelisiniz
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
