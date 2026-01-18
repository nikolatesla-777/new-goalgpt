/**
 * Trend Tab - SIMPLIFIED
 *
 * Displays match trend chart for live matches.
 * Now receives data via props (no Context).
 */

import { useMemo } from 'react';
import { MatchTrendChart } from '../MatchTrendChart';
import type { Match } from '../../../api/matches';

interface TrendTabProps {
  data: any;
  match: Match;
}

export function TrendTab({ data, match }: TrendTabProps) {
  if (!match) return null;
  const matchStatus = (match as any).status ?? (match as any).status_id ?? (match as any).match_status ?? 0;
  const isLiveMatch = matchStatus && [2, 3, 4, 5, 7].includes(matchStatus);

  // Trend data is only available when match is in progress
  if (!isLiveMatch) {
    return (
      <div className="p-10 text-center text-gray-600 bg-white rounded-xl border border-gray-200">
        <p className="m-0 text-base font-medium">
          Trend verisi sadece maç devam ederken mevcuttur.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Bu maç henüz başlamadı veya tamamlandı.
        </p>
      </div>
    );
  }

  // CRITICAL FIX: API returns {trend: {results: [...]}} not {trend: {first_half: [], second_half: []}}
  // Handle both structures for backwards compatibility
  const trendData = data?.trend || {};
  const hasResults = (trendData?.results?.length ?? 0) > 0;
  const hasFirstHalf = (trendData?.first_half?.length ?? 0) > 0;
  const hasSecondHalf = (trendData?.second_half?.length ?? 0) > 0;
  const hasData = hasResults || hasFirstHalf || hasSecondHalf;

  if (!hasData) {
    return (
      <div className="p-10 text-center text-gray-600 bg-white rounded-xl border border-gray-200">
        <p className="m-0 text-base font-medium">
          Trend verisi bulunamadı.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Bu maç için trend verisi henüz oluşmamış olabilir.
        </p>
      </div>
    );
  }

  const currentMinute = (match as any).minute ?? null;
  const incidents = data?.incidents || [];

  // CRITICAL FIX: Transform flat 'results' array to first_half/second_half format
  // API sends: {trend: {results: [{minute: 0, home_value, away_value}, ...]}}
  // Chart expects: {trend: {first_half: [...], second_half: [...]}}
  const transformedTrendData = useMemo(() => {
    if (!trendData) return null;

    // If already has first_half/second_half, use as is
    if (trendData.first_half || trendData.second_half) {
      return trendData;
    }

    // Transform flat results array to half-based structure
    if (trendData.results && Array.isArray(trendData.results)) {
      const firstHalf = trendData.results.filter((p: any) => p.minute <= 45);
      const secondHalf = trendData.results.filter((p: any) => p.minute > 45 && p.minute <= 90);
      const overtime = trendData.results.filter((p: any) => p.minute > 90);

      return {
        match_id: trendData.match_id,
        first_half: firstHalf,
        second_half: secondHalf,
        overtime: overtime.length > 0 ? overtime : undefined,
      };
    }

    return trendData;
  }, [trendData]);

  return (
    <div className="flex flex-col gap-4">
      <MatchTrendChart
        data={transformedTrendData}
        incidents={incidents}
        homeTeamName={match.home_team?.name}
        awayTeamName={match.away_team?.name}
        homeTeamLogo={match.home_team?.logo_url}
        awayTeamLogo={match.away_team?.logo_url}
        currentMinute={currentMinute}
      />
    </div>
  );
}

export default TrendTab;
