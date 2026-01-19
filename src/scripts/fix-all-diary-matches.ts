/**
 * Fix All Diary Matches Script
 *
 * This script fetches diary data from TheSports API for multiple days
 * and syncs ALL matches to the database with correct timestamps.
 *
 * TheSports API uses UTC+8 (China) timezone for diary filtering.
 * We need to fetch multiple days and filter by TSI boundaries.
 *
 * Usage: npm run fix:diary or tsx src/scripts/fix-all-diary-matches.ts
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { theSportsAPI } from '../core/TheSportsAPIManager';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';

// TSI (Turkey) offset: UTC+3
const TSI_OFFSET_MS = 3 * 60 * 60 * 1000;
const TSI_OFFSET_SECONDS = 3 * 60 * 60;

// How many days to fetch (today + future days)
const DAYS_TO_FETCH = 7; // Fetch 7 days of data

interface DiaryMatch {
  id: string;
  season_id?: string;
  competition_id?: string;
  home_team_id?: string;
  away_team_id?: string;
  status_id?: number;
  status?: number;
  match_time?: number;
  home_scores?: number[];
  away_scores?: number[];
  [key: string]: any;
}

/**
 * Get date string in YYYYMMDD format for a given offset from today (TSI)
 */
function getDateTSI(daysOffset: number = 0): string {
  const dateTSI = new Date(Date.now() + TSI_OFFSET_MS + daysOffset * 24 * 60 * 60 * 1000);
  const year = dateTSI.getUTCFullYear();
  const month = String(dateTSI.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateTSI.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Get TSI day boundaries as Unix timestamps
 */
function getTSIDayBoundaries(dateStr: string): { start: number; end: number } {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));

  const startUTC = Math.floor(Date.UTC(year, month, day, 0, 0, 0) / 1000) - TSI_OFFSET_SECONDS;
  const endUTC = Math.floor(Date.UTC(year, month, day, 23, 59, 59) / 1000) - TSI_OFFSET_SECONDS;

  return { start: startUTC, end: endUTC };
}

/**
 * Calculate display score
 */
function calculateDisplayScore(
  regularScore: number | null,
  overtimeScore: number | null,
  penaltyScore: number | null
): number {
  const regular = regularScore || 0;
  const overtime = overtimeScore || 0;
  const penalty = penaltyScore || 0;

  if (overtime > 0) {
    return overtime + penalty;
  }
  return regular + penalty;
}

/**
 * Fetch diary from TheSports API
 */
async function fetchDiary(dateStr: string): Promise<any> {
  try {
    const response = await theSportsAPI.get('/match/diary', { date: dateStr });
    return response;
  } catch (error: any) {
    logger.error(`Failed to fetch diary for ${dateStr}: ${error.message}`);
    return { results: [], results_extra: {} };
  }
}

/**
 * Sync a single match to database
 */
async function syncMatch(match: DiaryMatch): Promise<boolean> {
  try {
    const statusId = typeof match.status === 'number' ? match.status :
                    (match.status_id || match.status || 1);

    const homeScores = match.home_scores || [];
    const awayScores = match.away_scores || [];

    const homeRegularScore = homeScores[0] ?? null;
    const homeOvertimeScore = homeScores[5] ?? null;
    const homePenaltyScore = homeScores[6] ?? null;

    const awayRegularScore = awayScores[0] ?? null;
    const awayOvertimeScore = awayScores[5] ?? null;
    const awayPenaltyScore = awayScores[6] ?? null;

    const homeDisplayScore = calculateDisplayScore(homeRegularScore, homeOvertimeScore, homePenaltyScore);
    const awayDisplayScore = calculateDisplayScore(awayRegularScore, awayOvertimeScore, awayPenaltyScore);

    await pool.query(`
      INSERT INTO ts_matches (
        external_id, season_id, competition_id, home_team_id, away_team_id,
        status_id, match_time, home_scores, away_scores,
        home_score_display, away_score_display,
        home_score_regular, away_score_regular,
        home_score_overtime, away_score_overtime,
        home_score_penalties, away_score_penalties,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      ON CONFLICT (external_id) DO UPDATE SET
        status_id = EXCLUDED.status_id,
        match_time = EXCLUDED.match_time,
        home_scores = EXCLUDED.home_scores,
        away_scores = EXCLUDED.away_scores,
        home_score_display = EXCLUDED.home_score_display,
        away_score_display = EXCLUDED.away_score_display,
        home_score_regular = EXCLUDED.home_score_regular,
        away_score_regular = EXCLUDED.away_score_regular,
        home_score_overtime = EXCLUDED.home_score_overtime,
        away_score_overtime = EXCLUDED.away_score_overtime,
        home_score_penalties = EXCLUDED.home_score_penalties,
        away_score_penalties = EXCLUDED.away_score_penalties,
        updated_at = NOW()
    `, [
      match.id,
      match.season_id || null,
      match.competition_id || null,
      match.home_team_id || null,
      match.away_team_id || null,
      statusId,
      match.match_time || null,
      JSON.stringify(homeScores),
      JSON.stringify(awayScores),
      homeDisplayScore,
      awayDisplayScore,
      homeRegularScore,
      awayRegularScore,
      homeOvertimeScore,
      awayOvertimeScore,
      homePenaltyScore,
      awayPenaltyScore
    ]);

    return true;
  } catch (error: any) {
    // Silently fail for connection pool errors, will retry
    if (!error.message.includes('MaxClientsInSessionMode')) {
      logger.warn(`Failed to sync match ${match.id}: ${error.message}`);
    }
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();

  logger.info('='.repeat(60));
  logger.info('🔧 FIX ALL DIARY MATCHES - Starting comprehensive sync');
  logger.info('='.repeat(60));

  const teamDataService = new TeamDataService();
  const competitionService = new CompetitionService();

  // Collect all unique matches from all days
  const allMatches = new Map<string, DiaryMatch>();
  const allResultsExtra: any[] = [];

  // Fetch diary for multiple days
  // TheSports uses UTC+8, so we need to fetch today-1, today, today+1, ..., today+DAYS_TO_FETCH
  const datesToFetch: string[] = [];
  for (let i = -1; i <= DAYS_TO_FETCH; i++) {
    datesToFetch.push(getDateTSI(i));
  }

  logger.info(`📅 Fetching diary for ${datesToFetch.length} days: ${datesToFetch.join(', ')}`);

  for (const dateStr of datesToFetch) {
    logger.info(`🔄 Fetching diary for ${dateStr}...`);
    const response = await fetchDiary(dateStr);

    const matchCount = response.results?.length || 0;
    logger.info(`   Found ${matchCount} matches`);

    if (response.results) {
      for (const match of response.results) {
        const matchId = match.id;
        if (matchId && !allMatches.has(matchId)) {
          allMatches.set(matchId, match);
        }
      }
    }

    if (response.results_extra) {
      allResultsExtra.push(response.results_extra);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  logger.info(`📊 Total unique matches collected: ${allMatches.size}`);

  // Populate teams and competitions
  logger.info('🔄 Populating teams and competitions...');
  for (const extra of allResultsExtra) {
    if (extra.team) {
      await teamDataService.enrichFromResultsExtra(extra);
    }
    if (extra.competition) {
      await competitionService.enrichFromResultsExtra(extra);
    }
  }
  logger.info('✅ Teams and competitions populated');

  // Group matches by TSI date for logging
  const matchesByDate = new Map<string, DiaryMatch[]>();

  for (const match of allMatches.values()) {
    if (!match.match_time) continue;

    // Convert match_time to TSI date string
    const matchTimeTSI = new Date((match.match_time + TSI_OFFSET_SECONDS) * 1000);
    const dateStr = `${matchTimeTSI.getUTCFullYear()}${String(matchTimeTSI.getUTCMonth() + 1).padStart(2, '0')}${String(matchTimeTSI.getUTCDate()).padStart(2, '0')}`;

    if (!matchesByDate.has(dateStr)) {
      matchesByDate.set(dateStr, []);
    }
    matchesByDate.get(dateStr)!.push(match);
  }

  // Log matches by date
  logger.info('📊 Matches grouped by TSI date:');
  const sortedDates = Array.from(matchesByDate.keys()).sort();
  for (const date of sortedDates) {
    const matches = matchesByDate.get(date)!;
    logger.info(`   ${date}: ${matches.length} matches`);
  }

  // Sync all matches to database with batching
  logger.info('🔄 Syncing all matches to database...');

  let syncedCount = 0;
  let errorCount = 0;
  const batchSize = 10; // Process in small batches to avoid connection pool issues
  const matchArray = Array.from(allMatches.values());

  for (let i = 0; i < matchArray.length; i += batchSize) {
    const batch = matchArray.slice(i, i + batchSize);

    const results = await Promise.all(batch.map(match => syncMatch(match)));

    for (const success of results) {
      if (success) {
        syncedCount++;
      } else {
        errorCount++;
      }
    }

    // Progress log every 100 matches
    if ((i + batchSize) % 100 === 0 || i + batchSize >= matchArray.length) {
      logger.info(`   Progress: ${Math.min(i + batchSize, matchArray.length)}/${matchArray.length} (synced: ${syncedCount}, errors: ${errorCount})`);
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const duration = Date.now() - startTime;

  logger.info('='.repeat(60));
  logger.info('✅ FIX ALL DIARY MATCHES - Completed');
  logger.info(`   Duration: ${duration}ms`);
  logger.info(`   Total matches processed: ${allMatches.size}`);
  logger.info(`   Successfully synced: ${syncedCount}`);
  logger.info(`   Errors: ${errorCount}`);
  logger.info('='.repeat(60));

  // Verify Turkish Super League matches for today
  const todayStr = getDateTSI(0);
  const { start, end } = getTSIDayBoundaries(todayStr);

  const tslResult = await pool.query(`
    SELECT
      m.external_id,
      m.match_time,
      m.status_id,
      ht.name as home_team,
      at.name as away_team
    FROM ts_matches m
    LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
    LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
    WHERE m.competition_id = '8y39mp1h6jmojxg'
      AND m.match_time >= $1
      AND m.match_time <= $2
    ORDER BY m.match_time
  `, [start, end]);

  logger.info(`\n📊 Turkish Super League matches for ${todayStr} (TSI):`);
  for (const row of tslResult.rows) {
    const matchTimeTSI = new Date((parseInt(row.match_time) + TSI_OFFSET_SECONDS) * 1000);
    const timeStr = `${String(matchTimeTSI.getUTCHours()).padStart(2, '0')}:${String(matchTimeTSI.getUTCMinutes()).padStart(2, '0')}`;
    logger.info(`   ${row.home_team} vs ${row.away_team} @ ${timeStr} TSI (status: ${row.status_id})`);
  }

  process.exit(0);
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
