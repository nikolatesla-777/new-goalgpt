/**
 * Market Scorer Service - Core Scoring Engine
 *
 * Generates pick/probability/confidence for all 7 markets
 * LLM NEVER picks - this service does all the scoring
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { logger } from '../../utils/logger';
import marketRegistry from '../../config/market_registry.json';
import {
  calculatePoissonProbability,
  calculateBTTSProbability,
  calculateEdge,
  calculateComponentVariance,
} from './componentEvaluators';

/**
 * Market definitions from registry
 */
export type MarketId = 'O25' | 'BTTS' | 'HT_O05' | 'O35' | 'HOME_O15' | 'CORNERS_O85' | 'CARDS_O25';

/**
 * FootyStats match data structure (subset)
 */
export interface FootyStatsMatch {
  id: number;
  externalId: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  matchTime: number;

  // xG data
  xg?: {
    home: number;
    away: number;
    total: number;
  };

  // Potentials (pre-calculated by FootyStats)
  potentials?: {
    over25?: number; // percentage (0-100)
    btts?: number;
    o05HT?: number;
    o15?: number;
    corners?: number;
    cards?: number;
  };

  // Odds
  odds?: {
    ft_1?: number; // home win
    ft_x?: number; // draw
    ft_2?: number; // away win
  };

  // Trends (last 5 matches)
  trends?: {
    home?: any[];
    away?: any[];
  };

  // H2H stats
  h2h?: {
    betting_stats?: {
      over25Percentage?: number;
      bttsPercentage?: number;
    };
    avg_goals?: number;
  };

  // Team form stats
  homeTeam?: {
    seasonOver25Percentage_home?: number;
    seasonBTTSPercentage_home?: number;
    seasonGoals_home?: number;
    seasonConcededAVG_home?: number;
    cornersAVG_home?: number;
    cardsAVG_home?: number;
  };

  awayTeam?: {
    seasonOver25Percentage_away?: number;
    seasonBTTSPercentage_away?: number;
    seasonGoals_away?: number;
    seasonConcededAVG_away?: number;
    cornersAVG_away?: number;
    cardsAVG_away?: number;
  };

  // League norms
  league?: {
    avg_goals?: number;
    over25_rate?: number;
    btts_rate?: number;
  };
}

/**
 * Component evaluation result
 */
export interface ComponentResult {
  name: string;
  weight: number;
  raw_value: number | null;
  weighted_contribution: number;
  is_available: boolean;
  data_source: string;
}

/**
 * Risk flags
 */
export type RiskFlag =
  | 'MISSING_XG'
  | 'MISSING_POTENTIALS'
  | 'MISSING_ODDS'
  | 'EXTREME_ODDS'
  | 'LOW_DATA_QUALITY'
  | 'HIGH_VARIANCE'
  | 'NO_REFEREE_DATA';

/**
 * Scoring metadata (for publish eligibility validation)
 */
export interface ScoringMetadata {
  lambda_total?: number; // xG total (for O25, O35)
  lambda_home?: number; // xG home (for HOME_O15)
  lambda_away?: number; // xG away
  home_scoring_prob?: number; // P(home scores) for BTTS
  away_scoring_prob?: number; // P(away scores) for BTTS
  implied_prob?: number; // Implied probability from odds
  corners_avg_total?: number; // Corners average total
  cards_avg_total?: number; // Cards average total
}

/**
 * Market scoring result
 */
export interface ScoringResult {
  match_id: string;
  fs_match_id: number;
  market_id: MarketId;
  market_name: string;

  // Core results
  probability: number; // 0.0000 - 1.0000
  confidence: number; // 0 - 100
  pick: 'YES' | 'NO';
  edge: number | null;

  // Transparency
  components: ComponentResult[];
  risk_flags: RiskFlag[];
  data_score: number;

  // Metadata (for publish eligibility validation)
  metadata: ScoringMetadata;

  // Timestamp
  scored_at: number;
}

/**
 * Calculate metadata for publish eligibility validation
 */
function calculateMetadata(
  marketId: MarketId,
  matchData: FootyStatsMatch
): ScoringMetadata {
  const metadata: ScoringMetadata = {};

  // Lambda values (xG)
  if (matchData.xg) {
    metadata.lambda_home = matchData.xg.home;
    metadata.lambda_away = matchData.xg.away;
    metadata.lambda_total = matchData.xg.total;
  }

  // Scoring probabilities (for BTTS validation)
  if (matchData.xg) {
    // P(team scores) = 1 - P(team = 0) = 1 - e^(-λ)
    metadata.home_scoring_prob = 1 - Math.exp(-matchData.xg.home);
    metadata.away_scoring_prob = 1 - Math.exp(-matchData.xg.away);
  }

  // Implied probability from odds (for edge validation)
  if (matchData.odds) {
    // Use home win odds as proxy for implied probability
    const homeOdds = matchData.odds.ft_1 || 2.0;
    metadata.implied_prob = 1 / homeOdds;
  }

  // Corners average total
  if (matchData.homeTeam?.cornersAVG_home && matchData.awayTeam?.cornersAVG_away) {
    metadata.corners_avg_total = matchData.homeTeam.cornersAVG_home + matchData.awayTeam.cornersAVG_away;
  }

  // Cards average total
  if (matchData.homeTeam?.cardsAVG_home && matchData.awayTeam?.cardsAVG_away) {
    metadata.cards_avg_total = matchData.homeTeam.cardsAVG_home + matchData.awayTeam.cardsAVG_away;
  }

  return metadata;
}

/**
 * Adapter: Convert ScoringFeatures to FootyStatsMatch format
 *
 * This allows the marketScorer to work with the canonical ScoringFeatures
 * contract from featureBuilder.service.ts
 */
import { ScoringFeatures } from '../../types/scoringFeatures';

export function adaptScoringFeaturesToFootyStats(features: ScoringFeatures): FootyStatsMatch {
  return {
    id: 0, // Not used in scoring calculations
    externalId: features.match_id,
    homeTeamId: parseInt(features.home_team.id) || 0,
    awayTeamId: parseInt(features.away_team.id) || 0,
    homeTeamName: features.home_team.name,
    awayTeamName: features.away_team.name,
    matchTime: features.kickoff_ts,

    // xG data
    xg: features.xg,

    // Potentials
    potentials: features.potentials ? {
      over25: features.potentials.over25,
      btts: features.potentials.btts,
      o05HT: features.potentials.over05_ht,
      o15: features.potentials.over15,
      corners: features.potentials.corners_over85,
      cards: features.potentials.cards_over25,
    } : undefined,

    // Odds
    odds: features.odds ? {
      ft_1: features.odds.home_win,
      ft_x: features.odds.draw,
      ft_2: features.odds.away_win,
    } : undefined,

    // Trends (pass through form data if available)
    trends: features.form ? {
      home: features.form.home || [],
      away: features.form.away || [],
    } : undefined,

    // H2H stats
    h2h: features.h2h,

    // Team form stats (extract from form if available)
    homeTeam: features.form?.home ? {
      cornersAVG_home: features.corners?.home,
      cardsAVG_home: features.cards?.home,
    } : undefined,

    awayTeam: features.form?.away ? {
      cornersAVG_away: features.corners?.away,
      cardsAVG_away: features.cards?.away,
    } : undefined,

    // League norms
    league: features.league_stats,
  };
}

/**
 * Score a single market for a match
 */
export async function scoreMarket(
  marketId: MarketId,
  matchData: FootyStatsMatch
): Promise<ScoringResult> {
  const startTime = Date.now();
  logger.debug(`[MarketScorer] Scoring ${marketId} for match ${matchData.externalId}`);

  // Get market definition
  const marketDef = (marketRegistry.markets as any)[marketId];
  if (!marketDef) {
    throw new Error(`Unknown market: ${marketId}`);
  }

  // Step 1: Evaluate all components
  const components = await evaluateComponents(marketId, matchData, marketDef);

  // Step 2: Calculate weighted probability
  const probability = calculateWeightedProbability(components, marketDef);

  // Step 3: Apply adjustments
  const adjustedProbability = applyAdjustments(probability, matchData, marketDef);

  // Step 4: Calculate confidence score
  const { confidence, dataScore, riskFlags } = calculateConfidenceScore(
    components,
    matchData,
    marketDef,
    adjustedProbability
  );

  // Step 5: Calculate edge (if odds available)
  const edge = matchData.odds ? calculateEdge(adjustedProbability, matchData.odds) : null;

  // Step 6: Determine pick
  const pick = determinePick(adjustedProbability, confidence, edge, marketDef);

  // Step 7: Calculate metadata for publish eligibility validation
  const metadata = calculateMetadata(marketId, matchData);

  const duration = Date.now() - startTime;
  logger.debug(`[MarketScorer] ${marketId} scored in ${duration}ms: prob=${adjustedProbability.toFixed(4)}, conf=${confidence}, pick=${pick}`);

  return {
    match_id: matchData.externalId,
    fs_match_id: matchData.id,
    market_id: marketId,
    market_name: marketDef.display_name_tr,
    probability: adjustedProbability,
    confidence,
    pick,
    edge,
    components,
    risk_flags: riskFlags,
    data_score: dataScore,
    metadata,
    scored_at: Date.now(),
  };
}

/**
 * Score all 7 markets for a match
 */
export async function scoreAllMarkets(matchData: FootyStatsMatch): Promise<ScoringResult[]> {
  const markets: MarketId[] = ['O25', 'BTTS', 'HT_O05', 'O35', 'HOME_O15', 'CORNERS_O85', 'CARDS_O25'];

  const results = await Promise.all(
    markets.map((marketId) => scoreMarket(marketId, matchData))
  );

  return results;
}

/**
 * Evaluate all probability components for a market
 */
async function evaluateComponents(
  marketId: MarketId,
  matchData: FootyStatsMatch,
  marketDef: any
): Promise<ComponentResult[]> {
  const components: ComponentResult[] = [];
  const formula = marketDef.probability_formula;

  for (const compDef of formula.components) {
    const result = await evaluateComponent(compDef, matchData, marketId);
    components.push(result);
  }

  return components;
}

/**
 * Evaluate a single component
 */
async function evaluateComponent(
  compDef: any,
  matchData: FootyStatsMatch,
  marketId: MarketId
): Promise<ComponentResult> {
  const { name, weight, data_source, method, params, transform } = compDef;

  let raw_value: number | null = null;
  let is_available = false;

  try {
    // Extract data based on component type
    switch (name) {
      case 'prior_probability':
        raw_value = extractPriorProbability(matchData, marketId);
        is_available = raw_value !== null;
        if (is_available && transform === 'percentage_to_decimal') {
          raw_value = raw_value! / 100;
        }
        break;

      case 'poisson_distribution':
      case 'poisson_halftime':
      case 'poisson_home_goals':
      case 'poisson_corners':
      case 'poisson_cards':
        raw_value = calculatePoissonComponent(matchData, params, name);
        is_available = raw_value !== null;
        break;

      case 'independent_poisson':
        raw_value = calculateBTTSComponent(matchData);
        is_available = raw_value !== null;
        break;

      case 'form_adjustment':
        raw_value = calculateFormAdjustment(matchData, marketId, params);
        is_available = raw_value !== null;
        break;

      case 'btts_correlation':
        raw_value = calculateBTTSCorrelation(matchData, params);
        is_available = raw_value !== null;
        break;

      case 'h2h_btts':
        raw_value = matchData.h2h?.betting_stats?.bttsPercentage ?? null;
        is_available = raw_value !== null;
        if (is_available && transform === 'percentage_to_decimal') {
          raw_value = raw_value! / 100;
        }
        break;

      default:
        logger.warn(`[MarketScorer] Unknown component: ${name}`);
    }

    // Calculate weighted contribution
    const weighted_contribution = is_available && raw_value !== null
      ? raw_value * weight
      : 0;

    return {
      name,
      weight,
      raw_value,
      weighted_contribution,
      is_available,
      data_source,
    };
  } catch (error: any) {
    logger.error(`[MarketScorer] Error evaluating component ${name}:`, error);
    return {
      name,
      weight,
      raw_value: null,
      weighted_contribution: 0,
      is_available: false,
      data_source,
    };
  }
}

/**
 * Extract prior probability from FootyStats potentials
 */
function extractPriorProbability(matchData: FootyStatsMatch, marketId: MarketId): number | null {
  if (!matchData.potentials) return null;

  switch (marketId) {
    case 'O25':
      return matchData.potentials.over25 ?? null;
    case 'BTTS':
      return matchData.potentials.btts ?? null;
    case 'HT_O05':
      return matchData.potentials.o05HT ?? null;
    case 'O35':
      // Derive from O25 with penalty
      return matchData.potentials.over25 ? matchData.potentials.over25 - 20 : null;
    case 'HOME_O15':
      return matchData.potentials.o15 ?? null;
    case 'CORNERS_O85':
      return matchData.potentials.corners ?? null;
    case 'CARDS_O25':
      return matchData.potentials.cards ?? null;
    default:
      return null;
  }
}

/**
 * Calculate Poisson-based component
 */
function calculatePoissonComponent(
  matchData: FootyStatsMatch,
  params: any,
  componentName: string
): number | null {
  if (!matchData.xg) return null;

  const { threshold } = params;
  let lambda = 0;

  // Calculate lambda based on component type
  if (componentName.includes('halftime')) {
    // Half-time: use 45% of full-time xG
    lambda = (matchData.xg.home * 0.45) + (matchData.xg.away * 0.45);
  } else if (componentName.includes('home_goals')) {
    // Home team only
    lambda = matchData.xg.home;
  } else if (componentName.includes('corners')) {
    // Corners: use team corner averages
    const homeCorners = matchData.homeTeam?.cornersAVG_home ?? 0;
    const awayCorners = matchData.awayTeam?.cornersAVG_away ?? 0;
    if (homeCorners === 0 && awayCorners === 0) return null;
    lambda = homeCorners + awayCorners;
  } else if (componentName.includes('cards')) {
    // Cards: use team card averages
    const homeCards = matchData.homeTeam?.cardsAVG_home ?? 0;
    const awayCards = matchData.awayTeam?.cardsAVG_away ?? 0;
    if (homeCards === 0 && awayCards === 0) return null;
    lambda = homeCards + awayCards;
  } else {
    // Standard: total xG
    lambda = matchData.xg.total;
  }

  return calculatePoissonProbability(lambda, threshold);
}

/**
 * Calculate BTTS component (independent probability)
 */
function calculateBTTSComponent(matchData: FootyStatsMatch): number | null {
  if (!matchData.xg) return null;
  return calculateBTTSProbability(matchData.xg.home, matchData.xg.away);
}

/**
 * Calculate form adjustment component
 */
function calculateFormAdjustment(
  matchData: FootyStatsMatch,
  marketId: MarketId,
  params: any
): number | null {
  // TODO: Implement trend-based form calculation
  // For now, return null (will be implemented in componentEvaluators.ts)
  return null;
}

/**
 * Calculate BTTS correlation bonus
 */
function calculateBTTSCorrelation(matchData: FootyStatsMatch, params: any): number | null {
  const bttsPotential = matchData.potentials?.btts;
  if (!bttsPotential) return null;

  const { correlation_threshold } = params;
  if (bttsPotential >= correlation_threshold) {
    // High BTTS = bonus for Over 2.5
    return 0.05; // 5% bonus
  }

  return 0;
}

/**
 * Calculate weighted probability from components
 */
function calculateWeightedProbability(components: ComponentResult[], marketDef: any): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const comp of components) {
    if (comp.is_available) {
      weightedSum += comp.weighted_contribution;
      totalWeight += comp.weight;
    }
  }

  // Normalize by available weights
  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

/**
 * Apply market-specific adjustments
 */
function applyAdjustments(
  probability: number,
  matchData: FootyStatsMatch,
  marketDef: any
): number {
  let adjusted = probability;

  const adjustments = marketDef.probability_formula.adjustments || [];

  for (const adj of adjustments) {
    const shouldApply = evaluateCondition(adj.condition, matchData);
    if (shouldApply) {
      adjusted += adj.modifier;
      logger.debug(`[MarketScorer] Applied adjustment: ${adj.name} (${adj.modifier})`);
    }
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, adjusted));
}

/**
 * Evaluate adjustment condition
 */
function evaluateCondition(condition: string, matchData: FootyStatsMatch): boolean {
  // Parse simple conditions like "league.avg_goals < 2.3"
  if (condition.includes('league.avg_goals < ')) {
    const threshold = parseFloat(condition.split('< ')[1]);
    return (matchData.league?.avg_goals ?? 999) < threshold;
  }

  if (condition.includes('league.avg_goals > ')) {
    const threshold = parseFloat(condition.split('> ')[1]);
    return (matchData.league?.avg_goals ?? 0) > threshold;
  }

  if (condition.includes('total_xg < ')) {
    const threshold = parseFloat(condition.split('< ')[1]);
    return (matchData.xg?.total ?? 999) < threshold;
  }

  if (condition.includes('total_xg > ')) {
    const threshold = parseFloat(condition.split('> ')[1]);
    return (matchData.xg?.total ?? 0) > threshold;
  }

  // Add more condition parsers as needed
  return false;
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidenceScore(
  components: ComponentResult[],
  matchData: FootyStatsMatch,
  marketDef: any,
  probability: number
): { confidence: number; dataScore: number; riskFlags: RiskFlag[] } {
  const rules = marketDef.confidence_rules;
  let score = 0;
  const riskFlags: RiskFlag[] = [];

  // Factor 1: Data completeness (30%)
  const availableCount = components.filter((c) => c.is_available).length;
  const totalCount = components.length;
  const completeness = availableCount / totalCount;
  score += completeness * 30;

  const dataScore = Math.round(completeness * 100);

  // Factor 2: Prediction consensus (30%) - low variance = high confidence
  const variance = calculateComponentVariance(components);
  if (variance < 0.15) {
    score += 30;
  } else if (variance < 0.25) {
    score += 20;
  } else {
    score += 10;
    riskFlags.push('HIGH_VARIANCE');
  }

  // Factor 3: Value edge (25%)
  if (matchData.odds) {
    const edge = calculateEdge(probability, matchData.odds);
    if (edge > 0.05) {
      score += 25;
    } else if (edge > 0.0) {
      score += 15;
    }
  } else {
    riskFlags.push('MISSING_ODDS');
  }

  // Factor 4: Penalty flags (15%)
  let penaltyScore = 15;

  if (!matchData.xg) {
    penaltyScore -= 20;
    riskFlags.push('MISSING_XG');
  }

  if (!matchData.potentials) {
    penaltyScore -= 15;
    riskFlags.push('MISSING_POTENTIALS');
  }

  if (matchData.odds) {
    const minOdds = Math.min(matchData.odds.ft_1 ?? 999, matchData.odds.ft_x ?? 999, matchData.odds.ft_2 ?? 999);
    if (minOdds < 1.10) {
      penaltyScore -= 10;
      riskFlags.push('EXTREME_ODDS');
    }
  }

  score += Math.max(0, penaltyScore);

  // Clamp to [0, 100]
  const confidence = Math.max(0, Math.min(100, Math.round(score)));

  return { confidence, dataScore, riskFlags };
}

/**
 * Determine pick (YES/NO) based on thresholds
 */
function determinePick(
  probability: number,
  confidence: number,
  edge: number | null,
  marketDef: any
): 'YES' | 'NO' {
  const policy = marketDef.list_policy;

  // Check all thresholds
  const meetsConfidence = confidence >= policy.min_confidence;
  const meetsProbability = probability >= policy.min_probability;
  const meetsEdge = edge === null || edge >= policy.min_edge;

  return meetsConfidence && meetsProbability && meetsEdge ? 'YES' : 'NO';
}

/**
 * Export market scorer service
 */
export const marketScorerService = {
  scoreMarket,
  scoreAllMarkets,
  adaptScoringFeaturesToFootyStats,
};
