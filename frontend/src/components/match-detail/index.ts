/**
 * Match Detail Components - Barrel Export
 *
 * Modular match detail page architecture with separate
 * components for layout and each tab.
 */

// Context
export { MatchDetailProvider, useMatchDetail } from './MatchDetailContext';
export type {
  TabType,
  StatsData,
  H2HData,
  StandingsData,
  LineupData,
  TrendData,
  EventsData,
  AIData,
  AllTabData,
  MatchDetailContextValue,
} from './MatchDetailContext';

// Layout Components
export { MatchDetailLayout } from './MatchDetailLayout';
export { MatchDetailHeader } from './MatchDetailHeader';
export { MatchScoreCard } from './MatchScoreCard';
export { MatchTabNavigation } from './MatchTabNavigation';

// Utils
export { getStatName, sortStats, processStats, filterKnownStats } from './utils/statHelpers';
export type { StatItem } from './utils/statHelpers';

// Tab Components
export * from './tabs';
