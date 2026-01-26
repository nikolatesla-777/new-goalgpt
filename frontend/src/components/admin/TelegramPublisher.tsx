import { useState, useEffect } from 'react';
import { getTodaysMatches, publishToTelegram, getTelegramHealth } from '../../api/telegram';

// ============================================================================
// INTERFACES
// ============================================================================

interface Match {
  id: number;
  home_name: string;
  away_name: string;
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
}

interface Pick {
  market_type: string;
  label: string;
  emoji: string;
  odds?: number;
}

interface BotHealth {
  configured: boolean;
  metrics?: {
    requests: number;
    errors: number;
  };
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
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPicks, setSelectedPicks] = useState<string[]>([]);
  const [botHealth, setBotHealth] = useState<BotHealth | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);

  useEffect(() => {
    loadMatches();
    loadBotHealth();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTodaysMatches();
      setMatches(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Maçlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadBotHealth = async () => {
    try {
      const health = await getTelegramHealth();
      setBotHealth(health);
    } catch (err) {
      console.error('Bot health check failed:', err);
    }
  };

  const handleMatchSelect = (match: Match) => {
    setSelectedMatch(match);
    setSelectedPicks([]);
    setPublishSuccess(false);
  };

  const handlePickToggle = (marketType: string) => {
    if (selectedPicks.includes(marketType)) {
      setSelectedPicks(selectedPicks.filter(p => p !== marketType));
    } else {
      setSelectedPicks([...selectedPicks, marketType]);
    }
  };

  const handlePublish = async () => {
    if (!selectedMatch || !selectedMatch.external_id) {
      alert('⚠️ Maç external_id\'ye sahip olmalı');
      return;
    }

    if (selectedPicks.length === 0) {
      alert('⚠️ En az bir tahmin seçmelisiniz');
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const picks = selectedPicks.map(marketType => ({
        market_type: marketType,
        odds: undefined
      }));

      await publishToTelegram(selectedMatch.id, selectedMatch.external_id, picks);
      setPublishSuccess(true);

      setTimeout(() => {
        setPublishSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Yayınlama hatası');
    } finally {
      setPublishing(false);
    }
  };

  // Calculate stats
  const highConfidenceCount = matches.filter(m =>
    (m.btts_potential && m.btts_potential >= 70) ||
    (m.o25_potential && m.o25_potential >= 70)
  ).length;

  const avgBtts = matches.length > 0
    ? Math.round(matches.reduce((sum, m) => sum + (m.btts_potential || 0), 0) / matches.length)
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
            <button
              onClick={loadMatches}
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
                  <p className="text-sm font-medium text-gray-500 mb-1">Seçili Maç</p>
                  <p className="text-3xl font-bold text-gray-900">{selectedMatch ? 1 : 0}</p>
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
        {publishSuccess && (
          <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-green-800 mb-1">Başarılı!</h4>
              <p className="text-green-600">Tahmin Telegram'da yayınlandı</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Matches List (2/3 width) */}
          <div className="lg:col-span-2">
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
                  {matches.map((match) => {
                    const isSelected = selectedMatch?.id === match.id;
                    const isExpanded = expandedMatch === match.id;
                    const matchDate = new Date(match.date_unix * 1000);
                    const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={match.id}
                        className={`
                          rounded-xl p-5 border-2 transition-all duration-300 cursor-pointer
                          ${isSelected
                            ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'}
                        `}
                        onClick={() => handleMatchSelect(match)}
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
                              <span>{match.competition_name || 'Bilinmeyen Lig'}</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {match.home_name} <span className="text-gray-400 font-normal">vs</span> {match.away_name}
                            </h3>
                          </div>

                          {/* Selection Indicator */}
                          <div
                            className={`
                              w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4
                              ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'}
                            `}
                          >
                            {isSelected && (
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
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
                          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                            {match.corners_potential && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">🚩 Korner Potansiyeli</span>
                                <span className="font-semibold text-gray-900">{match.corners_potential.toFixed(1)}</span>
                              </div>
                            )}
                            {match.cards_potential && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">🟨 Kart Potansiyeli</span>
                                <span className="font-semibold text-gray-900">{match.cards_potential.toFixed(1)}</span>
                              </div>
                            )}
                            {match.odds_ft_1 && match.odds_ft_x && match.odds_ft_2 && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">💰 Oranlar</span>
                                <span className="font-semibold text-gray-900">
                                  {match.odds_ft_1.toFixed(2)} - {match.odds_ft_x.toFixed(2)} - {match.odds_ft_2.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Publish Panel (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>📤</span>
                  Yayın Paneli
                </h2>

                {!selectedMatch ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">
                      ← Bir maç seçin
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Selected Match Info */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                      <div className="text-sm text-blue-600 mb-1 font-medium">Seçili Maç</div>
                      <div className="font-bold text-gray-900 text-sm">
                        {selectedMatch.home_name} vs {selectedMatch.away_name}
                      </div>
                    </div>

                    {/* Picks Selection */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Tahminleri Seç</h3>
                      <div className="space-y-2">
                        {AVAILABLE_PICKS.map((pick) => {
                          const isSelected = selectedPicks.includes(pick.market_type);
                          return (
                            <button
                              key={pick.market_type}
                              onClick={() => handlePickToggle(pick.market_type)}
                              className={`
                                w-full p-3 rounded-xl border-2 text-left transition-all duration-200
                                ${isSelected
                                  ? 'border-blue-500 bg-blue-50 shadow-md'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}
                              `}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{pick.emoji}</span>
                                  <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                    {pick.label}
                                  </span>
                                </div>
                                <div
                                  className={`
                                    w-6 h-6 rounded-full border-2 flex items-center justify-center
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
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Publish Button */}
                    <button
                      onClick={handlePublish}
                      disabled={publishing || selectedPicks.length === 0}
                      className={`
                        w-full py-4 rounded-xl font-bold text-white text-lg
                        bg-gradient-to-r from-blue-600 to-indigo-600
                        hover:from-blue-700 hover:to-indigo-700
                        hover:shadow-xl hover:scale-[1.02]
                        active:scale-[0.98]
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-200
                        flex items-center justify-center gap-3
                      `}
                    >
                      {publishing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Yayınlanıyor...</span>
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

                    {selectedPicks.length === 0 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        En az bir tahmin seçmelisiniz
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
