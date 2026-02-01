// src/jobs/footyStatsTeamsCatalogSync.job.ts
import crypto from "node:crypto";
import { pool } from "../database/connection";
import { logger } from "../utils/logger";

/**
 * TARGET SEASON: Only 2025/2026 (hard constraint)
 */
const TARGET_SEASON = "2025/2026";
const CONCURRENCY = 5;
const TTL_HOURS = 12;

type Competition = {
  competition_id: number;
  name: string;
  country: string;
};

type TeamData = {
  id: number;
  name: string;
  clean_name?: string;
  competition_id?: number;
  // ... other fields from API
};

type LeagueTeamsResponse = {
  success: boolean;
  data: TeamData[];
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
 * Normalize season to "2025/2026" format
 * Handles: "2025-2026", "2025/26", "2025/2026"
 */
function normalizeSeason(input: string): string {
  const s = input.trim();

  // "2025-2026" → "2025/2026"
  if (s === "2025-2026") return "2025/2026";

  // "2025/26" → "2025/2026"
  if (s === "2025/26") return "2025/2026";

  // Already normalized
  if (s === "2025/2026") return "2025/2026";

  // Unknown format - log warning
  logger.warn(`[TeamsCatalog] Unknown season format: "${s}", using as-is`);
  return s;
}

/**
 * Get enabled competitions from allowlist
 */
async function getEnabledCompetitions(): Promise<Competition[]> {
  const result = await pool.query(
    `
    SELECT competition_id, name, country
    FROM fs_competitions_allowlist
    WHERE is_enabled = TRUE
    ORDER BY competition_id ASC
  `
  );

  return result.rows;
}

/**
 * Get catalog hash for competition/season
 */
async function getCatalogHash(
  competitionId: number,
  season: string
): Promise<string | null> {
  const result = await pool.query(
    `SELECT get_catalog_hash($1, $2) as hash`,
    [competitionId, season]
  );

  return result.rows[0]?.hash || null;
}

/**
 * Set catalog hash for competition/season
 */
async function setCatalogHash(
  competitionId: number,
  season: string,
  hash: string
): Promise<void> {
  await pool.query(`SELECT set_catalog_hash($1, $2, $3)`, [
    competitionId,
    season,
    hash,
  ]);
}

/**
 * Check if catalog needs refresh (TTL: 12 hours)
 */
async function needsRefresh(
  competitionId: number,
  season: string,
  ttlHours = TTL_HOURS
): Promise<boolean> {
  const result = await pool.query(
    `
    SELECT updated_at
    FROM fs_job_hashes
    WHERE job_name = 'teams_catalog_sync'
      AND entity_key = $1
  `,
    [`${competitionId}:${season}`]
  );

  if (!result.rows[0]) return true;

  const lastUpdate = new Date(result.rows[0].updated_at);
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

  return hoursSinceUpdate >= ttlHours;
}

/**
 * Fetch league teams from FootyStats API with retry
 * NOTE: API does NOT accept season parameter - returns current season automatically
 */
async function fetchLeagueTeams(
  competitionId: number,
  apiKey: string,
  retries = 3
): Promise<TeamData[] | null> {
  const url = new URL("https://api.football-data-api.com/league-teams");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("league_id", String(competitionId));
  // NOTE: No season_id parameter - API returns current season (2025/2026)

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { method: "GET" });

      if (res.status === 429) {
        // Rate limit - exponential backoff
        const delay = Math.pow(2, attempt) * 500;
        logger.warn(
          `[TeamsCatalog] Rate limit for competition ${competitionId}, retry ${attempt}/${retries} after ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `FootyStats league-teams API failed: ${res.status} ${res.statusText} :: ${body.slice(0, 200)}`
        );
      }

      const data: LeagueTeamsResponse = await res.json();

      if (Array.isArray(data?.data)) {
        return data.data;
      }

      return null;
    } catch (err: any) {
      if (attempt === retries) {
        logger.error(
          `[TeamsCatalog] Failed to fetch competition ${competitionId} after ${retries} retries:`,
          err.message
        );
        return null;
      }

      const delay = Math.pow(2, attempt) * 500;
      logger.warn(
        `[TeamsCatalog] Error fetching competition ${competitionId}, retry ${attempt}/${retries} after ${delay}ms:`,
        err.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}

/**
 * Log anomaly to database
 */
async function logAnomaly(
  anomalyType: string,
  severity: string,
  entityId: string,
  expectedValue: string,
  actualValue: string,
  details: any
): Promise<void> {
  try {
    await pool.query(
      `SELECT log_sync_anomaly($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        'teams_catalog_sync',
        anomalyType,
        severity,
        'team',
        entityId,
        expectedValue,
        actualValue,
        JSON.stringify(details),
        'rejected',
      ]
    );
  } catch (err: any) {
    logger.error(`[TeamsCatalog] Failed to log anomaly:`, err.message);
  }
}

/**
 * Check if team should be rejected (data quality guard)
 * Returns: { reject: boolean, reason?: string }
 */
async function shouldRejectTeam(
  team: TeamData,
  competitionId: number,
  competitionName: string,
  season: string
): Promise<{ reject: boolean; reason?: string }> {
  // Guard 1: API competition_id mismatch
  if (team.competition_id && team.competition_id !== competitionId) {
    await logAnomaly(
      'competition_mismatch',
      'error',
      `team:${team.id}`,
      `competition_id=${competitionId}`,
      `api_competition_id=${team.competition_id}`,
      { team_name: team.name, competition_name: competitionName }
    );

    return {
      reject: true,
      reason: `API competition_id mismatch: expected=${competitionId}, got=${team.competition_id}`,
    };
  }

  // Guard 2: Check if team already exists in OTHER competition
  const existingResult = await pool.query(
    `
    SELECT competition_id, team_name
    FROM fs_teams_catalog
    WHERE team_id = $1 AND season = $2 AND competition_id != $3
    LIMIT 1
  `,
    [team.id, season, competitionId]
  );

  if (existingResult.rows.length > 0) {
    const existing = existingResult.rows[0];

    await logAnomaly(
      'duplicate_team',
      'warning',
      `team:${team.id}`,
      `single_competition`,
      `multiple_competitions`,
      {
        team_name: team.name,
        current_competition: competitionName,
        existing_competition_id: existing.competition_id,
      }
    );

    return {
      reject: true,
      reason: `Team already exists in competition_id=${existing.competition_id}`,
    };
  }

  return { reject: false };
}

/**
 * Get all existing team_ids in catalog (for duplicate check)
 */
async function getExistingTeamIds(season: string): Promise<Set<number>> {
  const result = await pool.query(
    `SELECT DISTINCT team_id FROM fs_teams_catalog WHERE season = $1`,
    [season]
  );

  return new Set(result.rows.map((r) => r.team_id));
}

/**
 * UPSERT teams to catalog with anomaly detection
 */
async function upsertTeamsCatalog(
  teams: TeamData[],
  competitionId: number,
  competitionName: string,
  season: string,
  sharedExistingTeamIds?: Set<number>
): Promise<{ inserted: number; updated: number; rejected: number }> {
  let inserted = 0;
  let updated = 0;
  let rejected = 0;

  // Use shared Set if provided (for batch processing), otherwise fetch
  const existingTeamIds = sharedExistingTeamIds || await getExistingTeamIds(season);

  for (const team of teams) {
    // Guard 1: API competition_id mismatch
    if (team.competition_id && team.competition_id !== competitionId) {
      await logAnomaly(
        'competition_mismatch',
        'error',
        `team:${team.id}`,
        `competition_id=${competitionId}`,
        `api_competition_id=${team.competition_id}`,
        { team_name: team.name, competition_name: competitionName }
      );

      logger.warn(
        `[TeamsCatalog] REJECTED team ${team.id} (${team.name}): API competition_id mismatch`
      );
      rejected++;
      continue;
    }

    // Guard 2: Duplicate team check (using pre-fetched set)
    if (existingTeamIds.has(team.id)) {
      await logAnomaly(
        'duplicate_team',
        'warning',
        `team:${team.id}`,
        `single_competition`,
        `multiple_competitions`,
        {
          team_name: team.name,
          current_competition: competitionName,
        }
      );

      logger.warn(
        `[TeamsCatalog] REJECTED team ${team.id} (${team.name}): Already exists in another competition`
      );
      rejected++;
      continue;
    }

    // If team passes guards, add to set for future checks in this batch
    existingTeamIds.add(team.id);

    const result = await pool.query(
      `
      INSERT INTO fs_teams_catalog (
        team_id,
        competition_id,
        season,
        team_name,
        meta,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
      ON CONFLICT (team_id, competition_id, season) DO UPDATE SET
        team_name = EXCLUDED.team_name,
        meta = EXCLUDED.meta,
        updated_at = NOW()
      RETURNING (xmax = 0) as is_insert
    `,
      [
        team.id,
        competitionId,
        season,
        team.name || team.clean_name || "Unknown",
        JSON.stringify(team),
      ]
    );

    if (result.rows[0]?.is_insert) {
      inserted++;
    } else {
      updated++;
    }
  }

  return { inserted, updated, rejected };
}

/**
 * Sync teams catalog for a single competition
 */
async function syncCompetitionCatalog(
  competition: Competition,
  apiKey: string,
  forceFetch = false,
  sharedExistingTeamIds?: Set<number>
): Promise<{
  ok: boolean;
  competition_id: number;
  inserted: number;
  updated: number;
  rejected: number;
  error?: string;
}> {
  const { competition_id, name } = competition;

  try {
    // Check TTL cache unless force fetch
    if (!forceFetch) {
      const refresh = await needsRefresh(competition_id, TARGET_SEASON, TTL_HOURS);
      if (!refresh) {
        logger.debug(
          `[TeamsCatalog] Competition ${competition_id} (${name}) cached, skipping fetch`
        );
        return { ok: true, competition_id, inserted: 0, updated: 0, rejected: 0 };
      }
    }

    // Fetch teams from API (API returns current season automatically)
    const teams = await fetchLeagueTeams(competition_id, apiKey);

    if (!teams || teams.length === 0) {
      logger.warn(`[TeamsCatalog] No teams returned for competition ${competition_id} (${name})`);
      return {
        ok: false,
        competition_id,
        inserted: 0,
        updated: 0,
        rejected: 0,
        error: "No teams returned from API",
      };
    }

    // Hash guard: check if data changed
    const payloadHash = sha256Hex(stableStringify(teams));
    const prevHash = await getCatalogHash(competition_id, TARGET_SEASON);

    if (prevHash === payloadHash) {
      logger.debug(
        `[TeamsCatalog] Competition ${competition_id} (${name}) hash unchanged, skipping UPSERT`
      );
      await setCatalogHash(competition_id, TARGET_SEASON, payloadHash);
      return { ok: true, competition_id, inserted: 0, updated: 0, rejected: 0 };
    }

    // UPSERT teams to catalog with anomaly detection
    const { inserted, updated, rejected } = await upsertTeamsCatalog(
      teams,
      competition_id,
      name, // competition name for logging
      TARGET_SEASON,
      sharedExistingTeamIds
    );

    // Update hash
    await setCatalogHash(competition_id, TARGET_SEASON, payloadHash);

    logger.info(
      `[TeamsCatalog] Competition ${competition_id} (${name}) synced: ${inserted} inserted, ${updated} updated, ${rejected} rejected`
    );

    return { ok: true, competition_id, inserted, updated, rejected };
  } catch (err: any) {
    logger.error(
      `[TeamsCatalog] Failed to sync competition ${competition_id} (${name}):`,
      err.message
    );
    return {
      ok: false,
      competition_id,
      inserted: 0,
      updated: 0,
      rejected: 0,
      error: err.message,
    };
  }
}

/**
 * Sync all enabled competitions with concurrency control
 */
async function syncAllCompetitionsCatalog(
  competitions: Competition[],
  apiKey: string,
  concurrency = CONCURRENCY,
  forceFetch = false
) {
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalRejected = 0;
  let processed = 0;
  let failed = 0;

  // Pre-fetch existing team IDs ONCE to prevent race conditions across parallel batches
  const sharedExistingTeamIds = await getExistingTeamIds(TARGET_SEASON);
  logger.debug(
    `[TeamsCatalog] Pre-fetched ${sharedExistingTeamIds.size} existing team IDs for duplicate check`
  );

  for (let i = 0; i < competitions.length; i += concurrency) {
    const batch = competitions.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (comp) => {
        const result = await syncCompetitionCatalog(comp, apiKey, forceFetch, sharedExistingTeamIds);
        if (result.ok) {
          totalInserted += result.inserted || 0;
          totalUpdated += result.updated || 0;
          totalRejected += result.rejected || 0;
          processed++;
        } else {
          failed++;
        }
        return result;
      })
    );

    // Log batch progress
    logger.info(
      `[TeamsCatalog] Batch ${Math.ceil((i + 1) / concurrency)} completed (${i + batch.length}/${competitions.length})`
    );
  }

  return { totalInserted, totalUpdated, totalRejected, processed, failed };
}

/**
 * Main export: Run Teams Catalog Sync
 *
 * @param forceFetch - Bypass TTL cache and force fetch from API
 * @param concurrency - Number of parallel API calls (default: 5)
 */
export async function runFootyStatsTeamsCatalogSync(
  forceFetch = false,
  concurrency = CONCURRENCY
) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;
  if (!apiKey) throw new Error("FOOTYSTATS_API_KEY missing");

  logger.info(
    `[TeamsCatalog] Starting Teams Catalog Sync for season ${TARGET_SEASON}...`
  );

  const t0 = Date.now();

  // Get enabled competitions from allowlist
  const competitions = await getEnabledCompetitions();

  if (competitions.length === 0) {
    logger.warn(
      `[TeamsCatalog] No enabled competitions found in allowlist`
    );
    return {
      ok: true,
      season: TARGET_SEASON,
      competitions_count: 0,
      competitions_processed: 0,
      total_inserted: 0,
      total_updated: 0,
      total_rejected: 0,
      failed: 0,
      duration_ms: Date.now() - t0,
    };
  }

  logger.info(
    `[TeamsCatalog] Found ${competitions.length} enabled competitions, processing with concurrency=${concurrency}...`
  );

  // Sync all competitions
  const { totalInserted, totalUpdated, totalRejected, processed, failed } =
    await syncAllCompetitionsCatalog(competitions, apiKey, concurrency, forceFetch);

  const duration = Date.now() - t0;

  logger.info(`[TeamsCatalog] Teams Catalog Sync completed:`, {
    season: TARGET_SEASON,
    competitions_count: competitions.length,
    competitions_processed: processed,
    total_inserted: totalInserted,
    total_updated: totalUpdated,
    total_rejected: totalRejected,
    failed,
    duration_ms: duration,
  });

  return {
    ok: true,
    season: TARGET_SEASON,
    competitions_count: competitions.length,
    competitions_processed: processed,
    total_inserted: totalInserted,
    total_updated: totalUpdated,
    total_rejected: totalRejected,
    failed,
    duration_ms: duration,
  };
}
