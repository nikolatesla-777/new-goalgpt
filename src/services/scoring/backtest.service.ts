/**
 * Backtest Service - Historical Validation
 *
 * Validates scoring algorithm against historical match data
 * Calculates hit rate, ROI, and calibration metrics
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { marketScorerService, type ScoringResult, type MarketId } from './marketScorer.service';
import type { FootyStatsMatch } from './marketScorer.service';

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  marketId: MarketId;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  minMatches?: number; // Minimum matches required for valid backtest
}

/**
 * Historical match with outcome
 */
interface HistoricalMatch {
  match_id: string;
  fs_match_id: number;
  home_score: number;
  away_score: number;
  ht_home_score: number;
  ht_away_score: number;
  home_corners: number | null;
  away_corners: number | null;
  home_yellows: number | null;
  away_yellows: number | null;
  match_time: number;
}

/**
 * Prediction with actual outcome
 */
interface PredictionWithOutcome extends ScoringResult {
  actual_outcome: 'WIN' | 'LOSS' | 'VOID';
  actual_value: any;
}

/**
 * Calibration bucket
 */
interface CalibrationBucket {
  bucket: string; // "60-70%"
  avg_predicted: number;
  actual_rate: number;
  count: number;
  error: number;
}

/**
 * Backtest result
 */
export interface BacktestResult {
  market_id: MarketId;
  backtest_period: string;
  start_date: string;
  end_date: string;

  // Raw counts
  total_predictions: number;
  total_settled: number;
  won: number;
  lost: number;
  void: number;

  // Performance metrics
  hit_rate: number;
  roi: number;
  avg_confidence: number;
  avg_probability: number;

  // Calibration
  calibration_error: number;
  calibration_curve: CalibrationBucket[];

  // Validation
  validation_passed: boolean;
  validation_notes: string;
}

/**
 * Run backtest for a specific market and date range
 */
export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const { marketId, startDate, endDate, minMatches = 100 } = config;

  logger.info(`[Backtest] Starting backtest for ${marketId} (${startDate} to ${endDate})`);

  // Step 1: Fetch historical matches
  const historicalMatches = await fetchHistoricalMatches(startDate, endDate);

  if (historicalMatches.length < minMatches) {
    throw new Error(
      `Insufficient historical data: ${historicalMatches.length} matches (minimum ${minMatches})`
    );
  }

  logger.info(`[Backtest] Found ${historicalMatches.length} historical matches`);

  // Step 2: Generate predictions for all matches
  const predictions: PredictionWithOutcome[] = [];

  for (const match of historicalMatches) {
    try {
      // Transform database row to FootyStatsMatch format
      const footyStatsMatch: FootyStatsMatch = transformToFootyStatsMatch(match);

      // Score the match
      const scoring = await marketScorerService.scoreMarket(marketId, footyStatsMatch);

      // Only include picks marked as 'YES'
      if (scoring.pick !== 'YES') {
        continue;
      }

      // Evaluate actual outcome
      const actual_outcome = evaluateActualOutcome(match, marketId);

      predictions.push({ ...scoring, actual_outcome, actual_value: match });
    } catch (error: any) {
      logger.warn(`[Backtest] Failed to score match ${match.match_id}:`, error.message);
    }
  }

  if (predictions.length === 0) {
    throw new Error('No predictions generated (FootyStats data not available)');
  }

  logger.info(`[Backtest] Generated ${predictions.length} predictions`);

  // Step 3: Calculate performance metrics
  const metrics = calculatePerformanceMetrics(predictions);

  // Step 4: Calculate calibration
  const calibration = calculateCalibration(predictions);

  // Step 5: Validate against thresholds
  const validation = validateBacktestResult(marketId, metrics, calibration);

  const result: BacktestResult = {
    market_id: marketId,
    backtest_period: `${startDate} to ${endDate}`,
    start_date: startDate,
    end_date: endDate,
    ...metrics,
    calibration_error: calibration.error,
    calibration_curve: calibration.curve,
    validation_passed: validation.passed,
    validation_notes: validation.notes,
  };

  logger.info(`[Backtest] Completed backtest for ${marketId}`, {
    hit_rate: `${(result.hit_rate * 100).toFixed(2)}%`,
    roi: `${(result.roi * 100).toFixed(2)}%`,
    calibration_error: `${(result.calibration_error * 100).toFixed(2)}%`,
    validation: validation.passed ? 'PASSED' : 'FAILED',
  });

  return result;
}

/**
 * Transform database row to FootyStatsMatch format
 */
function transformToFootyStatsMatch(dbRow: any): FootyStatsMatch {
  return {
    id: dbRow.fs_match_id,
    externalId: dbRow.match_id,
    homeTeamId: 0, // Not needed for backtest
    awayTeamId: 0, // Not needed for backtest
    homeTeamName: dbRow.home_team,
    awayTeamName: dbRow.away_team,
    matchTime: dbRow.match_time,

    // xG data
    xg: dbRow.team_a_xg_prematch && dbRow.team_b_xg_prematch
      ? {
          home: dbRow.team_a_xg_prematch,
          away: dbRow.team_b_xg_prematch,
          total: dbRow.team_a_xg_prematch + dbRow.team_b_xg_prematch,
        }
      : undefined,

    // Potentials
    potentials: {
      over25: dbRow.o25_potential,
      btts: dbRow.btts_potential,
      o05HT: dbRow.o15_potential, // HT potential proxy
      o15: dbRow.o15_potential,
      corners: dbRow.corners_potential,
      cards: dbRow.cards_potential,
    },

    // Odds
    odds: dbRow.odds_ft_1 && dbRow.odds_ft_x && dbRow.odds_ft_2
      ? {
          ft_1: dbRow.odds_ft_1,
          ft_x: dbRow.odds_ft_x,
          ft_2: dbRow.odds_ft_2,
        }
      : undefined,

    // H2H stats (from JSONB)
    h2h: dbRow.h2h_stats || undefined,

    // Trends (from JSONB)
    trends: dbRow.trends || undefined,

    // Note: homeTeam/awayTeam/league data not available in backtest
    // Scorer will use available data and mark missing components
  };
}

/**
 * Fetch historical matches with FootyStatsMatch data from database
 */
async function fetchHistoricalMatches(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        m.external_id AS match_id,
        m.id AS fs_match_id,
        m.home_team,
        m.away_team,
        m.home_score_display AS home_score,
        m.away_score_display AS away_score,
        m.home_scores[1] AS ht_home_score,
        m.away_scores[1] AS ht_away_score,
        m.home_scores[5] AS home_corners,
        m.away_scores[5] AS away_corners,
        m.home_scores[3] AS home_yellows,
        m.away_scores[4] AS away_yellows,
        m.match_time,
        -- FootyStats data
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
        fs.data_quality_score
      FROM ts_matches m
      INNER JOIN fs_match_stats fs ON fs.ts_match_id = m.id
      WHERE m.status_id = 8
        AND m.match_time >= EXTRACT(EPOCH FROM $1::date)
        AND m.match_time < EXTRACT(EPOCH FROM ($2::date + INTERVAL '1 day'))
        AND m.home_score_display IS NOT NULL
        AND m.away_score_display IS NOT NULL
        AND fs.data_quality_score >= 60
      ORDER BY m.match_time ASC
    `;

    const result = await client.query(query, [startDate, endDate]);

    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Evaluate actual outcome for a match
 */
function evaluateActualOutcome(
  match: HistoricalMatch,
  marketId: MarketId
): 'WIN' | 'LOSS' | 'VOID' {
  try {
    switch (marketId) {
      case 'O25':
        return match.home_score + match.away_score >= 3 ? 'WIN' : 'LOSS';

      case 'BTTS':
        return match.home_score > 0 && match.away_score > 0 ? 'WIN' : 'LOSS';

      case 'HT_O05':
        return match.ht_home_score + match.ht_away_score >= 1 ? 'WIN' : 'LOSS';

      case 'O35':
        return match.home_score + match.away_score >= 4 ? 'WIN' : 'LOSS';

      case 'HOME_O15':
        return match.home_score >= 2 ? 'WIN' : 'LOSS';

      case 'CORNERS_O85':
        if (match.home_corners === null || match.away_corners === null) return 'VOID';
        return match.home_corners + match.away_corners >= 9 ? 'WIN' : 'LOSS';

      case 'CARDS_O25':
        if (match.home_yellows === null || match.away_yellows === null) return 'VOID';
        return match.home_yellows + match.away_yellows >= 3 ? 'WIN' : 'LOSS';

      default:
        return 'VOID';
    }
  } catch (error) {
    logger.error(`[Backtest] Error evaluating outcome for ${match.match_id}:`, error);
    return 'VOID';
  }
}

/**
 * Calculate performance metrics from predictions
 */
function calculatePerformanceMetrics(predictions: PredictionWithOutcome[]): {
  total_predictions: number;
  total_settled: number;
  won: number;
  lost: number;
  void: number;
  hit_rate: number;
  roi: number;
  avg_confidence: number;
  avg_probability: number;
} {
  const total_predictions = predictions.length;
  const void_count = predictions.filter((p) => p.actual_outcome === 'VOID').length;
  const won = predictions.filter((p) => p.actual_outcome === 'WIN').length;
  const lost = predictions.filter((p) => p.actual_outcome === 'LOSS').length;
  const total_settled = won + lost;

  const hit_rate = total_settled > 0 ? won / total_settled : 0;

  // ROI calculation (assuming flat stake of 1 unit per bet with odds of 2.0)
  // ROI = (Returns - Stake) / Stake
  const assumed_odds = 2.0;
  const returns = won * assumed_odds;
  const stake = total_settled;
  const roi = stake > 0 ? (returns - stake) / stake : 0;

  // Average confidence and probability
  const sum_confidence = predictions.reduce((acc, p) => acc + p.confidence, 0);
  const sum_probability = predictions.reduce((acc, p) => acc + p.probability, 0);
  const avg_confidence = total_predictions > 0 ? sum_confidence / total_predictions : 0;
  const avg_probability = total_predictions > 0 ? sum_probability / total_predictions : 0;

  return {
    total_predictions,
    total_settled,
    won,
    lost,
    void: void_count,
    hit_rate,
    roi,
    avg_confidence,
    avg_probability,
  };
}

/**
 * Calculate calibration (bucketed analysis)
 */
function calculateCalibration(predictions: PredictionWithOutcome[]): {
  error: number;
  curve: CalibrationBucket[];
} {
  // Filter out void predictions
  const settled = predictions.filter((p) => p.actual_outcome !== 'VOID');

  // Create 10 buckets (10%, 20%, ..., 100%)
  const buckets: CalibrationBucket[] = [];

  for (let i = 1; i <= 10; i++) {
    const min_prob = (i - 1) / 10;
    const max_prob = i / 10;
    const bucket_name = `${(min_prob * 100).toFixed(0)}-${(max_prob * 100).toFixed(0)}%`;

    // Get predictions in this bucket
    const bucket_predictions = settled.filter(
      (p) => p.probability >= min_prob && p.probability < max_prob
    );

    if (bucket_predictions.length === 0) continue;

    // Calculate average predicted probability
    const avg_predicted =
      bucket_predictions.reduce((acc, p) => acc + p.probability, 0) / bucket_predictions.length;

    // Calculate actual win rate
    const wins = bucket_predictions.filter((p) => p.actual_outcome === 'WIN').length;
    const actual_rate = wins / bucket_predictions.length;

    // Calculate error
    const error = Math.abs(avg_predicted - actual_rate);

    buckets.push({
      bucket: bucket_name,
      avg_predicted,
      actual_rate,
      count: bucket_predictions.length,
      error,
    });
  }

  // Overall calibration error (weighted by bucket size)
  const total_count = buckets.reduce((acc, b) => acc + b.count, 0);
  const weighted_error =
    total_count > 0
      ? buckets.reduce((acc, b) => acc + b.error * b.count, 0) / total_count
      : 0;

  return {
    error: weighted_error,
    curve: buckets,
  };
}

/**
 * Validate backtest result against thresholds
 */
function validateBacktestResult(
  marketId: MarketId,
  metrics: any,
  calibration: any
): { passed: boolean; notes: string } {
  // Get thresholds from market registry
  const thresholds: any = {
    O25: { min_hit_rate: 0.58, min_roi: 0.05, max_calibration_error: 0.08 },
    BTTS: { min_hit_rate: 0.58, min_roi: 0.05, max_calibration_error: 0.08 },
    HT_O05: { min_hit_rate: 0.62, min_roi: 0.05, max_calibration_error: 0.08 },
    O35: { min_hit_rate: 0.55, min_roi: 0.05, max_calibration_error: 0.10 },
    HOME_O15: { min_hit_rate: 0.58, min_roi: 0.05, max_calibration_error: 0.08 },
    CORNERS_O85: { min_hit_rate: 0.55, min_roi: 0.03, max_calibration_error: 0.12 },
    CARDS_O25: { min_hit_rate: 0.52, min_roi: 0.03, max_calibration_error: 0.15 },
  };

  const threshold = thresholds[marketId];
  const notes: string[] = [];

  // Check hit rate
  if (metrics.hit_rate < threshold.min_hit_rate) {
    notes.push(
      `Hit rate ${(metrics.hit_rate * 100).toFixed(2)}% below threshold ${(threshold.min_hit_rate * 100).toFixed(0)}%`
    );
  }

  // Check ROI
  if (metrics.roi < threshold.min_roi) {
    notes.push(
      `ROI ${(metrics.roi * 100).toFixed(2)}% below threshold ${(threshold.min_roi * 100).toFixed(0)}%`
    );
  }

  // Check calibration
  if (calibration.error > threshold.max_calibration_error) {
    notes.push(
      `Calibration error ${(calibration.error * 100).toFixed(2)}% above threshold ${(threshold.max_calibration_error * 100).toFixed(0)}%`
    );
  }

  const passed = notes.length === 0;

  return {
    passed,
    notes: passed ? 'All thresholds met' : notes.join('; '),
  };
}

/**
 * Save backtest result to database
 */
export async function saveBacktestResult(result: BacktestResult): Promise<void> {
  const client = await pool.connect();

  try {
    const query = `
      INSERT INTO scoring_backtest_results (
        market_id,
        backtest_period,
        start_date,
        end_date,
        total_predictions,
        total_settled,
        won,
        lost,
        void,
        hit_rate,
        roi,
        avg_confidence,
        avg_probability,
        calibration_error,
        calibration_curve,
        validation_passed,
        validation_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (market_id, start_date, end_date)
      DO UPDATE SET
        backtest_period = EXCLUDED.backtest_period,
        total_predictions = EXCLUDED.total_predictions,
        total_settled = EXCLUDED.total_settled,
        won = EXCLUDED.won,
        lost = EXCLUDED.lost,
        void = EXCLUDED.void,
        hit_rate = EXCLUDED.hit_rate,
        roi = EXCLUDED.roi,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_probability = EXCLUDED.avg_probability,
        calibration_error = EXCLUDED.calibration_error,
        calibration_curve = EXCLUDED.calibration_curve,
        validation_passed = EXCLUDED.validation_passed,
        validation_notes = EXCLUDED.validation_notes,
        created_at = NOW()
    `;

    await client.query(query, [
      result.market_id,
      result.backtest_period,
      result.start_date,
      result.end_date,
      result.total_predictions,
      result.total_settled,
      result.won,
      result.lost,
      result.void,
      result.hit_rate,
      result.roi,
      result.avg_confidence,
      result.avg_probability,
      result.calibration_error,
      JSON.stringify(result.calibration_curve),
      result.validation_passed,
      result.validation_notes,
    ]);

    logger.info(`[Backtest] Saved backtest result for ${result.market_id}`);
  } finally {
    client.release();
  }
}

/**
 * Export backtest service
 */
export const backtestService = {
  runBacktest,
  saveBacktestResult,
};
