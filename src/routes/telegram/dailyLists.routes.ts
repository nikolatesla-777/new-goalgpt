/**
 * Telegram Daily Lists Routes
 *
 * Routes for daily prediction lists generation and publishing
 */

import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { telegramBot } from '../../services/telegram/telegram.client';
import { pool, safeQuery } from '../../database/connection';
import { logger } from '../../utils/logger';
import { getDailyLists, refreshDailyLists, formatDailyListMessage, formatDailyListMessageWithResults } from '../../services/telegram/dailyLists.service';
import { evaluateMatch } from '../../services/telegram/dailyListsSettlement.service';
import { channelRouter } from '../../services/telegram/channelRouter';
import { parseMarketParam, getAllowedMarketParams, DAILY_LIST_MARKET_TO_ID } from '../../types/markets';

const PUBLISH_DELAY_MS = 1000; // 1 second between messages for rate limiting

/**
 * Get live scores for multiple matches (bulk query)
 */
async function getLiveScoresForMatches(matches: any[]): Promise<Map<number, any>> {
  const liveScores = new Map<number, any>();

  if (matches.length === 0) return liveScores;

  try {
    // Separate matches with match_id vs without
    const matchesWithId = matches.filter(m => m.match_id);
    const matchesWithoutId = matches.filter(m => !m.match_id);

    // STRATEGY 1: Use match_id directly (most reliable)
    if (matchesWithId.length > 0) {
      const matchIds = matchesWithId.map(m => m.match_id);
      const query = `
        SELECT
          m.external_id as match_id,
          m.home_score_display, m.away_score_display, m.status_id,
          m.minute
        FROM ts_matches m
        WHERE m.external_id = ANY($1)
          AND m.status_id IN (2, 3, 4, 5, 7, 8)
      `;

      const results = await safeQuery(query, [matchIds]);

      results.forEach((row: any) => {
        const fsMatch = matchesWithId.find(m => m.match_id === row.match_id);
        if (fsMatch) {
          const statusMap: Record<number, string> = {
            2: 'İlk Yarı',
            3: 'Devre Arası',
            4: 'İkinci Yarı',
            5: 'Uzatma',
            7: 'Penaltılar',
            8: 'Bitti',
          };

          liveScores.set(fsMatch.fs_id, {
            home: parseInt(row.home_score_display) || 0,
            away: parseInt(row.away_score_display) || 0,
            minute: row.minute || '',
            status: statusMap[row.status_id] || 'Canlı',
          });
        }
      });
    }

    // STRATEGY 2: Fallback to fuzzy matching for unmapped matches
    if (matchesWithoutId.length > 0) {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      matchesWithoutId.forEach(match => {
        const homeFirstWord = match.home_name.split(' ')[0].toLowerCase();
        const awayFirstWord = match.away_name.split(' ')[0].toLowerCase();
        const timeWindow = 3600; // +/- 1 hour

        conditions.push(`(
          (LOWER(t1.name) LIKE $${paramIndex} OR LOWER(t1.name) LIKE $${paramIndex + 1})
          AND (LOWER(t2.name) LIKE $${paramIndex + 2} OR LOWER(t2.name) LIKE $${paramIndex + 3})
          AND m.match_time >= $${paramIndex + 4}
          AND m.match_time <= $${paramIndex + 5}
        )`);

        params.push(
          `%${homeFirstWord}%`,
          `${homeFirstWord}%`,
          `%${awayFirstWord}%`,
          `${awayFirstWord}%`,
          match.date_unix - timeWindow,
          match.date_unix + timeWindow
        );

        paramIndex += 6;
      });

      const query = `
        SELECT
          m.home_score_display, m.away_score_display, m.status_id,
          m.minute, m.match_time,
          t1.name as home_team_name, t2.name as away_team_name
        FROM ts_matches m
        INNER JOIN ts_teams t1 ON m.home_team_id= t1.external_id
        INNER JOIN ts_teams t2 ON m.away_team_id= t2.external_id
        WHERE m.status_id IN (2, 3, 4, 5, 7, 8)
          AND (${conditions.join(' OR ')})
      `;

      const results = await safeQuery(query, params);

      results.forEach((row: any) => {
        const matchingFsMatch = matchesWithoutId.find(m => {
          const homeFirstWord = m.home_name.split(' ')[0].toLowerCase();
          const awayFirstWord = m.away_name.split(' ')[0].toLowerCase();
          return (
            row.home_team_name.toLowerCase().includes(homeFirstWord) &&
            row.away_team_name.toLowerCase().includes(awayFirstWord) &&
            Math.abs(row.match_time - m.date_unix) <= 3600
          );
        });

        if (matchingFsMatch) {
          const statusMap: Record<number, string> = {
            2: 'İlk Yarı',
            3: 'Devre Arası',
            4: 'İkinci Yarı',
            5: 'Uzatma',
            7: 'Penaltılar',
            8: 'Bitti',
          };

          liveScores.set(matchingFsMatch.fs_id, {
            home: parseInt(row.home_score_display) || 0,
            away: parseInt(row.away_score_display) || 0,
            minute: row.minute || '',
            status: statusMap[row.status_id] || 'Canlı',
          });
        }
      });
    }

    logger.info(`[TelegramDailyLists] 📺 Found live scores for ${liveScores.size}/${matches.length} matches (${matchesWithId.length} via match_id, ${matchesWithoutId.length} via fuzzy)`);
  } catch (err) {
    logger.error('[TelegramDailyLists] Error fetching live scores from TheSports:', err);
  }

  return liveScores;
}

/**
 * Calculate performance for a daily list
 *
 * STRATEGY:
 * 1. If list has settlement_result from database, use it (most accurate)
 * 2. Otherwise, count based on match results inline (realtime)
 */
async function calculateListPerformance(list: any): Promise<{
  total: number;
  won: number;
  lost: number;
  pending: number;
  win_rate: number;
}> {
  // DEBUG: Log what we're receiving
  logger.info(`[calculateListPerformance] DEBUG: list.market=${list.market}, has settlement_result=${!!list.settlement_result}`);
  if (list.settlement_result) {
    logger.info(`[calculateListPerformance] DEBUG: settlement_result=`, JSON.stringify(list.settlement_result));
  }

  // STRATEGY 1: Use database settlement_result if available (preferred)
  if (list.settlement_result) {
    const settlement = list.settlement_result;
    const total = (settlement.won || 0) + (settlement.lost || 0);
    const win_rate = total > 0 ? Math.round((settlement.won / total) * 100) : 0;

    logger.info(`[calculateListPerformance] DEBUG: Using settlement_result for ${list.market}: won=${settlement.won}, lost=${settlement.lost}, void=${settlement.void}`);

    return {
      total,
      won: settlement.won || 0,
      lost: settlement.lost || 0,
      pending: list.matches.length - total - (settlement.void || 0),
      win_rate,
    };
  }

  // STRATEGY 2: Realtime calculation based on match results (fallback)
  // This runs for unsettled lists only
  const now = Math.floor(Date.now() / 1000);
  let won = 0;
  let lost = 0;
  let pending = 0;

  for (const candidate of list.matches) {
    const match = candidate.match;

    // Check if match is finished (>2 hours after start)
    const matchFinished = match.date_unix <= (now - 2 * 60 * 60);

    if (!matchFinished) {
      pending++;
      continue;
    }

    // Get match result from TheSports database (match by team names + time window)
    try {
      // Use match_id if available (preferred)
      if (match.match_id) {
        const result = await safeQuery(
          `SELECT m.external_id, m.home_score_display, m.away_score_display, m.status_id,
                  m.home_scores, m.away_scores
           FROM ts_matches m
           WHERE m.external_id = $1 AND m.status_id = 8
           LIMIT 1`,
          [match.match_id]
        );

        if (result.length === 0) {
          pending++; // Not finished yet
          continue;
        }

        // Use evaluateMatch from settlement service (consistent logic)
        const { evaluateMatch } = await import('../../services/telegram/dailyListsSettlement.service');
        const evaluation = evaluateMatch(list.market, result[0]);

        if (evaluation.result === 'WIN') {
          won++;
        } else if (evaluation.result === 'LOSS') {
          lost++;
        } else {
          pending++; // VOID
        }
        continue;
      }

      // Fallback: No match_id, skip
      pending++;
    } catch (err) {
      logger.error('[TelegramDailyLists] Error checking match result:', err);
      pending++;
    }
  }

  const total = won + lost; // Total settled (won + lost, excluding void and pending)
  const win_rate = total > 0 ? Math.round((won / total) * 100) : 0;

  return { total, won, lost, pending, win_rate };
}

export async function dailyListsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /telegram/daily-lists/today
   * Get today's generated daily lists (preview without publishing)
   */
  fastify.get<{ Querystring: { date?: string } }>('/telegram/daily-lists/today', async (request, reply) => {
    const marker = '='.repeat(80) + '\n[ROUTE HANDLER] daily-lists/today CALLED\n' + '='.repeat(80) + '\n';
    process.stdout.write(marker);
    process.stderr.write(marker);
    console.log(marker);

    try {
      // Extract date query parameter (optional)
      const targetDate = request.query.date;

      console.error('[TRACE-1] Starting daily-lists route handler', targetDate ? `for date: ${targetDate}` : '');
      logger.info(`[TelegramDailyLists] 📊 Fetching lists for ${targetDate || 'today'}...`);

      // Get lists from database (or generate if not exists)
      console.error('[TRACE-2] About to call getDailyLists()', targetDate ? `with date: ${targetDate}` : '');
      const lists = await getDailyLists(targetDate);
      console.error('[TRACE-3] getDailyLists() returned:', lists.length, 'lists');

      // CRITICAL FIX: Load settlement data directly from database
      // getDailyLists() may not include settlement_result due to cache refresh logic
      console.error('[TRACE-3b] Loading settlement data from database...');
      const client = await pool.connect();
      try {
        const settlementQuery = await client.query(
          `SELECT market, settlement_result, status, settled_at
           FROM telegram_daily_lists
           WHERE list_date = $1`,
          [targetDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })]
        );

        const settlementMap = new Map(
          settlementQuery.rows.map(row => [row.market, row])
        );

        // Merge settlement data into lists
        lists.forEach(list => {
          const settlement = settlementMap.get(list.market);
          if (settlement && settlement.settlement_result) {
            list.settlement_result = settlement.settlement_result;
            list.status = settlement.status;
            list.settled_at = settlement.settled_at;
            console.error(`[TRACE-3c] Added settlement for ${list.market}: won=${settlement.settlement_result.won}`);
          }
        });
      } finally {
        client.release();
      }

      if (lists.length === 0) {
        return {
          success: true,
          lists_count: 0,
          lists: [],
          message: 'No eligible matches found for today',
        };
      }

      // Collect all unique matches for bulk score query
      console.error('[TRACE-4] Collecting unique matches');
      const allMatches = new Map<number, any>();
      const allMatchIds = new Set<string>(); // TheSports match IDs
      const unmappedMatches: any[] = [];

      lists.forEach(list => {
        list.matches.forEach((m: any) => {
          allMatches.set(m.match.fs_id, m.match);
          if (m.match.match_id) {
            allMatchIds.add(m.match.match_id);
          } else {
            // Collect unmapped matches for re-mapping
            unmappedMatches.push(m.match);
          }
        });
      });

      // ON-THE-FLY REMAPPING: Try to map unmapped matches again
      if (unmappedMatches.length > 0) {
        console.error(`[TRACE-4b] Attempting to remap ${unmappedMatches.length} unmapped matches...`);
        const { mapFootyStatsToTheSports } = await import('../../services/telegram/dailyLists.service');
        const remappedMatches = await mapFootyStatsToTheSports(unmappedMatches);

        // Update match_id for successfully remapped matches
        remappedMatches.forEach((external_id, fs_id) => {
          const match = allMatches.get(fs_id);
          if (match) {
            match.match_id = external_id;
            allMatchIds.add(external_id);
            console.error(`[TRACE-4c] ✅ Remapped fs_id ${fs_id} → ${external_id}`);
          }
        });

        logger.info(`[TelegramDailyLists] 🔄 Remapped ${remappedMatches.size}/${unmappedMatches.length} previously unmapped matches`);
      }

      // Bulk query: Get match results from TheSports database
      console.error('[TRACE-5] Fetching match results from TheSports for', allMatchIds.size, 'matches');
      const matchResultsMap = new Map<string, any>();

      if (allMatchIds.size > 0) {
        const client = await pool.connect();
        try {
          const result = await client.query(
            `SELECT external_id, status_id, home_score_display, away_score_display,
                    home_scores, away_scores
             FROM ts_matches
             WHERE external_id = ANY($1)`,
            [Array.from(allMatchIds)]
          );

          result.rows.forEach(row => {
            matchResultsMap.set(row.external_id, row);
          });

          console.error('[TRACE-6] Fetched results for', matchResultsMap.size, 'matches from TheSports');
        } finally {
          client.release();
        }
      }

      // Also get live scores for FootyStats (for pending matches)
      const liveScoresMap = await getLiveScoresForMatches(Array.from(allMatches.values()));
      console.error('[TRACE-6b] FootyStats live scores:', liveScoresMap.size);

      // Format response with match details + performance calculation
      console.error('[TRACE-7] Formatting lists');
      const formattedLists = await Promise.all(
        lists.map(async (list: any) => {
          // Calculate performance for finished matches
          console.error('[TRACE-8] Calculating performance for list:', list.market);
          const performance = await calculateListPerformance(list);
          console.error('[TRACE-9] Performance calculated for list:', list.market);

          return {
            market: list.market,
            title: list.title,
            emoji: list.emoji,
            matches_count: list.matches.length,
            avg_confidence: Math.round(
              list.matches.reduce((sum: number, m: any) => sum + m.confidence, 0) / list.matches.length
            ),
            settlement_result: list.settlement_result, // Include settlement result from database
            matches: list.matches.map((m: any) => {
              const matchId = m.match.match_id;
              const tsMatch = matchId ? matchResultsMap.get(matchId) : null;

              // Check if match finished
              const matchFinished = tsMatch && tsMatch.status_id === 8;

              let finalScore = null;
              let result = 'pending';

              if (matchFinished && tsMatch) {
                finalScore = {
                  home: tsMatch.home_score_display || 0,
                  away: tsMatch.away_score_display || 0,
                };

                // Evaluate result using settlement service
                try {
                  const settlement = evaluateMatch(list.market, tsMatch);
                  result = settlement.result === 'WIN' ? 'won' :
                           settlement.result === 'VOID' ? 'void' : 'lost';
                } catch (err) {
                  console.error('[DailyLists] Error evaluating match:', err);
                  result = 'void';
                }
              }

              return {
                fs_id: m.match.fs_id,
                match_id: matchId,
                home_name: m.match.home_name,
                away_name: m.match.away_name,
                league_name: m.match.league_name,
                date_unix: m.match.date_unix,
                confidence: m.confidence,
                reason: m.reason,
                potentials: m.match.potentials,
                xg: m.match.xg,
                odds: m.match.odds,
                live_score: liveScoresMap.get(m.match.fs_id) || null,
                // Match result data (TheSports only)
                match_finished: matchFinished,
                final_score: finalScore,
                result: result, // 'won' | 'lost' | 'void' | 'pending'
              };
            }),
            preview: await formatDailyListMessageWithResults(list, liveScoresMap),
            generated_at: list.generated_at,
            performance,
          };
        })
      );

      return {
        success: true,
        lists_count: lists.length,
        lists: formattedLists,
        generated_at: lists.length > 0 ? lists[0].generated_at : Date.now(),
      };

    } catch (error: any) {
      logger.error('[TelegramDailyLists] ❌ Error fetching today\'s lists:', error);

      // Force output to stderr for debugging
      const errorDetails = `
==================================
[CRITICAL ERROR] Daily Lists API Failed
Error: ${error.message}
Stack: ${error.stack || 'No stack trace'}
==================================
`;
      process.stderr.write(errorDetails);
      console.log(errorDetails); // Also try stdout
      console.error('[DEBUG] Daily lists error:', error.message);
      console.error('[DEBUG] Stack:', error.stack?.substring(0, 500));

      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /telegram/daily-lists/range?start=YYYY-MM-DD&end=YYYY-MM-DD
   * Get daily lists for a date range (historical data)
   *
   * Query Parameters:
   * - start: Start date (YYYY-MM-DD format, required)
   * - end: End date (YYYY-MM-DD format, required)
   *
   * Returns lists grouped by date with performance data
   */
  fastify.get('/telegram/daily-lists/range', async (request, reply) => {
    try {
      const { start, end } = request.query as { start?: string; end?: string };

      if (!start || !end) {
        return reply.status(400).send({
          error: 'Both start and end date parameters are required (YYYY-MM-DD format)'
        });
      }

      logger.info(`[TelegramDailyLists] 📅 Fetching lists from ${start} to ${end}...`);

      // Validate date range (max 31 days to prevent abuse)
      const startDate = new Date(start);
      const endDate = new Date(end);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff < 0) {
        return reply.status(400).send({
          error: 'End date must be after or equal to start date'
        });
      }

      if (daysDiff > 31) {
        return reply.status(400).send({
          error: 'Date range too large (max 31 days)'
        });
      }

      // Fetch lists for each date in range
      const listsByDate: Record<string, any[]> = {};
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const lists = await getDailyLists(dateStr);

        if (lists.length > 0) {
          listsByDate[dateStr] = lists;
          logger.info(`[TelegramDailyLists] ✅ Found ${lists.length} lists for ${dateStr}`);
        } else {
          logger.info(`[TelegramDailyLists] ⚠️  No lists found for ${dateStr}`);
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (Object.keys(listsByDate).length === 0) {
        return {
          success: true,
          date_range: { start, end },
          dates_count: 0,
          data: [],
          message: 'No lists found for this date range',
        };
      }

      // Collect all unique matches for bulk live score query
      const allMatches = new Map<number, any>();
      Object.values(listsByDate).flat().forEach((list: any) => {
        list.matches.forEach((m: any) => {
          allMatches.set(m.match.fs_id, m.match);
        });
      });

      // Bulk query: Get live scores for all matches
      const liveScoresMap = await getLiveScoresForMatches(Array.from(allMatches.values()));

      // Calculate performance for each date's lists
      const formattedData = await Promise.all(
        Object.entries(listsByDate).map(async ([date, lists]) => {
          const listsWithPerformance = await Promise.all(
            lists.map(async (list) => {
              const performance = await calculateListPerformance(list);
              return {
                market: list.market,
                title: list.title,
                emoji: list.emoji,
                matches_count: list.matches.length,
                avg_confidence: Math.round(
                  list.matches.reduce((sum: number, m: any) => sum + m.confidence, 0) / list.matches.length
                ),
                matches: list.matches.map((m: any) => ({
                  fs_id: m.match.fs_id,
                  home_name: m.match.home_name,
                  away_name: m.match.away_name,
                  league_name: m.match.league_name,
                  date_unix: m.match.date_unix,
                  confidence: m.confidence,
                  reason: m.reason,
                  potentials: m.match.potentials,
                  xg: m.match.xg,
                  odds: m.match.odds,
                  live_score: liveScoresMap.get(m.match.fs_id) || null,
                })),
                preview: formatDailyListMessage(list),
                generated_at: list.generated_at,
                performance,
              };
            })
          );

          return {
            date,
            lists: listsWithPerformance,
            lists_count: lists.length,
            generated_at: lists.length > 0 ? lists[0].generated_at : null,
          };
        })
      );

      return {
        success: true,
        date_range: { start, end },
        dates_count: Object.keys(listsByDate).length,
        data: formattedData,
      };

    } catch (error: any) {
      logger.error('[TelegramDailyLists] ❌ Range query failed:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * POST /telegram/publish/daily-list/:market
   * Publish a single daily list by market type
   *
   * HARDENING: Accepts both canonical (O25) and legacy (OVER_25) formats
   * Supported markets: O25, BTTS, HT_O05, O35, HOME_O15, CORNERS_O85, CARDS_O25
   */
  fastify.post('/telegram/publish/daily-list/:market', async (request, reply) => {
    const startTime = Date.now();
    const { market: marketParam } = request.params as { market: string };

    // HARDENING: Generate request_id for observability
    const requestId = randomUUID();
    const logContext = {
      operation: 'single_list_publish',
      request_id: requestId,
      market_param: marketParam,
      dry_run: channelRouter.isDryRun(),
    };

    try {
      logger.info(`[TelegramDailyLists] 🚀 Publishing single list: ${marketParam}`, logContext);

      // HARDENING: Validate and parse market parameter
      const marketId = parseMarketParam(marketParam);
      if (!marketId) {
        logger.warn('[TelegramDailyLists] ❌ Invalid market parameter', {
          ...logContext,
          allowed_markets: getAllowedMarketParams(),
        });
        return reply.status(400).send({
          error: 'Invalid market parameter',
          details: `Market '${marketParam}' is not recognized`,
          allowed_markets: getAllowedMarketParams(),
          canonical_format: ['O25', 'BTTS', 'HT_O05', 'O35', 'HOME_O15', 'CORNERS_O85', 'CARDS_O25'],
        });
      }

      // 0. HARDENING: Check if publishing is enabled
      if (!channelRouter.isPublishEnabled() && !channelRouter.isDryRun()) {
        logger.warn('[TelegramDailyLists] ⚠️  Publishing disabled', {
          ...logContext,
          market_id: marketId,
          note: 'Set TELEGRAM_PUBLISH_ENABLED=true or TELEGRAM_DRY_RUN=true to enable',
        });
        return reply.status(503).send({
          error: 'Telegram publishing is disabled',
          details: 'Set TELEGRAM_PUBLISH_ENABLED=true in .env to enable publishing',
        });
      }

      // 1. Check bot configuration
      if (!telegramBot.isConfigured()) {
        return reply.status(503).send({ error: 'Telegram bot not configured' });
      }

      // Get target channel for this market
      const targetChannelId = channelRouter.getTargetChatId(marketId);

      // 2. Get daily lists from database (or generate if not exists)
      logger.info('[TelegramDailyLists] 📊 Getting lists...', logContext);
      const lists = await getDailyLists();

      // 3. Find the specific list by market
      const targetList = lists.find((l: any) => l.market === marketParam);

      if (!targetList) {
        logger.warn(`[TelegramDailyLists] ⚠️ List not found for market: ${marketParam}`, logContext);
        return reply.status(404).send({
          success: false,
          error: `No list generated for market: ${marketParam}`,
          message: 'List not available or insufficient matches',
        });
      }

      // HARDENING: Standardized logging with all required fields
      const matchCount = targetList.matches.length;
      const picksCount = targetList.matches.length;
      const avgConfidence = Math.round(
        targetList.matches.reduce((sum: number, m: any) => sum + m.confidence, 0) / targetList.matches.length
      );

      logger.info(`[TelegramDailyLists] ✅ Found list for ${marketParam}`, {
        ...logContext,
        market_id: marketId,
        match_count: matchCount,
        picks_count: picksCount,
        avg_confidence: avgConfidence,
        target_chat_id: targetChannelId,
      });

      // 4. Format and publish to Telegram (Week-2B: Market-specific channel)
      const messageText = formatDailyListMessage(targetList);

      logger.info(`[TelegramDailyLists] 📡 Sending to Telegram...`, {
        ...logContext,
        market_id: marketId,
        target_channel: targetChannelId,
      });

      // HARDENING: DRY_RUN mode with enhanced response contract
      if (channelRouter.isDryRun()) {
        logger.warn(`[TelegramDailyLists] ⚠️ DRY_RUN: Skipping actual Telegram send for ${marketParam}`, {
          ...logContext,
          market_id: marketId,
          target_channel: targetChannelId,
          message_preview: messageText.substring(0, 100),
        });

        return {
          success: true,
          market: targetList.market,
          market_id: marketId,
          title: targetList.title,
          telegram_message_id: null,
          match_count: targetList.matches.length,
          avg_confidence: Math.round(
            targetList.matches.reduce((sum: number, m: any) => sum + m.confidence, 0) / targetList.matches.length
          ),
          dry_run: true,
          // HARDENING: Additional metadata for QA verification
          targeted_channel: {
            market: marketId,
            chat_id: targetChannelId,
            display_name: channelRouter.getChannelConfig(marketId)?.displayName,
          },
          message_preview: messageText.substring(0, 300),
          picks_count: targetList.matches.length,
          duration_ms: Date.now() - startTime,
        };
      }

      const result = await telegramBot.sendMessage({
        chat_id: targetChannelId, // Week-2B: Use market-specific channel
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      if (!result.ok) {
        throw new Error(`Telegram API returned ok=false for ${marketParam}`);
      }

      const telegramMessageId = result.result.message_id;

      logger.info(`[TelegramDailyLists] ✅ Published to Telegram`, {
        ...logContext,
        telegram_message_id: telegramMessageId,
      });

      // 5. Save to database (both telegram_posts and telegram_daily_lists)
      const client = await pool.connect();
      try {
        const matchIds = targetList.matches.map((m: any) => m.match.fs_id).join(',');
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

        // Save to telegram_posts for tracking
        await client.query(
          `INSERT INTO telegram_posts (match_id, channel_id, telegram_message_id, content, status, metadata)
           VALUES ($1, $2, $3, $4, 'published', $5)`,
          [
            `daily_list_${marketParam}_${Date.now()}`,
            targetChannelId, // Week-2B: Use market-specific channel
            telegramMessageId,
            messageText,
            JSON.stringify({
              list_type: 'daily',
              market: targetList.market,
              match_ids: matchIds,
              match_count: targetList.matches.length,
              confidence_scores: targetList.matches.map((m: any) => m.confidence),
              generated_at: targetList.generated_at,
            }),
          ]
        );

        // Update telegram_daily_lists with Telegram message ID for settlement
        await client.query(
          `UPDATE telegram_daily_lists
           SET telegram_message_id = $1,
               channel_id = $2,
               status = 'active'
           WHERE market = $3 AND list_date = $4`,
          [telegramMessageId, targetChannelId, marketParam, today] // Week-2B: Use market-specific channel
        );

        logger.info(`[TelegramDailyLists] 💾 Saved to database`, logContext);

      } finally {
        client.release();
      }

      // 6. Return success response
      const duration = Date.now() - startTime;

      return {
        success: true,
        market: targetList.market,
        title: targetList.title,
        telegram_message_id: telegramMessageId,
        match_count: targetList.matches.length,
        avg_confidence: Math.round(
          targetList.matches.reduce((sum: number, m: any) => sum + m.confidence, 0) / targetList.matches.length
        ),
        duration_ms: duration,
      };

    } catch (error: any) {
      logger.error(`[TelegramDailyLists] ❌ Error publishing ${marketParam}:`, error);
      return reply.status(500).send({
        success: false,
        error: error.message,
        market: marketParam,
      });
    }
  });

  /**
   * POST /telegram/publish/daily-lists
   * Generate and publish daily prediction lists (automated)
   *
   * STRICT RULES:
   * - Only NOT_STARTED matches
   * - 3-5 matches per list max
   * - Confidence-based filtering
   * - Skip if insufficient data
   */
  fastify.post('/telegram/publish/daily-lists', async (request, reply) => {
    const startTime = Date.now();

    // HARDENING: Generate request_id for observability
    const requestId = randomUUID();
    const logContext = {
      operation: 'daily_lists_publish',
      request_id: requestId,
      dry_run: channelRouter.isDryRun(),
    };

    try {
      logger.info('[TelegramDailyLists] 🚀 Starting daily lists publication...', logContext);

      // 0. HARDENING: Check if publishing is enabled
      if (!channelRouter.isPublishEnabled() && !channelRouter.isDryRun()) {
        logger.warn('[TelegramDailyLists] ⚠️  Publishing disabled', {
          ...logContext,
          note: 'Set TELEGRAM_PUBLISH_ENABLED=true or TELEGRAM_DRY_RUN=true to enable',
        });
        return reply.status(503).send({
          error: 'Telegram publishing is disabled',
          details: 'Set TELEGRAM_PUBLISH_ENABLED=true in .env to enable publishing',
        });
      }

      // 1. Check bot configuration
      if (!telegramBot.isConfigured()) {
        return reply.status(503).send({ error: 'Telegram bot not configured' });
      }

      const channelId = process.env.TELEGRAM_CHANNEL_ID || '';
      if (!channelId) {
        return reply.status(503).send({ error: 'TELEGRAM_CHANNEL_ID not set' });
      }

      // 2. Get daily lists from database (or generate if not exists)
      logger.info('[TelegramDailyLists] 📊 Getting lists...', logContext);
      const lists = await getDailyLists();

      if (lists.length === 0) {
        logger.warn('[TelegramDailyLists] ⚠️ NO_ELIGIBLE_MATCHES - No lists to publish', logContext);
        return {
          success: false,
          message: 'NO_ELIGIBLE_MATCHES',
          lists_generated: 0,
          reason: 'Insufficient matches with required confidence levels',
        };
      }

      logger.info(`[TelegramDailyLists] ✅ Generated ${lists.length} lists`, {
        ...logContext,
        list_count: lists.length,
        markets: lists.map((l: any) => l.market),
      });

      // 3. Publish each list to Telegram (Week-2B: Market-specific channels)
      // HARDENING: Market-based error isolation - track failed lists separately
      const publishedLists: any[] = [];
      const failedLists: any[] = [];

      for (const list of lists) {
        const messageText = formatDailyListMessage(list);

        try {
          // HARDENING: Use canonical market ID mapping
          const marketId = DAILY_LIST_MARKET_TO_ID[list.market];
          if (!marketId) {
            logger.error('[TelegramDailyLists] ❌ Unknown market type from daily list', {
              ...logContext,
              market: list.market,
              error: 'UNKNOWN_MARKET_TYPE',
            });
            failedLists.push({
              market: list.market,
              error: 'Unknown market type',
              match_count: list.matches.length,
            });
            continue; // Skip this market
          }

          const targetChannelId = channelRouter.getTargetChatId(marketId);
          const matchCount = list.matches.length;
          const picksCount = list.matches.length;
          const avgConfidence = Math.round(
            list.matches.reduce((sum: number, m: any) => sum + m.confidence, 0) / list.matches.length
          );

          // HARDENING: Standardized logging with all required fields
          logger.info(`[TelegramDailyLists] 📡 Publishing ${list.market} list...`, {
            ...logContext,
            market_id: marketId,
            market: list.market,
            match_count: matchCount,
            picks_count: picksCount,
            avg_confidence: avgConfidence,
            target_chat_id: targetChannelId,
          });

          // HARDENING: DRY_RUN mode with enhanced response contract
          if (channelRouter.isDryRun()) {
            logger.warn(`[TelegramDailyLists] ⚠️ DRY_RUN: Skipping actual Telegram send for ${list.market}`, {
              ...logContext,
              market: list.market,
              target_channel: targetChannelId,
              message_preview: messageText.substring(0, 100),
            });

            // HARDENING: Enhanced DRY_RUN response contract
            publishedLists.push({
              market: list.market,
              market_id: marketId,
              title: list.title,
              match_count: list.matches.length,
              telegram_message_id: null,
              avg_confidence: Math.round(
                list.matches.reduce((sum: number, m: any) => sum + m.confidence, 0) / list.matches.length
              ),
              dry_run: true,
              // HARDENING: Additional metadata for QA verification
              targeted_channel: {
                market: marketId,
                chat_id: targetChannelId,
                display_name: channelRouter.getChannelConfig(marketId)?.displayName,
              },
              message_preview: messageText.substring(0, 300),
              picks_count: list.matches.length,
            });

            continue; // Skip actual send
          }

          // FIX: NO connection held during Telegram API call
          const result = await telegramBot.sendMessage({
            chat_id: targetChannelId,
            text: messageText,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          });

          if (!result.ok) {
            throw new Error(`Telegram API returned ok=false for ${list.market}`);
          }

          const telegramMessageId = result.result.message_id;

          // FIX: Acquire connection AFTER Telegram send succeeds
          const client = await pool.connect();
          try {
            const matchIds = list.matches.map((m: any) => m.match.fs_id).join(',');
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

            // Save to telegram_posts for tracking
            await client.query(
              `INSERT INTO telegram_posts (match_id, channel_id, telegram_message_id, content, status, metadata)
               VALUES ($1, $2, $3, $4, 'published', $5)`,
              [
                `daily_list_${list.market}_${Date.now()}`, // Unique ID for list
                targetChannelId, // Week-2B: Use market-specific channel
                telegramMessageId,
                messageText,
                JSON.stringify({
                  list_type: 'daily',
                  market: list.market,
                  match_ids: matchIds,
                  match_count: list.matches.length,
                  confidence_scores: list.matches.map((m: any) => m.confidence),
                  generated_at: list.generated_at,
                }),
              ]
            );

            // Update telegram_daily_lists with Telegram message ID for settlement
            await client.query(
              `UPDATE telegram_daily_lists
               SET telegram_message_id = $1,
                   channel_id = $2,
                   status = 'active'
               WHERE market = $3 AND list_date = $4`,
              [telegramMessageId, targetChannelId, list.market, today] // Week-2B: Use market-specific channel
            );
          } finally {
            client.release();
          }

          publishedLists.push({
            market: list.market,
            title: list.title,
            match_count: list.matches.length,
            telegram_message_id: telegramMessageId,
            avg_confidence: Math.round(
              list.matches.reduce((sum: number, m: any) => sum + m.confidence, 0) / list.matches.length
            ),
          });

          logger.info(`[TelegramDailyLists] ✅ Published ${list.market} list`, {
            ...logContext,
            market: list.market,
            message_id: telegramMessageId,
          });

          // PHASE-0: Throttle - wait between messages to avoid rate limiting
          const listIndex = lists.indexOf(list);
          if (listIndex < lists.length - 1) {
            logger.debug(`[TelegramDailyLists] ⏳ Throttling ${PUBLISH_DELAY_MS}ms before next list...`);
            await new Promise(resolve => setTimeout(resolve, PUBLISH_DELAY_MS));
          }

        } catch (err: any) {
          // HARDENING: Market-based error isolation - one market failure doesn't stop others
          const marketId = DAILY_LIST_MARKET_TO_ID[list.market];
          const targetChannelId = marketId ? channelRouter.getTargetChatId(marketId) : 'N/A';

          logger.error(`[TelegramDailyLists] ❌ Failed to publish ${list.market} list`, {
            ...logContext,
            market_id: marketId,
            market: list.market,
            match_count: list.matches.length,
            picks_count: list.matches.length,
            target_chat_id: targetChannelId,
            error: err.message,
            error_stack: err.stack,
          });

          failedLists.push({
            market: list.market,
            market_id: marketId,
            error: err.message,
            match_count: list.matches.length,
            target_chat_id: targetChannelId,
          });
        }
      }

      const elapsedMs = Date.now() - startTime;

      // HARDENING: Comprehensive final logging with all metadata
      logger.info('[TelegramDailyLists] ✅ Daily lists publication complete', {
        ...logContext,
        lists_generated: lists.length,
        lists_published: publishedLists.length,
        lists_failed: failedLists.length,
        success_rate: lists.length > 0 ? ((publishedLists.length / lists.length) * 100).toFixed(1) + '%' : '0%',
        markets_published: publishedLists.map((l: any) => l.market),
        markets_failed: failedLists.map((l: any) => l.market),
        elapsed_ms: elapsedMs,
      });

      // HARDENING: Include failedLists in response for market-based error isolation
      return {
        success: true,
        lists_generated: lists.length,
        lists_published: publishedLists.length,
        lists_failed: failedLists.length,
        published_lists: publishedLists,
        failed_lists: failedLists, // NEW: Track failed markets separately
        elapsed_ms: elapsedMs,
        success_rate: lists.length > 0 ? ((publishedLists.length / lists.length) * 100).toFixed(1) + '%' : '0%',
      };

    } catch (error: any) {
      const elapsedMs = Date.now() - startTime;
      logger.error('[TelegramDailyLists] ❌ Daily lists publication failed', {
        ...logContext,
        error: error.message,
        stack: error.stack,
        elapsed_ms: elapsedMs,
      });
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * POST /telegram/daily-lists/refresh
   * Force refresh daily lists (admin function)
   */
  fastify.post('/telegram/daily-lists/refresh', async (request, reply) => {
    const logContext = { endpoint: 'POST /telegram/daily-lists/refresh' };
    const startTime = Date.now();

    try {
      logger.info('[TelegramDailyLists] 🔄 FORCE REFRESH requested...', logContext);

      // Force refresh (will regenerate and overwrite database)
      const lists = await refreshDailyLists();

      const elapsedMs = Date.now() - startTime;

      logger.info(`[TelegramDailyLists] ✅ Force refresh completed`, {
        ...logContext,
        lists_generated: lists.length,
        elapsed_ms: elapsedMs,
      });

      return {
        success: true,
        lists_generated: lists.length,
        lists: lists.map((l: any) => ({
          market: l.market,
          title: l.title,
          matches_count: l.matches.length,
          avg_confidence: l.avg_confidence || 0,
        })),
        elapsed_ms: elapsedMs,
      };

    } catch (error: any) {
      const elapsedMs = Date.now() - startTime;
      logger.error('[TelegramDailyLists] ❌ Force refresh failed', {
        ...logContext,
        error: error.message,
        stack: error.stack,
        elapsed_ms: elapsedMs,
      });
      return reply.status(500).send({ error: error.message });
    }
  });
}
