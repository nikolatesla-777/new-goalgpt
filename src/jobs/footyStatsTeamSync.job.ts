// src/jobs/footyStatsTeamSync.job.ts
import crypto from "node:crypto";
import { pool } from "../database/connection";
import { logger } from "../utils/logger";

type TeamData = Record<string, any>;
type TeamResponse = {
  success: boolean;
  data: TeamData;
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
 * Normalize FootyStats sentinel values (-1, -2, etc.) to null
 */
function normalizeSentinel(value: any): any {
  if (typeof value === "number" && value < 0) return null;
  return value;
}

/**
 * Extract AI-critical fields from stats object with safe fallback
 */
function extractAICriticalFields(teamData: TeamData) {
  const stats = teamData.stats || {};

  // Normalize numeric fields
  const matchesPlayedOverall = normalizeSentinel(stats.seasonMatchesPlayed_overall);
  const goalsScoredOverall = normalizeSentinel(stats.seasonGoals_overall);
  const goalsConcededOverall = normalizeSentinel(stats.seasonConceded_overall);
  const ppgOverall = normalizeSentinel(stats.seasonPPG_overall);
  const bttsPctOverall = normalizeSentinel(stats.seasonBTTSPercentage_overall);
  const over25PctOverall = normalizeSentinel(stats.seasonOver25Percentage_overall);
  const cornersAvgOverall = normalizeSentinel(
    stats.cornersAVG_overall ?? stats.cornersTotalAVG_overall
  );
  const cardsAvgOverall = normalizeSentinel(stats.cardsAVG_overall);

  return {
    matches_played_overall: Number.isFinite(Number(matchesPlayedOverall))
      ? Number(matchesPlayedOverall)
      : null,
    goals_scored_overall: Number.isFinite(Number(goalsScoredOverall))
      ? Number(goalsScoredOverall)
      : null,
    goals_conceded_overall: Number.isFinite(Number(goalsConcededOverall))
      ? Number(goalsConcededOverall)
      : null,
    ppg_overall: Number.isFinite(Number(ppgOverall)) ? Number(ppgOverall) : null,
    btts_pct_overall: Number.isFinite(Number(bttsPctOverall))
      ? Number(bttsPctOverall)
      : null,
    over25_pct_overall: Number.isFinite(Number(over25PctOverall))
      ? Number(over25PctOverall)
      : null,
    corners_avg_overall: Number.isFinite(Number(cornersAvgOverall))
      ? Number(cornersAvgOverall)
      : null,
    cards_avg_overall: Number.isFinite(Number(cardsAvgOverall))
      ? Number(cardsAvgOverall)
      : null,
  };
}

/**
 * UPSERT team metadata (without stats)
 */
async function upsertTeamSnapshot(teamData: TeamData) {
  // Create meta object (exclude stats for hash)
  const metaData = {
    team_id: teamData.id,
    competition_id: teamData.competition_id,
    season: teamData.season,
    name: teamData.name,
    full_name: teamData.full_name,
    english_name: teamData.english_name,
    country: teamData.country,
    founded: teamData.founded,
    image: teamData.image,
    url: teamData.url,
    season_format: teamData.seasonFormat,
    table_position: teamData.table_position,
    performance_rank: teamData.performance_rank,
    risk: teamData.risk,
    stadium_name: teamData.stadium_name,
    stadium_address: teamData.stadium_address,
  };

  const metaHash = sha256Hex(stableStringify(metaData));

  const sql = `
    INSERT INTO fs_team_snapshots (
      team_id,
      competition_id,
      season,
      name,
      full_name,
      english_name,
      country,
      founded,
      image,
      url,
      season_format,
      table_position,
      performance_rank,
      risk,
      stadium_name,
      stadium_address,
      raw,
      source_hash,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, NOW(), NOW()
    )
    ON CONFLICT (team_id, competition_id, season) DO UPDATE SET
      name = EXCLUDED.name,
      full_name = EXCLUDED.full_name,
      english_name = EXCLUDED.english_name,
      country = EXCLUDED.country,
      founded = EXCLUDED.founded,
      image = EXCLUDED.image,
      url = EXCLUDED.url,
      season_format = EXCLUDED.season_format,
      table_position = EXCLUDED.table_position,
      performance_rank = EXCLUDED.performance_rank,
      risk = EXCLUDED.risk,
      stadium_name = EXCLUDED.stadium_name,
      stadium_address = EXCLUDED.stadium_address,
      raw = EXCLUDED.raw,
      source_hash = EXCLUDED.source_hash,
      updated_at = NOW()
    WHERE fs_team_snapshots.source_hash IS DISTINCT FROM EXCLUDED.source_hash
  `;

  const params = [
    teamData.id,
    teamData.competition_id,
    teamData.season,
    teamData.name || null,
    teamData.full_name || null,
    teamData.english_name || null,
    teamData.country || null,
    teamData.founded || null,
    teamData.image || null,
    teamData.url || null,
    teamData.seasonFormat || null,
    teamData.table_position || null,
    teamData.performance_rank || null,
    teamData.risk || null,
    teamData.stadium_name || null,
    teamData.stadium_address || null,
    JSON.stringify(teamData), // Full payload
    metaHash,
  ];

  const result = await pool.query(sql, params);
  return result.rowCount && result.rowCount > 0;
}

/**
 * UPSERT team stats (with hash guard)
 */
async function upsertTeamSnapshotStats(teamData: TeamData) {
  const extracted = extractAICriticalFields(teamData);
  const statsHash = sha256Hex(stableStringify(teamData.stats || {}));

  const sql = `
    INSERT INTO fs_team_snapshot_stats (
      team_id,
      competition_id,
      season,
      matches_played_overall,
      goals_scored_overall,
      goals_conceded_overall,
      ppg_overall,
      btts_pct_overall,
      over25_pct_overall,
      corners_avg_overall,
      cards_avg_overall,
      stats_raw,
      source_hash,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, NOW(), NOW()
    )
    ON CONFLICT (team_id, competition_id, season) DO UPDATE SET
      matches_played_overall = EXCLUDED.matches_played_overall,
      goals_scored_overall = EXCLUDED.goals_scored_overall,
      goals_conceded_overall = EXCLUDED.goals_conceded_overall,
      ppg_overall = EXCLUDED.ppg_overall,
      btts_pct_overall = EXCLUDED.btts_pct_overall,
      over25_pct_overall = EXCLUDED.over25_pct_overall,
      corners_avg_overall = EXCLUDED.corners_avg_overall,
      cards_avg_overall = EXCLUDED.cards_avg_overall,
      stats_raw = EXCLUDED.stats_raw,
      source_hash = EXCLUDED.source_hash,
      updated_at = NOW()
    WHERE fs_team_snapshot_stats.source_hash IS DISTINCT FROM EXCLUDED.source_hash
  `;

  const params = [
    teamData.id,
    teamData.competition_id,
    teamData.season,
    extracted.matches_played_overall,
    extracted.goals_scored_overall,
    extracted.goals_conceded_overall,
    extracted.ppg_overall,
    extracted.btts_pct_overall,
    extracted.over25_pct_overall,
    extracted.corners_avg_overall,
    extracted.cards_avg_overall,
    JSON.stringify(teamData.stats || {}),
    statsHash,
  ];

  const result = await pool.query(sql, params);
  return result.rowCount && result.rowCount > 0;
}

/**
 * Fetch individual team data from FootyStats API with retry
 * Returns array of TeamData (one per season/competition)
 */
async function fetchTeamData(
  teamId: number,
  apiKey: string,
  retries = 3
): Promise<TeamData[] | null> {
  const url = new URL("https://api.football-data-api.com/team");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("team_id", String(teamId));
  url.searchParams.set("include", "stats"); // CRITICAL!

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { method: "GET" });

      if (res.status === 429) {
        // Rate limit - exponential backoff
        const delay = Math.pow(2, attempt) * 500;
        logger.warn(`[FootyStats] Rate limit for team ${teamId}, retry ${attempt}/${retries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`FootyStats team API failed: ${res.status} ${res.statusText} :: ${body.slice(0, 200)}`);
      }

      const data: TeamResponse = await res.json();

      // FootyStats /team endpoint returns an ARRAY of season/competition snapshots
      if (Array.isArray(data?.data)) {
        return data.data;
      }

      return null;
    } catch (err: any) {
      if (attempt === retries) {
        logger.error(`[FootyStats] Failed to fetch team ${teamId} after ${retries} retries:`, err.message);
        return null;
      }

      const delay = Math.pow(2, attempt) * 500;
      logger.warn(`[FootyStats] Error fetching team ${teamId}, retry ${attempt}/${retries} after ${delay}ms:`, err.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}

/**
 * Get unique team IDs from fs_matches for a given competition/season
 */
async function getTeamIdsFromMatches(
  competitionId: number,
  season: string
): Promise<number[]> {
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

  return result.rows.map((r) => r.team_id);
}

/**
 * Process teams with controlled concurrency
 */
async function processTeamsWithConcurrency(
  teamIds: number[],
  apiKey: string,
  concurrency = 5
) {
  let metaUpdated = 0;
  let statsUpdated = 0;
  let processed = 0;
  let failed = 0;
  let seasonSnapshots = 0;

  // Process in batches
  for (let i = 0; i < teamIds.length; i += concurrency) {
    const batch = teamIds.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (teamId) => {
        const teamDataArray = await fetchTeamData(teamId, apiKey);
        if (!teamDataArray || teamDataArray.length === 0) {
          failed++;
          return null;
        }

        // Process all season/competition snapshots for this team
        for (const teamData of teamDataArray) {
          // UPSERT meta
          const metaWrote = await upsertTeamSnapshot(teamData);
          if (metaWrote) metaUpdated++;

          // UPSERT stats
          const statsWrote = await upsertTeamSnapshotStats(teamData);
          if (statsWrote) statsUpdated++;

          seasonSnapshots++;
        }

        processed++;
        return teamDataArray;
      })
    );

    // Log batch progress
    logger.info(
      `[FootyStats] Processed batch ${Math.ceil((i + 1) / concurrency)} (${i + batch.length}/${teamIds.length})`
    );
  }

  return { processed, metaUpdated, statsUpdated, failed, seasonSnapshots };
}

/**
 * Main sync function
 */
export async function runFootyStatsTeamSync(
  competitionId: number,
  season: string,
  concurrency = 5
) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;
  if (!apiKey) throw new Error("FOOTYSTATS_API_KEY missing");

  logger.info(`[FootyStats] Starting team sync for competition_id=${competitionId}, season=${season}...`);

  const t0 = Date.now();

  // Get unique team IDs from matches
  const teamIds = await getTeamIdsFromMatches(competitionId, season);

  if (teamIds.length === 0) {
    logger.warn(`[FootyStats] No teams found in fs_matches for competition_id=${competitionId}`);
    return {
      ok: true,
      competition_id: competitionId,
      season,
      teams_count: 0,
      teams_processed: 0,
      meta_updated: 0,
      stats_updated: 0,
      failed: 0,
      duration_ms: Date.now() - t0,
    };
  }

  logger.info(`[FootyStats] Found ${teamIds.length} unique teams, processing with concurrency=${concurrency}...`);

  // Process teams with controlled concurrency
  const { processed, metaUpdated, statsUpdated, failed, seasonSnapshots } =
    await processTeamsWithConcurrency(teamIds, apiKey, concurrency);

  const duration = Date.now() - t0;

  logger.info(`[FootyStats] Team sync completed:`, {
    competition_id: competitionId,
    season,
    teams_count: teamIds.length,
    teams_processed: processed,
    season_snapshots: seasonSnapshots,
    meta_updated: metaUpdated,
    stats_updated: statsUpdated,
    failed,
    duration_ms: duration,
  });

  return {
    ok: true,
    competition_id: competitionId,
    season,
    teams_count: teamIds.length,
    teams_processed: processed,
    season_snapshots: seasonSnapshots,
    meta_updated: metaUpdated,
    stats_updated: statsUpdated,
    failed,
    duration_ms: duration,
  };
}
