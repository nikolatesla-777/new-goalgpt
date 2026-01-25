/**
 * PHASE-2A: Pick Validator
 *
 * Purpose: Validate picks before saving to database
 *
 * Rules:
 * 1. Market type must be supported
 * 2. Odds must be present (if required)
 * 3. No duplicate picks for same post
 */

import { logger } from '../../../utils/logger';

/**
 * PHASE-2A: Supported market types
 * Only these markets can be published and settled
 */
export const SUPPORTED_MARKETS = [
  'BTTS_YES',      // Both Teams To Score
  'O25_OVER',      // Over 2.5 Goals
  'O15_OVER',      // Over 1.5 Goals
  'HT_O05_OVER',   // Half-Time Over 0.5 Goals
] as const;

export type SupportedMarketType = typeof SUPPORTED_MARKETS[number];

export interface Pick {
  market_type: string;
  odds?: number | null;
}

export interface PickValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
  invalidPicks?: string[];
}

/**
 * PHASE-2A: Validate market type
 *
 * @param marketType - Market type string (e.g., 'BTTS_YES')
 * @returns true if supported
 */
export function isSupportedMarket(marketType: string): boolean {
  return SUPPORTED_MARKETS.includes(marketType as SupportedMarketType);
}

/**
 * PHASE-2A: Validate all picks before saving
 *
 * @param picks - Array of picks to validate
 * @param postId - Post ID (for logging)
 * @returns Validation result
 */
export function validatePicks(picks: Pick[], postId?: string): PickValidationResult {
  // RULE 1: At least one pick required
  if (!picks || picks.length === 0) {
    const logContext = { post_id: postId, picks_count: 0 };
    logger.warn('[PickValidator] ❌ No picks provided', logContext);
    return {
      valid: false,
      error: 'At least one pick is required',
      errorCode: 'NO_PICKS',
    };
  }

  const logContext = { post_id: postId, picks_count: picks.length };
  const invalidPicks: string[] = [];

  // RULE 2: Validate each pick
  for (const pick of picks) {
    // Check market type
    if (!pick.market_type) {
      invalidPicks.push('Missing market_type');
      continue;
    }

    if (!isSupportedMarket(pick.market_type)) {
      invalidPicks.push(`Unsupported market: ${pick.market_type}`);
      logger.warn('[PickValidator] ❌ Unsupported market type', {
        ...logContext,
        market_type: pick.market_type,
        supported_markets: SUPPORTED_MARKETS,
      });
    }

    // RULE 2B: Validate odds (OPTIONAL but must be valid if provided)
    // Odds are displayed in Telegram messages as @1.85
    // If provided, must be numeric and within reasonable range
    if (pick.odds !== null && pick.odds !== undefined) {
      const odds = pick.odds;

      // Check if numeric
      if (typeof odds !== 'number' || isNaN(odds)) {
        invalidPicks.push(`Invalid odds for ${pick.market_type}: not a number`);
        logger.warn('[PickValidator] ❌ Invalid odds: not numeric', {
          ...logContext,
          market_type: pick.market_type,
          odds,
        });
        continue;
      }

      // Check range (betting odds typically 1.01 to 100.00)
      if (odds < 1.01 || odds > 100.0) {
        invalidPicks.push(`Invalid odds for ${pick.market_type}: ${odds} (must be 1.01-100.00)`);
        logger.warn('[PickValidator] ❌ Invalid odds: out of range', {
          ...logContext,
          market_type: pick.market_type,
          odds,
          valid_range: '1.01-100.00',
        });
      }
    }
  }

  // RULE 3: Check for duplicates
  const marketTypes = picks.map(p => p.market_type);
  const uniqueMarkets = new Set(marketTypes);
  if (marketTypes.length !== uniqueMarkets.size) {
    const duplicates = marketTypes.filter((item, index) => marketTypes.indexOf(item) !== index);
    invalidPicks.push(`Duplicate markets: ${duplicates.join(', ')}`);
    logger.warn('[PickValidator] ❌ Duplicate market types', {
      ...logContext,
      duplicates,
    });
  }

  // Return validation result
  if (invalidPicks.length > 0) {
    logger.warn('[PickValidator] ❌ Pick validation failed', {
      ...logContext,
      invalid_picks: invalidPicks,
    });

    return {
      valid: false,
      error: invalidPicks.join('; '),
      errorCode: 'INVALID_PICKS',
      invalidPicks,
    };
  }

  logger.info('[PickValidator] ✅ All picks valid', logContext);
  return { valid: true };
}

/**
 * PHASE-2A: Get human-readable market name
 */
export function getMarketName(marketType: string): string {
  const marketNames: Record<string, string> = {
    BTTS_YES: 'Both Teams To Score',
    O25_OVER: 'Over 2.5 Goals',
    O15_OVER: 'Over 1.5 Goals',
    HT_O05_OVER: 'Half-Time Over 0.5 Goals',
  };

  return marketNames[marketType] || marketType;
}

/**
 * PHASE-2A: Get Turkish market label (for messages)
 */
export function getMarketLabelTurkish(marketType: string): string {
  const labels: Record<string, string> = {
    BTTS_YES: 'BTTS',
    O25_OVER: 'Üst 2.5',
    O15_OVER: 'Üst 1.5',
    HT_O05_OVER: 'İY Üst 0.5',
  };

  return labels[marketType] || marketType;
}
