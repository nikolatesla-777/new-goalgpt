/**
 * TheSports Integration Module
 *
 * Centralized exports for TheSports API client.
 *
 * PR-5: TheSports Client Hardening
 *
 * Usage:
 *   // New hardened client (recommended)
 *   import { theSportsClient } from '../integrations/thesports';
 *   const data = await theSportsClient.get('/match/detail', { uuid: matchId });
 *
 *   // Backward-compatible adapter for legacy code
 *   import { theSportsAPIAdapter } from '../integrations/thesports';
 *   const data = await theSportsAPIAdapter.get('/match/detail', { uuid: matchId });
 */

export {
  theSportsClient,
  TheSportsClient,
  TheSportsClientClass,
  CircuitState,
  type TheSportsClientConfig,
} from './TheSportsClient';

export {
  TheSportsClientAdapter,
  theSportsAPIAdapter,
} from './TheSportsClientAdapter';
