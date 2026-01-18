/**
 * Events Tab - SIMPLIFIED
 *
 * Displays match events timeline using MatchEventsTimeline component.
 * Now receives data via props (no Context).
 */

import { MatchEventsTimeline } from '../MatchEventsTimeline';
import type { Match } from '../../../api/matches';

interface EventsTabProps {
  data: any[] | null;
  match: Match;
}

export function EventsTab({ data, match }: EventsTabProps) {
  if (!match) return null;

  const incidents = data || [];
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
