/**
 * Canonical Scoring Features Contract - Week-2A
 *
 * This is the SINGLE SOURCE OF TRUTH for all scoring operations.
 * NO fuzzy matching. NO inference. Field missing => undefined + risk_flag + publish blocked.
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

/**
 * Data source identifier
 */
export type ScoringDataSource = 'thesports' | 'footystats' | 'hybrid';

/**
 * Completeness tracking for data fields
 */
export interface DataCompleteness {
  present: string[];  // Fields that have values
  missing: string[];  // Fields that are undefined/null
}

/**
 * Expected Goals (xG) data
 */
export interface XGData {
  home: number;      // Home team xG
  away: number;      // Away team xG
  total: number;     // Sum of home + away
}

/**
 * Match odds (closing odds preferred)
 */
export interface OddsData {
  home_win: number;  // 1X2: Home win odds
  draw: number;      // 1X2: Draw odds
  away_win: number;  // 1X2: Away win odds
}

/**
 * Market potentials (pre-calculated probabilities, 0-100 scale)
 */
export interface PotentialsData {
  over25?: number;       // Over 2.5 Goals potential (0-100)
  btts?: number;         // Both Teams To Score potential (0-100)
  over15?: number;       // Over 1.5 Goals potential (0-100)
  over05_ht?: number;    // Half-Time Over 0.5 Goals potential (0-100)
  over35?: number;       // Over 3.5 Goals potential (0-100)
  corners_over85?: number; // Corners Over 8.5 potential (0-100)
  cards_over25?: number;   // Cards Over 2.5 potential (0-100)
}

/**
 * Full-time scores
 */
export interface FullTimeScores {
  home: number;
  away: number;
  total: number;  // Computed: home + away
}

/**
 * Half-time scores
 */
export interface HalfTimeScores {
  home: number;
  away: number;
  total: number;  // Computed: home + away
}

/**
 * Corners data
 */
export interface CornersData {
  home: number;
  away: number;
  total: number;  // Computed: home + away
}

/**
 * Cards data (yellow cards only)
 */
export interface CardsData {
  home: number;      // Home team yellow cards
  away: number;      // Away team yellow cards
  total: number;     // Computed: home + away
}

/**
 * Team information
 */
export interface TeamInfo {
  id: string;        // Team ID from data source
  name: string;      // Team name
}

/**
 * League/Competition information
 */
export interface LeagueInfo {
  id: string;        // League ID from data source
  name?: string;     // League name (optional)
}

/**
 * Canonical Scoring Features Contract
 *
 * This structure represents all data needed for market scoring.
 * Fields are OPTIONAL (undefined if not available).
 * Completeness tracking records what's present/missing.
 */
export interface ScoringFeatures {
  // ============================================================================
  // METADATA
  // ============================================================================
  source: ScoringDataSource;  // Data provider (thesports/footystats/hybrid)
  match_id: string;           // External match ID
  kickoff_ts: number;         // Unix timestamp (seconds)
  completeness: DataCompleteness;

  // ============================================================================
  // TEAMS & LEAGUE
  // ============================================================================
  home_team: TeamInfo;
  away_team: TeamInfo;
  league: LeagueInfo;

  // ============================================================================
  // EXPECTED GOALS (xG)
  // ============================================================================
  xg?: XGData;  // undefined if not available (TheSports doesn't have xG)

  // ============================================================================
  // ODDS
  // ============================================================================
  odds?: OddsData;  // undefined if not available

  // ============================================================================
  // POTENTIALS (Pre-calculated market probabilities)
  // ============================================================================
  potentials?: PotentialsData;  // undefined if not available (TheSports doesn't have potentials)

  // ============================================================================
  // ACTUAL MATCH DATA (Goals, Corners, Cards)
  // ============================================================================

  /**
   * Full-time scores
   * Only present if match has ended (status_id = 8)
   */
  ft_scores?: FullTimeScores;

  /**
   * Half-time scores
   * Only present if HT data is available
   */
  ht_scores?: HalfTimeScores;

  /**
   * Corners data
   * Only present if corners are tracked for this match
   */
  corners?: CornersData;

  /**
   * Cards data (yellow cards)
   * Only present if cards are tracked for this match
   */
  cards?: CardsData;

  // ============================================================================
  // ADDITIONAL DATA (For advanced scoring)
  // ============================================================================

  /**
   * Team form statistics (if available from data provider)
   */
  form?: {
    home?: {
      recent_matches?: any[];  // Recent match results
      avg_goals_scored?: number;
      avg_goals_conceded?: number;
      avg_corners?: number;
      avg_cards?: number;
    };
    away?: {
      recent_matches?: any[];
      avg_goals_scored?: number;
      avg_goals_conceded?: number;
      avg_corners?: number;
      avg_cards?: number;
    };
  };

  /**
   * Head-to-head statistics (if available)
   */
  h2h?: {
    avg_goals?: number;
    over25_percentage?: number;
    btts_percentage?: number;
  };

  /**
   * League statistics/norms (if available)
   */
  league_stats?: {
    avg_goals_per_match?: number;
    over25_rate?: number;
    btts_rate?: number;
  };
}

/**
 * Risk flags for missing/invalid data
 */
export type ScoringRiskFlag =
  | 'MISSING_XG'
  | 'MISSING_ODDS'
  | 'MISSING_POTENTIALS'
  | 'MISSING_HT_SCORES'
  | 'MISSING_CORNERS'
  | 'MISSING_CARDS'
  | 'MISSING_FORM_DATA'
  | 'MISSING_H2H_DATA'
  | 'MISSING_LEAGUE_STATS'
  | 'INCOMPLETE_TEAM_DATA'
  | 'INCOMPLETE_LEAGUE_DATA';

/**
 * Helper function to calculate completeness
 */
export function calculateCompleteness(features: Partial<ScoringFeatures>): DataCompleteness {
  const present: string[] = [];
  const missing: string[] = [];

  // Check top-level optional fields
  const optionalFields: Array<keyof ScoringFeatures> = [
    'xg',
    'odds',
    'potentials',
    'ft_scores',
    'ht_scores',
    'corners',
    'cards',
    'form',
    'h2h',
    'league_stats',
  ];

  for (const field of optionalFields) {
    if (features[field] !== undefined && features[field] !== null) {
      present.push(field);
    } else {
      missing.push(field);
    }
  }

  return { present, missing };
}

/**
 * Helper function to generate risk flags based on missing data
 */
export function generateRiskFlags(completeness: DataCompleteness): ScoringRiskFlag[] {
  const flags: ScoringRiskFlag[] = [];

  for (const missing of completeness.missing) {
    switch (missing) {
      case 'xg':
        flags.push('MISSING_XG');
        break;
      case 'odds':
        flags.push('MISSING_ODDS');
        break;
      case 'potentials':
        flags.push('MISSING_POTENTIALS');
        break;
      case 'ht_scores':
        flags.push('MISSING_HT_SCORES');
        break;
      case 'corners':
        flags.push('MISSING_CORNERS');
        break;
      case 'cards':
        flags.push('MISSING_CARDS');
        break;
      case 'form':
        flags.push('MISSING_FORM_DATA');
        break;
      case 'h2h':
        flags.push('MISSING_H2H_DATA');
        break;
      case 'league_stats':
        flags.push('MISSING_LEAGUE_STATS');
        break;
    }
  }

  return flags;
}
