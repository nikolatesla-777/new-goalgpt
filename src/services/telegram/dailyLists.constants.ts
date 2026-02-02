/**
 * Daily Lists Configuration Constants
 * Centralized constants for Telegram Daily Lists feature
 */

export const DAILY_LISTS_CONFIG = {
  // Cache TTL
  CACHE_TTL_MS: 60 * 60 * 1000, // 1 hour

  // Match mapping
  TIME_WINDOW_SECONDS: 3600, // ±1 hour for fuzzy matching
  SIMILARITY_THRESHOLD: 0.40, // 40% minimum similarity
  MIN_VALID_MATCHES: 10, // Minimum matches to avoid refresh

  // Market thresholds
  CONFIDENCE_THRESHOLDS: {
    OVER_25: 55,
    OVER_15: 50,
    BTTS: 55,
    HT_OVER_05: 55,
    CORNERS: 50,
    CARDS: 50,
  },

  // Market selection
  MIN_MATCHES_PER_MARKET: 3,
  MAX_MATCHES_PER_MARKET: 5,
} as const;
