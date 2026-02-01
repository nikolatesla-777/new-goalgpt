// src/jobs/footyStatsTeamsSeasonSync.job.ts
import crypto from "node:crypto";
import { pool } from "../database/connection";
import { logger } from "../utils/logger";

type LeagueSeasonResponse = Record<string, any>;
type TeamData = Record<string, any>;

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

async function upsertTeam(teamData: TeamData) {
  const sql = `
    INSERT INTO fs_teams (
      fs_team_id,
      original_id,
      country,
      continent,
      founded,
      stadium_name,
      stadium_address,
      image,
      image_thumb,
      flag_element,
      url,
      parent_url,
      verified,
      fetched_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
    )
    ON CONFLICT (fs_team_id) DO UPDATE SET
      country = EXCLUDED.country,
      continent = EXCLUDED.continent,
      founded = EXCLUDED.founded,
      stadium_name = EXCLUDED.stadium_name,
      image = EXCLUDED.image,
      verified = EXCLUDED.verified,
      fetched_at = NOW()
  `;

  const params = [
    teamData.id,
    teamData.original_id || null,
    teamData.country || null,
    teamData.continent || null,
    teamData.founded || null,
    teamData.stadium_name || null,
    teamData.stadium_address || null,
    teamData.image || null,
    teamData.image_thumb || null,
    teamData.flag_element || null,
    teamData.url || null,
    teamData.parent_url || null,
    teamData.verified || null,
  ];

  await pool.query(sql, params);
}

async function upsertTeamSeason(teamData: TeamData, fsSeasonId: number) {
  const sql = `
    INSERT INTO fs_team_seasons (
      fs_team_id,
      fs_season_id,
      season,
      season_clean,
      competition_id,
      tsapi_id,
      eo_id,
      dsg_id,
      tsapi_team_id,
      mapping_verified,
      seasonurl_overall,
      seasonurl_home,
      seasonurl_away,
      fetched_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
    )
    ON CONFLICT (fs_team_id, fs_season_id) DO UPDATE SET
      season = EXCLUDED.season,
      competition_id = EXCLUDED.competition_id,
      tsapi_id = EXCLUDED.tsapi_id,
      eo_id = EXCLUDED.eo_id,
      dsg_id = EXCLUDED.dsg_id,
      seasonurl_overall = EXCLUDED.seasonurl_overall,
      seasonurl_home = EXCLUDED.seasonurl_home,
      seasonurl_away = EXCLUDED.seasonurl_away,
      fetched_at = NOW()
  `;

  const params = [
    teamData.id,
    fsSeasonId,
    teamData.season || null,
    teamData.seasonClean || null,
    teamData.competition_id || null,
    teamData.tsapi_id || null,
    teamData.eo_id || null,
    teamData.dsg_id || null,
    null, // tsapi_team_id (Adım 2.3'te doldurulacak)
    false, // mapping_verified
    teamData.seasonURL_overall || null,
    teamData.seasonURL_home || null,
    teamData.seasonURL_away || null,
  ];

  await pool.query(sql, params);
}

async function upsertTeamSeasonStats(teamData: TeamData, fsSeasonId: number) {
  // Extract AI-critical fields from nested stats object
  const statsObj = teamData.stats || {};
  const seasonBttsPercentageOverall = Number(statsObj.seasonBTTSPercentage_overall ?? NaN);
  const seasonOver25PercentageOverall = Number(statsObj.seasonOver25Percentage_overall ?? NaN);
  const seasonOver35PercentageOverall = Number(statsObj.seasonOver35Percentage_overall ?? NaN);
  const seasonUnder25PercentageOverall = Number(statsObj.seasonUnder25Percentage_overall ?? NaN);
  const seasonAvgGoalsOverall = Number(statsObj.seasonAVG_overall ?? NaN);
  const seasonPpgOverall = Number(statsObj.seasonPPG_overall ?? NaN);
  const cornersAvgOverall = Number(statsObj.cornersAVG_overall ?? NaN);
  const cardsAvgOverall = Number(statsObj.cardsAVG_overall ?? NaN);
  const xgForAvgOverall = Number(statsObj.xg_for_avg_overall ?? NaN);
  const xgAgainstAvgOverall = Number(statsObj.xg_against_avg_overall ?? NaN);

  const normalized = {
    season_btts_percentage_overall: Number.isFinite(seasonBttsPercentageOverall) ? seasonBttsPercentageOverall : null,
    season_over25_percentage_overall: Number.isFinite(seasonOver25PercentageOverall) ? seasonOver25PercentageOverall : null,
    season_over35_percentage_overall: Number.isFinite(seasonOver35PercentageOverall) ? seasonOver35PercentageOverall : null,
    season_under25_percentage_overall: Number.isFinite(seasonUnder25PercentageOverall) ? seasonUnder25PercentageOverall : null,
    season_avg_goals_overall: Number.isFinite(seasonAvgGoalsOverall) ? seasonAvgGoalsOverall : null,
    season_ppg_overall: Number.isFinite(seasonPpgOverall) ? seasonPpgOverall : null,
    corners_avg_overall: Number.isFinite(cornersAvgOverall) ? cornersAvgOverall : null,
    cards_avg_overall: Number.isFinite(cardsAvgOverall) ? cardsAvgOverall : null,
    xg_for_avg_overall: Number.isFinite(xgForAvgOverall) ? xgForAvgOverall : null,
    xg_against_avg_overall: Number.isFinite(xgAgainstAvgOverall) ? xgAgainstAvgOverall : null,
  };

  // Hash for deterministik UPSERT
  const sourceHash = sha256Hex(stableStringify(teamData));

  const sql = `
    INSERT INTO fs_team_season_stats (
      fs_team_id,
      fs_season_id,
      season_btts_percentage_overall,
      season_over25_percentage_overall,
      season_over35_percentage_overall,
      season_under25_percentage_overall,
      season_avg_goals_overall,
      season_ppg_overall,
      corners_avg_overall,
      cards_avg_overall,
      xg_for_avg_overall,
      xg_against_avg_overall,
      stats,
      source_hash,
      fetched_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, NOW()
    )
    ON CONFLICT (fs_team_id, fs_season_id) DO UPDATE SET
      season_btts_percentage_overall = EXCLUDED.season_btts_percentage_overall,
      season_over25_percentage_overall = EXCLUDED.season_over25_percentage_overall,
      season_over35_percentage_overall = EXCLUDED.season_over35_percentage_overall,
      season_under25_percentage_overall = EXCLUDED.season_under25_percentage_overall,
      season_avg_goals_overall = EXCLUDED.season_avg_goals_overall,
      season_ppg_overall = EXCLUDED.season_ppg_overall,
      corners_avg_overall = EXCLUDED.corners_avg_overall,
      cards_avg_overall = EXCLUDED.cards_avg_overall,
      xg_for_avg_overall = EXCLUDED.xg_for_avg_overall,
      xg_against_avg_overall = EXCLUDED.xg_against_avg_overall,
      stats = EXCLUDED.stats,
      source_hash = EXCLUDED.source_hash,
      fetched_at = NOW()
    WHERE fs_team_season_stats.source_hash IS DISTINCT FROM EXCLUDED.source_hash
  `;

  const params = [
    teamData.id,
    fsSeasonId,
    normalized.season_btts_percentage_overall,
    normalized.season_over25_percentage_overall,
    normalized.season_over35_percentage_overall,
    normalized.season_under25_percentage_overall,
    normalized.season_avg_goals_overall,
    normalized.season_ppg_overall,
    normalized.corners_avg_overall,
    normalized.cards_avg_overall,
    normalized.xg_for_avg_overall,
    normalized.xg_against_avg_overall,
    JSON.stringify(teamData),
    sourceHash,
  ];

  const result = await pool.query(sql, params);
  return result.rowCount && result.rowCount > 0;
}

export async function runFootyStatsTeamsSeasonSync(fsSeasonId = 14972) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;
  if (!apiKey) throw new Error("FOOTYSTATS_API_KEY missing");

  const url = new URL("https://api.football-data-api.com/league-teams");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("season_id", String(fsSeasonId));
  url.searchParams.set("include", "stats");  // CRITICAL: get full team stats

  logger.info(`[FootyStats] Fetching teams for fs_season_id=${fsSeasonId}...`);

  const t0 = Date.now();
  const res = await fetch(url.toString(), { method: "GET" });
  const ms = Date.now() - t0;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FootyStats league-teams failed: ${res.status} ${res.statusText} (${ms}ms) :: ${body.slice(0, 300)}`);
  }

  const data: LeagueSeasonResponse = await res.json();

  // Get teams array from response
  const teams: TeamData[] = data?.data || [];

  if (teams.length === 0) {
    logger.warn(`[FootyStats] No teams found in response for fs_season_id=${fsSeasonId}`);
    return {
      ok: true,
      fs_season_id: fsSeasonId,
      teams_count: 0,
      duration_ms: ms,
    };
  }

  logger.info(`[FootyStats] Found ${teams.length} teams, processing...`);

  let teamsProcessed = 0;
  let statsUpdated = 0;

  for (const team of teams) {
    try {
      // 1) Upsert base team
      await upsertTeam(team);

      // 2) Upsert team season
      await upsertTeamSeason(team, fsSeasonId);

      // 3) Upsert team season stats (hash-guard)
      const wrote = await upsertTeamSeasonStats(team, fsSeasonId);
      if (wrote) statsUpdated++;

      teamsProcessed++;
    } catch (err: any) {
      logger.error(`[FootyStats] Failed to process team ${team.id} (${team.name}):`, err.message);
    }
  }

  logger.info(`[FootyStats] Teams sync completed:`, {
    fs_season_id: fsSeasonId,
    teams_total: teams.length,
    teams_processed: teamsProcessed,
    stats_updated: statsUpdated,
    duration_ms: ms,
  });

  return {
    ok: true,
    fs_season_id: fsSeasonId,
    teams_count: teams.length,
    teams_processed: teamsProcessed,
    stats_updated: statsUpdated,
    duration_ms: ms,
  };
}
