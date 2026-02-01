/**
 * Raw FootyStats API Response Types
 *
 * These types reflect the actual API payload structure from FootyStats API.
 * DO NOT modify these to match our internal needs - use normalizer for that.
 *
 * @module footystats.raw
 * @version 1.0.0
 */

/**
 * Raw FootyStats Match - Direct API response shape
 * Fields may be null, undefined, or missing entirely
 */
export interface RawFootyStatsMatch {
  // Identifiers
  id: number;
  homeID: number;
  awayID: number;

  // Basic info
  home_name: string;
  away_name: string;
  competition_name?: string | null;
  league_name?: string | null;
  status: string;
  date_unix: number;

  // Scores
  homeGoalCount: number | null;
  awayGoalCount: number | null;

  // Potentials (may be null from API)
  btts_potential?: number | null;
  o25_potential?: number | null;
  o15_potential?: number | null;
  avg_potential?: number | null;
  corners_potential?: number | null;
  cards_potential?: number | null;

  // xG data
  team_a_xg_prematch?: number | null;
  team_b_xg_prematch?: number | null;

  // Odds
  odds_ft_1?: number | null;
  odds_ft_x?: number | null;
  odds_ft_2?: number | null;

  // Trends (may be missing or null)
  trends?: {
    home: [string, string][] | null;
    away: [string, string][] | null;
  } | null;

  // H2H data (may be deeply nested nulls)
  h2h?: {
    previous_matches_results?: {
      team_a_wins: number | null;
      team_b_wins: number | null;
      draw: number | null;
      totalMatches: number | null;
    } | null;
    betting_stats?: {
      bttsPercentage: number | null;
      over25Percentage: number | null;
      avg_goals: number | null;
    } | null;
    previous_matches_ids?: Array<{
      id: number;
      date_unix: number;
      team_a_id: number;
      team_b_id: number;
      team_a_goals: number | null;
      team_b_goals: number | null;
    }> | null;
  } | null;
}

/**
 * Raw FootyStats Team Form - Direct API response shape
 */
export interface RawFootyStatsTeamForm {
  team_id: number;
  last_x_match_num: number | null;
  formRun_overall: string | null;
  formRun_home: string | null;
  formRun_away: string | null;
  seasonPPG_overall: number | null;
  seasonBTTSPercentage_overall: number | null;
  seasonOver25Percentage_overall: number | null;
  xg_for_avg_overall: number | null;
  xg_against_avg_overall: number | null;
  cornersAVG_overall: number | null;
  cardsAVG_overall: number | null;
}

/**
 * Raw FootyStats Pager
 */
export interface RawFootyStatsPager {
  current_page: number;
  max_page: number;
  results_per_page: number;
  total_results: number;
}

/**
 * Raw FootyStats Response wrapper
 */
export interface RawFootyStatsResponse<T> {
  success: boolean;
  pager?: RawFootyStatsPager | null;
  data: T;
}
