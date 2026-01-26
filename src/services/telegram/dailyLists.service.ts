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
  home_name: string;
  away_name: string;
  league_name: string;
  date_unix: number;
  status: string;
  potentials?: {
    btts?: number;
    over25?: number;
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
 * @returns Array of DailyList objects (empty if no eligible matches)
 */
export async function generateDailyLists(): Promise<DailyList[]> {
  logger.info('[TelegramDailyLists] 🚀 Starting daily list generation...');

  try {
    // 1. Fetch today's matches from FootyStats
    const response = await footyStatsAPI.getTodaysMatches();
    const rawMatches = response.data || [];  // ✅ FIX: Use response.data, not response.matches

    // ✅ FIX: Transform FootyStats raw data to expected structure
    const allMatches: FootyStatsMatch[] = rawMatches.map((m: any) => ({
      fs_id: m.id,
      home_name: m.home_name,
      away_name: m.away_name,
      league_name: m.competition_name || m.league_name || 'Unknown',
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

    // 2. Generate lists for each market
    const lists: DailyList[] = [];
    const timestamp = Date.now();

    // A) Over 2.5 Goals
    const over25Candidates = filterMatchesByMarket(allMatches, 'OVER_25', 55);
    const over25Selected = selectTopMatches(over25Candidates, 5);
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
    const over15Selected = selectTopMatches(over15Candidates, 10);
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
    const bttsSelected = selectTopMatches(bttsCandiates, 5);
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
    const htOver05Selected = selectTopMatches(htOver05Candidates, 5);
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
    const cornersSelected = selectTopMatches(cornersCandidates, 5);
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
    const cardsSelected = selectTopMatches(cardsCandidates, 5);
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
    throw error;
  }
}

/**
 * Format a daily list as Telegram message
 */
export function formatDailyListMessage(list: DailyList): string {
  const { emoji, title, matches } = list;

  let message = `${emoji} <b>${title.toUpperCase()}</b>\n\n`;

  matches.forEach((candidate, index) => {
    const { match, confidence, reason } = candidate;
    const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const num = nums[index] || `${index + 1}️⃣`;

    const matchTime = new Date(match.date_unix * 1000);
    const timeStr = matchTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const confidenceEmoji = confidence >= 70 ? '🔥' : '⭐';

    message += `${num} <b>${match.home_name} vs ${match.away_name}</b>\n`;
    message += `🕒 ${timeStr} | 🏆 ${match.league_name || 'Bilinmiyor'}\n`;
    message += `${confidenceEmoji} Güven: ${confidence}/100\n`;
    message += `📊 ${reason}\n\n`;
  });

  message += `⚠️ <b>Not:</b>\n`;
  message += `• Liste istatistiksel verilere dayanır\n`;
  message += `• Canlıya girmeden önce oran ve kadro kontrolü önerilir\n`;

  return message;
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
    logger.info(`[TelegramDailyLists] ✅ Using cached lists from database`);
    return cachedLists;
  }

  // 2. Cache miss - generate new lists
  logger.info(`[TelegramDailyLists] 🔄 Cache miss - generating new lists...`);
  const newLists = await generateDailyLists();

  // 3. Save to database
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

  // Generate new lists
  const newLists = await generateDailyLists();

  // Save to database (will overwrite existing)
  if (newLists.length > 0) {
    await saveDailyListsToDatabase(targetDate, newLists);
  }

  return newLists;
}
