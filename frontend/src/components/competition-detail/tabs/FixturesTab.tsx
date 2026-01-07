/**
 * Fixtures Tab
 *
 * Displays competition fixtures - upcoming and past matches.
 */

import { useCompetitionDetail } from '../CompetitionDetailContext';
import { MatchRow } from '../MatchRow';

export function FixturesTab() {
  const { upcomingMatches, pastMatches, fixtures } = useCompetitionDetail();

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      {upcomingMatches.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 bg-slate-800/80 border-b border-slate-700 font-semibold text-blue-400 sticky top-0">
            Gelecek Maclar
          </div>
          <div className="divide-y divide-slate-700/50">
            {upcomingMatches.map(match => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {pastMatches.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 bg-slate-800/80 border-b border-slate-700 font-semibold text-slate-400 sticky top-0">
            Tamamlanan Maclar
          </div>
          <div className="divide-y divide-slate-700/50">
            {pastMatches.map(match => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      {fixtures.length === 0 && (
        <div className="p-12 text-center bg-slate-800/50 rounded-xl border border-slate-700/50 text-slate-500">
          Henuz fikstur bulunamadi.
        </div>
      )}
    </div>
  );
}

export default FixturesTab;
