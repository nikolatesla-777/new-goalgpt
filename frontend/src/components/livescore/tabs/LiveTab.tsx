/**
 * Live Tab - Canlı Maçlar
 *
 * Shows currently live matches (status 2, 3, 4, 5, 7)
 *
 * CRITICAL FIX: Uses prefetchedMatches from LivescoreContext to avoid double fetching.
 * Context handles WebSocket and polling, MatchList only renders.
 */

import { useLivescore } from '../LivescoreContext';
import { MatchList } from '../../MatchList';

export function LiveTab() {
  const { selectedDate, sortBy, liveMatches } = useLivescore();

  return (
    <MatchList
      view="live"
      date={selectedDate}
      sortBy={sortBy}
      prefetchedMatches={liveMatches}
      skipInternalUpdates={true}
    />
  );
}

export default LiveTab;
