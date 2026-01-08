/**
 * H2H Tab
 *
 * Displays head-to-head statistics and previous matches between teams.
 * NOW WITH LAZY LOADING: Fetches data only when tab is clicked.
 */

import { useEffect } from 'react';
import { useMatchDetail } from '../MatchDetailContext';

export function H2HTab() {
  const { tabData, tabLoadingStates, fetchTabData } = useMatchDetail();

  // LAZY LOADING: Trigger fetch on mount
  useEffect(() => {
    fetchTabData('h2h');
  }, [fetchTabData]);

  const loading = tabLoadingStates.h2h;
  const data = tabData.h2h;

  // Show loading state while fetching
  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600">Karşılıklı maçlar yükleniyor...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8 md:p-10 text-gray-600 bg-white rounded-xl">
        H2H verisi bulunamadı
      </div>
    );
  }

  const summary = data.summary;
  const h2hMatches = data.h2hMatches || [];

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* H2H Summary */}
      {summary && summary.total > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 text-center">
          <h3 className="m-0 mb-3 sm:mb-4 font-semibold text-sm sm:text-base">Karşılıklı Maçlar Özeti</h3>
          <div className="flex justify-center gap-4 sm:gap-6">
            <div className="text-center">
              <div className="font-bold text-blue-600 text-lg sm:text-2xl">{summary.homeWins}</div>
              <div className="text-gray-600 text-xs sm:text-sm mt-1">Ev Kazandı</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-400 text-lg sm:text-2xl">{summary.draws}</div>
              <div className="text-gray-600 text-xs sm:text-sm mt-1">Berabere</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-red-500 text-lg sm:text-2xl">{summary.awayWins}</div>
              <div className="text-gray-600 text-xs sm:text-sm mt-1">Dep Kazandı</div>
            </div>
          </div>
          <div className="mt-3 text-gray-600 text-xs sm:text-sm">
            Toplam {summary.total} maç
          </div>
        </div>
      )}

      {/* Previous H2H Matches */}
      {h2hMatches.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
          <h4 className="m-0 mb-3 font-semibold text-sm sm:text-base">Son Karşılaşmalar</h4>
          <div className="flex flex-col gap-2">
            {h2hMatches.slice(0, 5).map((match: any, idx: number) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600 truncate">{match.date || match.match_time}</span>
                <span className="font-semibold text-sm sm:text-base whitespace-nowrap">{match.home_score ?? '-'} - {match.away_score ?? '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* If no data at all */}
      {!summary && h2hMatches.length === 0 && (
        <div className="text-center p-8 sm:p-10 text-gray-600 bg-white rounded-xl">
          H2H verisi bulunamadı
        </div>
      )}
    </div>
  );
}

export default H2HTab;
