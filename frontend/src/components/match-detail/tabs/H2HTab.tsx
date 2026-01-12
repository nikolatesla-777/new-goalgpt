/**
 * H2H Tab - SIMPLIFIED
 *
 * Displays head-to-head statistics and previous matches between teams.
 * Now receives data via props (no Context).
 */

import { UsersThree, Question } from '@phosphor-icons/react';

interface H2HTabProps {
  data: any;
  match: any;
}

export function H2HTab({ data, match }: H2HTabProps) {
  // Enhanced empty state with team info
  if (!data) {
    const homeTeamName = match?.home_team?.name || 'Ev Sahibi';
    const awayTeamName = match?.away_team?.name || 'Deplasman';

    return (
      <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-8 md:p-12 text-center border border-gray-200/50 shadow-lg">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-3xl flex items-center justify-center shadow-inner">
              <UsersThree size={40} weight="duotone" className="text-indigo-500" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-400 rounded-full border-4 border-white flex items-center justify-center">
              <Question size={12} weight="bold" className="text-white" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            Karşılıklı Maç Geçmişi Bulunamadı
          </h3>
          <p className="text-gray-600 max-w-md mx-auto leading-relaxed mb-4">
            <span className="font-semibold text-blue-600">{homeTeamName}</span> ve{' '}
            <span className="font-semibold text-red-500">{awayTeamName}</span> takımları
            arasında daha önce kayıtlı bir karşılaşma bulunmuyor.
          </p>
          <div className="bg-gray-100 rounded-lg px-4 py-2 text-xs text-gray-500">
            Bu takımlar ilk kez karşılaşıyor olabilir veya veriler henüz yüklenmemiş olabilir.
          </div>
        </div>
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

      {/* Note: If !data is true, the enhanced empty state above is shown instead */}
    </div>
  );
}

export default H2HTab;
