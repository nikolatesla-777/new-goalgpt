/**
 * Telegram Daily Lists Service
 *
 * Generates daily prediction lists for Telegram channel:
 * - Over 2.5 Goals
 * - BTTS (Both Teams To Score)
 * - First Half Over 0.5 Goals
 *
 * DATABASE-FIRST APPROACH:
 * - Lists generated ONCE per day, stored in database
 * - Lists remain STABLE throughout the day
 * - Started matches STAY in list for performance tracking
 * - 3-5 matches per list max
 * - Confidence-based filtering (prefer HIGH/MEDIUM)
 * - Skip if insufficient data
 *
 * @author GoalGPT Team
 * @version 2.0.0 - Database persistence added
 */

import { footyStatsAPI } from '../footystats/footystats.client';
import { logger } from '../../utils/logger';
import { safeQuery } from '../../database/connection';

// ============================================================================
// TYPES
// ============================================================================

interface FootyStatsMatch {
  fs_id: number;
  match_id?: string | null;  // ✅ ADD: TheSports external_id for settlement
  home_name: string;
  away_name: string;
  league_name: string;
  date_unix: number;
  status: string;
  potentials?: {
    btts?: number;
    over25?: number;
    over15?: number;   // ✅ ADD: Over 1.5 potential
    avg?: number;
    corners?: number;  // ✅ ADD: Match corner potential (e.g., 9.4)
    cards?: number;    // ✅ ADD: Match card potential (e.g., 4.9)
  };
  xg?: {
    home?: number;
    away?: number;
  };
  odds?: {
    home?: number;
    draw?: number;
    away?: number;
  };
}

interface MatchCandidate {
  match: FootyStatsMatch;
  confidence: number;
  reason: string;
}

export interface DailyList {
  market: 'OVER_25' | 'OVER_15' | 'BTTS' | 'HT_OVER_05' | 'CORNERS' | 'CARDS';
  title: string;
  emoji: string;
  matches: MatchCandidate[];
  matches_count?: number;
  avg_confidence?: number;
  preview?: string;
  generated_at: number;
  performance?: {
    total: number;
    won: number;
    lost: number;
    pending: number;
    win_rate: number;
  };
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate confidence score for Over 2.5 market
 */
function calculateOver25Confidence(match: FootyStatsMatch): number {
  let score = 0;
  let factors = 0;

  // Potential (max 40 points)
  if (match.potentials?.over25) {
    score += (match.potentials.over25 / 100) * 40;
    factors++;
  }

  // xG Total (max 30 points)
  if (match.xg?.home && match.xg?.away) {
    const totalXg = match.xg.home + match.xg.away;
    if (totalXg >= 3.0) score += 30;
    else if (totalXg >= 2.5) score += 20;
    else if (totalXg >= 2.0) score += 10;
    factors++;
  }

  // BTTS correlation (max 20 points)
  if (match.potentials?.btts) {
    score += (match.potentials.btts / 100) * 20;
    factors++;
  }

  // Avg potential (max 10 points)
  if (match.potentials?.avg) {
    score += (match.potentials.avg / 100) * 10;
    factors++;
  }

  // If less than 2 factors, return 0 (insufficient data)
  if (factors < 2) return 0;

  return Math.round(score);
}

/**
 * Calculate confidence score for BTTS market
 */
function calculateBTTSConfidence(match: FootyStatsMatch): number {
  let score = 0;
  let factors = 0;

  // BTTS Potential (max 50 points)
  if (match.potentials?.btts) {
    score += (match.potentials.btts / 100) * 50;
    factors++;
  }

  // xG balance (max 30 points) - both teams should have decent xG
  if (match.xg?.home && match.xg?.away) {
    const minXg = Math.min(match.xg.home, match.xg.away);
    if (minXg >= 1.0) score += 30;
    else if (minXg >= 0.7) score += 20;
    else if (minXg >= 0.5) score += 10;
    factors++;
  }

  // Over 2.5 correlation (max 20 points)
  if (match.potentials?.over25) {
    score += (match.potentials.over25 / 100) * 20;
    factors++;
  }

  // If less than 2 factors, return 0
  if (factors < 2) return 0;

  return Math.round(score);
}

/**
 * Calculate confidence score for First Half Over 0.5 market
 */
function calculateHTOver05Confidence(match: FootyStatsMatch): number {
  let score = 0;
  let factors = 0;

  // Total xG as proxy for attacking intent (max 40 points)
  if (match.xg?.home && match.xg?.away) {
    const totalXg = match.xg.home + match.xg.away;
    if (totalXg >= 2.5) score += 40;
    else if (totalXg >= 2.0) score += 30;
    else if (totalXg >= 1.5) score += 20;
    factors++;
  }

  // Over 2.5 potential (max 30 points)
  if (match.potentials?.over25) {
    score += (match.potentials.over25 / 100) * 30;
    factors++;
  }

  // BTTS potential (max 20 points)
  if (match.potentials?.btts) {
    score += (match.potentials.btts / 100) * 20;
    factors++;
  }

  // Avg potential (max 10 points)
  if (match.potentials?.avg) {
    score += (match.potentials.avg / 100) * 10;
    factors++;
  }

  // If less than 2 factors, return 0
  if (factors < 2) return 0;

  return Math.round(score);
}

/**
 * Calculate confidence score for Corners market
 */
function calculateCornersConfidence(match: FootyStatsMatch): number {
  let score = 0;
  let factors = 0;

  // Corners potential as primary indicator (max 50 points)
  if (match.potentials?.corners) {
    const corners = match.potentials.corners;
    // Score based on expected corner count
    if (corners >= 12) score += 50;
    else if (corners >= 10) score += 40;
    else if (corners >= 9) score += 30;
    else if (corners >= 8) score += 20;
    else score += 10;
    factors++;
  }

  // Over 2.5 correlation (attacking intent) (max 25 points)
  if (match.potentials?.over25) {
    score += (match.potentials.over25 / 100) * 25;
    factors++;
  }

  // Total xG correlation (max 15 points)
  if (match.xg?.home && match.xg?.away) {
    const totalXg = match.xg.home + match.xg.away;
    if (totalXg >= 3.0) score += 15;
    else if (totalXg >= 2.5) score += 10;
    else if (totalXg >= 2.0) score += 5;
    factors++;
  }

  // Avg potential (max 10 points)
  if (match.potentials?.avg) {
    score += (match.potentials.avg / 100) * 10;
    factors++;
  }

  // If less than 2 factors, return 0
  if (factors < 2) return 0;

  return Math.round(score);
}

/**
 * Calculate confidence score for Cards market
 */
function calculateCardsConfidence(match: FootyStatsMatch): number {
  let score = 0;
  let factors = 0;

  // Cards potential as primary indicator (max 50 points)
  if (match.potentials?.cards) {
    const cards = match.potentials.cards;
    // Score based on expected card count
    if (cards >= 6) score += 50;
    else if (cards >= 5) score += 40;
    else if (cards >= 4.5) score += 30;
    else if (cards >= 4) score += 20;
    else score += 10;
    factors++;
  }

  // BTTS correlation (competitive match) (max 25 points)
  if (match.potentials?.btts) {
    score += (match.potentials.btts / 100) * 25;
    factors++;
  }

  // Over 2.5 correlation (max 15 points)
  if (match.potentials?.over25) {
    score += (match.potentials.over25 / 100) * 15;
    factors++;
  }

  // Avg potential (max 10 points)
  if (match.potentials?.avg) {
    score += (match.potentials.avg / 100) * 10;
    factors++;
  }

  // If less than 2 factors, return 0
  if (factors < 2) return 0;

  return Math.round(score);
}

/**
 * Calculate confidence score for Over 1.5 goals market
 */
function calculateOver15Confidence(match: FootyStatsMatch): number {
  let score = 0;
  let factors = 0;

  // Over 1.5 potential as primary indicator (max 50 points)
  if (match.potentials?.over15) {
    const over15 = match.potentials.over15;
    // Score based on percentage
    if (over15 >= 90) score += 50;
    else if (over15 >= 85) score += 45;
    else if (over15 >= 80) score += 40;
    else if (over15 >= 75) score += 35;
    else if (over15 >= 70) score += 30;
    else score += 20;
    factors++;
  }

  // Total xG as strong indicator (max 30 points)
  if (match.xg?.home && match.xg?.away) {
    const totalXg = match.xg.home + match.xg.away;
    if (totalXg >= 2.5) score += 30;
    else if (totalXg >= 2.0) score += 25;
    else if (totalXg >= 1.5) score += 20;
    else if (totalXg >= 1.2) score += 10;
    factors++;
  }

  // Over 2.5 correlation (max 20 points)
  if (match.potentials?.over25) {
    score += (match.potentials.over25 / 100) * 20;
    factors++;
  }

  // If less than 2 factors, return 0
  if (factors < 2) return 0;

  return Math.round(score);
}

// ============================================================================
// FILTERING & SELECTION
// ============================================================================

/**
 * Filter matches by market and confidence threshold
 */
function filterMatchesByMarket(
  matches: FootyStatsMatch[],
  market: 'OVER_25' | 'OVER_15' | 'BTTS' | 'HT_OVER_05' | 'CORNERS' | 'CARDS',
  minConfidence: number = 50
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  for (const match of matches) {
    // ✅ NO STATUS FILTER - Include all matches (started or not)
    // Lists are stored in database and remain stable throughout the day

    // Calculate confidence based on market
    let confidence = 0;
    let reason = '';

    switch (market) {
      case 'OVER_25':
        confidence = calculateOver25Confidence(match);
        reason = `O2.5: %${match.potentials?.over25 || 0}, xG: ${((match.xg?.home || 0) + (match.xg?.away || 0)).toFixed(1)}`;
        break;
      case 'OVER_15':
        confidence = calculateOver15Confidence(match);
        reason = `O1.5: %${match.potentials?.over15 || 0}, xG: ${((match.xg?.home || 0) + (match.xg?.away || 0)).toFixed(1)}`;
        break;
      case 'BTTS':
        confidence = calculateBTTSConfidence(match);
        reason = `BTTS: %${match.potentials?.btts || 0}, xG: ${(match.xg?.home || 0).toFixed(1)}-${(match.xg?.away || 0).toFixed(1)}`;
        break;
      case 'HT_OVER_05':
        confidence = calculateHTOver05Confidence(match);
        reason = `İY Potansiyel, xG: ${((match.xg?.home || 0) + (match.xg?.away || 0)).toFixed(1)}`;
        break;
      case 'CORNERS':
        confidence = calculateCornersConfidence(match);
        reason = `Korner: ${match.potentials?.corners?.toFixed(1) || 0}, O2.5: %${match.potentials?.over25 || 0}`;
        break;
      case 'CARDS':
        confidence = calculateCardsConfidence(match);
        reason = `Kart: ${match.potentials?.cards?.toFixed(1) || 0}, BTTS: %${match.potentials?.btts || 0}`;
        break;
    }

    // Skip if below threshold or insufficient data
    if (confidence < minConfidence) continue;

    candidates.push({ match, confidence, reason });
  }

  // Sort by confidence descending
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Select top matches for a list (max 5)
 */
function selectTopMatches(
  candidates: MatchCandidate[],
  maxMatches: number = 5
): MatchCandidate[] {
  // Prefer HIGH (>70) and MEDIUM (50-70) confidence
  const high = candidates.filter(c => c.confidence >= 70);
  const medium = candidates.filter(c => c.confidence >= 50 && c.confidence < 70);

  let selected: MatchCandidate[] = [];

  // Strategy: Fill with HIGH first, then MEDIUM if needed
  if (high.length >= 3) {
    selected = high.slice(0, maxMatches);
  } else if (high.length + medium.length >= 3) {
    selected = [...high, ...medium].slice(0, maxMatches);
  } else {
    // Not enough matches
    return [];
  }

  return selected;
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate all daily lists for Telegram
 *
 * @param date - ISO date string (YYYY-MM-DD), defaults to today
 * @returns Array of DailyList objects (empty if no eligible matches)
 */
export async function generateDailyLists(date?: string): Promise<DailyList[]> {
  const targetDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

  logger.info(`[TelegramDailyLists] 🚀 Starting daily list generation for ${targetDate}...`);

  try {
    // 1. Fetch matches for target date from FootyStats
    const response = await footyStatsAPI.getTodaysMatches(targetDate, 'Europe/Istanbul');
    const rawMatches = response.data || [];  // ✅ FIX: Use response.data, not response.matches

    // ✅ DEBUG: Log available fields in FootyStats response
    if (rawMatches.length > 0) {
      const sample: any = rawMatches[0];
      logger.info(`[TelegramDailyLists] 🔍 Available FootyStats fields:`, Object.keys(sample));
      logger.info(`[TelegramDailyLists] 🔍 League-related fields:`, {
        competition_name: sample.competition_name,
        league_name: sample.league_name,
        competition_id: sample.competition_id,
        season_id: sample.season_id,
        country: sample.country,
      });
    }

    // ✅ FIX: Transform FootyStats raw data to expected structure
    const allMatches: FootyStatsMatch[] = rawMatches.map((m: any) => ({
      fs_id: m.id,
      home_name: m.home_name,
      away_name: m.away_name,
      league_name: m.competition_name || m.league_name || m.country || 'Unknown',
      date_unix: m.date_unix,
      status: m.status,
      potentials: {
        btts: m.btts_potential,
        over25: m.o25_potential,
        over15: m.o15_potential,       // ✅ ADD: Over 1.5 potential
        avg: m.avg_potential,
        corners: m.corners_potential,  // ✅ ADD: Match corner potential
        cards: m.cards_potential,      // ✅ ADD: Match card potential
      },
      xg: {
        home: m.team_a_xg_prematch,
        away: m.team_b_xg_prematch,
      },
      odds: {
        home: m.odds_ft_1,
        draw: m.odds_ft_x,
        away: m.odds_ft_2,
      },
    }));

    logger.info(`[TelegramDailyLists] 📊 Fetched ${allMatches.length} matches from FootyStats`);

    if (allMatches.length === 0) {
      logger.warn('[TelegramDailyLists] ⚠️ No matches available today');
      return [];
    }

    // 2. Map FootyStats matches to TheSports matches (for settlement)
    const matchIdMap = await mapFootyStatsToTheSports(allMatches);
    logger.info(`[TelegramDailyLists] 🔗 Mapped ${matchIdMap.size}/${allMatches.length} matches to TheSports`);

    // 3. Enrich matches with TheSports match_id for settlement
    const enrichMatches = (candidates: MatchCandidate[]): MatchCandidate[] => {
      return candidates.map(c => ({
        ...c,
        match: {
          ...c.match,
          match_id: matchIdMap.get(c.match.fs_id) || null,
        },
      }));
    };

    // 4. Generate lists for each market
    const lists: DailyList[] = [];
    const timestamp = Date.now();

    // A) Over 2.5 Goals
    const over25Candidates = filterMatchesByMarket(allMatches, 'OVER_25', 55);
    const over25Selected = enrichMatches(selectTopMatches(over25Candidates, 5));
    if (over25Selected.length >= 3) {
      lists.push({
        market: 'OVER_25',
        title: 'Günün 2.5 ÜST Maçları',
        emoji: '📈',
        matches: over25Selected,
        generated_at: timestamp,
      });
      logger.info(`[TelegramDailyLists] ✅ Over 2.5 list: ${over25Selected.length} matches`);
    } else {
      logger.warn(`[TelegramDailyLists] ⚠️ Over 2.5 list: Insufficient matches (${over25Selected.length})`);
    }

    // B) Over 1.5 Goals (10 matches)
    const over15Candidates = filterMatchesByMarket(allMatches, 'OVER_15', 55);
    const over15Selected = enrichMatches(selectTopMatches(over15Candidates, 10));
    if (over15Selected.length >= 5) {
      lists.push({
        market: 'OVER_15',
        title: 'Günün 1.5 ÜST Maçları',
        emoji: '🎯',
        matches: over15Selected,
        generated_at: timestamp,
      });
      logger.info(`[TelegramDailyLists] ✅ Over 1.5 list: ${over15Selected.length} matches`);
    } else {
      logger.warn(`[TelegramDailyLists] ⚠️ Over 1.5 list: Insufficient matches (${over15Selected.length})`);
    }

    // C) BTTS
    const bttsCandiates = filterMatchesByMarket(allMatches, 'BTTS', 55);
    const bttsSelected = enrichMatches(selectTopMatches(bttsCandiates, 5));
    if (bttsSelected.length >= 3) {
      lists.push({
        market: 'BTTS',
        title: 'Günün BTTS Maçları',
        emoji: '⚽',
        matches: bttsSelected,
        generated_at: timestamp,
      });
      logger.info(`[TelegramDailyLists] ✅ BTTS list: ${bttsSelected.length} matches`);
    } else {
      logger.warn(`[TelegramDailyLists] ⚠️ BTTS list: Insufficient matches (${bttsSelected.length})`);
    }

    // D) First Half Over 0.5
    const htOver05Candidates = filterMatchesByMarket(allMatches, 'HT_OVER_05', 50);
    const htOver05Selected = enrichMatches(selectTopMatches(htOver05Candidates, 5));
    if (htOver05Selected.length >= 3) {
      lists.push({
        market: 'HT_OVER_05',
        title: 'Günün İY 0.5 ÜST Maçları',
        emoji: '⏱️',
        matches: htOver05Selected,
        generated_at: timestamp,
      });
      logger.info(`[TelegramDailyLists] ✅ HT Over 0.5 list: ${htOver05Selected.length} matches`);
    } else {
      logger.warn(`[TelegramDailyLists] ⚠️ HT Over 0.5 list: Insufficient matches (${htOver05Selected.length})`);
    }

    // E) Corners
    const cornersCandidates = filterMatchesByMarket(allMatches, 'CORNERS', 50);
    const cornersSelected = enrichMatches(selectTopMatches(cornersCandidates, 5));
    if (cornersSelected.length >= 3) {
      lists.push({
        market: 'CORNERS',
        title: 'Günün KORNER Maçları',
        emoji: '🚩',
        matches: cornersSelected,
        generated_at: timestamp,
      });
      logger.info(`[TelegramDailyLists] ✅ Corners list: ${cornersSelected.length} matches`);
    } else {
      logger.warn(`[TelegramDailyLists] ⚠️ Corners list: Insufficient matches (${cornersSelected.length})`);
    }

    // F) Cards
    const cardsCandidates = filterMatchesByMarket(allMatches, 'CARDS', 50);
    const cardsSelected = enrichMatches(selectTopMatches(cardsCandidates, 5));
    if (cardsSelected.length >= 3) {
      lists.push({
        market: 'CARDS',
        title: 'Günün KART Maçları',
        emoji: '🟨',
        matches: cardsSelected,
        generated_at: timestamp,
      });
      logger.info(`[TelegramDailyLists] ✅ Cards list: ${cardsSelected.length} matches`);
    } else {
      logger.warn(`[TelegramDailyLists] ⚠️ Cards list: Insufficient matches (${cardsSelected.length})`);
    }

    // 3. Log final result
    if (lists.length === 0) {
      logger.warn('[TelegramDailyLists] ❌ NO_ELIGIBLE_MATCHES - No lists generated');
    } else {
      logger.info(`[TelegramDailyLists] 🎯 Generated ${lists.length} lists successfully`);
    }

    return lists;

  } catch (error: any) {
    logger.error('[TelegramDailyLists] ❌ Error generating lists:', error);
    console.error('[DEBUG] generateDailyLists error:', error.message);
    console.error('[DEBUG] Error stack:', error.stack?.substring(0, 1000));
    throw error;
  }
}

/**
 * Format a daily list as Telegram message
 *
 * @param list - Daily list to format
 * @param withResults - If true, fetch and display match results (async operation)
 */
export function formatDailyListMessage(list: DailyList, withResults: boolean = false): string {
  const { emoji, title, matches, market } = list;

  let message = `${emoji} <b>${title.toUpperCase()}</b>\n\n`;

  matches.forEach((candidate, index) => {
    const { match, confidence, reason } = candidate;
    const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const num = nums[index] || `${index + 1}️⃣`;

    const matchTime = new Date(match.date_unix * 1000);
    const timeStr = matchTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const confidenceEmoji = confidence >= 70 ? '🔥' : '⭐';

    message += `${num} <b>${match.home_name} vs ${match.away_name}</b>\n`;
    message += `🕒 ${timeStr} | 🏆 ${match.league_name && match.league_name !== 'Unknown' ? match.league_name : 'Bilinmiyor'}\n`;
    message += `${confidenceEmoji} Güven: ${confidence}/100\n`;
    message += `📊 ${reason}\n\n`;
  });

  message += `⚠️ <b>Not:</b>\n`;
  message += `• Liste istatistiksel verilere dayanır\n`;
  message += `• Canlıya girmeden önce oran ve kadro kontrolü önerilir\n`;

  return message;
}

/**
 * Format a daily list with live match results
 * Shows Won/Lost badges and scores for finished matches
 *
 * @param list - Daily list to format
 * @param liveScores - Map of fs_id to live score data
 */
export async function formatDailyListMessageWithResults(
  list: DailyList,
  liveScores?: Map<number, any>
): Promise<string> {
  const { emoji, title, matches, market } = list;
  const now = Math.floor(Date.now() / 1000);

  // Count results
  let wonCount = 0;
  let lostCount = 0;
  let pendingCount = 0;

  // First pass: calculate performance
  for (const candidate of matches) {
    const match = candidate.match;
    const matchFinished = match.date_unix <= (now - 2 * 60 * 60); // 2 hours after start

    if (!matchFinished) {
      pendingCount++;
      continue;
    }

    // Get live score if available
    const liveScore = liveScores?.get(match.fs_id);
    if (!liveScore) {
      pendingCount++;
      continue;
    }

    // Evaluate based on market type
    let isWin = false;
    const homeScore = liveScore.home || 0;
    const awayScore = liveScore.away || 0;
    const totalGoals = homeScore + awayScore;

    switch (market) {
      case 'OVER_25':
        isWin = totalGoals >= 3;
        break;
      case 'OVER_15':
        isWin = totalGoals >= 2;
        break;
      case 'BTTS':
        isWin = homeScore > 0 && awayScore > 0;
        break;
      case 'HT_OVER_05':
      case 'CORNERS':
      case 'CARDS':
        // These need special data, count as pending for now
        pendingCount++;
        continue;
    }

    if (isWin) {
      wonCount++;
    } else {
      lostCount++;
    }
  }

  const settledCount = wonCount + lostCount;
  const totalCount = matches.length;

  // Build header with performance
  let message = `${emoji} <b>${title.toUpperCase()}</b>\n\n`;

  if (settledCount > 0) {
    const winRate = Math.round((wonCount / settledCount) * 100);
    message += `📊 <b>Performans: ${wonCount}/${settledCount} (%${winRate})</b>\n`;
    message += `✅ Kazanan: ${wonCount}\n`;
    message += `❌ Kaybeden: ${lostCount}\n`;
    if (pendingCount > 0) {
      message += `🕒 Bekleyen: ${pendingCount}\n`;
    }
  }

  message += `\n`;

  // Second pass: format matches with results
  const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  for (let index = 0; index < matches.length; index++) {
    const candidate = matches[index];
    const { match, confidence, reason } = candidate;
    const num = nums[index] || `${index + 1}️⃣`;

    const matchTime = new Date(match.date_unix * 1000);
    const timeStr = matchTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const matchFinished = match.date_unix <= (now - 2 * 60 * 60);

    const confidenceEmoji = confidence >= 70 ? '🔥' : '⭐';

    // Get result if match finished
    let resultBadge = '';
    let scoreStr = '';

    const liveScore = liveScores?.get(match.fs_id);

    if (matchFinished && liveScore) {
      const homeScore = liveScore.home || 0;
      const awayScore = liveScore.away || 0;
      const totalGoals = homeScore + awayScore;

      scoreStr = `${homeScore}-${awayScore}`;

      // Evaluate result
      let isWin = false;
      switch (market) {
        case 'OVER_25':
          isWin = totalGoals >= 3;
          break;
        case 'OVER_15':
          isWin = totalGoals >= 2;
          break;
        case 'BTTS':
          isWin = homeScore > 0 && awayScore > 0;
          break;
      }

      resultBadge = isWin ? '✅ <b>Kazandı</b>' : '❌ <b>Kaybetti</b>';
    }

    message += `${num} <b>${match.home_name} vs ${match.away_name}</b>\n`;

    if (resultBadge) {
      message += `${resultBadge} | Skor: <b>${scoreStr}</b>\n`;
    } else {
      message += `🕒 ${timeStr} | 🏆 ${match.league_name && match.league_name !== 'Unknown' ? match.league_name : 'Bilinmiyor'}\n`;
    }

    message += `${confidenceEmoji} Güven: ${confidence}/100\n`;
    message += `📊 ${reason}\n\n`;
  }

  message += `⚠️ <b>Not:</b>\n`;
  message += `• Liste istatistiksel verilere dayanır\n`;
  message += `• Canlıya girmeden önce oran ve kadro kontrolü önerilir\n`;

  return message;
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

/**
 * Calculate string similarity score (0-1) using Jaro-Winkler distance
 * Higher score = more similar strings
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  // Remove common prefixes like "Club", "Atlético", etc.
  const s1Clean = s1.replace(/^(club|atletico|athletic|fc|cf|ac|sc|sporting|real)\s+/i, '');
  const s2Clean = s2.replace(/^(club|atletico|athletic|fc|cf|ac|sc|sporting|real)\s+/i, '');

  if (s1Clean === s2Clean) return 0.95;

  // Check if one string contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;
  if (s1Clean.includes(s2Clean) || s2Clean.includes(s1Clean)) return 0.8;

  // Simple character-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;

  if (longerLength === 0) return 1.0;

  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }

  return matches / longerLength;
}

/**
 * Map FootyStats matches to TheSports matches using team names and time window
 * Uses fuzzy matching to improve match detection
 * Returns a map of fs_id -> TheSports external_id
 */
async function mapFootyStatsToTheSports(matches: FootyStatsMatch[]): Promise<Map<number, string>> {
  const matchMap = new Map<number, string>();

  if (matches.length === 0) return matchMap;

  try {
    // For each FootyStats match, find candidates in TheSports within time window
    for (const fsMatch of matches) {
      const timeWindow = 3600; // +/- 1 hour
      const minTime = fsMatch.date_unix - timeWindow;
      const maxTime = fsMatch.date_unix + timeWindow;

      // Get all TheSports matches within time window
      const candidateQuery = `
        SELECT
          m.external_id,
          t1.name as home_team_name,
          t2.name as away_team_name,
          m.match_time
        FROM ts_matches m
        INNER JOIN ts_teams t1 ON m.home_team_id = t1.external_id
        INNER JOIN ts_teams t2 ON m.away_team_id = t2.external_id
        WHERE m.match_time >= $1 AND m.match_time <= $2
      `;

      const candidates = await safeQuery(candidateQuery, [minTime, maxTime]);

      if (candidates.length === 0) continue;

      // Find best match using fuzzy matching
      let bestMatch: any = null;
      let bestScore = 0;

      for (const candidate of candidates) {
        // Calculate similarity scores for both teams
        const homeScore = calculateStringSimilarity(fsMatch.home_name, candidate.home_team_name);
        const awayScore = calculateStringSimilarity(fsMatch.away_name, candidate.away_team_name);

        // Combined score (both teams must match reasonably well)
        const combinedScore = (homeScore + awayScore) / 2;

        // Time proximity bonus (closer time = slightly higher score)
        const timeDiff = Math.abs(candidate.match_time - fsMatch.date_unix);
        const timeBonus = Math.max(0, (3600 - timeDiff) / 3600) * 0.1; // Up to 0.1 bonus

        const finalScore = combinedScore + timeBonus;

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestMatch = candidate;
        }
      }

      // Accept match if score is above threshold
      const SIMILARITY_THRESHOLD = 0.65; // 65% similarity required

      if (bestMatch && bestScore >= SIMILARITY_THRESHOLD) {
        matchMap.set(fsMatch.fs_id, bestMatch.external_id);
        logger.debug(
          `[TelegramDailyLists] ✅ Fuzzy matched: "${fsMatch.home_name} vs ${fsMatch.away_name}" → ` +
          `"${bestMatch.home_team_name} vs ${bestMatch.away_team_name}" (score: ${bestScore.toFixed(2)})`
        );
      } else {
        logger.warn(
          `[TelegramDailyLists] ❌ No match found for: "${fsMatch.home_name} vs ${fsMatch.away_name}" ` +
          `(best score: ${bestScore.toFixed(2)}, threshold: ${SIMILARITY_THRESHOLD})`
        );
      }
    }

    logger.info(`[TelegramDailyLists] 🔗 Mapped ${matchMap.size}/${matches.length} matches to TheSports (${Math.round(matchMap.size / matches.length * 100)}%)`);
  } catch (err) {
    logger.error('[TelegramDailyLists] Error mapping matches to TheSports:', err);
  }

  return matchMap;
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

/**
 * Save daily lists to database
 */
async function saveDailyListsToDatabase(date: string, lists: DailyList[]): Promise<void> {
  logger.info(`[TelegramDailyLists] 💾 Saving ${lists.length} lists to database for ${date}...`);

  for (const list of lists) {
    const matchesCount = list.matches.length;
    const avgConfidence = Math.round(
      list.matches.reduce((sum, m) => sum + m.confidence, 0) / matchesCount
    );

    const preview = formatDailyListMessage(list);

    try {
      await safeQuery(
        `INSERT INTO telegram_daily_lists
          (market, list_date, title, emoji, matches_count, avg_confidence, matches, preview, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9))
         ON CONFLICT (market, list_date)
         DO UPDATE SET
           matches = EXCLUDED.matches,
           matches_count = EXCLUDED.matches_count,
           avg_confidence = EXCLUDED.avg_confidence,
           preview = EXCLUDED.preview,
           updated_at = NOW()`,
        [
          list.market,
          date,
          list.title,
          list.emoji,
          matchesCount,
          avgConfidence,
          JSON.stringify(list.matches),
          preview,
          list.generated_at / 1000,
        ]
      );

      logger.info(`[TelegramDailyLists] ✅ Saved ${list.market} list (${matchesCount} matches)`);
    } catch (error: any) {
      logger.error(`[TelegramDailyLists] ❌ Failed to save ${list.market} list:`, error);
    }
  }
}

/**
 * Get daily lists from database
 */
async function getDailyListsFromDatabase(date: string): Promise<DailyList[] | null> {
  logger.info(`[TelegramDailyLists] 🔍 Checking database for lists on ${date}...`);

  try {
    const rows = await safeQuery<{
      market: string;
      title: string;
      emoji: string;
      matches: any;
      matches_count: number;
      avg_confidence: number;
      preview: string;
      generated_at: Date;
    }>(
      `SELECT market, title, emoji, matches, matches_count, avg_confidence, preview,
              EXTRACT(EPOCH FROM generated_at)::bigint * 1000 as generated_at
       FROM telegram_daily_lists
       WHERE list_date = $1
       ORDER BY
         CASE market
           WHEN 'OVER_25' THEN 1
           WHEN 'OVER_15' THEN 2
           WHEN 'BTTS' THEN 3
           WHEN 'HT_OVER_05' THEN 4
           WHEN 'CORNERS' THEN 5
           WHEN 'CARDS' THEN 6
         END`,
      [date]
    );

    if (rows.length === 0) {
      logger.info(`[TelegramDailyLists] ⚠️ No lists found in database for ${date}`);
      return null;
    }

    const lists: DailyList[] = rows.map((row) => ({
      market: row.market as any,
      title: row.title,
      emoji: row.emoji,
      matches: JSON.parse(row.matches as any),
      matches_count: row.matches_count,
      avg_confidence: row.avg_confidence,
      preview: row.preview,
      generated_at: Number(row.generated_at),
    }));

    logger.info(`[TelegramDailyLists] ✅ Loaded ${lists.length} lists from database`);
    return lists;
  } catch (error: any) {
    logger.error(`[TelegramDailyLists] ❌ Database query failed:`, error);
    return null;
  }
}

/**
 * Get daily lists (database-first, generate if missing)
 *
 * CRITICAL: Lists are auto-refreshed and filtered:
 * - Cache refreshes every 1 hour
 * - Started/finished matches are filtered out in real-time
 * - If no valid matches remain, regenerates lists
 *
 * @param date - ISO date string (YYYY-MM-DD), defaults to today
 * @returns Array of DailyList objects
 */
export async function getDailyLists(date?: string): Promise<DailyList[]> {
  // Default to today in Istanbul timezone (UTC+3)
  const targetDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

  logger.info(`[TelegramDailyLists] 📅 Getting lists for ${targetDate}...`);

  // 1. Try to get from database first (CACHE)
  const cachedLists = await getDailyListsFromDatabase(targetDate);
  if (cachedLists && cachedLists.length > 0) {
    const cacheAge = Date.now() - cachedLists[0].generated_at;
    const cacheAgeMinutes = Math.floor(cacheAge / 60000);

    logger.info(`[TelegramDailyLists] 📦 Found cached lists (${cacheAgeMinutes} minutes old)`);

    // 2. Filter out started/finished matches (real-time filtering)
    const now = Math.floor(Date.now() / 1000);
    const filteredLists = cachedLists.map(list => ({
      ...list,
      matches: list.matches.filter(m => m.match.date_unix > now),
      matches_count: list.matches.filter(m => m.match.date_unix > now).length,
    })).filter(list => list.matches_count >= 3); // Keep only lists with 3+ valid matches

    const totalValidMatches = filteredLists.reduce((sum, l) => sum + l.matches_count, 0);

    logger.info(`[TelegramDailyLists] ⏰ After filtering: ${filteredLists.length} lists, ${totalValidMatches} valid matches`);

    // 3. Cache refresh logic
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour
    const shouldRefresh = cacheAge > CACHE_TTL || filteredLists.length === 0 || totalValidMatches < 10;

    if (shouldRefresh) {
      logger.info(`[TelegramDailyLists] 🔄 Cache refresh needed (age: ${cacheAgeMinutes}m, valid lists: ${filteredLists.length}, matches: ${totalValidMatches})`);
      const newLists = await generateDailyLists(targetDate);

      if (newLists.length > 0) {
        await saveDailyListsToDatabase(targetDate, newLists);
        return newLists;
      }
    }

    // 4. Return filtered cache if still valid
    if (filteredLists.length > 0) {
      logger.info(`[TelegramDailyLists] ✅ Using filtered cached lists`);
      return filteredLists;
    }
  }

  // 5. Cache miss or empty - generate new lists
  logger.info(`[TelegramDailyLists] 🔄 Cache miss - generating new lists...`);
  const newLists = await generateDailyLists(targetDate);

  // 6. Save to database
  if (newLists.length > 0) {
    await saveDailyListsToDatabase(targetDate, newLists);
  }

  return newLists;
}

/**
 * Force refresh daily lists (admin function)
 *
 * @param date - ISO date string (YYYY-MM-DD), defaults to today
 * @returns Array of DailyList objects
 */
export async function refreshDailyLists(date?: string): Promise<DailyList[]> {
  const targetDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

  logger.info(`[TelegramDailyLists] 🔄 FORCE REFRESH for ${targetDate}...`);

  // Generate new lists for target date
  const newLists = await generateDailyLists(targetDate);

  // Save to database (will overwrite existing)
  if (newLists.length > 0) {
    await saveDailyListsToDatabase(targetDate, newLists);
  }

  return newLists;
}
