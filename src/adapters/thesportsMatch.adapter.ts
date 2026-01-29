/**
 * TheSports Match Adapter - Week-2A
 *
 * Maps TheSports match data to canonical ScoringFeatures contract.
 * 100% DETERMINISTIC - no fuzzy matching, no inference.
 * Field missing => undefined + tracked in completeness.
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import {
  ScoringFeatures,
  DataCompleteness,
  XGData,
  OddsData,
  PotentialsData,
  FullTimeScores,
  HalfTimeScores,
  CornersData,
  CardsData,
  TeamInfo,
  LeagueInfo,
  calculateCompleteness,
  generateRiskFlags,
  type ScoringRiskFlag,
} from '../types/scoringFeatures';
import { logger } from '../utils/logger';

/**
 * TheSports Match Data Structure (from database ts_matches table)
 *
 * This represents the ACTUAL structure we get from TheSports backend.
 * Documentation: See docs/THESPORTS_TO_SCORING_MAPPING.md
 */
export interface TheSportsMatchData {
  // ============================================================================
  // IDENTIFIERS
  // ============================================================================
  id: string;                    // Internal UUID (PRIMARY KEY)
  external_id: string;           // TheSports external match ID
  home_team_id?: string;         // Home team ID
  away_team_id?: string;         // Away team ID
  competition_id?: string;       // Competition/League ID
  season_id?: string;            // Season ID

  // ============================================================================
  // TEAM NAMES
  // ============================================================================
  home_team: string;             // Home team name
  away_team: string;             // Away team name

  // ============================================================================
  // MATCH TIMING
  // ============================================================================
  match_time: number;            // Unix timestamp (seconds)
  status_id: number;             // Match status (8 = ENDED, 2-7 = LIVE, 1 = NOT_STARTED)

  // ============================================================================
  // FULL-TIME SCORES
  // ============================================================================
  home_score_display?: number;   // Home team FT score
  away_score_display?: number;   // Away team FT score

  // ============================================================================
  // DETAILED SCORES (ARRAYS)
  // ============================================================================
  /**
   * home_scores array structure:
   * [0] - unused
   * [1] - Half-time score
   * [2] - unused
   * [3] - Yellow cards
   * [4] - unused
   * [5] - Corners
   */
  home_scores?: number[];

  /**
   * away_scores array structure:
   * [0] - unused
   * [1] - Half-time score
   * [2] - unused
   * [3] - unused
   * [4] - Yellow cards
   * [5] - Corners
   */
  away_scores?: number[];

  // ============================================================================
  // ADDITIONAL FIELDS (may be present in some queries)
  // ============================================================================
  competition_name?: string;     // League name (if joined)
  statistics?: any;              // JSONB field (team stats)
  incidents?: any;               // JSONB field (match events)

  // ============================================================================
  // FIELDS THAT THESPORTS DOES NOT PROVIDE
  // ============================================================================
  // xG data - NOT AVAILABLE in TheSports
  // Odds data - NOT AVAILABLE in TheSports
  // Potentials - NOT AVAILABLE in TheSports
  // Form statistics - NOT AVAILABLE in simple match query
  // H2H statistics - NOT AVAILABLE in simple match query
  // League statistics - NOT AVAILABLE in simple match query
}

/**
 * Adapter result with features + risk flags
 */
export interface AdaptedMatchData {
  features: ScoringFeatures;
  risk_flags: ScoringRiskFlag[];
}

/**
 * TheSports Match Adapter Class
 */
export class TheSportsMatchAdapter {
  /**
   * Adapt TheSports match data to canonical ScoringFeatures
   *
   * Rules:
   * 1. Direct field mapping (no transformation)
   * 2. Compute totals ONLY if both parts exist
   * 3. No inference - missing data = undefined
   * 4. Track completeness (present/missing)
   */
  adapt(thesportsData: TheSportsMatchData): AdaptedMatchData {
    logger.debug('[TheSportsAdapter] Adapting match', {
      match_id: thesportsData.external_id,
      home: thesportsData.home_team,
      away: thesportsData.away_team,
    });

    // ============================================================================
    // STEP 1: Map basic identifiers and teams
    // ============================================================================

    const home_team: TeamInfo = {
      id: thesportsData.home_team_id || thesportsData.external_id + '_home',
      name: thesportsData.home_team,
    };

    const away_team: TeamInfo = {
      id: thesportsData.away_team_id || thesportsData.external_id + '_away',
      name: thesportsData.away_team,
    };

    const league: LeagueInfo = {
      id: thesportsData.competition_id || 'unknown',
      name: thesportsData.competition_name,
    };

    // ============================================================================
    // STEP 2: Map xG (TheSports DOES NOT provide xG)
    // ============================================================================
    const xg: XGData | undefined = undefined; // TheSports has no xG data

    // ============================================================================
    // STEP 3: Map odds (TheSports DOES NOT provide odds)
    // ============================================================================
    const odds: OddsData | undefined = undefined; // TheSports has no odds data

    // ============================================================================
    // STEP 4: Map potentials (TheSports DOES NOT provide potentials)
    // ============================================================================
    const potentials: PotentialsData | undefined = undefined; // TheSports has no potentials

    // ============================================================================
    // STEP 5: Map full-time scores (only if match ended)
    // ============================================================================
    let ft_scores: FullTimeScores | undefined = undefined;

    if (
      thesportsData.status_id === 8 && // ENDED
      thesportsData.home_score_display !== undefined &&
      thesportsData.home_score_display !== null &&
      thesportsData.away_score_display !== undefined &&
      thesportsData.away_score_display !== null
    ) {
      ft_scores = {
        home: thesportsData.home_score_display,
        away: thesportsData.away_score_display,
        total: thesportsData.home_score_display + thesportsData.away_score_display,
      };
    }

    // ============================================================================
    // STEP 6: Map half-time scores
    // ============================================================================
    let ht_scores: HalfTimeScores | undefined = undefined;

    if (
      thesportsData.home_scores &&
      thesportsData.home_scores[1] !== undefined &&
      thesportsData.home_scores[1] !== null &&
      thesportsData.away_scores &&
      thesportsData.away_scores[1] !== undefined &&
      thesportsData.away_scores[1] !== null
    ) {
      ht_scores = {
        home: thesportsData.home_scores[1],
        away: thesportsData.away_scores[1],
        total: thesportsData.home_scores[1] + thesportsData.away_scores[1],
      };
    }

    // ============================================================================
    // STEP 7: Map corners
    // ============================================================================
    let corners: CornersData | undefined = undefined;

    if (
      thesportsData.home_scores &&
      thesportsData.home_scores[5] !== undefined &&
      thesportsData.home_scores[5] !== null &&
      thesportsData.away_scores &&
      thesportsData.away_scores[5] !== undefined &&
      thesportsData.away_scores[5] !== null
    ) {
      corners = {
        home: thesportsData.home_scores[5],
        away: thesportsData.away_scores[5],
        total: thesportsData.home_scores[5] + thesportsData.away_scores[5],
      };
    }

    // ============================================================================
    // STEP 8: Map cards (yellow cards)
    // ============================================================================
    let cards: CardsData | undefined = undefined;

    if (
      thesportsData.home_scores &&
      thesportsData.home_scores[3] !== undefined &&
      thesportsData.home_scores[3] !== null &&
      thesportsData.away_scores &&
      thesportsData.away_scores[4] !== undefined &&
      thesportsData.away_scores[4] !== null
    ) {
      cards = {
        home: thesportsData.home_scores[3],
        away: thesportsData.away_scores[4],
        total: thesportsData.home_scores[3] + thesportsData.away_scores[4],
      };
    }

    // ============================================================================
    // STEP 9: Build ScoringFeatures object
    // ============================================================================

    const features: ScoringFeatures = {
      source: 'thesports',
      match_id: thesportsData.external_id,
      kickoff_ts: thesportsData.match_time,
      completeness: { present: [], missing: [] }, // Will be calculated below

      // Teams & League
      home_team,
      away_team,
      league,

      // Data fields (all optional)
      xg,
      odds,
      potentials,
      ft_scores,
      ht_scores,
      corners,
      cards,

      // Advanced data (not available from simple TheSports match query)
      form: undefined,
      h2h: undefined,
      league_stats: undefined,
    };

    // ============================================================================
    // STEP 10: Calculate completeness
    // ============================================================================

    features.completeness = calculateCompleteness(features);

    // ============================================================================
    // STEP 11: Generate risk flags
    // ============================================================================

    const risk_flags = generateRiskFlags(features.completeness);

    // Log warnings for critical missing data
    if (risk_flags.includes('MISSING_XG')) {
      logger.debug('[TheSportsAdapter] WARNING: xG data not available (TheSports limitation)');
    }

    if (risk_flags.includes('MISSING_ODDS')) {
      logger.debug('[TheSportsAdapter] WARNING: Odds data not available (TheSports limitation)');
    }

    if (risk_flags.includes('MISSING_POTENTIALS')) {
      logger.debug('[TheSportsAdapter] WARNING: Potentials not available (TheSports limitation)');
    }

    logger.debug('[TheSportsAdapter] Adaptation complete', {
      match_id: thesportsData.external_id,
      present_fields: features.completeness.present.length,
      missing_fields: features.completeness.missing.length,
      risk_flags: risk_flags.length,
    });

    return {
      features,
      risk_flags,
    };
  }

  /**
   * Validate that TheSports data has minimum required fields
   *
   * Required fields:
   * - external_id (match ID)
   * - home_team (team name)
   * - away_team (team name)
   * - match_time (kickoff timestamp)
   * - status_id (match status)
   */
  validate(thesportsData: TheSportsMatchData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!thesportsData.external_id) {
      errors.push('Missing required field: external_id');
    }

    if (!thesportsData.home_team) {
      errors.push('Missing required field: home_team');
    }

    if (!thesportsData.away_team) {
      errors.push('Missing required field: away_team');
    }

    if (!thesportsData.match_time) {
      errors.push('Missing required field: match_time');
    }

    if (thesportsData.status_id === undefined || thesportsData.status_id === null) {
      errors.push('Missing required field: status_id');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Singleton instance
 */
export const thesportsMatchAdapter = new TheSportsMatchAdapter();
