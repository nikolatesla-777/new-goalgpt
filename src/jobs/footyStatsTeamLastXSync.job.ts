// src/jobs/footyStatsTeamLastXSync.job.ts
import crypto from "node:crypto";
import { pool } from "../database/connection";
import { logger } from "../utils/logger";

type LastXTeamRow = {
  id: number;
  name: string;
  full_name: string;
  country: string;
  competition_id: number; // WARNING: API returns -1, we need to pass actual competition_id
  season: string;
  image: string;
  url: string;
  table_position: number;
  performance_rank: number;
  risk: number;
  season_format: string;
  last_updated_match_timestamp: number;
  last_x_home_away_or_overall: number; // 0=overall, 1=home, 2=away
  last_x_match_num: number; // CRITICAL: The actual window size (5, 6, or 10)
  stats: Record<string, any>;
};

type LastXResponse = {
  success: boolean;
  data: LastXTeamRow[];
};

function stableStringify(value: any): string {
  const seen = new WeakSet();
  const sorter = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return "[Circular]";
    seen.add(v);

    if (Array.isArray(v)) return v.map(sorter);

    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = sorter(v[k]);
    return out;
  };

  return JSON.stringify(sorter(value));
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Parse scope field: 0=overall, 1=home, 2=away
 */
function parseScope(last_x_home_away_or_overall: number): number {
  if (last_x_home_away_or_overall === 1) return 1; // home
  if (last_x_home_away_or_overall === 2) return 2; // away
  return 0; // overall (default)
}

/**
 * Get recorded matches count from stats
 * CRITICAL: Show this in UI to avoid misleading percentages
 */
function getRecordedMatchesCount(stats: Record<string, any>): number {
  return stats.seasonMatchesPlayed_overall || 0;
}

/**
 * Check if team LastX data needs refresh (TTL: 6 hours)
 */
async function needsRefresh(teamId: number, ttlHours = 6): Promise<boolean> {
  const result = await pool.query(
    `
    SELECT MAX(fetched_at) as last_fetch
    FROM fs_team_lastx_stats
    WHERE team_id = $1
  `,
    [teamId]
  );

  if (!result.rows[0].last_fetch) return true;

  const lastFetch = new Date(result.rows[0].last_fetch);
  const now = new Date();
  const hoursSinceLastFetch =
    (now.getTime() - lastFetch.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastFetch >= ttlHours;
}

/**
 * Fetch LastX data from FootyStats API with retry
 * Returns array of 3 records (Last 5, Last 6, Last 10)
 */
async function fetchTeamLastX(
  teamId: number,
  apiKey: string,
  retries = 3
): Promise<LastXTeamRow[] | null> {
  const url = new URL("https://api.football-data-api.com/lastx");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("team_id", String(teamId));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { method: "GET" });

      if (res.status === 429) {
        // Rate limit - exponential backoff
        const delay = Math.pow(2, attempt) * 500;
        logger.warn(
          `[FootyStats] Rate limit for team ${teamId} LastX, retry ${attempt}/${retries} after ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `FootyStats lastx API failed: ${res.status} ${res.statusText} :: ${body.slice(0, 200)}`
        );
      }

      const data: LastXResponse = await res.json();

      // API returns array of 3 records (Last 5, 6, 10)
      if (Array.isArray(data?.data)) {
        return data.data;
      }

      return null;
    } catch (err: any) {
      if (attempt === retries) {
        logger.error(
          `[FootyStats] Failed to fetch team ${teamId} LastX after ${retries} retries:`,
          err.message
        );
        return null;
      }

      const delay = Math.pow(2, attempt) * 500;
      logger.warn(
        `[FootyStats] Error fetching team ${teamId} LastX, retry ${attempt}/${retries} after ${delay}ms:`,
        err.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}

/**
 * UPSERT single LastX row with hash guard
 * @param row - The LastX data from API (competition_id will be -1)
 * @param actualCompetitionId - The actual competition_id to store
 */
async function upsertTeamLastXRow(row: LastXTeamRow, actualCompetitionId: number) {
  const scope = parseScope(row.last_x_home_away_or_overall);
  const lastX = row.last_x_match_num || 5; // Use API field

  // Create full payload for hash
  const payload = {
    team_id: row.id,
    season: row.season,
    competition_id: actualCompetitionId, // Use actual competition_id, not -1
    scope,
    last_x: lastX,
    stats: row.stats || {},
  };

  const sourceHash = sha256Hex(stableStringify(payload));

  const sql = `
    INSERT INTO fs_team_lastx_stats (
      team_id,
      season,
      competition_id,
      scope,
      last_x,
      name,
      full_name,
      country,
      image,
      url,
      table_position,
      performance_rank,
      risk,
      season_format,
      last_updated_match_timestamp,
      stats,
      raw,
      source_hash,
      fetched_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18, NOW(), NOW()
    )
    ON CONFLICT (team_id, season, competition_id, scope, last_x) DO UPDATE SET
      name = EXCLUDED.name,
      full_name = EXCLUDED.full_name,
      country = EXCLUDED.country,
      image = EXCLUDED.image,
      url = EXCLUDED.url,
      table_position = EXCLUDED.table_position,
      performance_rank = EXCLUDED.performance_rank,
      risk = EXCLUDED.risk,
      season_format = EXCLUDED.season_format,
      last_updated_match_timestamp = EXCLUDED.last_updated_match_timestamp,
      stats = EXCLUDED.stats,
      raw = EXCLUDED.raw,
      source_hash = EXCLUDED.source_hash,
      updated_at = NOW()
    WHERE fs_team_lastx_stats.source_hash IS DISTINCT FROM EXCLUDED.source_hash
  `;

  const params = [
    row.id,
    row.season || null,
    actualCompetitionId, // Use actual competition_id, not row.competition_id (-1)
    scope,
    lastX,
    row.name || null,
    row.full_name || null,
    row.country || null,
    row.image || null,
    row.url || null,
    row.table_position || null,
    row.performance_rank || null,
    row.risk || null,
    row.season_format || null,
    row.last_updated_match_timestamp || null,
    JSON.stringify(row.stats || {}),
    JSON.stringify(row), // Full raw payload
    sourceHash,
  ];

  const result = await pool.query(sql, params);
  return result.rowCount && result.rowCount > 0;
}

/**
 * Sync LastX stats for a single team (3 records: Last 5, 6, 10)
 */
async function syncTeamLastX(
  teamId: number,
  competitionId: number,
  apiKey: string,
  forceFetch = false
): Promise<{ ok: boolean; updated: number; error?: string }> {
  try {
    // Check TTL cache unless force fetch
    if (!forceFetch) {
      const refresh = await needsRefresh(teamId, 6);
      if (!refresh) {
        logger.debug(`[FootyStats] Team ${teamId} LastX cached, skipping fetch`);
        return { ok: true, updated: 0 };
      }
    }

    // Fetch LastX data (3 records)
    const rows = await fetchTeamLastX(teamId, apiKey);

    if (!rows || rows.length === 0) {
      return { ok: false, updated: 0, error: "No data returned from API" };
    }

    let updated = 0;

    // UPSERT all 3 rows with actual competition_id
    for (const row of rows) {
      const wrote = await upsertTeamLastXRow(row, competitionId);
      if (wrote) updated++;
    }

    logger.info(
      `[FootyStats] Team ${teamId} LastX synced: ${updated}/${rows.length} updated`
    );

    return { ok: true, updated };
  } catch (err: any) {
    logger.error(`[FootyStats] Failed to sync team ${teamId} LastX:`, err.message);
    return { ok: false, updated: 0, error: err.message };
  }
}

/**
 * Sync LastX stats for multiple teams with concurrency control
 */
async function syncMultipleTeamsLastX(
  teamIds: number[],
  competitionId: number,
  apiKey: string,
  concurrency = 5,
  forceFetch = false
) {
  let totalUpdated = 0;
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < teamIds.length; i += concurrency) {
    const batch = teamIds.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (teamId) => {
        const result = await syncTeamLastX(teamId, competitionId, apiKey, forceFetch);
        if (result.ok) {
          totalUpdated += result.updated;
          processed++;
        } else {
          failed++;
        }
        return result;
      })
    );

    // Log batch progress
    logger.info(
      `[FootyStats] LastX sync batch ${Math.ceil((i + 1) / concurrency)} (${i + batch.length}/${teamIds.length})`
    );
  }

  return { totalUpdated, processed, failed };
}

/**
 * Main sync function for all teams in a competition
 */
export async function runFootyStatsTeamLastXSync(
  competitionId: number,
  forceFetch = false,
  concurrency = 5
) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;
  if (!apiKey) throw new Error("FOOTYSTATS_API_KEY missing");

  logger.info(
    `[FootyStats] Starting team LastX sync for competition_id=${competitionId}...`
  );

  const t0 = Date.now();

  // Get unique team IDs from matches
  const result = await pool.query(
    `
    SELECT DISTINCT unnest(ARRAY[home_team_fs_id, away_team_fs_id]) AS team_id
    FROM fs_matches
    WHERE competition_id = $1
      AND home_team_fs_id IS NOT NULL
      AND away_team_fs_id IS NOT NULL
    ORDER BY team_id
  `,
    [competitionId]
  );

  const teamIds = result.rows.map((r) => r.team_id);

  if (teamIds.length === 0) {
    logger.warn(
      `[FootyStats] No teams found in fs_matches for competition_id=${competitionId}`
    );
    return {
      ok: true,
      competition_id: competitionId,
      teams_count: 0,
      teams_processed: 0,
      total_updated: 0,
      failed: 0,
      duration_ms: Date.now() - t0,
    };
  }

  logger.info(
    `[FootyStats] Found ${teamIds.length} unique teams, processing LastX with concurrency=${concurrency}...`
  );

  // Process teams with controlled concurrency
  const { totalUpdated, processed, failed } = await syncMultipleTeamsLastX(
    teamIds,
    competitionId,
    apiKey,
    concurrency,
    forceFetch
  );

  const duration = Date.now() - t0;

  logger.info(`[FootyStats] Team LastX sync completed:`, {
    competition_id: competitionId,
    teams_count: teamIds.length,
    teams_processed: processed,
    total_updated: totalUpdated,
    failed,
    duration_ms: duration,
  });

  return {
    ok: true,
    competition_id: competitionId,
    teams_count: teamIds.length,
    teams_processed: processed,
    total_updated: totalUpdated,
    failed,
    duration_ms: duration,
  };
}
