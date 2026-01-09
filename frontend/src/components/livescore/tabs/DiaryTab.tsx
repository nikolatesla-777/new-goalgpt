/**
 * Diary Tab - Günün Maçları
 *
 * Shows all matches for the selected date
 *
 * CRITICAL FIX: Uses prefetchedMatches from LivescoreContext to avoid double fetching.
 * Context handles WebSocket and polling, MatchList only renders.
 */

import { useLivescore } from '../LivescoreContext';
import { MatchList } from '../../MatchList';

export function DiaryTab() {
  const { selectedDate, sortBy, allMatches, loading } = useLivescore();

  return (
    <MatchList
      view="diary"
      date={selectedDate}
      sortBy={sortBy}
      prefetchedMatches={allMatches}
      skipInternalUpdates={true}
      isLoading={loading}
    />
  );
}

export default DiaryTab;
