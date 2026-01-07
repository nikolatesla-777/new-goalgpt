/**
 * Stats Tab
 *
 * Displays match statistics with period tabs (TÜMÜ, 1. YARI, 2. YARI).
 * Most complex tab component with period-based stat filtering.
 */

import { useState } from 'react';
import { useMatchDetail } from '../MatchDetailContext';
import { getStatName, sortStats } from '../utils/statHelpers';

type StatsPeriod = 'full' | 'first' | 'second';

/**
 * Single stat row with bar visualization
 */
function StatRow({ label, home, away }: { label: string; home: any; away: any }) {
  const homeNum = Number(home) || 0;
  const awayNum = Number(away) || 0;
  const total = homeNum + awayNum || 1;
  const homePercent = (homeNum / total) * 100;

  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-2 sm:mb-3 gap-2">
        <span className="font-semibold text-gray-900 text-sm sm:text-base min-w-[30px] text-right">{home}</span>
        <span className="text-gray-600 text-xs sm:text-sm font-medium text-center flex-1">{label}</span>
        <span className="font-semibold text-gray-900 text-sm sm:text-base min-w-[30px] text-left">{away}</span>
      </div>
      <div className="flex gap-1 h-1.5 sm:h-2">
        <div className="bg-blue-600 rounded-full" style={{ flex: homePercent }}></div>
        <div className="bg-red-500 rounded-full" style={{ flex: 100 - homePercent }}></div>
      </div>
    </div>
  );
}

export function StatsTab() {
  const { match, tabData } = useMatchDetail();
  const [activePeriod, setActivePeriod] = useState<StatsPeriod>('full');

  if (!match) return null;

  const data = tabData.stats;
  const hasData = data !== null && data !== undefined;

  if (!hasData) {
    return (
      <div className="text-center p-10 text-gray-600">
        Yükleniyor...
      </div>
    );
  }

  // Determine match status
  const matchStatus = (match as any).status ?? (match as any).status_id ?? 1;
  const isFirstHalf = matchStatus === 2 || matchStatus === 3;
  const isSecondHalfOrLater = matchStatus >= 4;

  // Parse half time stats data
  const parseHalfStats = (halfData: any, sign: 'p1' | 'p2' | 'ft'): any[] => {
    if (!halfData?.results || !Array.isArray(halfData.results)) {
      return [];
    }

    const stats: any[] = [];
    for (const statObj of halfData.results) {
      if (statObj.Sign !== sign) continue;

      for (const [key, value] of Object.entries(statObj)) {
        if (key === 'Sign') continue;

        const statId = Number(key);
        if (isNaN(statId)) continue;

        const values = Array.isArray(value) ? value : [];
        if (values.length >= 2) {
          stats.push({
            type: statId,
            home: values[0],
            away: values[1],
          });
        }
      }
    }
    return stats;
  };

  // Get full time stats
  const getFullTimeStats = (): any[] => {
    const fullTime = data?.fullTime as any;
    if (fullTime?.stats && Array.isArray(fullTime.stats)) {
      return fullTime.stats;
    } else if (fullTime?.results && Array.isArray(fullTime.results)) {
      return fullTime.results;
    }
    return [];
  };

  // Get first half stats snapshot (from backend)
  const firstHalfStatsSnapshot = data?.firstHalfStats || null;
  const hasFirstHalfSnapshot = !!firstHalfStatsSnapshot && Array.isArray(firstHalfStatsSnapshot) && firstHalfStatsSnapshot.length > 0;

  // Get second half stats from backend (NEW: from statistics_second_half column)
  const secondHalfStatsFromBackend = (data as any)?.secondHalfStats || null;
  const hasSecondHalfSnapshot = !!secondHalfStatsFromBackend && Array.isArray(secondHalfStatsFromBackend) && secondHalfStatsFromBackend.length > 0;

  // Calculate second half stats (fallback if backend doesn't have it)
  const calculateSecondHalfStats = (): any[] => {
    // Prefer backend second half stats if available
    if (hasSecondHalfSnapshot) {
      return secondHalfStatsFromBackend;
    }

    // Fallback: Calculate from full - first half
    if (!hasFirstHalfSnapshot) return [];

    const fullStats = getFullTimeStats();
    if (fullStats.length === 0) return [];

    const secondHalfStats: any[] = [];

    for (const fullStat of fullStats) {
      const firstHalfStat = firstHalfStatsSnapshot.find((s: any) => s.type === fullStat.type);

      if (firstHalfStat) {
        const homeSecondHalf = (fullStat.home ?? 0) - (firstHalfStat.home ?? 0);
        const awaySecondHalf = (fullStat.away ?? 0) - (firstHalfStat.away ?? 0);

        secondHalfStats.push({
          ...fullStat,
          home: Math.max(0, homeSecondHalf),
          away: Math.max(0, awaySecondHalf),
        });
      } else {
        secondHalfStats.push(fullStat);
      }
    }

    return secondHalfStats;
  };

  // Get stats based on active period
  let rawStats: any[] = [];

  if (activePeriod === 'full') {
    rawStats = getFullTimeStats();
  } else if (activePeriod === 'first') {
    if (isFirstHalf) {
      rawStats = getFullTimeStats();
    } else if (hasFirstHalfSnapshot) {
      rawStats = firstHalfStatsSnapshot;
    } else {
      const halfStats = parseHalfStats(data?.halfTime, 'p1');
      rawStats = halfStats.length > 0 ? halfStats : getFullTimeStats();
    }
  } else if (activePeriod === 'second') {
    if (hasFirstHalfSnapshot) {
      rawStats = calculateSecondHalfStats();
    } else {
      const halfStats = parseHalfStats(data?.halfTime, 'p2');
      if (halfStats.length > 0) {
        rawStats = halfStats;
      } else {
        rawStats = getFullTimeStats();
      }
    }
  }

  // Sort and filter unknown stats
  const stats = sortStats(rawStats).filter(s => getStatName(s.type) !== '');

  // Basic stats fallback
  const basicStats = [
    { label: 'Gol', home: match.home_score ?? 0, away: match.away_score ?? 0 },
    { label: 'Sarı Kart', home: (match as any).home_yellow_cards ?? 0, away: (match as any).away_yellow_cards ?? 0 },
    { label: 'Kırmızı Kart', home: (match as any).home_red_cards ?? 0, away: (match as any).away_red_cards ?? 0 },
    { label: 'Korner', home: (match as any).home_corners ?? 0, away: (match as any).away_corners ?? 0 },
  ];

  const hasFullTimeStats = getFullTimeStats().length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Period Tabs */}
      {(hasFullTimeStats || matchStatus >= 2) && (
        <div className="flex gap-2 border-b-2 border-gray-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActivePeriod('full')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 text-xs sm:text-sm whitespace-nowrap ${
              activePeriod === 'full'
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-transparent text-gray-600'
            }`}
          >
            TÜMÜ
          </button>
          <button
            onClick={() => setActivePeriod('first')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 text-xs sm:text-sm whitespace-nowrap ${
              activePeriod === 'first'
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-transparent text-gray-600'
            }`}
          >
            1. YARI
          </button>
          {isSecondHalfOrLater && (
            <button
              onClick={() => setActivePeriod('second')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 text-xs sm:text-sm whitespace-nowrap ${
                activePeriod === 'second'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-transparent text-gray-600'
              }`}
            >
              2. YARI
            </button>
          )}
        </div>
      )}

      {/* Stats List */}
      {stats.length > 0 ? (
        <div className="flex flex-col gap-3">
          {stats.map((stat: any, idx: number) => (
            <StatRow key={idx} label={getStatName(stat.type)} home={stat.home ?? '-'} away={stat.away ?? '-'} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-center p-5 text-gray-600 bg-gray-50 rounded-lg mb-4 text-base">
            {activePeriod === 'first' && (isFirstHalf
              ? 'Maç devam ediyor, detaylı istatistikler güncelleniyor...'
              : '1. yarı detaylı istatistikleri mevcut değil.'
            )}
            {activePeriod === 'second' && '2. yarı detaylı istatistikleri mevcut değil. Temel bilgiler gösteriliyor.'}
            {activePeriod === 'full' && 'Detaylı istatistik verisi bulunamadı. Temel bilgiler gösteriliyor.'}
          </div>
          {basicStats.map((stat, idx) => (
            <StatRow key={idx} label={stat.label} home={stat.home} away={stat.away} />
          ))}
        </div>
      )}
    </div>
  );
}

export default StatsTab;
