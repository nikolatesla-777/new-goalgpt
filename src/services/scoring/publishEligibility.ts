/**
 * Publish Eligibility - canPublish() Function
 *
 * Determines if a prediction is eligible for publishing
 * Implements PUBLISH_POLICY.md rules
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { RiskFlag, hasBlockingFlags, riskFlagsUtils } from './riskFlags';
import type { ScoringResult, MarketId } from './marketScorer.service';
import { logger } from '../../utils/logger';
import marketRegistry from '../../config/market_registry.json';

/**
 * Publish eligibility result
 */
export interface PublishEligibilityResult {
  canPublish: boolean;
  reason: string;
  failedChecks: string[];
  passedChecks: string[];
}

/**
 * Determine if a scoring result is eligible for publish
 *
 * CRITICAL CHECKS (ALL must pass):
 * 1. Pick must be YES
 * 2. Confidence >= market.list_policy.min_confidence
 * 3. Probability >= market.list_policy.min_probability
 * 4. Edge > 0.00 (positive edge required)
 * 5. No blocking risk flags
 * 6. Market-specific thresholds (lambda, scoring prob, etc.)
 *
 * @param marketId - Market identifier
 * @param scoreResult - Scoring result from marketScorer.service.ts
 * @returns PublishEligibilityResult
 */
export function canPublish(
  marketId: MarketId,
  scoreResult: ScoringResult
): PublishEligibilityResult {
  const failedChecks: string[] = [];
  const passedChecks: string[] = [];

  // Get market definition
  const marketDef = (marketRegistry.markets as any)[marketId];
  if (!marketDef) {
    return {
      canPublish: false,
      reason: `Unknown market: ${marketId}`,
      failedChecks: ['UNKNOWN_MARKET'],
      passedChecks: [],
    };
  }

  const policy = marketDef.list_policy;

  // === CHECK 1: Pick must be YES ===
  if (scoreResult.pick !== 'YES') {
    failedChecks.push(`Pick is ${scoreResult.pick} (must be YES)`);
  } else {
    passedChecks.push('Pick is YES');
  }

  // === CHECK 2: Confidence threshold ===
  if (scoreResult.confidence < policy.min_confidence) {
    failedChecks.push(
      `Confidence ${scoreResult.confidence} < ${policy.min_confidence} (threshold)`
    );
  } else {
    passedChecks.push(`Confidence ${scoreResult.confidence} >= ${policy.min_confidence}`);
  }

  // === CHECK 3: Probability threshold ===
  if (scoreResult.probability < policy.min_probability) {
    failedChecks.push(
      `Probability ${scoreResult.probability.toFixed(4)} < ${policy.min_probability.toFixed(2)} (threshold)`
    );
  } else {
    passedChecks.push(
      `Probability ${scoreResult.probability.toFixed(2)} >= ${policy.min_probability.toFixed(2)}`
    );
  }

  // === CHECK 4: Edge (positive edge required) ===
  if (scoreResult.edge !== null) {
    if (scoreResult.edge <= 0.00) {
      failedChecks.push(`Edge ${scoreResult.edge.toFixed(4)} <= 0 (no value)`);
    } else {
      passedChecks.push(`Edge ${scoreResult.edge.toFixed(2)} > 0`);
    }
  } else {
    // Edge missing (no odds) - check if policy requires it
    if (policy.min_edge !== undefined && policy.min_edge > 0) {
      failedChecks.push('Edge is NULL (odds missing, required for publish)');
    } else {
      passedChecks.push('Edge is NULL (optional)');
    }
  }

  // === CHECK 5: Blocking risk flags ===
  if (hasBlockingFlags(scoreResult.risk_flags as RiskFlag[])) {
    const blockingFlags = scoreResult.risk_flags.filter((f: string) =>
      riskFlagsUtils.isBlockingFlag(f as RiskFlag)
    );
    failedChecks.push(`Blocking flags present: ${blockingFlags.join(', ')}`);
  } else {
    passedChecks.push('No blocking risk flags');
  }

  // === CHECK 6: Market-specific thresholds ===
  checkMarketSpecificThresholds(marketId, scoreResult, policy, failedChecks, passedChecks);

  // === FINAL VERDICT ===
  const canPublish = failedChecks.length === 0;

  let reason = '';
  if (canPublish) {
    reason = '✅ All checks passed - eligible for publish';
  } else {
    reason = `❌ Failed ${failedChecks.length} check(s): ${failedChecks[0]}`; // First failure as primary reason
  }

  logger.debug(`[PublishEligibility] ${marketId} - ${scoreResult.match_id}`, {
    canPublish,
    confidence: scoreResult.confidence,
    probability: scoreResult.probability,
    edge: scoreResult.edge,
    failedChecks,
  });

  return {
    canPublish,
    reason,
    failedChecks,
    passedChecks,
  };
}

/**
 * Check market-specific thresholds (lambda, scoring prob, etc.)
 */
function checkMarketSpecificThresholds(
  marketId: MarketId,
  scoreResult: ScoringResult,
  policy: any,
  failedChecks: string[],
  passedChecks: string[]
): void {
  switch (marketId) {
    case 'O25':
      // Lambda (xG total) >= 2.4
      if (policy.min_lambda_total !== undefined) {
        const lambda = scoreResult.metadata.lambda_total;
        if (lambda !== undefined) {
          if (lambda < policy.min_lambda_total) {
            failedChecks.push(
              `Lambda total ${lambda.toFixed(2)} < ${policy.min_lambda_total} (threshold)`
            );
          } else {
            passedChecks.push(`Lambda total ${lambda.toFixed(2)} >= ${policy.min_lambda_total}`);
          }
        } else {
          failedChecks.push('Lambda total missing (xG data unavailable)');
        }
      }
      break;

    case 'BTTS':
      // Home scoring prob >= 55%, Away scoring prob >= 55%
      if (policy.min_home_scoring_prob !== undefined && policy.min_away_scoring_prob !== undefined) {
        const homeProb = scoreResult.metadata.home_scoring_prob;
        const awayProb = scoreResult.metadata.away_scoring_prob;

        if (homeProb !== undefined && awayProb !== undefined) {
          let bttsCheckPassed = true;

          if (homeProb < policy.min_home_scoring_prob) {
            failedChecks.push(
              `Home scoring prob ${(homeProb * 100).toFixed(1)}% < ${(policy.min_home_scoring_prob * 100).toFixed(0)}% (threshold)`
            );
            bttsCheckPassed = false;
          }

          if (awayProb < policy.min_away_scoring_prob) {
            failedChecks.push(
              `Away scoring prob ${(awayProb * 100).toFixed(1)}% < ${(policy.min_away_scoring_prob * 100).toFixed(0)}% (threshold)`
            );
            bttsCheckPassed = false;
          }

          if (bttsCheckPassed) {
            passedChecks.push(
              `Both teams scoring prob >= ${(policy.min_home_scoring_prob * 100).toFixed(0)}% (home: ${(homeProb * 100).toFixed(1)}%, away: ${(awayProb * 100).toFixed(1)}%)`
            );
          }
        } else {
          failedChecks.push('Scoring probabilities missing (xG data unavailable)');
        }
      }
      break;

    case 'HT_O05':
      // Early goal proxy required
      if (policy.require_early_goal_proxy === true) {
        const hasEarlyGoalProxy = !scoreResult.risk_flags.includes('NO_EARLY_GOAL_PROXY');
        if (!hasEarlyGoalProxy) {
          failedChecks.push('Early goal proxy required but missing');
        } else {
          passedChecks.push('Early goal proxy available');
        }
      }
      break;

    case 'O35':
      // Lambda >= 3.1
      if (policy.min_lambda_total !== undefined) {
        const lambda = scoreResult.metadata.lambda_total;
        if (lambda !== undefined) {
          if (lambda < policy.min_lambda_total) {
            failedChecks.push(
              `Lambda total ${lambda.toFixed(2)} < ${policy.min_lambda_total} (threshold)`
            );
          } else {
            passedChecks.push(`Lambda total ${lambda.toFixed(2)} >= ${policy.min_lambda_total}`);
          }
        } else {
          failedChecks.push('Lambda total missing (xG data unavailable)');
        }
      }
      break;

    case 'HOME_O15':
      // Lambda home >= 1.45
      if (policy.min_lambda_home !== undefined) {
        const lambda = scoreResult.metadata.lambda_home;
        if (lambda !== undefined) {
          if (lambda < policy.min_lambda_home) {
            failedChecks.push(
              `Lambda home ${lambda.toFixed(2)} < ${policy.min_lambda_home} (threshold)`
            );
          } else {
            passedChecks.push(`Lambda home ${lambda.toFixed(2)} >= ${policy.min_lambda_home}`);
          }
        } else {
          failedChecks.push('Lambda home missing (xG data unavailable)');
        }
      }
      break;

    case 'CORNERS_O85':
      // Corners potential required
      if (policy.require_corners_potential === true) {
        const hasCornersPotential = !scoreResult.risk_flags.includes('MISSING_POTENTIAL_CORNERS');
        if (!hasCornersPotential) {
          failedChecks.push('Corners potential required but missing');
        } else {
          passedChecks.push('Corners potential available');
        }
      }
      break;

    case 'CARDS_O25':
      // Cards potential required
      if (policy.require_cards_potential === true) {
        const hasCardsPotential = !scoreResult.risk_flags.includes('MISSING_POTENTIAL_CARDS');
        if (!hasCardsPotential) {
          failedChecks.push('Cards potential required but missing');
        } else {
          passedChecks.push('Cards potential available');
        }
      }
      break;
  }
}

/**
 * Batch check: Filter publishable predictions from a list
 */
export function filterPublishable(
  marketId: MarketId,
  scoreResults: ScoringResult[]
): ScoringResult[] {
  return scoreResults.filter((result) => {
    const eligibility = canPublish(marketId, result);
    return eligibility.canPublish;
  });
}

/**
 * Get publish eligibility stats for a batch
 */
export function getPublishStats(
  marketId: MarketId,
  scoreResults: ScoringResult[]
): {
  total: number;
  publishable: number;
  rejected: number;
  rejectionReasons: Record<string, number>;
} {
  const total = scoreResults.length;
  let publishable = 0;
  const rejectionReasons: Record<string, number> = {};

  for (const result of scoreResults) {
    const eligibility = canPublish(marketId, result);

    if (eligibility.canPublish) {
      publishable++;
    } else {
      // Count rejection reasons
      for (const check of eligibility.failedChecks) {
        const reason = check.split('(')[0].trim(); // Extract reason before parentheses
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
      }
    }
  }

  return {
    total,
    publishable,
    rejected: total - publishable,
    rejectionReasons,
  };
}

/**
 * Export publish eligibility utils
 */
export const publishEligibilityUtils = {
  canPublish,
  filterPublishable,
  getPublishStats,
};
