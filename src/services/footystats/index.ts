/**
 * FootyStats Integration Module
 *
 * Exports all FootyStats services and types for easy import
 */

// API Client
export {
  footyStatsAPI,
  FootyStatsAPIClient,
  type FootyStatsResponse,
  type FootyStatsLeague,
  type FootyStatsTeam,
  type FootyStatsMatch,
  type FootyStatsTeamForm,
  type FootyStatsReferee,
} from './footystats.client';

// Mapping Service
export {
  mappingService,
  FootyStatsMappingService,
  normalizeString,
  stringSimilarity,
  type MappingResult,
  type MappingStats,
} from './mapping.service';
