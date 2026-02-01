// src/jobs/footyStatsLeagueMatchesSeasonSync.job.ts
import crypto from "node:crypto";
import { pool } from "../database/connection";
import { logger } from "../utils/logger";

type MatchData = Record<string, any>;
type LeagueMatchesResponse = {
  success: boolean;
  data: MatchData[];
  pager?: {
    current_page: number;
    max_page: number;
  };
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

async function upsertMatch(matchData: MatchData, fixtureHash: string) {
  const sql = `
    INSERT INTO fs_matches (
      fs_match_id,
      fs_season_id,
      competition_id,
      status,
      round_id,
      game_week,
      revised_game_week,
      home_team_fs_id,
      away_team_fs_id,
      winning_team_fs_id,
      date_unix,
      date,
      stadium_id,
      stadium_name,
      stadium_location,
      referee_id,
      coach_home_id,
      coach_away_id,
      no_home_away,
      source_hash,
      fetched_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
    )
    ON CONFLICT (fs_match_id) DO UPDATE SET
      status = EXCLUDED.status,
      game_week = EXCLUDED.game_week,
      revised_game_week = EXCLUDED.revised_game_week,
      winning_team_fs_id = EXCLUDED.winning_team_fs_id,
      date_unix = EXCLUDED.date_unix,
      date = EXCLUDED.date,
      source_hash = EXCLUDED.source_hash,
      updated_at = NOW()
    WHERE fs_matches.source_hash IS DISTINCT FROM EXCLUDED.source_hash
  `;

  const params = [
    matchData.id,
    matchData.competition_id || null,
    matchData.competition_id || null,
    matchData.status || null,
    matchData.round_id || null,
    matchData.game_week || null,
    matchData.revised_game_week || null,
    matchData.homeID || null,
    matchData.awayID || null,
    matchData.winningTeamID || null,
    matchData.date_unix || null,
    matchData.date || null,
    matchData.stadium_id || null,
    matchData.stadium_name || null,
    matchData.stadium_location || null,
    matchData.referee_id || null,
    matchData.coach_home_id || null,
    matchData.coach_away_id || null,
    matchData.no_home_away || null,
    fixtureHash,
  ];

  const result = await pool.query(sql, params);
  return result.rowCount && result.rowCount > 0;
}

async function upsertMatchStats(matchData: MatchData, statsHash: string) {
  // Derived flags
  const totalGoals = (matchData.homeGoalCount || 0) + (matchData.awayGoalCount || 0);
  const btts = (matchData.homeGoalCount || 0) > 0 && (matchData.awayGoalCount || 0) > 0;
  const over05 = totalGoals >= 1;
  const over15 = totalGoals >= 2;
  const over25 = totalGoals >= 3;
  const over35 = totalGoals >= 4;
  const over45 = totalGoals >= 5;
  const over55 = totalGoals >= 6;

  const cornersTotal = (matchData.team_a_corners || 0) + (matchData.team_b_corners || 0);
  const over65Corners = cornersTotal >= 7;
  const over75Corners = cornersTotal >= 8;
  const over85Corners = cornersTotal >= 9;
  const over95Corners = cornersTotal >= 10;
  const over105Corners = cornersTotal >= 11;

  const cardsTotal = (matchData.team_a_cards || 0) + (matchData.team_b_cards || 0);
  const over25Cards = cardsTotal >= 3;
  const over35Cards = cardsTotal >= 4;
  const over45Cards = cardsTotal >= 5;

  const sql = `
    INSERT INTO fs_match_stats (
      fs_match_id,
      home_goal_count,
      away_goal_count,
      total_goal_count,
      ht_home,
      ht_away,
      ht_goal_count,
      home_goals_jsonb,
      away_goals_jsonb,
      events_jsonb,
      corners_home,
      corners_away,
      corners_total,
      cards_home,
      cards_away,
      cards_total,
      shots_home,
      shots_away,
      shots_total,
      shots_on_target_home,
      shots_on_target_away,
      fouls_home,
      fouls_away,
      possession_home,
      possession_away,
      offsides_home,
      offsides_away,
      xg_home,
      xg_away,
      odds_ft_1,
      odds_ft_x,
      odds_ft_2,
      odds_ft_over25,
      odds_ft_under25,
      odds_btts_yes,
      odds_btts_no,
      btts,
      over05,
      over15,
      over25,
      over35,
      over45,
      over55,
      over65_corners,
      over75_corners,
      over85_corners,
      over95_corners,
      over105_corners,
      over25_cards,
      over35_cards,
      over45_cards,
      raw_jsonb,
      source_hash,
      fetched_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
      $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
      $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
      $51, $52::jsonb, $53, NOW(), NOW()
    )
    ON CONFLICT (fs_match_id) DO UPDATE SET
      home_goal_count = EXCLUDED.home_goal_count,
      away_goal_count = EXCLUDED.away_goal_count,
      total_goal_count = EXCLUDED.total_goal_count,
      ht_home = EXCLUDED.ht_home,
      ht_away = EXCLUDED.ht_away,
      ht_goal_count = EXCLUDED.ht_goal_count,
      home_goals_jsonb = EXCLUDED.home_goals_jsonb,
      away_goals_jsonb = EXCLUDED.away_goals_jsonb,
      events_jsonb = EXCLUDED.events_jsonb,
      corners_home = EXCLUDED.corners_home,
      corners_away = EXCLUDED.corners_away,
      corners_total = EXCLUDED.corners_total,
      cards_home = EXCLUDED.cards_home,
      cards_away = EXCLUDED.cards_away,
      cards_total = EXCLUDED.cards_total,
      shots_home = EXCLUDED.shots_home,
      shots_away = EXCLUDED.shots_away,
      shots_total = EXCLUDED.shots_total,
      shots_on_target_home = EXCLUDED.shots_on_target_home,
      shots_on_target_away = EXCLUDED.shots_on_target_away,
      fouls_home = EXCLUDED.fouls_home,
      fouls_away = EXCLUDED.fouls_away,
      possession_home = EXCLUDED.possession_home,
      possession_away = EXCLUDED.possession_away,
      offsides_home = EXCLUDED.offsides_home,
      offsides_away = EXCLUDED.offsides_away,
      xg_home = EXCLUDED.xg_home,
      xg_away = EXCLUDED.xg_away,
      odds_ft_1 = EXCLUDED.odds_ft_1,
      odds_ft_x = EXCLUDED.odds_ft_x,
      odds_ft_2 = EXCLUDED.odds_ft_2,
      odds_ft_over25 = EXCLUDED.odds_ft_over25,
      odds_ft_under25 = EXCLUDED.odds_ft_under25,
      odds_btts_yes = EXCLUDED.odds_btts_yes,
      odds_btts_no = EXCLUDED.odds_btts_no,
      btts = EXCLUDED.btts,
      over05 = EXCLUDED.over05,
      over15 = EXCLUDED.over15,
      over25 = EXCLUDED.over25,
      over35 = EXCLUDED.over35,
      over45 = EXCLUDED.over45,
      over55 = EXCLUDED.over55,
      over65_corners = EXCLUDED.over65_corners,
      over75_corners = EXCLUDED.over75_corners,
      over85_corners = EXCLUDED.over85_corners,
      over95_corners = EXCLUDED.over95_corners,
      over105_corners = EXCLUDED.over105_corners,
      over25_cards = EXCLUDED.over25_cards,
      over35_cards = EXCLUDED.over35_cards,
      over45_cards = EXCLUDED.over45_cards,
      raw_jsonb = EXCLUDED.raw_jsonb,
      source_hash = EXCLUDED.source_hash,
      updated_at = NOW()
    WHERE fs_match_stats.source_hash IS DISTINCT FROM EXCLUDED.source_hash
  `;

  const params = [
    matchData.id,
    matchData.homeGoalCount || null,
    matchData.awayGoalCount || null,
    totalGoals,
    matchData.ht_home || null,
    matchData.ht_away || null,
    (matchData.ht_home || 0) + (matchData.ht_away || 0),
    JSON.stringify(matchData.home_goals || []),
    JSON.stringify(matchData.away_goals || []),
    JSON.stringify(matchData.events || []),
    matchData.team_a_corners || null,
    matchData.team_b_corners || null,
    cornersTotal,
    matchData.team_a_cards || null,
    matchData.team_b_cards || null,
    cardsTotal,
    matchData.team_a_shots || null,
    matchData.team_b_shots || null,
    (matchData.team_a_shots || 0) + (matchData.team_b_shots || 0),
    matchData.team_a_shotsOnTarget || null,
    matchData.team_b_shotsOnTarget || null,
    matchData.team_a_fouls || null,
    matchData.team_b_fouls || null,
    matchData.team_a_possession || null,
    matchData.team_b_possession || null,
    matchData.team_a_offsides || null,
    matchData.team_b_offsides || null,
    matchData.team_a_xg || null,
    matchData.team_b_xg || null,
    matchData.odds_ft_1 || null,
    matchData.odds_ft_x || null,
    matchData.odds_ft_2 || null,
    matchData.odds_ft_over25 || null,
    matchData.odds_ft_under25 || null,
    matchData.odds_btts_yes || null,
    matchData.odds_btts_no || null,
    btts,
    over05,
    over15,
    over25,
    over35,
    over45,
    over55,
    over65Corners,
    over75Corners,
    over85Corners,
    over95Corners,
    over105Corners,
    over25Cards,
    over35Cards,
    over45Cards,
    JSON.stringify(matchData),
    statsHash,
  ];

  const result = await pool.query(sql, params);
  return result.rowCount && result.rowCount > 0;
}

export async function runFootyStatsLeagueMatchesSeasonSync(fsSeasonId = 14972, maxPerPage = 1000) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;
  if (!apiKey) throw new Error("FOOTYSTATS_API_KEY missing");

  logger.info(`[FootyStats] Fetching matches for fs_season_id=${fsSeasonId}...`);

  let page = 1;
  let totalMatches = 0;
  let matchesProcessed = 0;
  let fixturesUpdated = 0;
  let statsUpdated = 0;

  const t0 = Date.now();

  while (true) {
    const url = new URL("https://api.football-data-api.com/league-matches");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("season_id", String(fsSeasonId));
    url.searchParams.set("max_per_page", String(maxPerPage));
    url.searchParams.set("page", String(page));

    logger.info(`[FootyStats] Fetching page ${page} (max_per_page=${maxPerPage})...`);

    const res = await fetch(url.toString(), { method: "GET" });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`FootyStats league-matches failed: ${res.status} ${res.statusText} :: ${body.slice(0, 300)}`);
    }

    const data: LeagueMatchesResponse = await res.json();
    const matches: MatchData[] = data?.data || [];

    if (matches.length === 0) {
      logger.info(`[FootyStats] No more matches on page ${page}, stopping`);
      break;
    }

    logger.info(`[FootyStats] Processing ${matches.length} matches from page ${page}...`);

    for (const match of matches) {
      try {
        // Separate fixture and stats data for hash
        const fixtureData = {
          id: match.id,
          competition_id: match.competition_id,
          status: match.status,
          round_id: match.round_id,
          game_week: match.game_week,
          revised_game_week: match.revised_game_week,
          homeID: match.homeID,
          awayID: match.awayID,
          winningTeamID: match.winningTeamID,
          date_unix: match.date_unix,
          date: match.date,
          stadium_id: match.stadium_id,
          stadium_name: match.stadium_name,
          stadium_location: match.stadium_location,
          referee_id: match.referee_id,
          coach_home_id: match.coach_home_id,
          coach_away_id: match.coach_away_id,
          no_home_away: match.no_home_away,
        };

        const fixtureHash = sha256Hex(stableStringify(fixtureData));
        const statsHash = sha256Hex(stableStringify(match));

        // Upsert fixture
        const fixtureWrote = await upsertMatch(match, fixtureHash);
        if (fixtureWrote) fixturesUpdated++;

        // Upsert stats
        const statsWrote = await upsertMatchStats(match, statsHash);
        if (statsWrote) statsUpdated++;

        matchesProcessed++;
      } catch (err: any) {
        logger.error(`[FootyStats] Failed to process match ${match.id}:`, err.message);
      }
    }

    totalMatches += matches.length;

    // Stop if we got fewer matches than max_per_page (last page)
    if (matches.length < maxPerPage) {
      logger.info(`[FootyStats] Page ${page} returned ${matches.length} < ${maxPerPage}, stopping`);
      break;
    }

    page++;
  }

  const duration = Date.now() - t0;

  logger.info(`[FootyStats] Matches sync completed:`, {
    fs_season_id: fsSeasonId,
    pages_fetched: page,
    matches_total: totalMatches,
    matches_processed: matchesProcessed,
    fixtures_updated: fixturesUpdated,
    stats_updated: statsUpdated,
    duration_ms: duration,
  });

  return {
    ok: true,
    fs_season_id: fsSeasonId,
    pages_fetched: page,
    matches_total: totalMatches,
    matches_processed: matchesProcessed,
    fixtures_updated: fixturesUpdated,
    stats_updated: statsUpdated,
    duration_ms: duration,
  };
}
