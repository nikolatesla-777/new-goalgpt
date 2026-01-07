/**
 * Match Detail Layout
 *
 * Main layout component for match detail page.
 * Renders INSTANTLY - no full-page loading states.
 * Header, ScoreCard, Tabs show immediately, content loads in background.
 */

import { useParams, Outlet } from 'react-router-dom';
import { MatchDetailProvider, useMatchDetail } from './MatchDetailContext';
import { MatchDetailHeader } from './MatchDetailHeader';
import { MatchScoreCard } from './MatchScoreCard';
import { MatchTabNavigation } from './MatchTabNavigation';

/**
 * Inner layout that uses the context
 * CRITICAL: No full-page loading - render immediately
 */
function MatchDetailLayoutInner() {
  const { match, loading, error } = useMatchDetail();

  // Only show error if we tried loading and failed (not during initial load)
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 pb-safe">
        <MatchDetailHeader />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-8 text-center border-2 border-red-200/50 shadow-lg">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">❌</span>
              </div>
              <p className="text-red-700 font-bold text-lg">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ALWAYS render the page structure - no full-page loading
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 pb-safe">
      <MatchDetailHeader />

      {/* Score card - show skeleton if match not loaded yet */}
      {match ? (
        <MatchScoreCard />
      ) : (
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-white pt-4 md:pt-8 pb-6 md:pb-10 px-3 md:px-4">
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-8">
            {/* Home Team Skeleton */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-14 h-14 md:w-24 md:h-24 bg-white/10 rounded-full animate-pulse mb-2 md:mb-4" />
              <div className="w-24 h-4 bg-white/10 rounded animate-pulse" />
            </div>

            {/* Score Skeleton */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-6 bg-white/10 rounded-full animate-pulse mb-2" />
              <div className="bg-white/10 rounded-xl px-6 py-3">
                <div className="text-3xl md:text-5xl font-black text-white/30">- : -</div>
              </div>
            </div>

            {/* Away Team Skeleton */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-14 h-14 md:w-24 md:h-24 bg-white/10 rounded-full animate-pulse mb-2 md:mb-4" />
              <div className="w-24 h-4 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      )}

      <MatchTabNavigation />

      {/* Tab Content - render immediately, each tab handles its own loading */}
      <div className="max-w-5xl mx-auto px-3 md:px-4 py-4 md:py-6">
        <Outlet />
      </div>
    </div>
  );
}

/**
 * Match Detail Layout with Provider
 */
export function MatchDetailLayout() {
  const { matchId } = useParams<{ matchId: string }>();

  if (!matchId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <p className="text-red-600 font-semibold">Maç ID bulunamadı</p>
      </div>
    );
  }

  return (
    <MatchDetailProvider matchId={matchId}>
      <MatchDetailLayoutInner />
    </MatchDetailProvider>
  );
}

export default MatchDetailLayout;
