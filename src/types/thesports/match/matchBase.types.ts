/**
 * Match Base Types
 *
 * Shared type definitions for match-related data structures
 * Created: 2026-01-09 (Phase 2: Type Safety)
 */

/**
 * Score Array Format - FIXED Array[7]
 *
 * TheSports API returns scores as a 7-element array with specific indices:
 * - Index 0: regular_score (normal time score)
 * - Index 1: halftime_score (score at half time)
 * - Index 2: red_cards (red cards count)
 * - Index 3: yellow_cards (yellow cards count)
 * - Index 4: corners (corner kicks count)
 * - Index 5: overtime_score (overtime score, if match went to extra time)
 * - Index 6: penalty_score (penalty shootout score)
 *
 * @example
 * const homeScores: ScoreArray = [2, 1, 0, 3, 7, 0, 0];
 * // regular: 2, halftime: 1, red: 0, yellow: 3, corners: 7, OT: 0, penalty: 0
 */
export type ScoreArray = [number, number, number, number, number, number, number];

/**
 * Score array index constants for type-safe access
 *
 * Use these instead of magic numbers to access score array elements.
 * Provides compile-time safety and better code readability.
 *
 * @example
 * const scores: ScoreArray = [2, 1, 0, 3, 7, 0, 0];
 * const redCards = scores[SCORE_INDEX.RED_CARDS]; // 0
 * const corners = scores[SCORE_INDEX.CORNERS];     // 7
 */
export const SCORE_INDEX = {
  /** Index 0: Regular time score */
  REGULAR: 0,

  /** Index 1: Halftime score */
  HALFTIME: 1,

  /** Index 2: Red cards count */
  RED_CARDS: 2,

  /** Index 3: Yellow cards count */
  YELLOW_CARDS: 3,

  /** Index 4: Corner kicks count */
  CORNERS: 4,

  /** Index 5: Overtime score */
  OVERTIME: 5,

  /** Index 6: Penalty shootout score */
  PENALTY: 6,
} as const;

/**
 * Parsed score object with named fields
 *
 * Returned by parseScoreArray() helper function.
 * Provides easy access to all score components with descriptive names.
 */
export interface ParsedScore {
  /** Regular time score (90 minutes) */
  regular: number;

  /** Halftime score (45 minutes) */
  halftime: number;

  /** Red cards count */
  redCards: number;

  /** Yellow cards count */
  yellowCards: number;

  /** Corner kicks count */
  corners: number;

  /** Overtime score (extra time) */
  overtime: number;

  /** Penalty shootout score */
  penalty: number;

  /**
   * Display score - calculated based on match progression
   * - If overtime exists: overtime + penalty
   * - Otherwise: regular + penalty
   */
  display: number;
}

/**
 * Match environment data (weather, temperature, etc.)
 *
 * Contains optional environmental information about the match.
 */
export interface MatchEnvironment {
  /** Weather condition (enum or string) */
  weather?: number | string;

  /** Temperature (Celsius or Fahrenheit) */
  temperature?: number | string;

  /** Wind speed */
  wind?: number | string;

  /** Humidity percentage */
  humidity?: number | string;

  /** Any other environmental data */
  [key: string]: any;
}
