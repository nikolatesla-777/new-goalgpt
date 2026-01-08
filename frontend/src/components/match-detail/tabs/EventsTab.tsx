/**
 * Events Tab
 *
 * Displays match events timeline using MatchEventsTimeline component.
 * NOW WITH LAZY LOADING: Fetches data only when tab is clicked.
 */

import { useEffect } from 'react';
import { useMatchDetail } from '../MatchDetailContext';
import { MatchEventsTimeline } from '../MatchEventsTimeline';

export function EventsTab() {
  const { match, tabData, tabLoadingStates, fetchTabData } = useMatchDetail();

  // LAZY LOADING: Trigger fetch on mount
  useEffect(() => {
    fetchTabData('events');
  }, [fetchTabData]);

  if (!match) return null;

  const loading = tabLoadingStates.events;
  const events = tabData.events;

  // Show loading state while fetching
  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Olaylar yükleniyor...</span>
      </div>
    );
  }

  const incidents = events?.incidents || [];
  // console.log(`[EventsTab] Displaying ${incidents.length} incidents`);
  const matchStatusId = (match as any).status ?? (match as any).status_id ?? (match as any).match_status ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <MatchEventsTimeline
        incidents={incidents}
        homeTeamName={match.home_team?.name}
        awayTeamName={match.away_team?.name}
        matchStatusId={matchStatusId}
      />
    </div>
  );
}

export default EventsTab;
