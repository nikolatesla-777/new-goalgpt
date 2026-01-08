/**
 * Trend Tab
 *
 * Displays match trend chart for live matches.
 * NOW WITH LAZY LOADING: Fetches data only when tab is clicked.
 */

import { useEffect } from 'react';
import { useMatchDetail } from '../MatchDetailContext';
import { MatchTrendChart } from '../MatchTrendChart';

export function TrendTab() {
  const { match, tabData, tabLoadingStates, fetchTabData } = useMatchDetail();

  // LAZY LOADING: Trigger fetch on mount
  useEffect(() => {
    fetchTabData('trend');
  }, [fetchTabData]);

  if (!match) return null;

  const loading = tabLoadingStates.trend;

  // Show loading state while fetching
  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        <span className="ml-3 text-gray-600">Trend verisi yükleniyor...</span>
      </div>
    );
  }

  const data = tabData.trend;
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

  const hasData = ((data?.trend?.first_half?.length ?? 0) > 0 || (data?.trend?.second_half?.length ?? 0) > 0);

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

  return (
    <div className="flex flex-col gap-4">
      <MatchTrendChart
        data={data?.trend ?? null}
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
