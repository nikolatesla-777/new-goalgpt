// src/jobs/footyStatsLeagueSeasonStatsSync.job.ts
import crypto from "node:crypto";
import { pool } from "../database/connection";
import { logger } from "../utils/logger";

type LeagueSeasonResponse = Record<string, any>;

function stableStringify(value: any): string {
  // Minimal stable stringify (dependency yok)
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

export async function runFootyStatsSeasonStatsUpsert(fsSeasonId = 14972, maxTime?: number) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;
  if (!apiKey) throw new Error("FOOTYSTATS_API_KEY missing");

  const url = new URL("https://api.football-data-api.com/league-season");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("season_id", String(fsSeasonId));
  if (maxTime) url.searchParams.set("max_time", String(maxTime));

  logger.info(`[FootyStats] Fetching season stats for fs_season_id=${fsSeasonId}...`);

  const t0 = Date.now();
  const res = await fetch(url.toString(), { method: "GET" });
  const ms = Date.now() - t0;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FootyStats league-season failed: ${res.status} ${res.statusText} (${ms}ms) :: ${body.slice(0, 300)}`);
  }

  const data: LeagueSeasonResponse = await res.json();

  // 1) Ham payload'ı saklayacağız (stats JSONB)
  const statsPayload = data;

  // 2) Extracted (AI-critical) alanlar - data object içinden al
  const seasonData = statsPayload?.data || {};
  const seasonBTTSPercentage = Number(seasonData.seasonBTTSPercentage ?? NaN);
  const seasonOver25PercentageOverall = Number(seasonData.seasonOver25Percentage_overall ?? NaN);
  const cornersAVGOverall = Number(seasonData.cornersAVG_overall ?? NaN);
  const cardsAVGOverall = Number(seasonData.cardsAVG_overall ?? NaN);
  const seasonAvgGoalsOverall = Number(seasonData.seasonAVG_overall ?? NaN);
  const seasonAvgGoalsHome = Number(seasonData.seasonAVG_home ?? NaN);
  const seasonAvgGoalsAway = Number(seasonData.seasonAVG_away ?? NaN);
  const seasonOver35PercentageOverall = Number(seasonData.seasonOver35Percentage_overall ?? NaN);
  const seasonUnder25PercentageOverall = Number(seasonData.seasonUnder25Percentage_overall ?? NaN);

  const normalized = {
    fs_season_id: fsSeasonId,
    season_btts_percentage: Number.isFinite(seasonBTTSPercentage) ? seasonBTTSPercentage : null,
    season_over25_percentage: Number.isFinite(seasonOver25PercentageOverall) ? seasonOver25PercentageOverall : null,
    season_over35_percentage: Number.isFinite(seasonOver35PercentageOverall) ? seasonOver35PercentageOverall : null,
    season_under25_percentage: Number.isFinite(seasonUnder25PercentageOverall) ? seasonUnder25PercentageOverall : null,
    season_avg_goals_overall: Number.isFinite(seasonAvgGoalsOverall) ? seasonAvgGoalsOverall : null,
    season_avg_goals_home: Number.isFinite(seasonAvgGoalsHome) ? seasonAvgGoalsHome : null,
    season_avg_goals_away: Number.isFinite(seasonAvgGoalsAway) ? seasonAvgGoalsAway : null,
    corners_avg_overall: Number.isFinite(cornersAVGOverall) ? cornersAVGOverall : null,
    cards_avg_overall: Number.isFinite(cardsAVGOverall) ? cardsAVGOverall : null,
    stats: statsPayload,
  };

  // 3) Hash (deterministik)
  const sourceHash = sha256Hex(stableStringify(statsPayload));

  // 4) UPSERT (hash değişmediyse update yok)
  const sql = `
    INSERT INTO fs_league_season_stats (
      fs_season_id,
      season_btts_percentage,
      season_over25_percentage,
      season_over35_percentage,
      season_under25_percentage,
      season_avg_goals_overall,
      season_avg_goals_home,
      season_avg_goals_away,
      corners_avg_overall,
      cards_avg_overall,
      stats,
      source_hash,
      fetched_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, NOW()
    )
    ON CONFLICT (fs_season_id) DO UPDATE
    SET
      season_btts_percentage   = EXCLUDED.season_btts_percentage,
      season_over25_percentage = EXCLUDED.season_over25_percentage,
      season_over35_percentage = EXCLUDED.season_over35_percentage,
      season_under25_percentage = EXCLUDED.season_under25_percentage,
      season_avg_goals_overall = EXCLUDED.season_avg_goals_overall,
      season_avg_goals_home    = EXCLUDED.season_avg_goals_home,
      season_avg_goals_away    = EXCLUDED.season_avg_goals_away,
      corners_avg_overall      = EXCLUDED.corners_avg_overall,
      cards_avg_overall        = EXCLUDED.cards_avg_overall,
      stats                    = EXCLUDED.stats,
      source_hash              = EXCLUDED.source_hash,
      fetched_at               = NOW()
    WHERE fs_league_season_stats.source_hash IS DISTINCT FROM EXCLUDED.source_hash
    RETURNING fs_season_id, source_hash, fetched_at;
  `;

  const params = [
    normalized.fs_season_id,
    normalized.season_btts_percentage,
    normalized.season_over25_percentage,
    normalized.season_over35_percentage,
    normalized.season_under25_percentage,
    normalized.season_avg_goals_overall,
    normalized.season_avg_goals_home,
    normalized.season_avg_goals_away,
    normalized.corners_avg_overall,
    normalized.cards_avg_overall,
    JSON.stringify(normalized.stats),
    sourceHash,
  ];

  const result = await pool.query(sql, params);

  const wrote = result.rowCount && result.rowCount > 0;

  logger.info(`[FootyStats] Season stats upsert completed:`, {
    fs_season_id: fsSeasonId,
    wrote,
    source_hash: sourceHash,
    duration_ms: ms,
    extracted_fields: {
      season_btts_percentage: normalized.season_btts_percentage,
      season_over25_percentage: normalized.season_over25_percentage,
      season_avg_goals_overall: normalized.season_avg_goals_overall,
      corners_avg_overall: normalized.corners_avg_overall,
      cards_avg_overall: normalized.cards_avg_overall,
    }
  });

  return {
    ok: true,
    fs_season_id: fsSeasonId,
    wrote,
    source_hash: sourceHash,
    duration_ms: ms,
  };
}
