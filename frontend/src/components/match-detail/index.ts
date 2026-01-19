/**
 * Match Detail Components
 *
 * Exports for match detail page components.
 */

export { MatchDetailLayout } from './MatchDetailLayout';
export { MatchDetailProvider, useMatchDetail } from './MatchDetailContext';
export type {
  MatchData,
  MatchTeam,
  MatchStat,
  MatchIncident,
  MatchLineup,
  LineupPlayer,
  H2HData,
  H2HMatch,
  TrendPoint,
  Standing,
} from './MatchDetailContext';

// Tabs
export { StatsTab } from './tabs/StatsTab';
export { EventsTab } from './tabs/EventsTab';
export { H2HTab } from './tabs/H2HTab';
export { StandingsTab } from './tabs/StandingsTab';
export { LineupTab } from './tabs/LineupTab';
export { TrendTab } from './tabs/TrendTab';
export { AITab } from './tabs/AITab';
export { ForumTab } from './tabs/ForumTab';
