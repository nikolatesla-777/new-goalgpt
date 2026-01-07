/**
 * Finished Tab - Bitenler
 *
 * Shows finished matches (status 8)
 *
 * CRITICAL FIX: Uses prefetchedMatches from LivescoreContext to avoid double fetching.
 * Context handles WebSocket and polling, MatchList only renders.
 */

import { useLivescore } from '../LivescoreContext';
import { MatchList } from '../../MatchList';

export function FinishedTab() {
  const { selectedDate, sortBy, finishedMatches } = useLivescore();

  return (
    <MatchList
      view="finished"
      date={selectedDate}
      sortBy={sortBy}
      prefetchedMatches={finishedMatches}
      skipInternalUpdates={true}
    />
  );
}

export default FinishedTab;
