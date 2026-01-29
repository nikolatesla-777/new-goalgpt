/**
 * Market Type Definitions - Week-2B Hardening
 *
 * Canonical enum for all betting markets
 * Single source of truth for market identifiers
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

// ============================================================================
// CANONICAL MARKET ID ENUM
// ============================================================================

/**
 * Canonical market identifiers
 * Used throughout the application for type safety
 */
export enum MarketId {
  O25 = 'O25',                    // Over 2.5 Goals
  BTTS = 'BTTS',                  // Both Teams To Score
  HT_O05 = 'HT_O05',              // Half-Time Over 0.5
  O35 = 'O35',                    // Over 3.5 Goals
  HOME_O15 = 'HOME_O15',          // Home Team Over 1.5
  CORNERS_O85 = 'CORNERS_O85',    // Corners Over 8.5
  CARDS_O25 = 'CARDS_O25',        // Cards Over 2.5
}

/**
 * Market display names (Turkish)
 */
export const MARKET_DISPLAY_NAMES_TR: Record<MarketId, string> = {
  [MarketId.O25]: '2.5 Üst Gol',
  [MarketId.BTTS]: 'Karşılıklı Gol',
  [MarketId.HT_O05]: 'İlk Yarı 0.5 Üst',
  [MarketId.O35]: '3.5 Üst Gol',
  [MarketId.HOME_O15]: 'Ev Sahibi 1.5 Üst',
  [MarketId.CORNERS_O85]: 'Korner 8.5 Üst',
  [MarketId.CARDS_O25]: 'Kart 2.5 Üst',
};

/**
 * Market display names (English)
 */
export const MARKET_DISPLAY_NAMES_EN: Record<MarketId, string> = {
  [MarketId.O25]: 'Over 2.5 Goals',
  [MarketId.BTTS]: 'Both Teams To Score',
  [MarketId.HT_O05]: 'Half-Time Over 0.5',
  [MarketId.O35]: 'Over 3.5 Goals',
  [MarketId.HOME_O15]: 'Home Team Over 1.5',
  [MarketId.CORNERS_O85]: 'Corners Over 8.5',
  [MarketId.CARDS_O25]: 'Cards Over 2.5',
};

// ============================================================================
// ROUTE PARAM MAPPING
// ============================================================================

/**
 * Legacy route parameter names (for backward compatibility)
 * Maps old route params to canonical MarketId
 */
export const ROUTE_PARAM_TO_MARKET_ID: Record<string, MarketId> = {
  // Canonical (preferred)
  'O25': MarketId.O25,
  'BTTS': MarketId.BTTS,
  'HT_O05': MarketId.HT_O05,
  'O35': MarketId.O35,
  'HOME_O15': MarketId.HOME_O15,
  'CORNERS_O85': MarketId.CORNERS_O85,
  'CARDS_O25': MarketId.CARDS_O25,

  // Legacy format (backward compatibility)
  'OVER_25': MarketId.O25,
  'OVER_15': MarketId.HOME_O15,  // Note: OVER_15 was ambiguous - maps to HOME_O15
  'OVER_35': MarketId.O35,
  'HT_OVER_05': MarketId.HT_O05,
  'CORNERS': MarketId.CORNERS_O85,
  'CARDS': MarketId.CARDS_O25,
};

/**
 * DailyList market type to canonical MarketId mapping
 * Maps database/service layer market names to canonical enum
 */
export const DAILY_LIST_MARKET_TO_ID: Record<string, MarketId> = {
  'OVER_25': MarketId.O25,
  'BTTS': MarketId.BTTS,
  'HT_OVER_05': MarketId.HT_O05,
  'OVER_35': MarketId.O35,
  'HOME_OVER_15': MarketId.HOME_O15,
  'CORNERS': MarketId.CORNERS_O85,
  'CARDS': MarketId.CARDS_O25,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse route parameter to canonical MarketId
 *
 * @param param - Route parameter (e.g., "OVER_25", "O25")
 * @returns Canonical MarketId or null if invalid
 */
export function parseMarketParam(param: string): MarketId | null {
  const normalized = param.toUpperCase().trim();
  return ROUTE_PARAM_TO_MARKET_ID[normalized] || null;
}

/**
 * Get all valid route parameter names
 *
 * @returns Array of valid route parameters
 */
export function getAllowedMarketParams(): string[] {
  return Object.keys(ROUTE_PARAM_TO_MARKET_ID);
}

/**
 * Get all canonical market IDs
 *
 * @returns Array of canonical MarketId values
 */
export function getAllMarketIds(): MarketId[] {
  return Object.values(MarketId);
}

/**
 * Check if a route parameter is valid
 *
 * @param param - Route parameter to validate
 * @returns True if valid market parameter
 */
export function isValidMarketParam(param: string): boolean {
  return parseMarketParam(param) !== null;
}

/**
 * Get market display name
 *
 * @param marketId - Canonical market ID
 * @param locale - Locale (tr or en)
 * @returns Display name
 */
export function getMarketDisplayName(marketId: MarketId, locale: 'tr' | 'en' = 'tr'): string {
  return locale === 'tr'
    ? MARKET_DISPLAY_NAMES_TR[marketId]
    : MARKET_DISPLAY_NAMES_EN[marketId];
}
