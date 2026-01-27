/**
 * FootyStats Cache Service
 *
 * Implements TTL-based caching for FootyStats API responses
 * TTL Strategy:
 * - Pre-match: 24 hours
 * - Live: 5 minutes
 * - Completed: 7 days
 */

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface CacheOptions {
  ttlSeconds?: number; // Override default TTL
  forceRefresh?: boolean; // Bypass cache
}

interface MatchCacheData {
  fs_match_id: number;
  home_name: string;
  away_name: string;
  competition_name?: string;
  match_date_unix: number;
  status: string;
  btts_potential?: number;
  over25_potential?: number;
  over15_potential?: number;
  corners_potential?: number;
  cards_potential?: number;
  shots_potential?: number;
  fouls_potential?: number;
  xg_home_prematch?: number;
  xg_away_prematch?: number;
  xg_total?: number;
  odds_home?: number;
  odds_draw?: number;
  odds_away?: number;
  trends?: any;
  h2h_data?: any;
  form_data?: any;
  api_response?: any;
}

interface TeamFormCacheData {
  fs_team_id: number;
  season_id: string;
  team_name: string;
  form_string?: string;
  ppg_overall?: number;
  ppg_home?: number;
  ppg_away?: number;
  xg_for_avg?: number;
  xg_against_avg?: number;
  btts_percentage?: number;
  over25_percentage?: number;
  form_data_overall?: any;
  form_data_home?: any;
  form_data_away?: any;
}

// ============================================================================
// TTL CALCULATION
// ============================================================================

/**
 * Calculate TTL (Time To Live) in seconds based on match status
 */
function calculateTTL(matchDateUnix: number, status?: string): number {
  const now = Date.now() / 1000;
  const matchDate = matchDateUnix;

  // Match is in the past (completed)
  if (matchDate < now) {
    return 7 * 24 * 60 * 60; // 7 days
  }

  // Match is live (within 2 hours of start time)
  if (Math.abs(matchDate - now) < 2 * 60 * 60) {
    return 5 * 60; // 5 minutes
  }

  // Match is upcoming (pre-match)
  return 24 * 60 * 60; // 24 hours
}

/**
 * Get expiration timestamp
 */
function getExpiresAt(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}

// ============================================================================
// MATCH STATS CACHE
// ============================================================================

/**
 * Get cached match stats
 */
export async function getCachedMatchStats(
  fsMatchId: number,
  options: CacheOptions = {}
): Promise<any | null> {
  if (options.forceRefresh) {
    logger.info(`[Cache] Force refresh requested for match ${fsMatchId}`);
    return null;
  }

  try {
    const result = await pool.query(
      `SELECT * FROM fs_match_stats
       WHERE fs_match_id = $1
       AND expires_at > NOW()
       LIMIT 1`,
      [fsMatchId]
    );

    if (result.rows.length === 0) {
      logger.info(`[Cache] Miss for match ${fsMatchId}`);
      await logCacheOperation('fs_match_stats', 'miss', fsMatchId.toString());
      return null;
    }

    // Increment hit count
    await pool.query(
      `UPDATE fs_match_stats SET hit_count = hit_count + 1 WHERE fs_match_id = $1`,
      [fsMatchId]
    );

    logger.info(`[Cache] Hit for match ${fsMatchId} (hits: ${result.rows[0].hit_count + 1})`);
    await logCacheOperation('fs_match_stats', 'hit', fsMatchId.toString());

    return result.rows[0];
  } catch (error: any) {
    logger.error(`[Cache] Error getting match stats: ${error.message}`);
    return null;
  }
}

/**
 * Set cached match stats
 */
export async function setCachedMatchStats(
  data: MatchCacheData,
  options: CacheOptions = {}
): Promise<boolean> {
  try {
    const ttl = options.ttlSeconds || calculateTTL(data.match_date_unix, data.status);
    const expiresAt = getExpiresAt(ttl);

    await pool.query(
      `INSERT INTO fs_match_stats (
        fs_match_id, home_name, away_name, competition_name, match_date_unix, status,
        btts_potential, over25_potential, over15_potential, corners_potential,
        cards_potential, shots_potential, fouls_potential,
        xg_home_prematch, xg_away_prematch, xg_total,
        odds_home, odds_draw, odds_away,
        trends, h2h_data, form_data, api_response,
        expires_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, NOW()
      )
      ON CONFLICT (fs_match_id) DO UPDATE SET
        home_name = EXCLUDED.home_name,
        away_name = EXCLUDED.away_name,
        competition_name = EXCLUDED.competition_name,
        match_date_unix = EXCLUDED.match_date_unix,
        status = EXCLUDED.status,
        btts_potential = EXCLUDED.btts_potential,
        over25_potential = EXCLUDED.over25_potential,
        over15_potential = EXCLUDED.over15_potential,
        corners_potential = EXCLUDED.corners_potential,
        cards_potential = EXCLUDED.cards_potential,
        shots_potential = EXCLUDED.shots_potential,
        fouls_potential = EXCLUDED.fouls_potential,
        xg_home_prematch = EXCLUDED.xg_home_prematch,
        xg_away_prematch = EXCLUDED.xg_away_prematch,
        xg_total = EXCLUDED.xg_total,
        odds_home = EXCLUDED.odds_home,
        odds_draw = EXCLUDED.odds_draw,
        odds_away = EXCLUDED.odds_away,
        trends = EXCLUDED.trends,
        h2h_data = EXCLUDED.h2h_data,
        form_data = EXCLUDED.form_data,
        api_response = EXCLUDED.api_response,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()`,
      [
        data.fs_match_id, data.home_name, data.away_name, data.competition_name,
        data.match_date_unix, data.status,
        data.btts_potential, data.over25_potential, data.over15_potential,
        data.corners_potential, data.cards_potential, data.shots_potential, data.fouls_potential,
        data.xg_home_prematch, data.xg_away_prematch, data.xg_total,
        data.odds_home, data.odds_draw, data.odds_away,
        data.trends ? JSON.stringify(data.trends) : null,
        data.h2h_data ? JSON.stringify(data.h2h_data) : null,
        data.form_data ? JSON.stringify(data.form_data) : null,
        data.api_response ? JSON.stringify(data.api_response) : null,
        expiresAt
      ]
    );

    logger.info(`[Cache] Stored match ${data.fs_match_id} with TTL ${ttl}s (expires: ${expiresAt.toISOString()})`);
    await logCacheOperation('fs_match_stats', 'write', data.fs_match_id.toString());

    return true;
  } catch (error: any) {
    logger.error(`[Cache] Error setting match stats: ${error.message}`);
    return false;
  }
}

// ============================================================================
// TEAM FORM CACHE
// ============================================================================

/**
 * Get cached team form
 */
export async function getCachedTeamForm(
  fsTeamId: number,
  seasonId?: string,
  options: CacheOptions = {}
): Promise<any | null> {
  if (options.forceRefresh) {
    return null;
  }

  try {
    let query = `SELECT * FROM fs_team_form WHERE fs_team_id = $1 AND expires_at > NOW()`;
    const params: any[] = [fsTeamId];

    if (seasonId) {
      query += ` AND season_id = $2`;
      params.push(seasonId);
    }

    query += ` ORDER BY updated_at DESC LIMIT 1`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      logger.info(`[Cache] Miss for team form ${fsTeamId}`);
      await logCacheOperation('fs_team_form', 'miss', fsTeamId.toString());
      return null;
    }

    // Increment hit count
    await pool.query(
      `UPDATE fs_team_form SET hit_count = hit_count + 1 WHERE id = $1`,
      [result.rows[0].id]
    );

    logger.info(`[Cache] Hit for team form ${fsTeamId}`);
    await logCacheOperation('fs_team_form', 'hit', fsTeamId.toString());

    return result.rows[0];
  } catch (error: any) {
    logger.error(`[Cache] Error getting team form: ${error.message}`);
    return null;
  }
}

/**
 * Set cached team form
 */
export async function setCachedTeamForm(
  data: TeamFormCacheData,
  options: CacheOptions = {}
): Promise<boolean> {
  try {
    const ttl = options.ttlSeconds || 24 * 60 * 60; // Default 24 hours
    const expiresAt = getExpiresAt(ttl);

    await pool.query(
      `INSERT INTO fs_team_form (
        fs_team_id, season_id, team_name, form_string,
        ppg_overall, ppg_home, ppg_away,
        xg_for_avg, xg_against_avg, btts_percentage, over25_percentage,
        form_data_overall, form_data_home, form_data_away,
        expires_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
      )
      ON CONFLICT (fs_team_id, season_id) DO UPDATE SET
        team_name = EXCLUDED.team_name,
        form_string = EXCLUDED.form_string,
        ppg_overall = EXCLUDED.ppg_overall,
        ppg_home = EXCLUDED.ppg_home,
        ppg_away = EXCLUDED.ppg_away,
        xg_for_avg = EXCLUDED.xg_for_avg,
        xg_against_avg = EXCLUDED.xg_against_avg,
        btts_percentage = EXCLUDED.btts_percentage,
        over25_percentage = EXCLUDED.over25_percentage,
        form_data_overall = EXCLUDED.form_data_overall,
        form_data_home = EXCLUDED.form_data_home,
        form_data_away = EXCLUDED.form_data_away,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()`,
      [
        data.fs_team_id, data.season_id, data.team_name, data.form_string,
        data.ppg_overall, data.ppg_home, data.ppg_away,
        data.xg_for_avg, data.xg_against_avg, data.btts_percentage, data.over25_percentage,
        data.form_data_overall ? JSON.stringify(data.form_data_overall) : null,
        data.form_data_home ? JSON.stringify(data.form_data_home) : null,
        data.form_data_away ? JSON.stringify(data.form_data_away) : null,
        expiresAt
      ]
    );

    logger.info(`[Cache] Stored team form ${data.fs_team_id} with TTL ${ttl}s`);
    await logCacheOperation('fs_team_form', 'write', data.fs_team_id.toString());

    return true;
  } catch (error: any) {
    logger.error(`[Cache] Error setting team form: ${error.message}`);
    return false;
  }
}

// ============================================================================
// TODAY'S MATCHES CACHE
// ============================================================================

/**
 * Get cached today's matches
 */
export async function getCachedTodayMatches(
  date: Date = new Date(),
  options: CacheOptions = {}
): Promise<any | null> {
  if (options.forceRefresh) {
    return null;
  }

  try {
    const dateStr = date.toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT * FROM fs_today_matches_cache
       WHERE cache_date = $1
       AND expires_at > NOW()
       LIMIT 1`,
      [dateStr]
    );

    if (result.rows.length === 0) {
      logger.info(`[Cache] Miss for today's matches ${dateStr}`);
      await logCacheOperation('fs_today_matches_cache', 'miss', dateStr);
      return null;
    }

    // Increment hit count
    await pool.query(
      `UPDATE fs_today_matches_cache SET hit_count = hit_count + 1 WHERE cache_date = $1`,
      [dateStr]
    );

    logger.info(`[Cache] Hit for today's matches ${dateStr}`);
    await logCacheOperation('fs_today_matches_cache', 'hit', dateStr);

    return result.rows[0].matches_data;
  } catch (error: any) {
    logger.error(`[Cache] Error getting today's matches: ${error.message}`);
    return null;
  }
}

/**
 * Set cached today's matches
 */
export async function setCachedTodayMatches(
  matches: any[],
  date: Date = new Date(),
  options: CacheOptions = {}
): Promise<boolean> {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const ttl = options.ttlSeconds || 60 * 60; // Default 1 hour for bulk today's matches
    const expiresAt = getExpiresAt(ttl);

    await pool.query(
      `INSERT INTO fs_today_matches_cache (
        cache_date, matches_data, match_count, expires_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, NOW()
      )
      ON CONFLICT (cache_date) DO UPDATE SET
        matches_data = EXCLUDED.matches_data,
        match_count = EXCLUDED.match_count,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()`,
      [dateStr, JSON.stringify(matches), matches.length, expiresAt]
    );

    logger.info(`[Cache] Stored today's matches (${matches.length} matches) with TTL ${ttl}s`);
    await logCacheOperation('fs_today_matches_cache', 'write', dateStr);

    return true;
  } catch (error: any) {
    logger.error(`[Cache] Error setting today's matches: ${error.message}`);
    return false;
  }
}

// ============================================================================
// CACHE INVALIDATION
// ============================================================================

/**
 * Invalidate specific match cache
 */
export async function invalidateMatchCache(fsMatchId: number): Promise<boolean> {
  try {
    await pool.query(`DELETE FROM fs_match_stats WHERE fs_match_id = $1`, [fsMatchId]);
    logger.info(`[Cache] Invalidated match ${fsMatchId}`);
    await logCacheOperation('fs_match_stats', 'invalidate', fsMatchId.toString());
    return true;
  } catch (error: any) {
    logger.error(`[Cache] Error invalidating match: ${error.message}`);
    return false;
  }
}

/**
 * Invalidate all expired cache entries
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const results = await Promise.all([
      pool.query(`DELETE FROM fs_match_stats WHERE expires_at < NOW()`),
      pool.query(`DELETE FROM fs_team_form WHERE expires_at < NOW()`),
      pool.query(`DELETE FROM fs_today_matches_cache WHERE expires_at < NOW()`)
    ]);

    const totalDeleted = results.reduce((sum, r) => sum + r.rowCount, 0);
    logger.info(`[Cache] Cleanup: Deleted ${totalDeleted} expired entries`);

    await logCacheOperation('all', 'cleanup', totalDeleted.toString());
  } catch (error: any) {
    logger.error(`[Cache] Cleanup error: ${error.message}`);
  }
}

// ============================================================================
// CACHE STATISTICS
// ============================================================================

/**
 * Log cache operation for monitoring
 */
async function logCacheOperation(
  tableName: string,
  operation: string,
  entityId: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO fs_cache_stats (table_name, operation, entity_id, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [tableName, operation, entityId]
    );
  } catch (error: any) {
    // Silent fail - don't break cache operations
    logger.debug(`[Cache] Stats log error: ${error.message}`);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<any> {
  try {
    const stats = await pool.query(`
      SELECT
        table_name,
        operation,
        COUNT(*) as count,
        MAX(timestamp) as last_operation
      FROM fs_cache_stats
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY table_name, operation
      ORDER BY table_name, operation
    `);

    const currentCounts = await pool.query(`
      SELECT
        'fs_match_stats' as table_name,
        COUNT(*) as total_entries,
        SUM(hit_count) as total_hits
      FROM fs_match_stats WHERE expires_at > NOW()
      UNION ALL
      SELECT
        'fs_team_form' as table_name,
        COUNT(*) as total_entries,
        SUM(hit_count) as total_hits
      FROM fs_team_form WHERE expires_at > NOW()
      UNION ALL
      SELECT
        'fs_today_matches_cache' as table_name,
        COUNT(*) as total_entries,
        SUM(hit_count) as total_hits
      FROM fs_today_matches_cache WHERE expires_at > NOW()
    `);

    return {
      operations_24h: stats.rows,
      current_cache: currentCounts.rows
    };
  } catch (error: any) {
    logger.error(`[Cache] Error getting stats: ${error.message}`);
    return null;
  }
}
