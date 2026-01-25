/**
 * PHASE-2A: Settlement Rule Engine
 *
 * Purpose: Centralized, rule-based settlement evaluation
 *
 * GUARANTEES:
 * 1. Never guess outcomes - if data missing, mark VOID
 * 2. Explicit rules for each market type
 * 3. All evaluations logged with rule used
 *
 * Supported Markets:
 * - BTTS_YES: Both teams scored
 * - O25_OVER: Total goals >= 3
 * - O15_OVER: Total goals >= 2
 * - HT_O05_OVER: Half-time goals >= 1 (VOID if HT data missing)
 */

import { logger } from '../../../utils/logger';
import { SupportedMarketType } from '../validators/pickValidator';

/**
 * Settlement outcome
 */
export type SettlementOutcome = 'WON' | 'LOST' | 'VOID';

/**
 * Settlement result
 */
export interface SettlementResult {
  outcome: SettlementOutcome;
  rule: string;
  reason?: string;
  data: Record<string, any>;
}

/**
 * Match score data required for settlement
 */
export interface MatchScoreData {
  home_score: number;
  away_score: number;
  ht_home_score?: number | null;
  ht_away_score?: number | null;
}

/**
 * PHASE-2A: Evaluate BTTS (Both Teams To Score)
 *
 * RULE: Both home and away team must have scored at least 1 goal
 * WIN: home_score > 0 AND away_score > 0
 * LOSE: home_score == 0 OR away_score == 0
 * VOID: Never (full-time score is always available for finished matches)
 */
function evaluateBTTS(scores: MatchScoreData): SettlementResult {
  const { home_score, away_score } = scores;

  // SAFETY GUARD: Validate score data
  if (home_score < 0 || away_score < 0) {
    logger.warn('[SettlementRules] ⚠️ Invalid scores for BTTS (negative)', scores);
    return {
      outcome: 'VOID',
      rule: 'BTTS: Invalid negative scores',
      reason: 'Invalid score data',
      data: scores,
    };
  }

  const won = home_score > 0 && away_score > 0;

  logger.info(`[SettlementRules] BTTS evaluation: ${won ? 'WON' : 'LOST'}`, {
    home_score,
    away_score,
    outcome: won ? 'WON' : 'LOST',
  });

  return {
    outcome: won ? 'WON' : 'LOST',
    rule: `BTTS: Both teams score (home: ${home_score}, away: ${away_score})`,
    data: { home_score, away_score },
  };
}

/**
 * PHASE-2A: Evaluate O2.5 (Over 2.5 Goals)
 *
 * RULE: Total goals must be 3 or more
 * WIN: total >= 3
 * LOSE: total < 3
 * VOID: Never (full-time score is always available)
 */
function evaluateOver25(scores: MatchScoreData): SettlementResult {
  const { home_score, away_score } = scores;

  // SAFETY GUARD: Validate score data
  if (home_score < 0 || away_score < 0) {
    logger.warn('[SettlementRules] ⚠️ Invalid scores for O2.5 (negative)', scores);
    return {
      outcome: 'VOID',
      rule: 'O2.5: Invalid negative scores',
      reason: 'Invalid score data',
      data: scores,
    };
  }

  const total = home_score + away_score;
  const won = total >= 3;

  logger.info(`[SettlementRules] O2.5 evaluation: ${won ? 'WON' : 'LOST'}`, {
    home_score,
    away_score,
    total_goals: total,
    outcome: won ? 'WON' : 'LOST',
  });

  return {
    outcome: won ? 'WON' : 'LOST',
    rule: `O2.5: Total goals >= 3 (total: ${total})`,
    data: { home_score, away_score, total_goals: total },
  };
}

/**
 * PHASE-2A: Evaluate O1.5 (Over 1.5 Goals)
 *
 * RULE: Total goals must be 2 or more
 * WIN: total >= 2
 * LOSE: total < 2
 * VOID: Never (full-time score is always available)
 */
function evaluateOver15(scores: MatchScoreData): SettlementResult {
  const { home_score, away_score } = scores;

  // SAFETY GUARD: Validate score data
  if (home_score < 0 || away_score < 0) {
    logger.warn('[SettlementRules] ⚠️ Invalid scores for O1.5 (negative)', scores);
    return {
      outcome: 'VOID',
      rule: 'O1.5: Invalid negative scores',
      reason: 'Invalid score data',
      data: scores,
    };
  }

  const total = home_score + away_score;
  const won = total >= 2;

  logger.info(`[SettlementRules] O1.5 evaluation: ${won ? 'WON' : 'LOST'}`, {
    home_score,
    away_score,
    total_goals: total,
    outcome: won ? 'WON' : 'LOST',
  });

  return {
    outcome: won ? 'WON' : 'LOST',
    rule: `O1.5: Total goals >= 2 (total: ${total})`,
    data: { home_score, away_score, total_goals: total },
  };
}

/**
 * PHASE-2A: Evaluate HT O0.5 (Half-Time Over 0.5 Goals)
 *
 * RULE: Half-time total goals must be 1 or more
 * WIN: ht_total >= 1
 * LOSE: ht_total == 0
 * VOID: If half-time data is missing (null, undefined, NaN)
 *
 * SAFETY GUARD: CRITICAL - Do NOT guess. If HT data missing, VOID.
 */
function evaluateHTOver05(scores: MatchScoreData): SettlementResult {
  const { ht_home_score, ht_away_score } = scores;

  // SAFETY GUARD: Check if HT data exists
  if (
    ht_home_score === null ||
    ht_home_score === undefined ||
    ht_away_score === null ||
    ht_away_score === undefined ||
    isNaN(ht_home_score) ||
    isNaN(ht_away_score)
  ) {
    logger.warn('[SettlementRules] ⚠️ HT data missing - marking VOID', scores);
    return {
      outcome: 'VOID',
      rule: 'HT O0.5: Half-time data missing',
      reason: 'HT_DATA_MISSING',
      data: scores,
    };
  }

  // SAFETY GUARD: Validate HT scores
  if (ht_home_score < 0 || ht_away_score < 0) {
    logger.warn('[SettlementRules] ⚠️ Invalid HT scores (negative)', scores);
    return {
      outcome: 'VOID',
      rule: 'HT O0.5: Invalid negative HT scores',
      reason: 'Invalid HT score data',
      data: scores,
    };
  }

  const htTotal = ht_home_score + ht_away_score;
  const won = htTotal >= 1;

  logger.info(`[SettlementRules] HT O0.5 evaluation: ${won ? 'WON' : 'LOST'}`, {
    ht_home_score,
    ht_away_score,
    ht_total_goals: htTotal,
    outcome: won ? 'WON' : 'LOST',
  });

  return {
    outcome: won ? 'WON' : 'LOST',
    rule: `HT O0.5: HT total goals >= 1 (HT total: ${htTotal})`,
    data: {
      ht_home_score,
      ht_away_score,
      ht_total_goals: htTotal,
    },
  };
}

/**
 * PHASE-2A: Main settlement evaluator
 *
 * @param marketType - Market type to evaluate
 * @param scores - Match score data
 * @param pickId - Pick ID (for logging)
 * @returns Settlement result
 */
export function evaluateSettlement(
  marketType: SupportedMarketType,
  scores: MatchScoreData,
  pickId?: string
): SettlementResult {
  const logContext = {
    pick_id: pickId,
    market_type: marketType,
  };

  logger.info('[SettlementRules] 🎯 Evaluating settlement', logContext);

  // Route to appropriate rule
  let result: SettlementResult;

  switch (marketType) {
    case 'BTTS_YES':
      result = evaluateBTTS(scores);
      break;

    case 'O25_OVER':
      result = evaluateOver25(scores);
      break;

    case 'O15_OVER':
      result = evaluateOver15(scores);
      break;

    case 'HT_O05_OVER':
      result = evaluateHTOver05(scores);
      break;

    default:
      // SAFETY GUARD: Unknown market type
      logger.error('[SettlementRules] ❌ Unknown market type', {
        ...logContext,
        market_type: marketType,
      });
      return {
        outcome: 'VOID',
        rule: `Unknown market type: ${marketType}`,
        reason: 'UNKNOWN_MARKET',
        data: {},
      };
  }

  logger.info('[SettlementRules] ✅ Settlement evaluated', {
    ...logContext,
    outcome: result.outcome,
    rule: result.rule,
  });

  return result;
}

/**
 * PHASE-2A: Convert settlement outcome to pick status
 */
export function outcomeToStatus(outcome: SettlementOutcome): 'won' | 'lost' | 'void' {
  return outcome.toLowerCase() as 'won' | 'lost' | 'void';
}
