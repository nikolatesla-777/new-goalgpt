/**
 * Not Started Tab - Başlamayanlar
 *
 * Shows matches that haven't started yet (status 1)
 *
 * CRITICAL FIX: Uses prefetchedMatches from LivescoreContext to avoid double fetching.
 * Context handles WebSocket and polling, MatchList only renders.
 */

import { useLivescore } from '../LivescoreContext';
import { MatchList } from '../../MatchList';

export function NotStartedTab() {
  const { selectedDate, sortBy, notStartedMatches, loading } = useLivescore();

  return (
    <MatchList
      view="not_started"
      date={selectedDate}
      sortBy={sortBy}
      prefetchedMatches={notStartedMatches}
      skipInternalUpdates={true}
      isLoading={loading}
    />
  );
}

export default NotStartedTab;
