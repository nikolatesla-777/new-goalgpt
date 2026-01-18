/**
 * Match Detail Components - Barrel Export (SIMPLIFIED)
 *
 * Simplified architecture - no Context, no Layout wrapper.
 * Match detail page is now a single component at /pages/MatchDetailPage.tsx
 */

// Utils (still useful for tabs)
export { getStatName, sortStats, processStats, filterKnownStats } from './utils/statHelpers';
export type { StatItem } from './utils/statHelpers';

// Tab Components (now Props-based, not Context-based)
export * from './tabs';

// UI Components (used by tabs)
export { MatchEventsTimeline } from './MatchEventsTimeline';
export { MatchTrendChart } from './MatchTrendChart';
