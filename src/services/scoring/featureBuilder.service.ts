/**
 * Feature Builder Service - Week-2A Phase 2
 *
 * Builds composite ScoringFeatures by merging:
 * - TheSports data (identity, scores, settlement data)
 * - FootyStats data (xG, odds, potentials, trends)
 *
 * CRITICAL: NO fuzzy matching. Deterministic linking only.
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import {
  thesportsMatchAdapter,
  TheSportsMatchData,
} from '../../adapters/thesportsMatch.adapter';
import {
  ScoringFeatures,
  XGData,
  OddsData,
  PotentialsData,
  calculateCompleteness,
  generateRiskFlags,
  ScoringRiskFlag,
} from '../../types/scoringFeatures';

/**
 * Source references for traceability
 */
export interface SourceReferences {
  thesports_match_id: string;      // TheSports external_id
  thesports_internal_id?: string;   // ts_matches.id (UUID)
  footystats_match_id?: number;     // FootyStats match ID
  footystats_linked: boolean;       // Whether FootyStats data was found
  link_method?: 'stored_mapping' | 'deterministic_match' | 'not_found';
}

/**
 * FootyStats match data (from fs_match_stats table)
 */
interface FootyStatsMatchData {
  fs_match_id: number;
  team_a_xg_prematch?: number;
  team_b_xg_prematch?: number;
  btts_potential?: number;
  o25_potential?: number;
  o15_potential?: number;
  corners_potential?: number;
  cards_potential?: number;
  odds_ft_1?: number;
  odds_ft_x?: number;
  odds_ft_2?: number;
  h2h_stats?: any;
  trends?: any;
  data_quality_score?: number;
}

/**
 * Composite feature build result
 */
export interface CompositeFeatures {
  features: ScoringFeatures;
  source_refs: SourceReferences;
  risk_flags: ScoringRiskFlag[];
}

/**
 * Feature Builder Service
 */
export class FeatureBuilderService {
  /**
   * Build composite ScoringFeatures for a match
   *
   * Pipeline:
   * 1. Fetch TheSports match data (ts_matches table)
   * 2. Try to fetch FootyStats features (fs_match_stats table)
   * 3. Merge into ScoringFeatures
   * 4. Calculate completeness and risk flags
   *
   * @param matchId - TheSports external match ID
   */
  async buildScoringFeatures(matchId: string): Promise<CompositeFeatures> {
    logger.info('[FeatureBuilder] Building composite features', { matchId });

    // ============================================================================
    // STEP 1: Fetch TheSports match data
    // ============================================================================

    const thesportsData = await this.fetchTheSportsMatch(matchId);

    if (!thesportsData) {
      throw new Error(`Match not found: ${matchId}`);
    }

    // Validate TheSports data
    const validation = thesportsMatchAdapter.validate(thesportsData);
    if (!validation.valid) {
      throw new Error(`Invalid TheSports data: ${validation.errors.join(', ')}`);
    }

    // Adapt TheSports data to base ScoringFeatures
    const { features: baseFeatures, risk_flags: baseRiskFlags } =
      thesportsMatchAdapter.adapt(thesportsData);

    // ============================================================================
    // STEP 2: Try to fetch FootyStats features
    // ============================================================================

    const { footystatsData, linkMethod } = await this.fetchFootyStatsFeatures(
      thesportsData.id, // Internal UUID
      thesportsData.external_id,
      thesportsData.home_team,
      thesportsData.away_team,
      thesportsData.match_time
    );

    // ============================================================================
    // STEP 3: Merge FootyStats data into ScoringFeatures
    // ============================================================================

    const compositeFeatures = this.mergeFeatures(baseFeatures, footystatsData);

    // ============================================================================
    // STEP 4: Build source references
    // ============================================================================

    const source_refs: SourceReferences = {
      thesports_match_id: thesportsData.external_id,
      thesports_internal_id: thesportsData.id,
      footystats_match_id: footystatsData?.fs_match_id,
      footystats_linked: footystatsData !== null,
      link_method: linkMethod,
    };

    // ============================================================================
    // STEP 5: Calculate completeness and risk flags
    // ============================================================================

    compositeFeatures.completeness = calculateCompleteness(compositeFeatures);
    const risk_flags = generateRiskFlags(compositeFeatures.completeness);

    // Add MISSING_FOOTYSTATS_LINK flag if FootyStats data not found
    if (!footystatsData) {
      risk_flags.push('MISSING_XG'); // Already added by generateRiskFlags
      logger.warn('[FeatureBuilder] FootyStats data not found for match', {
        matchId,
        link_method: linkMethod,
      });
    }

    // Update source to 'hybrid' if FootyStats data is present
    if (footystatsData) {
      compositeFeatures.source = 'hybrid';
    }

    logger.info('[FeatureBuilder] Composite features built', {
      matchId,
      footystats_linked: source_refs.footystats_linked,
      present_fields: compositeFeatures.completeness.present.length,
      missing_fields: compositeFeatures.completeness.missing.length,
      risk_flags: risk_flags.length,
    });

    return {
      features: compositeFeatures,
      source_refs,
      risk_flags,
    };
  }

  /**
   * Fetch TheSports match data from ts_matches table
   */
  private async fetchTheSportsMatch(
    externalId: string
  ): Promise<TheSportsMatchData | null> {
    try {
      const result = await pool.query(
        `SELECT
          id,
          external_id,
          home_team_id,
          away_team_id,
          competition_id,
          season_id,
          home_team,
          away_team,
          match_time,
          status_id,
          home_score_display,
          away_score_display,
          home_scores,
          away_scores,
          statistics,
          incidents
        FROM ts_matches
        WHERE external_id = $1
        LIMIT 1`,
        [externalId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as TheSportsMatchData;
    } catch (error) {
      logger.error('[FeatureBuilder] Error fetching TheSports match', {
        externalId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch FootyStats features for a match
   *
   * Strategy:
   * 1. Try stored mapping (ts_match_id -> fs_match_id in fs_match_stats)
   * 2. If not found, try deterministic matching (date/time window + team names)
   * 3. If still not found, return null
   *
   * RULE: NO fuzzy matching. Must be deterministic.
   */
  private async fetchFootyStatsFeatures(
    tsMatchInternalId: string,
    tsExternalId: string,
    homeTeam: string,
    awayTeam: string,
    matchTime: number
  ): Promise<{
    footystatsData: FootyStatsMatchData | null;
    linkMethod: 'stored_mapping' | 'deterministic_match' | 'not_found';
  }> {
    // ============================================================================
    // METHOD 1: Try stored mapping (fs_match_stats table)
    // ============================================================================

    try {
      const storedResult = await pool.query(
        `SELECT
          fs_match_id,
          team_a_xg_prematch,
          team_b_xg_prematch,
          btts_potential,
          o25_potential,
          o15_potential,
          corners_potential,
          cards_potential,
          odds_ft_1,
          odds_ft_x,
          odds_ft_2,
          h2h_stats,
          trends,
          data_quality_score
        FROM fs_match_stats
        WHERE ts_match_id = $1
        LIMIT 1`,
        [tsMatchInternalId]
      );

      if (storedResult.rows.length > 0) {
        logger.debug('[FeatureBuilder] FootyStats data found via stored mapping', {
          ts_match_id: tsMatchInternalId,
          fs_match_id: storedResult.rows[0].fs_match_id,
        });

        return {
          footystatsData: storedResult.rows[0] as FootyStatsMatchData,
          linkMethod: 'stored_mapping',
        };
      }
    } catch (error) {
      logger.warn('[FeatureBuilder] Error querying stored mapping', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // ============================================================================
    // METHOD 2: Try deterministic matching
    // ============================================================================

    try {
      // Match using:
      // - Date/time window (±2 hours)
      // - EXACT normalized team names (case-insensitive, no fuzzy)

      const matchTimeFrom = matchTime - 7200; // -2 hours
      const matchTimeTo = matchTime + 7200;   // +2 hours

      const deterministicResult = await pool.query(
        `SELECT
          fs.fs_match_id,
          fs.team_a_xg_prematch,
          fs.team_b_xg_prematch,
          fs.btts_potential,
          fs.o25_potential,
          fs.o15_potential,
          fs.corners_potential,
          fs.cards_potential,
          fs.odds_ft_1,
          fs.odds_ft_x,
          fs.odds_ft_2,
          fs.h2h_stats,
          fs.trends,
          fs.data_quality_score,
          m.home_team as ts_home,
          m.away_team as ts_away,
          m.match_time as ts_time
        FROM fs_match_stats fs
        JOIN ts_matches m ON fs.ts_match_id = m.id
        WHERE m.match_time >= $1
          AND m.match_time <= $2
          AND LOWER(m.home_team) = LOWER($3)
          AND LOWER(m.away_team) = LOWER($4)
        LIMIT 1`,
        [matchTimeFrom, matchTimeTo, homeTeam, awayTeam]
      );

      if (deterministicResult.rows.length > 0) {
        logger.info('[FeatureBuilder] FootyStats data found via deterministic match', {
          ts_external_id: tsExternalId,
          fs_match_id: deterministicResult.rows[0].fs_match_id,
          time_diff: Math.abs(deterministicResult.rows[0].ts_time - matchTime),
        });

        return {
          footystatsData: deterministicResult.rows[0] as FootyStatsMatchData,
          linkMethod: 'deterministic_match',
        };
      }
    } catch (error) {
      logger.warn('[FeatureBuilder] Error in deterministic matching', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // ============================================================================
    // METHOD 3: Not found
    // ============================================================================

    logger.warn('[FeatureBuilder] FootyStats data not found', {
      ts_external_id: tsExternalId,
      home_team: homeTeam,
      away_team: awayTeam,
    });

    return {
      footystatsData: null,
      linkMethod: 'not_found',
    };
  }

  /**
   * Merge FootyStats data into base ScoringFeatures
   *
   * Rule: FootyStats provides predictive features (xG, odds, potentials, trends)
   *       TheSports provides settlement features (scores, corners, cards)
   */
  private mergeFeatures(
    baseFeatures: ScoringFeatures,
    footystatsData: FootyStatsMatchData | null
  ): ScoringFeatures {
    if (!footystatsData) {
      // No FootyStats data - return base features as-is
      return { ...baseFeatures };
    }

    // ============================================================================
    // Merge xG data
    // ============================================================================

    let xg: XGData | undefined = undefined;

    if (
      footystatsData.team_a_xg_prematch !== null &&
      footystatsData.team_a_xg_prematch !== undefined &&
      footystatsData.team_b_xg_prematch !== null &&
      footystatsData.team_b_xg_prematch !== undefined
    ) {
      xg = {
        home: footystatsData.team_a_xg_prematch,
        away: footystatsData.team_b_xg_prematch,
        total: footystatsData.team_a_xg_prematch + footystatsData.team_b_xg_prematch,
      };
    }

    // ============================================================================
    // Merge odds data
    // ============================================================================

    let odds: OddsData | undefined = undefined;

    if (
      footystatsData.odds_ft_1 !== null &&
      footystatsData.odds_ft_1 !== undefined &&
      footystatsData.odds_ft_x !== null &&
      footystatsData.odds_ft_x !== undefined &&
      footystatsData.odds_ft_2 !== null &&
      footystatsData.odds_ft_2 !== undefined
    ) {
      odds = {
        home_win: footystatsData.odds_ft_1,
        draw: footystatsData.odds_ft_x,
        away_win: footystatsData.odds_ft_2,
      };
    }

    // ============================================================================
    // Merge potentials data
    // ============================================================================

    const potentials: PotentialsData = {
      over25: footystatsData.o25_potential || undefined,
      btts: footystatsData.btts_potential || undefined,
      over15: footystatsData.o15_potential || undefined,
      over05_ht: undefined, // FootyStats doesn't have HT-specific potential
      over35: undefined,    // Would need to be calculated from other potentials
      corners_over85: footystatsData.corners_potential || undefined,
      cards_over25: footystatsData.cards_potential || undefined,
    };

    // Only set potentials if at least one field is present
    const hasPotentials = Object.values(potentials).some(v => v !== undefined);

    // ============================================================================
    // Merge trends and H2H
    // ============================================================================

    const trends = footystatsData.trends || undefined;
    const h2h = footystatsData.h2h_stats || undefined;

    // ============================================================================
    // Build merged features
    // ============================================================================

    return {
      ...baseFeatures,

      // Override with FootyStats data
      xg,
      odds,
      potentials: hasPotentials ? potentials : undefined,

      // Add trends and H2H
      form: trends ? { home: trends.home, away: trends.away } : undefined,
      h2h: h2h || undefined,

      // Note: source will be updated to 'hybrid' by caller
      // completeness will be recalculated by caller
    };
  }
}

/**
 * Singleton instance
 */
export const featureBuilderService = new FeatureBuilderService();
