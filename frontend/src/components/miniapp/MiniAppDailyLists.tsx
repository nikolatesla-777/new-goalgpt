import { useState } from 'react';
import { useTelegramDailyListsToday } from '../../api/hooks';
import { formatTimestampToTSI } from '../../utils/dateUtils';

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
  reason?: string;
  live_score?: {
    home: number;
    away: number;
    minute: string;
    status: string;
  };
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
  bgColor: string;
}> = {
  OVER_25: {
    label: '2.5 ÜST',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    icon: '📈',
    bgColor: '#3B82F6',
  },
  OVER_15: {
    label: '1.5 ÜST',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    icon: '🎯',
    bgColor: '#8B5CF6',
  },
  BTTS: {
    label: 'Karşılıklı Gol',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    icon: '⚽',
    bgColor: '#10B981',
  },
  HT_OVER_05: {
    label: 'İY 0.5 ÜST',
    gradient: 'linear-gradient(135deg, #A855F7 0%, #9333EA 100%)',
    icon: '⏱️',
    bgColor: '#A855F7',
  },
  CORNERS: {
    label: 'Korner 7.5 ÜST',
    gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
    icon: '🚩',
    bgColor: '#F97316',
  },
  CARDS: {
    label: 'Sarı Kart 3.5 ÜST',
    gradient: 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)',
    icon: '🟨',
    bgColor: '#EAB308',
  },
};

// ============================================================================
// LIST CARD COMPONENT
// ============================================================================

interface ListCardProps {
  list: DailyList;
  expanded: boolean;
  onToggle: () => void;
}

function ListCard({ list, expanded, onToggle }: ListCardProps) {
  const config = MARKET_CONFIG[list.market] || MARKET_CONFIG.OVER_25;
  const performance = list.performance || { total: 0, won: 0, lost: 0, pending: 0, win_rate: 0 };

  const visibleMatches = expanded ? list.matches : list.matches.slice(0, 3);
  const remainingCount = list.matches.length - visibleMatches.length;

  return (
    <div
      className="rounded-2xl shadow-lg overflow-hidden mb-6"
      style={{ background: config.gradient }}
    >
      {/* Header */}
      <div className="p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.icon}</span>
            <div>
              <div className="text-xl font-bold">{config.label}</div>
              <div className="text-sm opacity-90">{list.matches_count} Maç Seçildi</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-75 mb-1">Ortalama Güven</div>
            <div className="text-3xl font-bold">{list.avg_confidence}%</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white/20 rounded-full h-2 mb-4">
          <div
            className="bg-white h-2 rounded-full transition-all duration-300"
            style={{ width: `${list.avg_confidence}%` }}
          />
        </div>

        {/* Performance */}
        <div className="bg-white/10 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Performans</span>
            <span className="text-sm font-bold">
              {performance.won}/{performance.total} ({performance.win_rate}%)
            </span>
          </div>

          {/* Performance Progress */}
          <div className="bg-white/20 rounded-full h-2 mb-2">
            <div
              className="bg-green-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${performance.win_rate}%` }}
            />
          </div>

          {/* Win/Loss Icons */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-green-300">✓</span>
              <span>{performance.won}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-red-300">✗</span>
              <span>{performance.lost}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="bg-white">
        {visibleMatches.map((match, index) => (
          <div
            key={match.fs_id}
            className="p-4 border-b border-gray-100 last:border-b-0"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Time and League */}
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span>🕐 {formatTimestampToTSI(match.date_unix * 1000)}</span>
                  <span className="text-gray-300">•</span>
                  <span>{match.league_name}</span>
                </div>

                {/* Match */}
                <div className="font-semibold text-gray-800 mb-2">
                  #{index + 1} {match.home_name} vs {match.away_name}
                </div>

                {/* Match Details */}
                {match.reason && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full">
                      {match.reason}
                    </span>
                  </div>
                )}

                {/* Result Badge */}
                {match.result && match.result !== 'pending' && (
                  <div className="mt-2 flex items-center gap-2">
                    {match.result === 'won' && (
                      <div className="flex items-center gap-1 text-green-600">
                        <span className="text-sm">✓</span>
                        <span className="text-xs font-medium">Kazandı</span>
                        {match.final_score && (
                          <span className="text-xs ml-1">
                            {match.final_score.home}-{match.final_score.away}
                          </span>
                        )}
                      </div>
                    )}
                    {match.result === 'lost' && (
                      <div className="flex items-center gap-1 text-red-600">
                        <span className="text-sm">✗</span>
                        <span className="text-xs font-medium">Kaybetti</span>
                        {match.final_score && (
                          <span className="text-xs ml-1">
                            {match.final_score.home}-{match.final_score.away}
                          </span>
                        )}
                      </div>
                    )}
                    {match.live_score && !match.match_finished && (
                      <div className="flex items-center gap-1 text-orange-600">
                        <span className="text-xs font-medium">🔴 CANLI</span>
                        <span className="text-xs ml-1">
                          {match.live_score.home}-{match.live_score.away} {match.live_score.minute}'
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confidence Badge */}
              <div className="ml-4 flex items-center gap-1">
                <span className="text-orange-500">🔥</span>
                <span className="text-sm font-bold text-gray-700">{match.confidence}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Show More Button */}
        {remainingCount > 0 && (
          <button
            onClick={onToggle}
            className="w-full p-4 text-center text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {expanded ? '▲ Daha az göster' : `▼ ${remainingCount} maç daha göster`}
          </button>
        )}

        {/* Action Buttons */}
        <div className="p-4 flex gap-3">
          <button
            className="flex-1 py-3 rounded-lg font-medium text-white transition-all"
            style={{ background: config.gradient }}
          >
            <span className="mr-2">⚠️</span>
            📧 Metin
          </button>
          <button
            className="flex-1 py-3 rounded-lg font-medium text-white transition-all"
            style={{ background: config.gradient }}
          >
            <span className="mr-2">📸</span>
            📊 Görsel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MiniAppDailyLists() {
  const { data, isLoading, error } = useTelegramDailyListsToday();
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());

  const toggleExpanded = (market: string) => {
    setExpandedLists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(market)) {
        newSet.delete(market);
      } else {
        newSet.add(market);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
          <p className="text-red-600 font-medium mb-2">⚠️ Hata</p>
          <p className="text-gray-600">Listeler yüklenirken bir hata oluştu.</p>
        </div>
      </div>
    );
  }

  const lists = data?.lists || [];

  if (lists.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
          <p className="text-gray-600 mb-2">📊</p>
          <p className="text-gray-600">Bugün için liste bulunamadı.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800">📊 Günlük Tahmin Listeleri</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('tr-TR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
      </div>

      {/* Lists */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {lists.map((list) => (
          <ListCard
            key={list.market}
            list={list}
            expanded={expandedLists.has(list.market)}
            onToggle={() => toggleExpanded(list.market)}
          />
        ))}
      </div>

      {/* Footer Note */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-xs text-gray-500">
            ⚠️ <strong>Not:</strong> Liste istatistiksel verilere dayanır.
            Canlıya girmeden önce oran ve kadro kontrolü önerilir.
          </p>
        </div>
      </div>
    </div>
  );
}
