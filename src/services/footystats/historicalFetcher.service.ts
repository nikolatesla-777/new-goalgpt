/**
 * Historical Match Data Fetcher - Week-2C
 *
 * Fetches FootyStats data for historical matches from ts_matches table
 * Features:
 * - Rate-limited (30 req/min)
 * - Resumable (skip already fetched)
 * - Progress tracking
 * - Data quality scoring
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { footyStatsAPI, FootyStatsMatch } from './footystats.client';
import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface FetchConfig {
  startDate: string;       // '2024-01-01'
  endDate: string;         // '2024-12-31'
  competitions?: number[]; // Filter by competition_id (e.g., [1,2,3] for top leagues)
  limit?: number;          // Max matches to fetch
  skipExisting?: boolean;  // Skip if fs_match_stats already exists
}

export interface FetchProgress {
  total: number;
  processed: number;
  success: number;
  errors: number;
  skipped: number;
  avgQualityScore: number;
}

// ============================================================================
// MAIN FETCH FUNCTION
// ============================================================================

/**
 * Fetch historical FootyStats data for matches in ts_matches table
 */
export async function fetchHistoricalData(config: FetchConfig): Promise<FetchProgress> {
  const { startDate, endDate, competitions, limit, skipExisting = true } = config;

  logger.info('[HistoricalFetcher] Starting historical data fetch', { config });

  // 1. Get target matches from ts_matches
  const matches = await getTargetMatches(startDate, endDate, competitions, limit, skipExisting);

  logger.info(`[HistoricalFetcher] Found ${matches.length} matches to fetch`);

  if (matches.length === 0) {
    logger.warn('[HistoricalFetcher] No matches to fetch');
    return { total: 0, processed: 0, success: 0, errors: 0, skipped: 0, avgQualityScore: 0 };
  }

  // 2. Fetch FootyStats data for each match
  const progress: FetchProgress = {
    total: matches.length,
    processed: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    avgQualityScore: 0,
  };

  let qualityScoreSum = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    try {
      // 2a. Find FootyStats match ID (using date-based lookup)
      const fsMatchId = await findFootyStatsMatchId(
        match.home_team,
        match.away_team,
        match.match_time
      );

      if (!fsMatchId) {
        logger.debug('[HistoricalFetcher] FootyStats match not found', {
          ts_match_id: match.ts_match_id,
          home: match.home_team,
          away: match.away_team,
          date: match.match_time,
        });
        progress.skipped++;
        progress.processed++;
        continue;
      }

      // 2b. Fetch full match data
      const fsData = await footyStatsAPI.getMatchDetails(fsMatchId);

      if (!fsData || !fsData.data) {
        logger.warn('[HistoricalFetcher] Empty FootyStats response', {
          fs_match_id: fsMatchId,
        });
        progress.errors++;
        progress.processed++;
        continue;
      }

      // 2c. Calculate data quality score
      const qualityScore = calculateDataQuality(fsData.data);
      qualityScoreSum += qualityScore;

      // 2d. Store in fs_match_stats
      await storeFootyStatsData(match.ts_match_id, fsData.data, qualityScore);

      progress.success++;
      progress.processed++;

      // Progress logging every 100 matches
      if ((i + 1) % 100 === 0) {
        const avgQuality = progress.success > 0 ? Math.round(qualityScoreSum / progress.success) : 0;
        logger.info(
          `[HistoricalFetcher] Progress: ${i + 1}/${matches.length} ` +
          `(✅ ${progress.success} | ❌ ${progress.errors} | ⏭️  ${progress.skipped} | ` +
          `Avg Quality: ${avgQuality})`
        );
      }
    } catch (error) {
      logger.error(`[HistoricalFetcher] Error fetching match`, {
        ts_match_id: match.ts_match_id,
        home: match.home_team,
        away: match.away_team,
        error: error instanceof Error ? error.message : String(error),
      });
      progress.errors++;
      progress.processed++;
    }
  }

  // Calculate final average quality score
  progress.avgQualityScore = progress.success > 0 ? Math.round(qualityScoreSum / progress.success) : 0;

  logger.info('[HistoricalFetcher] Fetch complete', progress);

  return progress;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get target matches from ts_matches table
 */
async function getTargetMatches(
  startDate: string,
  endDate: string,
  competitions?: number[],
  limit?: number,
  skipExisting?: boolean
) {
  let query = `
    SELECT
      m.id as ts_match_id,
      m.external_id as ts_external_id,
      m.home_team,
      m.away_team,
      m.match_time,
      m.home_score_display,
      m.away_score_display,
      m.status_id,
      m.competition_id
    FROM ts_matches m
    WHERE m.status_id = 8  -- ENDED
      AND m.match_time >= $1::timestamptz
      AND m.match_time <= $2::timestamptz
  `;

  const params: any[] = [startDate, endDate];

  if (competitions && competitions.length > 0) {
    query += ` AND m.competition_id = ANY($${params.length + 1})`;
    params.push(competitions);
  }

  if (skipExisting) {
    query += ` AND NOT EXISTS (
      SELECT 1 FROM fs_match_stats fs
      WHERE fs.ts_match_id = m.id
    )`;
  }

  query += ` ORDER BY m.match_time DESC`;

  if (limit) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Find FootyStats match ID by team names and date
 * Uses fuzzy matching if exact match not found
 */
async function findFootyStatsMatchId(
  homeTeam: string,
  awayTeam: string,
  matchTime: Date
): Promise<number | null> {
  try {
    // Format date for FootyStats API (YYYY-MM-DD)
    const date = new Date(matchTime);
    const dateStr = date.toISOString().split('T')[0];

    // Fetch matches for that day
    const response = await footyStatsAPI.getTodaysMatches(dateStr);

    if (!response || !response.data) {
      return null;
    }

    // 1. Try exact match (case-insensitive)
    const exactMatch = response.data.find(
      (m) =>
        m.home_name.toLowerCase() === homeTeam.toLowerCase() &&
        m.away_name.toLowerCase() === awayTeam.toLowerCase()
    );

    if (exactMatch) {
      return exactMatch.id;
    }

    // 2. Try fuzzy match (contains)
    const fuzzyMatch = response.data.find(
      (m) =>
        m.home_name.toLowerCase().includes(homeTeam.toLowerCase().slice(0, 10)) &&
        m.away_name.toLowerCase().includes(awayTeam.toLowerCase().slice(0, 10))
    );

    if (fuzzyMatch) {
      logger.debug('[HistoricalFetcher] Fuzzy match found', {
        expected: `${homeTeam} vs ${awayTeam}`,
        found: `${fuzzyMatch.home_name} vs ${fuzzyMatch.away_name}`,
        fs_match_id: fuzzyMatch.id,
      });
      return fuzzyMatch.id;
    }

    // 3. No match found
    return null;
  } catch (error) {
    logger.error('[HistoricalFetcher] Error finding FootyStats match ID', {
      home: homeTeam,
      away: awayTeam,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Calculate data quality score (0-100)
 * Based on completeness of FootyStats data
 */
function calculateDataQuality(fsMatch: FootyStatsMatch): number {
  let score = 0;

  // xG data (30 points)
  if (fsMatch.team_a_xg_prematch && fsMatch.team_b_xg_prematch) {
    score += 30;
  }

  // Potentials (30 points total - 6 points each)
  if (fsMatch.btts_potential) score += 6;
  if (fsMatch.o25_potential) score += 6;
  if (fsMatch.o15_potential) score += 6;
  if (fsMatch.corners_potential) score += 6;
  if (fsMatch.cards_potential) score += 6;

  // Odds (20 points)
  if (fsMatch.odds_ft_1 && fsMatch.odds_ft_x && fsMatch.odds_ft_2) {
    score += 20;
  }

  // H2H (10 points)
  if (fsMatch.h2h && fsMatch.h2h.betting_stats) {
    score += 10;
  }

  // Trends (10 points)
  if (fsMatch.trends && fsMatch.trends.home && fsMatch.trends.away) {
    score += 10;
  }

  return score;
}

/**
 * Store FootyStats data in fs_match_stats table
 */
async function storeFootyStatsData(
  tsMatchId: string,
  fsMatch: FootyStatsMatch,
  qualityScore: number
): Promise<void> {
  await pool.query(
    `INSERT INTO fs_match_stats (
      ts_match_id, fs_match_id,
      home_team_fs_id, away_team_fs_id,
      status, date_unix,
      btts_potential, o25_potential, o15_potential,
      avg_potential, corners_potential, cards_potential,
      team_a_xg_prematch, team_b_xg_prematch,
      odds_ft_1, odds_ft_x, odds_ft_2,
      h2h_stats, trends,
      data_quality_score
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
    )
    ON CONFLICT (fs_match_id) DO UPDATE SET
      data_quality_score = EXCLUDED.data_quality_score,
      fetched_at = NOW()`,
    [
      tsMatchId,
      fsMatch.id,
      fsMatch.homeID,
      fsMatch.awayID,
      fsMatch.status,
      fsMatch.date_unix,
      fsMatch.btts_potential,
      fsMatch.o25_potential,
      fsMatch.o15_potential,
      fsMatch.avg_potential,
      fsMatch.corners_potential,
      fsMatch.cards_potential,
      fsMatch.team_a_xg_prematch,
      fsMatch.team_b_xg_prematch,
      fsMatch.odds_ft_1,
      fsMatch.odds_ft_x,
      fsMatch.odds_ft_2,
      JSON.stringify(fsMatch.h2h),
      JSON.stringify(fsMatch.trends),
      qualityScore,
    ]
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { calculateDataQuality };
