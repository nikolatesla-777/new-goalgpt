/**
 * Daily Lists Settlement Service
 *
 * AUTO-SETTLEMENT: Evaluates match results against 6 market predictions
 * Markets: OVER_25, OVER_15, BTTS, HT_OVER_05, CORNERS, CARDS
 *
 * CRITICAL RULES:
 * 1. Never guess outcomes - if data missing, mark VOID
 * 2. Use TheSports match data for settlement
 * 3. Map FootyStats matches to TheSports by match_id
 * 4. Log all evaluations for transparency
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { logger } from '../../utils/logger';
import { safeQuery } from '../../database/connection';

// ============================================================================
// TYPES
// ============================================================================

export interface MatchSettlement {
  match_id: string;
  fs_match_id: number;
  home_team: string;
  away_team: string;
  result: 'WIN' | 'LOSS' | 'VOID';
  home_score?: number;
  away_score?: number;
  reason?: string;
  rule?: string;
}

export interface ListSettlementResult {
  list_id: string;
  list_type: string;
  won: number;
  lost: number;
  void: number;
  matches: MatchSettlement[];
}

interface TheSportsMatchResult {
  external_id: string;
  home_name: string;
  away_name: string;
  status_id: number;
  home_score_display: number;
  away_score_display: number;
  home_scores: any[];
  away_scores: any[];
}

export interface DailyListRecord {
  id: string;
  market: string;
  list_date: string;
  matches: any;
  telegram_message_id: number;
  channel_id: string;
  preview: string;
}

// ============================================================================
// SETTLEMENT THRESHOLDS (USER CONFIGURABLE)
// ============================================================================

// Updated 2026-02-02: User confirmed new thresholds
const CORNERS_THRESHOLD = 8;  // Total corners >= 8 = WIN (7.5 ÜST)
const CARDS_THRESHOLD = 4;    // Total cards >= 4 = WIN (3.5 ÜST)

// ============================================================================
// CORE EVALUATION FUNCTIONS
// ============================================================================

/**
 * Evaluate a single match against market criteria
 *
 * @param marketType - Market to evaluate (OVER_25, OVER_15, BTTS, HT_OVER_05, CORNERS, CARDS)
 * @param matchResult - TheSports match data
 * @param teamStats - Team statistics (for CORNERS and CARDS)
 * @returns Settlement result (WIN/LOSS/VOID with reasoning)
 */
export function evaluateMatch(
  marketType: string,
  matchResult: TheSportsMatchResult,
  teamStats?: any[]
): MatchSettlement {
  const baseResult: Omit<MatchSettlement, 'result' | 'reason' | 'rule'> = {
    match_id: matchResult.external_id,
    fs_match_id: 0, // Will be set by caller
    home_team: matchResult.home_name,
    away_team: matchResult.away_name,
  };

  // SAFETY GUARD: Check match status based on market type
  // HT_OVER_05: Can settle after halftime (status_id >= 3)
  // Other markets: Must wait until match ends (status_id = 8)

  if (marketType === 'HT_OVER_05') {
    // For HT markets, we can settle once halftime is complete (status >= 3)
    // Status 3 = Halftime, 4 = Second Half, 5 = Overtime, 7 = Penalties, 8 = Ended
    if (matchResult.status_id < 3) {
      logger.warn(`[DailyListsSettlement] HT market - match still in first half`, {
        match_id: matchResult.external_id,
        status_id: matchResult.status_id,
        market: marketType,
      });

      return {
        ...baseResult,
        result: 'VOID',
        reason: 'First half not complete yet',
        rule: `Status: ${matchResult.status_id} (HT not available)`,
      };
    }
  } else {
    // For full-time markets, match must be finished (status_id = 8)
    if (matchResult.status_id !== 8) {
      logger.warn(`[DailyListsSettlement] Match not finished`, {
        match_id: matchResult.external_id,
        status_id: matchResult.status_id,
        market: marketType,
      });

      return {
        ...baseResult,
        result: 'VOID',
        reason: 'Match not finished',
        rule: `Status: ${matchResult.status_id} (not ENDED)`,
      };
    }
  }

  const homeScore = matchResult.home_score_display || 0;
  const awayScore = matchResult.away_score_display || 0;
  const totalGoals = homeScore + awayScore;

  switch (marketType) {
    case 'OVER_25':
      return {
        ...baseResult,
        result: totalGoals >= 3 ? 'WIN' : 'LOSS',
        home_score: homeScore,
        away_score: awayScore,
        rule: `O2.5: Total goals >= 3 (${totalGoals} goals)`,
      };

    case 'OVER_15':
      return {
        ...baseResult,
        result: totalGoals >= 2 ? 'WIN' : 'LOSS',
        home_score: homeScore,
        away_score: awayScore,
        rule: `O1.5: Total goals >= 2 (${totalGoals} goals)`,
      };

    case 'BTTS':
      return {
        ...baseResult,
        result: homeScore > 0 && awayScore > 0 ? 'WIN' : 'LOSS',
        home_score: homeScore,
        away_score: awayScore,
        rule: `BTTS: Both teams score (${homeScore > 0 && awayScore > 0 ? 'Yes' : 'No'})`,
      };

    case 'HT_OVER_05': {
      // Extract half-time scores from JSONB arrays
      // TheSports stores scores in two formats:
      // 1. Array of numbers: [1, 0, ...] where [0] = HT score
      // 2. Array of objects: [{score: 1}, ...] (legacy)

      let htHome: number;
      let htAway: number;

      // Handle both array formats
      if (typeof matchResult.home_scores?.[0] === 'number') {
        // Format 1: Direct number array
        htHome = matchResult.home_scores[0];
        htAway = matchResult.away_scores[0];
      } else if (typeof matchResult.home_scores?.[0] === 'object') {
        // Format 2: Object array (legacy)
        htHome = matchResult.home_scores[0]?.score;
        htAway = matchResult.away_scores[0]?.score;
      } else {
        htHome = null;
        htAway = null;
      }

      // SAFETY GUARD: Validate HT data exists
      if (htHome === null || htHome === undefined || htAway === null || htAway === undefined) {
        logger.warn(`[DailyListsSettlement] HT data missing`, {
          match_id: matchResult.external_id,
          home_scores: matchResult.home_scores,
          away_scores: matchResult.away_scores,
        });

        return {
          ...baseResult,
          result: 'VOID',
          reason: 'Half-time data missing',
          rule: 'HT O0.5: HT data unavailable',
        };
      }

      const htTotal = parseInt(String(htHome)) + parseInt(String(htAway));

      return {
        ...baseResult,
        result: htTotal >= 1 ? 'WIN' : 'LOSS',
        home_score: homeScore,
        away_score: awayScore,
        rule: `HT O0.5: HT total >= 1 (HT: ${htTotal} goals)`,
      };
    }

    case 'CORNERS': {
      // PRIORITY 1: Use team stats API (more accurate)
      if (teamStats && Array.isArray(teamStats) && teamStats.length === 2) {
        const homeTeamStats = teamStats[0];
        const awayTeamStats = teamStats[1];

        const cornersHome = homeTeamStats?.corner_kicks ?? null;
        const cornersAway = awayTeamStats?.corner_kicks ?? null;

        if (cornersHome !== null && cornersAway !== null) {
          const totalCorners = parseInt(String(cornersHome)) + parseInt(String(cornersAway));

          return {
            ...baseResult,
            result: totalCorners >= CORNERS_THRESHOLD ? 'WIN' : 'LOSS',
            home_score: homeScore,
            away_score: awayScore,
            rule: `CORNERS O7.5: Total >= ${CORNERS_THRESHOLD} (${totalCorners} corners)`,
            reason: `${totalCorners} corners (${cornersHome} + ${cornersAway})`,
          };
        }
      }

      // FALLBACK: Use home_scores/away_scores array (less accurate)
      let cornersHome: number;
      let cornersAway: number;

      // Handle both array formats
      if (typeof matchResult.home_scores?.[4] === 'number') {
        cornersHome = matchResult.home_scores[4];
        cornersAway = matchResult.away_scores[4];
      } else if (typeof matchResult.home_scores?.[4] === 'object') {
        cornersHome = matchResult.home_scores[4]?.score;
        cornersAway = matchResult.away_scores[4]?.score;
      } else {
        cornersHome = null;
        cornersAway = null;
      }

      // SAFETY GUARD: Validate corner data exists
      if (cornersHome === null || cornersHome === undefined || cornersAway === null || cornersAway === undefined) {
        logger.warn(`[DailyListsSettlement] Corner data missing`, {
          match_id: matchResult.external_id,
          home_scores: matchResult.home_scores,
          away_scores: matchResult.away_scores,
          team_stats_available: !!teamStats,
        });

        return {
          ...baseResult,
          result: 'VOID',
          reason: 'Corner data not available',
          rule: 'CORNERS: Corner stats unavailable',
        };
      }

      const totalCorners = parseInt(String(cornersHome)) + parseInt(String(cornersAway));

      return {
        ...baseResult,
        result: totalCorners >= CORNERS_THRESHOLD ? 'WIN' : 'LOSS',
        home_score: homeScore,
        away_score: awayScore,
        rule: `CORNERS O7.5: Total >= ${CORNERS_THRESHOLD} (${totalCorners} corners - fallback)`,
        reason: `${totalCorners} corners`,
      };
    }

    case 'CARDS': {
      // PRIORITY 1: Use team stats API (more accurate)
      if (teamStats && Array.isArray(teamStats) && teamStats.length === 2) {
        const homeTeamStats = teamStats[0];
        const awayTeamStats = teamStats[1];

        const cardsHome = homeTeamStats?.yellow_cards ?? null;
        const cardsAway = awayTeamStats?.yellow_cards ?? null;

        if (cardsHome !== null && cardsAway !== null) {
          const totalCards = parseInt(String(cardsHome)) + parseInt(String(cardsAway));

          return {
            ...baseResult,
            result: totalCards >= CARDS_THRESHOLD ? 'WIN' : 'LOSS',
            home_score: homeScore,
            away_score: awayScore,
            rule: `CARDS O3.5: Total >= ${CARDS_THRESHOLD} (${totalCards} cards)`,
            reason: `${totalCards} yellow cards (${cardsHome} + ${cardsAway})`,
          };
        }
      }

      // FALLBACK: Use home_scores/away_scores array (less accurate)
      let cardsHome: number;
      let cardsAway: number;

      // Handle both array formats
      if (typeof matchResult.home_scores?.[2] === 'number') {
        cardsHome = matchResult.home_scores[2];
        cardsAway = matchResult.away_scores[2];
      } else if (typeof matchResult.home_scores?.[2] === 'object') {
        cardsHome = matchResult.home_scores[2]?.score;
        cardsAway = matchResult.away_scores[2]?.score;
      } else {
        cardsHome = null;
        cardsAway = null;
      }

      // SAFETY GUARD: Validate card data exists
      if (cardsHome === null || cardsHome === undefined || cardsAway === null || cardsAway === undefined) {
        logger.warn(`[DailyListsSettlement] Card data missing`, {
          match_id: matchResult.external_id,
          home_scores: matchResult.home_scores,
          away_scores: matchResult.away_scores,
          team_stats_available: !!teamStats,
        });

        return {
          ...baseResult,
          result: 'VOID',
          reason: 'Card data not available',
          rule: 'CARDS: Card stats unavailable',
        };
      }

      const totalCards = parseInt(String(cardsHome)) + parseInt(String(cardsAway));

      return {
        ...baseResult,
        result: totalCards >= CARDS_THRESHOLD ? 'WIN' : 'LOSS',
        home_score: homeScore,
        away_score: awayScore,
        rule: `CARDS O3.5: Total >= ${CARDS_THRESHOLD} (${totalCards} cards - fallback)`,
        reason: `${totalCards} yellow cards`,
      };
    }

    default:
      logger.error(`[DailyListsSettlement] Unknown market type`, {
        market_type: marketType,
        match_id: matchResult.external_id,
      });

      return {
        ...baseResult,
        result: 'VOID',
        reason: 'Unknown market type',
        rule: `Unknown market: ${marketType}`,
      };
  }
}

/**
 * Map FootyStats match to TheSports match using external_id
 *
 * CRITICAL: Assumes matches JSONB array contains objects with:
 * - match_id: TheSports external_id (alphanumeric)
 * - fs_match_id: FootyStats ID (numeric)
 * - home_team, away_team, league, match_time, confidence
 */
async function getTheSportsMatchData(matchId: string): Promise<TheSportsMatchResult | null> {
  try {
    const results = await safeQuery<TheSportsMatchResult>(
      `SELECT
        external_id,
        home_name,
        away_name,
        status_id,
        home_score_display,
        away_score_display,
        home_scores,
        away_scores
       FROM ts_matches
       WHERE external_id = $1`,
      [matchId]
    );

    if (results.length === 0) {
      logger.warn(`[DailyListsSettlement] Match not found in TheSports`, {
        match_id: matchId,
      });
      return null;
    }

    return results[0];

  } catch (error: any) {
    logger.error(`[DailyListsSettlement] Error fetching match data`, {
      match_id: matchId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Settle a single daily list by evaluating all matches
 *
 * @param list - Daily list record from database
 * @returns Settlement result with win/loss/void counts
 */
export async function settleDailyList(list: DailyListRecord): Promise<ListSettlementResult> {
  logger.info(`[DailyListsSettlement] Settling list ${list.market} for ${list.list_date}`, {
    list_id: list.id,
    market: list.market,
  });

  // Parse matches JSONB array
  const matches = JSON.parse(JSON.stringify(list.matches));
  const settlements: MatchSettlement[] = [];

  // Extract all match IDs
  const matchIds = matches.map((m: any) => m.match.match_id).filter(Boolean);

  if (matchIds.length === 0) {
    logger.warn(`[DailyListsSettlement] No match IDs found in list`, {
      list_id: list.id,
      market: list.market,
    });

    return {
      list_id: list.id,
      list_type: list.market,
      won: 0,
      lost: 0,
      void: 0,
      matches: [],
    };
  }

  // Fetch all match results in one query (performance optimization)
  const matchResults = await safeQuery<TheSportsMatchResult>(
    `SELECT
      m.external_id,
      ht.name as home_name,
      at.name as away_name,
      m.status_id,
      m.home_score_display,
      m.away_score_display,
      m.home_scores,
      m.away_scores
     FROM ts_matches m
     JOIN ts_teams ht ON m.home_team_id = ht.external_id
     JOIN ts_teams at ON m.away_team_id = at.external_id
     WHERE m.external_id = ANY($1)`,
    [matchIds]
  );

  // Create lookup map for O(1) access
  const resultsMap = new Map<string, TheSportsMatchResult>();
  matchResults.forEach(r => resultsMap.set(r.external_id, r));

  // Fetch team stats for CORNERS and CARDS markets from ts_match_stats table
  let teamStatsMap = new Map<string, any>();
  if (list.market === 'CORNERS' || list.market === 'CARDS') {
    try {
      // Query ts_match_stats table directly instead of API
      const statsResults = await safeQuery<any>(
        `SELECT
          match_id,
          home_corner,
          away_corner,
          home_yellow_cards,
          away_yellow_cards
         FROM ts_match_stats
         WHERE match_id = ANY($1)`,
        [matchIds]
      );

      // Map to format expected by evaluateMatch function
      statsResults.forEach(row => {
        teamStatsMap.set(row.match_id, [
          {
            corner_kicks: row.home_corner ?? 0,
            yellow_cards: row.home_yellow_cards ?? 0,
          },
          {
            corner_kicks: row.away_corner ?? 0,
            yellow_cards: row.away_yellow_cards ?? 0,
          }
        ]);
      });

      logger.info(`[DailyListsSettlement] Fetched team stats from ts_match_stats for ${teamStatsMap.size}/${matchIds.length} matches`, {
        market: list.market,
      });

    } catch (err: any) {
      logger.error(`[DailyListsSettlement] Error fetching team stats from database`, {
        error: err.message,
        market: list.market,
      });
    }
  }

  // Evaluate each match
  for (const matchCandidate of matches) {
    const match = matchCandidate.match;
    const matchId = match.match_id;

    if (!matchId) {
      settlements.push({
        match_id: 'unknown',
        fs_match_id: match.fs_id || 0,
        home_team: match.home_name || 'Unknown',
        away_team: match.away_name || 'Unknown',
        result: 'VOID',
        reason: 'Match ID missing',
        rule: 'NO_MATCH_ID',
      });
      continue;
    }

    const matchResult = resultsMap.get(matchId);

    if (!matchResult) {
      logger.warn(`[DailyListsSettlement] Match not found in database`, {
        match_id: matchId,
        fs_match_id: match.fs_id,
      });

      settlements.push({
        match_id: matchId,
        fs_match_id: match.fs_id || 0,
        home_team: match.home_name || 'Unknown',
        away_team: match.away_name || 'Unknown',
        result: 'VOID',
        reason: 'Match not found in database',
        rule: 'MATCH_NOT_FOUND',
      });
      continue;
    }

    // Get team stats for this match (if available)
    const matchTeamStats = teamStatsMap.get(matchId);

    // Evaluate match against market
    const settlement = evaluateMatch(list.market, matchResult, matchTeamStats);
    settlement.fs_match_id = match.fs_id || 0;

    settlements.push(settlement);

    logger.info(`[DailyListsSettlement] Match evaluated`, {
      list_id: list.id,
      match_id: matchId,
      market: list.market,
      result: settlement.result,
      rule: settlement.rule,
    });
  }

  // Count results
  const won = settlements.filter(s => s.result === 'WIN').length;
  const lost = settlements.filter(s => s.result === 'LOSS').length;
  const voidCount = settlements.filter(s => s.result === 'VOID').length;

  logger.info(`[DailyListsSettlement] List settled`, {
    list_id: list.id,
    market: list.market,
    won,
    lost,
    void: voidCount,
    total: settlements.length,
  });

  return {
    list_id: list.id,
    list_type: list.market,
    won,
    lost,
    void: voidCount,
    matches: settlements,
  };
}

/**
 * Format settlement results for Telegram message edit
 *
 * @param listType - Market type (OVER_25, BTTS, etc.)
 * @param result - Settlement result
 * @param originalMessage - Original Telegram message preview
 * @returns Formatted message with settlement results
 */
export function formatSettlementMessage(
  listType: string,
  result: ListSettlementResult,
  originalMessage: string
): string {
  const marketLabels: Record<string, string> = {
    OVER_25: 'Alt/Üst 2.5 Gol',
    OVER_15: 'Alt/Üst 1.5 Gol',
    BTTS: 'Karşılıklı Gol (BTTS)',
    HT_OVER_05: 'İlk Yarı 0.5 Üst',
    CORNERS: 'Korner',
    CARDS: 'Kart',
  };

  const marketLabel = marketLabels[listType] || listType;

  // Choose emoji based on win rate
  const totalSettled = result.won + result.lost;
  const winRate = totalSettled > 0 ? (result.won / totalSettled) * 100 : 0;
  let emoji = '⚠️';
  if (totalSettled === 0) emoji = '⏳'; // All void
  else if (winRate === 100) emoji = '🎉'; // Perfect
  else if (winRate >= 70) emoji = '✅'; // Good
  else if (winRate >= 50) emoji = '⚠️'; // Average
  else emoji = '❌'; // Poor

  let message = `${emoji} <b>${marketLabel} - SONUÇLANDI</b>\n\n`;

  // Summary
  message += `📊 <b>Sonuç:</b> ${result.won}/${totalSettled}\n`;
  message += `✅ Kazanan: ${result.won}\n`;
  message += `❌ Kaybeden: ${result.lost}\n`;

  if (result.void > 0) {
    message += `⚪ Geçersiz: ${result.void}\n`;
  }

  message += `\n`;

  // Match-by-match results (first 10 only to avoid message length limits)
  message += `📋 <b>Maç Sonuçları:</b>\n`;
  const displayMatches = result.matches.slice(0, 10);

  for (const match of displayMatches) {
    // Clear Won/Lost/Void badges with emojis
    let badge = '';
    if (match.result === 'WIN') {
      badge = '✅ <b>Kazandı</b>';
    } else if (match.result === 'VOID') {
      badge = '⚪ <b>Geçersiz</b>';
    } else {
      badge = '❌ <b>Kaybetti</b>';
    }

    // Format score clearly
    const scoreStr = match.home_score !== undefined && match.away_score !== undefined
      ? `<b>${match.home_score}-${match.away_score}</b>`
      : '-';

    // Format: ✅ Kazandı | Man City 3-1 Chelsea
    message += `${badge} | ${match.home_team} ${scoreStr} ${match.away_team}`;

    if (match.reason) {
      message += ` (${match.reason})`;
    }
    message += `\n`;
  }

  if (result.matches.length > 10) {
    message += `\n... ve ${result.matches.length - 10} maç daha\n`;
  }

  // Timestamp
  const now = new Date();
  const timeStr = now.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  message += `\n⏱ Sonuçlandırma: ${timeStr}`;

  return message;
}

/**
 * Get today's date in Istanbul timezone (YYYY-MM-DD format)
 */
export function getTodayInIstanbul(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}
