/**
 * Events Tab
 *
 * Displays match events timeline using MatchEventsTimeline component.
 */

import { useMatchDetail } from '../MatchDetailContext';
import { MatchEventsTimeline } from '../MatchEventsTimeline';

export function EventsTab() {
  const { match, tabData } = useMatchDetail();

  if (!match) return null;

  const events = tabData.events;
  const hasData = events !== null && events !== undefined;

  console.log('[EventsTab Render] tabData:', tabData);
  console.log('[EventsTab Render] events:', events);
  console.log('[EventsTab Render] hasData:', hasData);

  if (!hasData) {
    return (
      <div className="text-center p-10 text-gray-600">
        Yükleniyor...
      </div>
    );
  }

  const incidents = events?.incidents || [];
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
