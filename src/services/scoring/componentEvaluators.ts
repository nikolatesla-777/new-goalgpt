/**
 * Component Evaluators - Mathematical Functions
 *
 * Implements Poisson probability, BTTS calculation, edge calculation, etc.
 * Core mathematical functions for market scoring
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import type { ComponentResult } from './marketScorer.service';

/**
 * Calculate factorial (for Poisson distribution)
 * Uses iterative approach to avoid stack overflow
 */
export function factorial(n: number): number {
  if (n === 0 || n === 1) return 1;

  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}

/**
 * Calculate Poisson probability P(X >= k)
 *
 * Formula: P(X >= k) = 1 - P(X <= k-1) = 1 - Σ(i=0 to k-1) [λ^i * e^(-λ) / i!]
 *
 * @param lambda - Expected value (xG total, corners avg, etc.)
 * @param threshold - Threshold value (e.g., 2.5 for Over 2.5)
 * @returns Probability that X >= threshold
 *
 * @example
 * calculatePoissonProbability(2.85, 2.5) // P(goals >= 3) with λ=2.85
 * // Returns: 0.608 (60.8%)
 */
export function calculatePoissonProbability(lambda: number, threshold: number): number {
  if (lambda <= 0) return 0;

  // Calculate cumulative probability P(X <= k-1)
  let cumulative = 0;
  const k = Math.floor(threshold); // For 2.5, k=2; for 0.5, k=0

  for (let i = 0; i <= k; i++) {
    // P(X = i) = λ^i * e^(-λ) / i!
    const probability = Math.pow(lambda, i) * Math.exp(-lambda) / factorial(i);
    cumulative += probability;
  }

  // P(X >= k+1) = 1 - P(X <= k)
  return 1 - cumulative;
}

/**
 * Calculate BTTS (Both Teams To Score) probability using independent events
 *
 * Formula: P(BTTS) = P(Home scores) × P(Away scores)
 * Where: P(Team scores) = 1 - P(Team = 0) = 1 - e^(-λ)
 *
 * @param lambdaHome - Home team xG
 * @param lambdaAway - Away team xG
 * @returns Probability that both teams score
 *
 * @example
 * calculateBTTSProbability(1.65, 1.20)
 * // P(Home scores) = 1 - e^(-1.65) = 0.8088
 * // P(Away scores) = 1 - e^(-1.20) = 0.6988
 * // P(BTTS) = 0.8088 × 0.6988 = 0.5651 (56.51%)
 */
export function calculateBTTSProbability(lambdaHome: number, lambdaAway: number): number {
  if (lambdaHome <= 0 || lambdaAway <= 0) return 0;

  // P(Team scores at least 1) = 1 - P(Team scores 0)
  const probHomeScores = 1 - Math.exp(-lambdaHome);
  const probAwayScores = 1 - Math.exp(-lambdaAway);

  // Independent events: multiply probabilities
  return probHomeScores * probAwayScores;
}

/**
 * Calculate expected value (edge) vs betting odds
 *
 * Formula: Edge = (Probability × Odds) - 1
 *
 * Positive edge = value bet (our probability is higher than market)
 * Negative edge = no value (our probability is lower than market)
 *
 * @param probability - Our calculated probability (0-1)
 * @param odds - Betting odds object
 * @returns Edge value (0.05 = 5% edge)
 *
 * @example
 * calculateEdge(0.65, { ft_1: 1.85, ft_x: 3.40, ft_2: 4.50 })
 * // Implied market prob: 1/1.85 = 0.5405
 * // Our probability: 0.65
 * // Edge: (0.65 × 1.85) - 1 = 0.2025 (20.25% edge)
 */
export function calculateEdge(probability: number, odds: any): number {
  // For Over/BTTS markets, we need implied odds
  // For simplicity, assume fair odds with 5% margin
  // Implied probability = 1 / odds

  // Use home win odds as proxy (will be replaced with actual market odds when available)
  const impliedOdds = odds.ft_1 || 2.0; // Default to 2.0 if missing

  const expectedValue = probability * impliedOdds;
  return expectedValue - 1;
}

/**
 * Calculate component variance (measures prediction consensus)
 *
 * Low variance = all components agree = high confidence
 * High variance = components disagree = low confidence
 *
 * Formula: Variance = Σ(component_prob - mean_prob)² / n
 *
 * @param components - Array of component results
 * @returns Variance value (0.0 - 1.0)
 *
 * @example
 * // All components agree: variance ≈ 0
 * calculateComponentVariance([
 *   { raw_value: 0.65, is_available: true },
 *   { raw_value: 0.68, is_available: true },
 *   { raw_value: 0.67, is_available: true },
 * ]) // Returns: 0.0002 (very low variance)
 *
 * // Components disagree: variance > 0.15
 * calculateComponentVariance([
 *   { raw_value: 0.45, is_available: true },
 *   { raw_value: 0.75, is_available: true },
 *   { raw_value: 0.60, is_available: true },
 * ]) // Returns: 0.015 (high variance)
 */
export function calculateComponentVariance(components: ComponentResult[]): number {
  // Filter available components with non-null values
  const available = components.filter((c) => c.is_available && c.raw_value !== null);

  if (available.length === 0) return 1.0; // Max variance if no data

  // Calculate mean
  const sum = available.reduce((acc, c) => acc + (c.raw_value || 0), 0);
  const mean = sum / available.length;

  // Calculate variance
  const squaredDiffs = available.map((c) => {
    const diff = (c.raw_value || 0) - mean;
    return diff * diff;
  });

  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / available.length;

  return variance;
}

/**
 * Calculate form-based adjustment (trend analysis)
 *
 * Analyzes last N matches to determine recent form rate for a market
 *
 * @param trends - Match trends data (last 5 matches)
 * @param marketId - Market to analyze
 * @returns Probability adjustment based on form (0.0 - 1.0)
 *
 * @example
 * calculateFormRate(trends, 'O25')
 * // If last 5 matches: 4/5 had Over 2.5
 * // Returns: 0.80 (80%)
 */
export function calculateFormRate(
  trends: any[] | undefined,
  marketId: string
): number | null {
  if (!trends || trends.length === 0) return null;

  let successCount = 0;
  let totalMatches = 0;

  for (const match of trends) {
    if (!match) continue;
    totalMatches++;

    // Check if market condition was met
    switch (marketId) {
      case 'O25':
        if ((match.home_goals || 0) + (match.away_goals || 0) >= 3) {
          successCount++;
        }
        break;

      case 'BTTS':
        if ((match.home_goals || 0) > 0 && (match.away_goals || 0) > 0) {
          successCount++;
        }
        break;

      case 'O35':
        if ((match.home_goals || 0) + (match.away_goals || 0) >= 4) {
          successCount++;
        }
        break;

      case 'HT_O05':
        if ((match.ht_home_goals || 0) + (match.ht_away_goals || 0) >= 1) {
          successCount++;
        }
        break;

      case 'HOME_O15':
        if ((match.home_goals || 0) >= 2) {
          successCount++;
        }
        break;

      case 'CORNERS_O85':
        if ((match.home_corners || 0) + (match.away_corners || 0) >= 9) {
          successCount++;
        }
        break;

      case 'CARDS_O25':
        if ((match.home_cards || 0) + (match.away_cards || 0) >= 3) {
          successCount++;
        }
        break;
    }
  }

  if (totalMatches === 0) return null;

  return successCount / totalMatches;
}

/**
 * Calculate team attacking tempo indicator
 *
 * Uses avg_potential and xG to determine if team plays fast/slow
 *
 * @param avgPotential - Average potential from FootyStats
 * @param xgTotal - Total xG
 * @returns Tempo score (0.0 - 1.0)
 */
export function calculateTempoIndicator(
  avgPotential: number | undefined,
  xgTotal: number | undefined
): number | null {
  if (!avgPotential || !xgTotal) return null;

  // Normalize: avgPotential (0-100) + xG weight
  const tempoScore = (avgPotential / 100) * 0.6 + (Math.min(xgTotal / 4, 1)) * 0.4;

  return Math.min(1, Math.max(0, tempoScore));
}

/**
 * Calculate H2H average goals proxy for Over 3.5
 *
 * If H2H average >= 3.5, gives positive signal
 *
 * @param h2hAvgGoals - Average goals from H2H matches
 * @param threshold - Threshold to compare (3.5)
 * @returns Proxy probability (0.0 - 1.0)
 */
export function calculateH2HAvgGoalsProxy(
  h2hAvgGoals: number | undefined,
  threshold: number
): number | null {
  if (!h2hAvgGoals) return null;

  // Simple linear mapping
  if (h2hAvgGoals >= threshold + 0.5) return 0.70; // Strong signal
  if (h2hAvgGoals >= threshold) return 0.55; // Moderate signal
  if (h2hAvgGoals >= threshold - 0.5) return 0.45; // Weak signal
  return 0.30; // Negative signal
}

/**
 * Calculate home scoring rate from team form
 *
 * @param homeGoalsAvg - Home team's average goals at home
 * @param threshold - Threshold to compare (1.5)
 * @returns Probability (0.0 - 1.0)
 */
export function calculateHomeScoringRate(
  homeGoalsAvg: number | undefined,
  threshold: number
): number | null {
  if (!homeGoalsAvg) return null;

  // Use Poisson with team's average as lambda
  return calculatePoissonProbability(homeGoalsAvg, threshold);
}

/**
 * Calculate odds-to-probability correlation
 *
 * Lower home win odds = stronger home team = higher chance of home scoring
 *
 * @param homeWinOdds - Home win odds (ft_1)
 * @returns Correlation score (0.0 - 1.0)
 */
export function calculateOddsToProbabilityCorrelation(
  homeWinOdds: number | undefined
): number | null {
  if (!homeWinOdds || homeWinOdds < 1.01) return null;

  // Implied probability from odds
  const impliedProb = 1 / homeWinOdds;

  // Correlation: higher home win prob = higher home scoring prob
  return Math.min(1, impliedProb * 1.2); // 20% boost
}

/**
 * Calculate attacking correlation for corners
 *
 * Higher attacking potential = more corners
 *
 * @param avgPotential - Average attacking potential
 * @returns Correlation score (0.0 - 1.0)
 */
export function calculateAttackingCorrelation(
  avgPotential: number | undefined
): number | null {
  if (!avgPotential) return null;

  // Normalize to 0-1 range
  return Math.min(1, avgPotential / 100);
}

/**
 * Calculate match intensity proxy (for cards)
 *
 * Higher xG differential = more intense = more cards
 *
 * @param xgHome - Home xG
 * @param xgAway - Away xG
 * @returns Intensity score (0.0 - 1.0)
 */
export function calculateIntensityProxy(
  xgHome: number | undefined,
  xgAway: number | undefined
): number | null {
  if (!xgHome || !xgAway) return null;

  // Calculate differential and total
  const differential = Math.abs(xgHome - xgAway);
  const total = xgHome + xgAway;

  // Close match with high xG = high intensity
  const intensityScore = (total / 4) * (1 - differential / total);

  return Math.min(1, Math.max(0, intensityScore));
}
