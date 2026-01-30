/**
 * FootyStats Data Normalizer
 *
 * Converts raw FootyStats API responses to Canonical Match Snapshots.
 * Handles null/undefined normalization, type validation, and missing field tracking.
 *
 * RULES:
 * - Convert all null → undefined for optional fields
 * - Ensure arrays are never null (default to [])
 * - Ensure numbers are numbers (not strings)
 * - Track missing/invalid fields instead of throwing errors
 * - NEVER change business logic - only shape normalization
 *
 * @module footystatsNormalizer
 * @version 1.0.0
 */

import { RawFootyStatsMatch, RawFootyStatsTeamForm } from '../../types/footystats.raw';
import { CanonicalMatchSnapshot } from '../../types/matchSnapshot';
import { logger } from '../../utils/logger';

const SCHEMA_VERSION = 1;
const SOURCE_VERSION = 'footystats-api-v1';

/**
 * Normalize raw FootyStats match to canonical snapshot
 *
 * @param raw - Raw API response
 * @param homeForm - Optional home team form data
 * @param awayForm - Optional away team form data
 * @returns Canonical snapshot
 */
export function normalizeFootyStatsMatch(
  raw: RawFootyStatsMatch,
  homeForm?: RawFootyStatsTeamForm,
  awayForm?: RawFootyStatsTeamForm
): CanonicalMatchSnapshot {
  const missing_fields: string[] = [];

  // Helper: Convert null to undefined
  const nullToUndefined = <T>(value: T | null | undefined): T | undefined => {
    return value === null ? undefined : value;
  };

  // Helper: Ensure number or undefined
  const ensureNumber = (value: number | null | undefined, fieldPath: string): number | undefined => {
    if (value === null || value === undefined) {
      missing_fields.push(fieldPath);
      return undefined;
    }
    if (typeof value !== 'number' || isNaN(value)) {
      missing_fields.push(`${fieldPath}:invalid`);
      return undefined;
    }
    return value;
  };

  // Helper: Ensure array (never null/undefined)
  const ensureArray = <T>(value: T[] | null | undefined): T[] => {
    return Array.isArray(value) ? value : [];
  };

  // === IDENTITY ===
  const ids = {
    fs_match_id: raw.id,
    home_team_id: raw.homeID,
    away_team_id: raw.awayID,
    league_id: undefined, // Derived separately if needed
    season_id: undefined, // Derived separately if needed
  };

  // === TEMPORAL ===
  const time = {
    match_date_unix: raw.date_unix,
    status: raw.status || 'unknown',
    captured_at_unix: Math.floor(Date.now() / 1000),
  };

  // === BASIC INFO ===
  const teams = {
    home_name: raw.home_name,
    away_name: raw.away_name,
    competition_name: nullToUndefined(raw.competition_name || raw.league_name),
  };

  // === FORM DATA ===
  const form = {
    home: homeForm
      ? {
          ppg: ensureNumber(homeForm.seasonPPG_overall, 'form.home.ppg'),
          btts_pct: ensureNumber(homeForm.seasonBTTSPercentage_overall, 'form.home.btts_pct'),
          over25_pct: ensureNumber(homeForm.seasonOver25Percentage_overall, 'form.home.over25_pct'),
          overall_form: nullToUndefined(homeForm.formRun_overall),
          home_only_form: nullToUndefined(homeForm.formRun_home),
        }
      : undefined,
    away: awayForm
      ? {
          ppg: ensureNumber(awayForm.seasonPPG_overall, 'form.away.ppg'),
          btts_pct: ensureNumber(awayForm.seasonBTTSPercentage_overall, 'form.away.btts_pct'),
          over25_pct: ensureNumber(awayForm.seasonOver25Percentage_overall, 'form.away.over25_pct'),
          overall_form: nullToUndefined(awayForm.formRun_overall),
          away_only_form: nullToUndefined(awayForm.formRun_away),
        }
      : undefined,
  };

  // === H2H DATA ===
  let h2h: CanonicalMatchSnapshot['stats']['h2h'] = undefined;
  if (raw.h2h) {
    const rawH2h = raw.h2h;
    const prevResults = rawH2h.previous_matches_results;
    const bettingStats = rawH2h.betting_stats;

    if (prevResults || bettingStats) {
      h2h = {
        total_matches: prevResults?.totalMatches ?? 0,
        home_wins: prevResults?.team_a_wins ?? 0,
        draws: prevResults?.draw ?? 0,
        away_wins: prevResults?.team_b_wins ?? 0,
        btts_pct: ensureNumber(bettingStats?.bttsPercentage, 'h2h.btts_pct'),
        avg_goals: ensureNumber(bettingStats?.avg_goals, 'h2h.avg_goals'),
        recent_match_ids: ensureArray(rawH2h.previous_matches_ids).map((m) => m.id),
      };
    }
  }

  // === XG DATA ===
  const xg = {
    home: ensureNumber(raw.team_a_xg_prematch, 'xg.home'),
    away: ensureNumber(raw.team_b_xg_prematch, 'xg.away'),
    total:
      raw.team_a_xg_prematch && raw.team_b_xg_prematch
        ? ensureNumber(raw.team_a_xg_prematch + raw.team_b_xg_prematch, 'xg.total')
        : undefined,
  };

  // === GOALS (if match finished) ===
  let goals: CanonicalMatchSnapshot['stats']['goals'] = undefined;
  if (raw.homeGoalCount !== null && raw.awayGoalCount !== null) {
    goals = {
      home: raw.homeGoalCount,
      away: raw.awayGoalCount,
    };
  }

  // === POTENTIALS ===
  const potentials = {
    btts: ensureNumber(raw.btts_potential, 'potentials.btts'),
    over25: ensureNumber(raw.o25_potential, 'potentials.over25'),
    over15: ensureNumber(raw.o15_potential, 'potentials.over15'),
    corners: ensureNumber(raw.corners_potential, 'potentials.corners'),
    cards: ensureNumber(raw.cards_potential, 'potentials.cards'),
  };

  // === ODDS ===
  let odds: CanonicalMatchSnapshot['odds'] = undefined;
  if (raw.odds_ft_1 || raw.odds_ft_x || raw.odds_ft_2) {
    odds = {
      home: ensureNumber(raw.odds_ft_1, 'odds.home'),
      draw: ensureNumber(raw.odds_ft_x, 'odds.draw'),
      away: ensureNumber(raw.odds_ft_2, 'odds.away'),
    };
  }

  // === TRENDS ===
  let trends: CanonicalMatchSnapshot['trends'] = undefined;
  if (raw.trends) {
    trends = {
      home: ensureArray(raw.trends.home).map((t) => t[1]), // [sentiment, text] → text only
      away: ensureArray(raw.trends.away).map((t) => t[1]),
    };
  }

  // === METADATA ===
  const confidence = {
    data_completeness: calculateCompleteness(missing_fields),
    has_form_data: form.home !== undefined || form.away !== undefined,
    has_h2h_data: h2h !== undefined,
    has_xg_data: xg.home !== undefined || xg.away !== undefined,
    has_odds_data: odds !== undefined,
  };

  const meta = {
    schema_version: SCHEMA_VERSION,
    source_version: SOURCE_VERSION,
    missing_fields,
    confidence,
  };

  // === ASSEMBLE SNAPSHOT ===
  const snapshot: CanonicalMatchSnapshot = {
    ids,
    time,
    teams,
    stats: {
      form,
      h2h,
      xg,
      goals,
      potentials,
    },
    odds,
    trends,
    meta,
  };

  // Log if too many missing fields (for observability)
  if (missing_fields.length > 10) {
    logger.warn('[Normalizer] High missing field count', {
      fs_match_id: raw.id,
      missing_count: missing_fields.length,
      sample_fields: missing_fields.slice(0, 5),
    });
  }

  return snapshot;
}

/**
 * Calculate data completeness score (0-100)
 * Based on number of missing critical fields
 */
function calculateCompleteness(missing_fields: string[]): number {
  // Critical fields that heavily impact score
  const criticalFields = [
    'xg.home',
    'xg.away',
    'potentials.btts',
    'potentials.over25',
    'form.home.ppg',
    'form.away.ppg',
    'h2h.btts_pct',
  ];

  const criticalMissing = missing_fields.filter((field) =>
    criticalFields.some((critical) => field.startsWith(critical))
  ).length;

  const totalMissing = missing_fields.length;

  // Scoring logic:
  // - Start at 100
  // - Deduct 10 points per critical field missing (max -70)
  // - Deduct 2 points per non-critical field (max -30)

  const criticalPenalty = Math.min(criticalMissing * 10, 70);
  const nonCriticalPenalty = Math.min((totalMissing - criticalMissing) * 2, 30);

  return Math.max(0, 100 - criticalPenalty - nonCriticalPenalty);
}

/**
 * Validate snapshot structure (for testing/debugging)
 */
export function validateSnapshot(snapshot: CanonicalMatchSnapshot): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields validation
  if (!snapshot.ids?.fs_match_id) errors.push('Missing ids.fs_match_id');
  if (!snapshot.ids?.home_team_id) errors.push('Missing ids.home_team_id');
  if (!snapshot.ids?.away_team_id) errors.push('Missing ids.away_team_id');
  if (!snapshot.time?.match_date_unix) errors.push('Missing time.match_date_unix');
  if (!snapshot.teams?.home_name) errors.push('Missing teams.home_name');
  if (!snapshot.teams?.away_name) errors.push('Missing teams.away_name');
  if (!snapshot.meta?.schema_version) errors.push('Missing meta.schema_version');

  // Type validation
  if (typeof snapshot.ids.fs_match_id !== 'number') errors.push('ids.fs_match_id must be number');
  if (typeof snapshot.time.match_date_unix !== 'number') errors.push('time.match_date_unix must be number');

  // No null values allowed (only undefined for optional fields)
  const jsonStr = JSON.stringify(snapshot);
  if (jsonStr.includes(':null')) {
    errors.push('Snapshot contains null values (should use undefined)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
