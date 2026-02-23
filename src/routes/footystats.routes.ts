/**
 * FootyStats Integration Routes
 *
 * Admin endpoints for managing FootyStats integration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mappingService } from '../services/footystats/mapping.service';
import { footyStatsAPI } from '../services/footystats/footystats.client';
import { logger } from '../utils/logger';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
// PR-4: Use repository for all FootyStats DB access
import {
  getLeagues,
  getVerifiedLeagueMappings,
  searchMappings,
  getMatchDetails,
  getTeamMapping,
  clearAllMappings,
  runMigrations
} from '../repositories/footystats.repository';
// Import Turkish trends converter
import { generateTurkishTrends } from '../services/telegram/trends.generator';
// Import caching service
import {
  getCachedMatchStats,
  setCachedMatchStats,
  getCachedTodayMatches,
  setCachedTodayMatches,
  invalidateMatchCache,
  cleanupExpiredCache,
  getCacheStats
} from '../services/footystats/cache.service';

// ============================================================================
// MODULE-LEVEL LEAGUE TABLE CACHE (in-memory, 6-hour TTL)
// One /league-tables call covers ALL teams in a league (full season stats)
// competition_id from todays-matches == season_id for /league-tables
// ============================================================================
const _leagueTableCache = new Map<number, { teamMap: Map<number, Record<string, any>>; ts: number }>();
const _LEAGUE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ============================================================================
// MODULE-LEVEL LEAGUE NAME CACHE (in-memory, 24-hour TTL)
// /league-season?season_id=competition_id returns name_tr (Turkish), english_name, name
// ============================================================================
const _leagueNameCache = new Map<number, { name: string; ts: number }>();
const _LEAGUE_NAME_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// TRENDS RESPONSE CACHE (in-memory, 5-minute TTL)
// Caches the full computed trends-analysis response so concurrent requests
// don't all flood FootyStats API simultaneously. Also prevents repeated
// computation on every request.
// ============================================================================
let _trendsResponseCache: { data: any; ts: number } | null = null;
const _TRENDS_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Pending promise: if a computation is in progress, subsequent requests wait for it
let _trendsComputationPromise: Promise<any> | null = null;

/**
 * Returns Turkish (or English fallback) league name for a given competition_id.
 * Uses /league-season endpoint which contains name_tr, english_name, name, country.
 */
async function getLeagueNameCached(competitionId: number): Promise<string> {
  const cached = _leagueNameCache.get(competitionId);
  if (cached && Date.now() - cached.ts < _LEAGUE_NAME_CACHE_TTL_MS) return cached.name;

  try {
    const res = await footyStatsAPI.getLeagueSeason(competitionId);
    const d = (res.data as any)?.data ?? res.data;
    const nameTr = d?.name_tr;
    const englishName = d?.english_name;
    const name = d?.name;
    const country = d?.country;

    let resolved = nameTr || englishName || name;
    if (!resolved && country && (englishName || name)) {
      resolved = `${country} - ${englishName || name}`;
    }
    if (!resolved) resolved = 'Bilinmeyen Lig';

    _leagueNameCache.set(competitionId, { name: resolved, ts: Date.now() });
    return resolved;
  } catch {
    // On error cache a short-lived placeholder to avoid hammering the API
    _leagueNameCache.set(competitionId, { name: 'Bilinmeyen Lig', ts: Date.now() - _LEAGUE_NAME_CACHE_TTL_MS + 60_000 });
    return 'Bilinmeyen Lig';
  }
}

/**
 * Returns a map of teamId → full-season stats (home & away).
 * Computed from /league-tables which returns all teams in a league at once.
 */
async function getLeagueTeamStatsCached(competitionId: number): Promise<Map<number, Record<string, any>>> {
  const cached = _leagueTableCache.get(competitionId);
  if (cached && Date.now() - cached.ts < _LEAGUE_CACHE_TTL_MS) return cached.teamMap;

  const teamMap = new Map<number, Record<string, any>>();
  try {
    const res = await footyStatsAPI.getLeagueTables(competitionId);
    const rows: any[] = (res.data as any)?.league_table ?? [];
    for (const row of rows) {
      const id = Number(row.id);
      if (!id) continue;
      const homeMP = (row.seasonWins_home ?? 0) + (row.seasonDraws_home ?? 0) + (row.seasonLosses_home ?? 0);
      const awayMP = (row.seasonWins_away ?? 0) + (row.seasonDraws_away ?? 0) + (row.seasonLosses_away ?? 0);
      teamMap.set(id, {
        home_scored_avg: homeMP > 0 ? (row.seasonGoals_home ?? 0) / homeMP : 0,
        home_conceded_avg: homeMP > 0 ? (row.seasonConceded_home ?? 0) / homeMP : 0,
        away_scored_avg: awayMP > 0 ? (row.seasonGoals_away ?? 0) / awayMP : 0,
        away_conceded_avg: awayMP > 0 ? (row.seasonConceded_away ?? 0) / awayMP : 0,
      });
    }
    _leagueTableCache.set(competitionId, { teamMap, ts: Date.now() });
  } catch {
    // Return empty map on error; callers fall back to xG
  }
  return teamMap;
}

export async function footyStatsRoutes(fastify: FastifyInstance): Promise<void> {
  // NOTE: Debug endpoint /footystats/debug-db DELETED for security (exposed DB schema)

  // Search competitions by name or country
  fastify.get('/footystats/search-leagues', async (request: FastifyRequest<{
    Querystring: { q: string; country?: string };
  }>, reply: FastifyReply) => {
    try {
      const { q, country } = request.query;
      if (!q && !country) {
        return reply.status(400).send({ error: 'q or country parameter required' });
      }

      let query: string;
      let params: string[];

      if (country) {
        query = `SELECT c.id, c.name, COALESCE(co.name, 'International') as country_name
                 FROM ts_competitions c
                 LEFT JOIN ts_countries co ON c.country_id = co.external_id
                 WHERE LOWER(COALESCE(co.name, 'International')) LIKE $1
                 ORDER BY c.name
                 LIMIT 50`;
        params = [`%${country.toLowerCase()}%`];
      } else {
        query = `SELECT c.id, c.name, COALESCE(co.name, 'International') as country_name
                 FROM ts_competitions c
                 LEFT JOIN ts_countries co ON c.country_id = co.external_id
                 WHERE LOWER(c.name) LIKE $1
                 ORDER BY co.name, c.name
                 LIMIT 30`;
        params = [`%${q!.toLowerCase()}%`];
      }

      // PR-4: Use repository for DB access
      const leagues = await getLeagues(query, params);
      return { count: leagues.length, leagues };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Health check for FootyStats integration
  fastify.get('/footystats/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiHealth = footyStatsAPI.getHealth();
    const stats = await mappingService.getStats();

    return {
      api: apiHealth,
      mappings: stats,
    };
  });

  // Get trends analysis for today's matches (MOVED TO TOP TO AVOID LOADING ISSUES)
  fastify.get('/footystats/trends-analysis', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Return cached response if fresh (5-minute TTL)
      if (_trendsResponseCache && Date.now() - _trendsResponseCache.ts < _TRENDS_RESPONSE_CACHE_TTL_MS) {
        logger.info('[FootyStats] trends-analysis: serving from response cache');
        return _trendsResponseCache.data;
      }

      // If computation is already in progress (concurrent requests), wait for it
      if (_trendsComputationPromise) {
        logger.info('[FootyStats] trends-analysis: waiting for in-progress computation');
        return await _trendsComputationPromise;
      }

      // Start computation; store promise so concurrent requests share it
      _trendsComputationPromise = (async () => {
      logger.info('[FootyStats] Fetching trends analysis...');

      // Skip DB cache lookup to avoid connection pool exhaustion under live match load.
      // Fetch directly from FootyStats API (fast ~0.3s). League table data uses
      // in-memory _leagueTableCache (6h TTL) to avoid repeated API calls.
      const response = await footyStatsAPI.getTodaysMatches();
      const matches = response.data || [];

      if (!matches || matches.length === 0) {
        return {
          success: true,
          trends: {
            goalTrends: [],
            cornerTrends: [],
            cardsTrends: [],
            formTrends: [],
            valueBets: []
          },
          totalMatches: 0
        };
      }

      // Helper: read field from either processed (cached) or raw API format
      const bp = (m: any, field: string, rawField: string): number =>
        m.potentials?.[field] ?? m[rawField] ?? 0;
      const bx = (m: any, team: 'home' | 'away'): number =>
        m.xg?.[team] ?? (team === 'home' ? m.team_a_xg_prematch : m.team_b_xg_prematch) ?? 0;

      // Collect ALL unique competition_ids from ALL matches (for league names + table stats)
      const allCompIds = new Set<number>();
      matches.forEach((m: any) => {
        const cid = Number(m.competition_id || m.competitionId);
        if (cid) allCompIds.add(cid);
      });

      // Fetch league names AND league table stats for all competitions.
      // Uses in-memory caches (24h / 6h TTL). Runs at most 4 competitions concurrently
      // to avoid FootyStats rate limiting, and races against a 6-second timeout so
      // cold-cache startup never blocks the response long-term.
      const leagueNames = new Map<number, string>();
      const leagueTeamMaps = new Map<number, Map<number, Record<string, any>>>();

      const enrichOneCompetition = async (cid: number) => {
        const [name, teamMap] = await Promise.all([
          getLeagueNameCached(cid),
          getLeagueTeamStatsCached(cid),
        ]);
        leagueNames.set(cid, name);
        leagueTeamMaps.set(cid, teamMap);
      };

      // Concurrency-limited runner: process max 4 competitions at a time
      const CONCURRENCY = 4;
      const allCidArray = [...allCompIds];
      const enrichmentPromise = (async () => {
        for (let i = 0; i < allCidArray.length; i += CONCURRENCY) {
          const batch = allCidArray.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map(enrichOneCompetition));
        }
      })();

      const enrichmentTimeout = new Promise<void>(resolve =>
        setTimeout(() => {
          logger.warn('[FootyStats] League enrichment exceeded 6s — returning partial data, caches will populate in background');
          resolve();
        }, 6000)
      );
      await Promise.race([enrichmentPromise, enrichmentTimeout]);

      // Helper: resolve league name for a match
      const getLeagueName = (m: any): string => {
        const cid = Number(m.competition_id || m.competitionId);
        return leagueNames.get(cid) || m.league_name || m.competition_name || 'Bilinmeyen Lig';
      };

      // GOAL TRENDS - collect matching matches first, then fetch full-season team stats
      const filteredForGoals = matches.filter((m: any) =>
        bp(m, 'btts', 'btts_potential') >= 65 || bp(m, 'over25', 'o25_potential') >= 65
      );

      // Helper: get full-season stats for a team from its competition's table
      const getTeamSeasonStats = (m: any, teamId: number): Record<string, any> | undefined => {
        const cid = Number(m.competition_id || m.competitionId);
        return leagueTeamMaps.get(cid)?.get(teamId);
      };

      // GOAL TRENDS - High scoring matches with real full-season scored/conceded averages
      const goalTrends = filteredForGoals
        .map((m: any) => {
          const btts = bp(m, 'btts', 'btts_potential');
          const over25 = bp(m, 'over25', 'o25_potential');
          const homeXg = bx(m, 'home');
          const awayXg = bx(m, 'away');
          const homeStats = getTeamSeasonStats(m, Number(m.homeID));
          const awayStats = getTeamSeasonStats(m, Number(m.awayID));
          return {
            fs_id: m.fs_id || m.id,
            home_name: m.home_name,
            away_name: m.away_name,
            home_logo: m.home_logo || null,
            away_logo: m.away_logo || null,
            league_name: getLeagueName(m),
            date_unix: m.date_unix,
            btts,
            over25,
            over15: bp(m, 'over15', 'o15_potential'),
            ht_over05: bp(m, 'ht_over05', 'o05HT_potential'),
            avg_goals: bp(m, 'avg', 'avg_potential'),
            xg_total: homeXg + awayXg,
            corners: bp(m, 'corners', 'corners_potential'),
            cards: bp(m, 'cards', 'cards_potential'),
            corner_over75: (() => { const c = bp(m, 'corners', 'corners_potential'); return c > 0 ? Math.min(90, Math.max(20, Math.round((c / 10) * 75 + 5))) : 0; })(),
            card_over35: (() => { const k = bp(m, 'cards', 'cards_potential'); return k > 0 ? Math.min(88, Math.max(20, Math.round((k / 5) * 70 + 10))) : 0; })(),
            // Full-season averages per venue (goals scored/conceded in home or away games)
            home_scored: homeStats?.home_scored_avg ?? homeXg,
            home_conceded: homeStats?.home_conceded_avg ?? awayXg,
            away_scored: awayStats?.away_scored_avg ?? awayXg,
            away_conceded: awayStats?.away_conceded_avg ?? homeXg,
            trend_type: btts >= 70 ? 'High BTTS' : 'High Goals',
            confidence: Math.max(btts, over25),
          };
        })
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .slice(0, 20);

      // CORNER TRENDS - High corner potential
      const cornerTrends = matches
        .filter((m: any) => bp(m, 'corners', 'corners_potential') >= 10)
        .map((m: any) => {
          const corners = bp(m, 'corners', 'corners_potential');
          return {
            fs_id: m.fs_id || m.id,
            home_name: m.home_name,
            away_name: m.away_name,
            home_logo: m.home_logo || null,
            away_logo: m.away_logo || null,
            league_name: getLeagueName(m),
            date_unix: m.date_unix,
            corners,
            over9_5: corners >= 9.5 ? 75 : 50,
            over10_5: corners >= 10.5 ? 70 : 45,
            trend_type: 'High Corners',
            confidence: Math.min(95, Math.round(corners * 7)),
          };
        })
        .sort((a: any, b: any) => b.corners - a.corners)
        .slice(0, 15);

      // CARDS TRENDS - High cards potential
      const cardsTrends = matches
        .filter((m: any) => bp(m, 'cards', 'cards_potential') >= 4)
        .map((m: any) => {
          const cards = bp(m, 'cards', 'cards_potential');
          return {
            fs_id: m.fs_id || m.id,
            home_name: m.home_name,
            away_name: m.away_name,
            home_logo: m.home_logo || null,
            away_logo: m.away_logo || null,
            league_name: getLeagueName(m),
            date_unix: m.date_unix,
            cards,
            over3_5: cards >= 3.5 ? 70 : 50,
            over4_5: cards >= 4.5 ? 65 : 45,
            trend_type: 'High Cards',
            confidence: Math.min(85, Math.round(cards * 15)),
          };
        })
        .sort((a: any, b: any) => b.cards - a.cards)
        .slice(0, 15);

      // FORM TRENDS - Teams with strong recent form (based on xG difference)
      const formTrends = matches
        .filter((m: any) => {
          const xgDiff = Math.abs(bx(m, 'home') - bx(m, 'away'));
          return xgDiff >= 0.5; // Significant xG difference indicates form advantage
        })
        .map((m: any) => {
          const homeXg = bx(m, 'home');
          const awayXg = bx(m, 'away');
          const favorite = homeXg > awayXg ? 'home' : 'away';
          const xgDiff = Math.abs(homeXg - awayXg);

          return {
            fs_id: m.fs_id || m.id,
            home_name: m.home_name,
            away_name: m.away_name,
            home_logo: m.home_logo || null,
            away_logo: m.away_logo || null,
            league_name: getLeagueName(m),
            date_unix: m.date_unix,
            home_xg: homeXg,
            away_xg: awayXg,
            xg_diff: xgDiff,
            favorite: favorite,
            favorite_name: favorite === 'home' ? m.home_name : m.away_name,
            trend_type: 'Form Advantage',
            confidence: Math.min(85, Math.round(50 + (xgDiff * 20))),
          };
        })
        .sort((a: any, b: any) => b.xg_diff - a.xg_diff)
        .slice(0, 15);

      // VALUE BETS - Mismatched odds vs predictions
      const valueBets = matches
        .filter((m: any) => {
          const oddsHome = m.odds?.home || m.odds_ft_1;
          const oddsAway = m.odds?.away || m.odds_ft_2;
          if (!oddsHome || !oddsAway) return false;
          const totalXg = bx(m, 'home') + bx(m, 'away');
          const bttsPot = bp(m, 'btts', 'btts_potential');
          const over25Pot = bp(m, 'over25', 'o25_potential');
          return (bttsPot >= 60 && totalXg >= 2.5) || (over25Pot >= 65 && totalXg >= 2.8);
        })
        .map((m: any) => {
          const bttsPot = bp(m, 'btts', 'btts_potential');
          const over25Pot = bp(m, 'over25', 'o25_potential');
          const totalXg = bx(m, 'home') + bx(m, 'away');
          return {
            fs_id: m.fs_id || m.id,
            home_name: m.home_name,
            away_name: m.away_name,
            home_logo: m.home_logo || null,
            away_logo: m.away_logo || null,
            league_name: getLeagueName(m),
            date_unix: m.date_unix,
            btts: bttsPot,
            over25: over25Pot,
            xg_total: totalXg,
            odds_home: m.odds?.home || m.odds_ft_1,
            odds_draw: m.odds?.draw || m.odds_ft_x,
            odds_away: m.odds?.away || m.odds_ft_2,
            trend_type: 'Value Bet',
            confidence: Math.round((bttsPot + over25Pot + (totalXg * 10)) / 3),
          };
        })
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .slice(0, 12);

      logger.info(`[FootyStats] Trends analysis completed: ${goalTrends.length} goal trends, ${cornerTrends.length} corner trends`);

      const result = {
        success: true,
        trends: {
          goalTrends,
          cornerTrends,
          cardsTrends,
          formTrends,
          valueBets
        },
        totalMatches: matches.length,
        generated_at: new Date().toISOString()
      };

      // Store in response cache
      _trendsResponseCache = { data: result, ts: Date.now() };
      return result;
      })(); // end _trendsComputationPromise IIFE

      try {
        const result = await _trendsComputationPromise;
        return result;
      } finally {
        _trendsComputationPromise = null;
      }
    } catch (error: any) {
      _trendsComputationPromise = null;
      logger.error('[FootyStats] Trends analysis error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch trends analysis'
      });
    }
  });

  // Test FootyStats API - ADMIN ONLY
  fastify.get<{ Querystring: { q?: string } }>('/footystats/test', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const { q } = request.query;
      const response = await footyStatsAPI.getLeagueList();
      let leagues = response.data || [];

      // Filter if query provided
      if (q) {
        const searchTerm = q.toLowerCase();
        leagues = leagues.filter(l =>
          l.name?.toLowerCase().includes(searchTerm) ||
          l.country?.toLowerCase().includes(searchTerm) ||
          l.league_name?.toLowerCase().includes(searchTerm)
        );
      }

      return {
        success: true,
        leagues_available: response.data?.length || 0,
        filtered_count: leagues.length,
        sample: leagues.slice(0, 20).map(l => ({
          name: l.name,
          country: l.country,
          league_name: l.league_name,
          seasons: l.season?.length || 0,
          latest_season: l.season?.[l.season.length - 1] || null,
        })),
      };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Run league mapping
  fastify.post('/footystats/mapping/leagues', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('[FootyStats] Starting league mapping via API...');
      const stats = await mappingService.mapLeagues();
      return {
        success: true,
        stats,
      };
    } catch (error: any) {
      logger.error('[FootyStats] League mapping failed:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Run team mapping for a single league (for testing)
  fastify.post('/footystats/mapping/teams/:leagueId', async (request: FastifyRequest<{
    Params: { leagueId: string };
  }>, reply: FastifyReply) => {
    try {
      const { leagueId } = request.params;
      logger.info(`[FootyStats] Starting team mapping for league ${leagueId}...`);
      const stats = await mappingService.mapTeamsForLeague(leagueId);
      return {
        success: true,
        stats,
      };
    } catch (error: any) {
      logger.error('[FootyStats] Team mapping failed:', error.message || error);
      return reply.status(500).send({
        success: false,
        error: error.message || String(error),
      });
    }
  });

  // Run team mapping for all leagues
  fastify.post('/footystats/mapping/teams', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('[FootyStats] Starting team mapping via API...');
      const stats = await mappingService.mapAllTeams();
      return {
        success: true,
        stats,
      };
    } catch (error: any) {
      logger.error('[FootyStats] Team mapping failed:', error.message || error);
      return reply.status(500).send({
        success: false,
        error: error.message || String(error),
      });
    }
  });

  // Get mapping stats
  fastify.get('/footystats/mapping/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await mappingService.getStats();
    return stats;
  });

  // Get unverified mappings
  fastify.get('/footystats/mapping/unverified', async (request: FastifyRequest, reply: FastifyReply) => {
    const unverified = await mappingService.getUnverifiedMappings();
    return {
      count: unverified.length,
      mappings: unverified,
    };
  });

  // Get verified league mappings
  fastify.get('/footystats/mapping/verified-leagues', async (request: FastifyRequest, reply: FastifyReply) => {
    // PR-4: Use repository for DB access
    const verified = await getVerifiedLeagueMappings();
    return { count: verified.length, leagues: verified };
  });

  // Search mappings by name
  fastify.get('/footystats/mapping/search', async (request: FastifyRequest<{
    Querystring: { q: string };
  }>, reply: FastifyReply) => {
    const { q } = request.query;
    if (!q) {
      return reply.status(400).send({ error: 'q parameter required' });
    }
    // PR-4: Use repository for DB access
    const results = await searchMappings(q);
    return { count: results.length, mappings: results };
  });

  // Verify a mapping
  fastify.post('/footystats/mapping/verify', async (request: FastifyRequest<{
    Body: { entity_type: string; ts_id: string };
  }>, reply: FastifyReply) => {
    const { entity_type, ts_id } = request.body;

    if (!entity_type || !ts_id) {
      return reply.status(400).send({ error: 'entity_type and ts_id required' });
    }

    await mappingService.verifyMapping(entity_type, ts_id, 'api');
    return { success: true };
  });

  // ============================================================================
  // MATCH ANALYSIS ENDPOINT (for AI Lab)
  // ============================================================================

  // Get FootyStats analysis for a match
  fastify.get('/footystats/analysis/:matchId', async (request: FastifyRequest<{
    Params: { matchId: string };
  }>, reply: FastifyReply) => {
    try {
      const { matchId } = request.params;

      // 1. Get match details from TheSports database
      // Note: external_id is varchar, id is UUID - we use external_id for lookups
      // PR-4: Use repository for DB access
      const matchResult = await getMatchDetails(matchId);

      if (matchResult.length === 0) {
        return reply.status(404).send({ error: 'Match not found' });
      }

      const match = matchResult[0];

      // 2. Get FootyStats team mappings
      // PR-4: Use repository for DB access
      const homeTeamMapping = await getTeamMapping(match.home_team_name);
      const awayTeamMapping = await getTeamMapping(match.away_team_name);

      // 3. Try to get FootyStats match data (if available)
      let fsMatchData = null;
      let fsHomeTeamData = null;
      let fsAwayTeamData = null;

      try {
        // Get today's matches from FootyStats to find this match
        const todaysMatches = await footyStatsAPI.getTodaysMatches();
        if (todaysMatches.data) {
          // Try to find the match by team names
          fsMatchData = todaysMatches.data.find((m: any) =>
            (m.home_name?.toLowerCase().includes(match.home_team_name?.toLowerCase().split(' ')[0]) ||
             match.home_team_name?.toLowerCase().includes(m.home_name?.toLowerCase().split(' ')[0])) &&
            (m.away_name?.toLowerCase().includes(match.away_team_name?.toLowerCase().split(' ')[0]) ||
             match.away_team_name?.toLowerCase().includes(m.away_name?.toLowerCase().split(' ')[0]))
          );
        }

        // Get team form data if we have mappings
        if (homeTeamMapping.length > 0) {
          const response = await footyStatsAPI.getTeamLastX(homeTeamMapping[0].fs_id);
          fsHomeTeamData = response.data?.[0];
        }

        if (awayTeamMapping.length > 0) {
          const response = await footyStatsAPI.getTeamLastX(awayTeamMapping[0].fs_id);
          fsAwayTeamData = response.data?.[0];
        }
      } catch (apiError: any) {
        logger.warn(`[FootyStats] API error fetching match data: ${apiError.message}`);
      }

      // 4. Build response in AI Lab format
      const response = {
        match: {
          id: match.id,
          external_id: match.external_id,
          home_team: match.home_team_name || 'Home Team',
          away_team: match.away_team_name || 'Away Team',
          home_logo: match.home_logo || '⚽',
          away_logo: match.away_logo || '⚽',
          date: match.match_time,
          league: match.league_name || 'Bilinmeyen Lig',
          status_id: match.status_id,
        },
        potentials: {
          btts_potential: fsMatchData?.btts_potential || null,
          over25_potential: fsMatchData?.o25_potential || null,
          over15_potential: fsMatchData?.avg_potential ? Math.min(fsMatchData.avg_potential + 15, 99) : null,
          corners_potential: fsMatchData?.corners_potential || null,
          cards_potential: fsMatchData?.cards_potential || null,
        },
        xg: {
          home_xg_prematch: fsMatchData?.team_a_xg_prematch || fsHomeTeamData?.xg_for_avg_overall || null,
          away_xg_prematch: fsMatchData?.team_b_xg_prematch || fsAwayTeamData?.xg_for_avg_overall || null,
          total_xg: null as number | null,
        },
        form: {
          home_form: fsHomeTeamData?.formRun_overall || null,
          away_form: fsAwayTeamData?.formRun_overall || null,
          home_ppg: fsHomeTeamData?.seasonPPG_overall || null,
          away_ppg: fsAwayTeamData?.seasonPPG_overall || null,
        },
        h2h: fsMatchData?.h2h ? (() => {
          const totalMatches = fsMatchData.h2h.previous_matches_results?.totalMatches || 0;
          const avgGoals = fsMatchData.h2h.betting_stats?.avg_goals || 0;
          const bttsPct = fsMatchData.h2h.betting_stats?.bttsPercentage || 0;
          const over25Pct = fsMatchData.h2h.betting_stats?.over25Percentage || 0;

          // Calculate Over 1.5 and Over 3.5 based on avg_goals and over25Pct
          const calculateOver15 = () => {
            if (avgGoals >= 3.0) return 100;
            if (avgGoals >= 2.5) return 95;
            if (avgGoals >= 2.0) return 85;
            if (avgGoals >= 1.5) return 70;
            return Math.round(avgGoals * 40);
          };

          const calculateOver35 = () => {
            if (avgGoals >= 4.5) return 90;
            if (avgGoals >= 4.0) return 75;
            if (avgGoals >= 3.5) return 60;
            if (avgGoals >= 3.0) return 45;
            if (avgGoals >= 2.5) return 30;
            return Math.round((avgGoals - 1.5) * 20);
          };

          // Estimate clean sheets
          const estimateCleanSheets = (isHome: boolean) => {
            const baseCleanSheetPct = 100 - bttsPct;
            const adjustment = isHome ? 1.1 : 0.9;
            return Math.max(0, Math.round(baseCleanSheetPct * adjustment));
          };

          return {
            total_matches: totalMatches,
            home_wins: fsMatchData.h2h.previous_matches_results?.team_a_wins || 0,
            draws: fsMatchData.h2h.previous_matches_results?.draw || 0,
            away_wins: fsMatchData.h2h.previous_matches_results?.team_b_wins || 0,
            btts_percentage: bttsPct,
            avg_goals: avgGoals,
            over15_pct: calculateOver15(),
            over25_pct: over25Pct,
            over35_pct: calculateOver35(),
            home_clean_sheets_pct: estimateCleanSheets(true),
            away_clean_sheets_pct: estimateCleanSheets(false),
          };
        })() : null,
        odds: fsMatchData ? {
          home_win: fsMatchData.odds_ft_1 || null,
          draw: fsMatchData.odds_ft_x || null,
          away_win: fsMatchData.odds_ft_2 || null,
        } : null,
        trends: {
          home: fsMatchData?.trends?.home || [],
          away: fsMatchData?.trends?.away || [],
        },
        mappings: {
          home_team_mapped: homeTeamMapping.length > 0,
          away_team_mapped: awayTeamMapping.length > 0,
          home_fs_id: homeTeamMapping[0]?.fs_id || null,
          away_fs_id: awayTeamMapping[0]?.fs_id || null,
        },
        data_source: {
          has_footystats_match: !!fsMatchData,
          has_home_team_data: !!fsHomeTeamData,
          has_away_team_data: !!fsAwayTeamData,
        }
      };

      // Calculate total xG
      if (response.xg.home_xg_prematch && response.xg.away_xg_prematch) {
        response.xg.total_xg = response.xg.home_xg_prematch + response.xg.away_xg_prematch;
      }

      return response;
    } catch (error: any) {
      logger.error('[FootyStats] Analysis endpoint error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get daily tips (all today's matches with predictions)
  // Note: This is essentially an alias for /today endpoint with same functionality
  fastify.get('/footystats/daily-tips', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const today = new Date();

      // Try to get cached data first
      const cached = await getCachedTodayMatches(today);
      if (cached) {
        logger.info(`[FootyStats] Daily tips - CACHE HIT (${cached.length} matches)`);
        return { count: cached.length, matches: cached, cached: true };
      }

      logger.info('[FootyStats] Daily tips - CACHE MISS, fetching from API');
      const response = await footyStatsAPI.getTodaysMatches();

      if (!response.data || response.data.length === 0) {
        return {
          count: 0,
          matches: [],
          cached: false,
          date: today.toISOString().split('T')[0]
        };
      }

      // Helper: Get match data from TheSports DB (league + logos) - SINGLE QUERY
      const { pool } = await import('../database/connection');

      // Build team names list for bulk query
      const allTeamNames = response.data.flatMap((m: any) => [m.home_name, m.away_name]);
      const uniqueTeamNames = [...new Set(allTeamNames)];

      // Bulk fetch team logos
      const teamLogosResult = await pool.query(
        `SELECT name, logo_url FROM ts_teams WHERE name = ANY($1)`,
        [uniqueTeamNames]
      );

      const teamLogosMap = new Map<string, string>();
      teamLogosResult.rows.forEach((row: any) => {
        teamLogosMap.set(row.name.toLowerCase(), row.logo_url);
      });

      // Fuzzy fallback for teams not found - build fuzzy queries
      const missingTeams = uniqueTeamNames.filter(name =>
        !teamLogosMap.has(name.toLowerCase())
      );

      if (missingTeams.length > 0) {
        // Build parameterized query to avoid SQL injection
        const fuzzyConditions = missingTeams.map((name, index) => {
          return `LOWER(name) LIKE $${index + 2}`;
        }).join(' OR ');

        const fuzzyParams = missingTeams.map(name => {
          const firstWord = name.split(' ')[0];
          return `%${firstWord.toLowerCase()}%`;
        });

        const fuzzyResult = await pool.query(
          `SELECT name, logo_url FROM ts_teams WHERE ${fuzzyConditions} LIMIT $1`,
          [missingTeams.length, ...fuzzyParams]
        );

        fuzzyResult.rows.forEach((row: any) => {
          const matchingTeam = missingTeams.find(t =>
            row.name.toLowerCase().includes(t.split(' ')[0].toLowerCase())
          );
          if (matchingTeam && !teamLogosMap.has(matchingTeam.toLowerCase())) {
            teamLogosMap.set(matchingTeam.toLowerCase(), row.logo_url);
          }
        });
      }

      // Bulk fetch league names from ts_matches by team names
      const leagueNamesResult = await pool.query(
        `SELECT DISTINCT
           t1.name as home_name,
           t2.name as away_name,
           c.name as league_name
         FROM ts_matches m
         INNER JOIN ts_teams t1 ON m.home_team_id::text = t1.external_id::text
         INNER JOIN ts_teams t2 ON m.away_team_id::text = t2.external_id::text
         INNER JOIN ts_competitions c ON m.competition_id::text = c.external_id::text
         WHERE (t1.name = ANY($1) OR t2.name = ANY($1))
           AND m.match_time >= extract(epoch from NOW() - INTERVAL '7 days')::bigint
           AND m.match_time <= extract(epoch from NOW() + INTERVAL '7 days')::bigint`,
        [uniqueTeamNames]
      );

      const matchLeagueMap = new Map<string, string>();
      leagueNamesResult.rows.forEach((row: any) => {
        const key = `${row.home_name}|${row.away_name}`.toLowerCase();
        matchLeagueMap.set(key, row.league_name);
      });

      // Map matches with logos and league names
      const matches = response.data.map((m: any) => {
        const matchKey = `${m.home_name}|${m.away_name}`.toLowerCase();
        return {
          fs_id: m.id,
          homeID: m.homeID,
          awayID: m.awayID,
          competition_id: m.competition_id,
          home_name: m.home_name,
          away_name: m.away_name,
          home_logo: teamLogosMap.get(m.home_name.toLowerCase()) || null,
          away_logo: teamLogosMap.get(m.away_name.toLowerCase()) || null,
          league_name: matchLeagueMap.get(matchKey) || m.competition_name,
          country: m.country,
          date_unix: m.date_unix,
          status: m.status,
          score: `${m.homeGoalCount || 0}-${m.awayGoalCount || 0}`,
          potentials: {
            btts: m.btts_potential,
            over25: m.over25_potential,
            avg: m.avg_potential,
            over15: m.o15_potential || (m.avg_potential > 1.5 ? Math.round(m.avg_potential * 40) : 60),
            ht_over05: m.o05HT_potential || 0,
            corners: m.corners_potential,
            cards: m.cards_potential,
            shots: m.shots_potential,
            fouls: m.fouls_potential
          },
          xg: {
            home: m.pre_match_xg_home,
            away: m.pre_match_xg_away
          },
          odds: {
            home: m.odds_ft_1,
            draw: m.odds_ft_x,
            away: m.odds_ft_2
          }
        };
      });

      // Cache the result
      await setCachedTodayMatches(matches, today);

      logger.info(`[FootyStats] Daily tips found: ${matches.length} matches`);

      return {
        count: matches.length,
        matches: matches,
        cached: false,
        date: today.toISOString().split('T')[0]
      };
    } catch (error: any) {
      logger.error('[FootyStats] Daily tips error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch daily tips',
        details: error.message
      });
    }
  });

  // Get referee analysis for a match
  fastify.get('/footystats/referee/:matchId', async (request: FastifyRequest<{
    Params: { matchId: string };
  }>, reply: FastifyReply) => {
    try {
      const { matchId } = request.params;
      logger.info(`[FootyStats] Fetching referee analysis for match ${matchId}...`);

      // IMPORTANT: FootyStats API doesn't have a direct referee endpoint for individual matches
      // We need to return mock/default data since referee data is not available in their API

      // Return default referee data (no referee info available)
      return reply.status(404).send({
        success: false,
        error: 'Referee information not available for this match'
      });

      /*
      // Original implementation (commented out - API doesn't support this)
      const matchDetails = await footyStatsAPI.getMatchDetails(parseInt(matchId));

      if (!matchDetails?.data?.[0]) {
        return reply.status(404).send({
          success: false,
          error: 'Match not found'
        });
      }

      const match = matchDetails.data[0];
      const refereeId = match.referee_id;

      if (!refereeId) {
        return reply.status(404).send({
          success: false,
          error: 'Referee not found for this match'
        });
      }

      // Get referee stats
      const refereeData = await footyStatsAPI.getRefereeStats(refereeId);

      if (!refereeData?.data?.[0]) {
        return reply.status(404).send({
          success: false,
          error: 'Referee stats not found'
        });
      }

      const referee = refereeData.data[0];

      // Calculate derived stats
      const cardsPerMatch = referee.cards_per_match || 0;
      const isSternReferee = cardsPerMatch > 4.5;
      const isLenient = cardsPerMatch < 3.0;

      return {
        success: true,
        referee: {
          id: referee.id,
          name: referee.full_name,
          nationality: referee.nationality,
          // Stats
          cards_per_match: cardsPerMatch,
          penalties_given_per_match: referee.penalties_given_per_match_overall || 0,
          btts_percentage: Math.round(referee.btts_percentage || 0),
          goals_per_match: referee.goals_per_match_overall || 0,
          // Meta
          matches_officiated: referee.appearances_overall || 0,
          // Badges
          is_stern: isSternReferee,
          is_lenient: isLenient,
        }
      };
      */
    } catch (error: any) {
      logger.error('[FootyStats] Referee analysis error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch referee data'
      });
    }
  });

  // Get league standings/tables for a season
  fastify.get('/footystats/league-tables/:seasonId', async (request: FastifyRequest<{
    Params: { seasonId: string };
  }>, reply: FastifyReply) => {
    try {
      const { seasonId } = request.params;
      logger.info(`[FootyStats] Fetching league tables for season ${seasonId}...`);

      const tablesData = await footyStatsAPI.getLeagueTables(parseInt(seasonId));

      if (!tablesData?.data) {
        return reply.status(404).send({
          success: false,
          error: 'League tables not found'
        });
      }

      const data = tablesData.data;

      // Extract the main league table (or specific tables for cups)
      const leagueTable = data.league_table || data.all_matches_table_overall || [];
      const specificTables = data.specific_tables || [];

      // Format team entries with zone indicators
      const formatTable = (table: any[]) => {
        return table.map((team: any) => ({
          id: team.id,
          name: team.name,
          position: team.position,
          points: team.points,
          matches_played: team.matchesPlayed,
          wins: team.seasonWins_overall,
          draws: team.seasonDraws_overall,
          losses: team.seasonLosses_overall,
          goals_for: team.seasonGoals,
          goals_against: team.seasonConceded,
          goal_difference: team.seasonGoalDifference,
          form: team.wdl_record || '',
          zone: team.zone || null,
          corrections: team.corrections || 0,
        }));
      };

      return {
        success: true,
        season_id: parseInt(seasonId),
        league_table: formatTable(leagueTable),
        specific_tables: specificTables.map((round: any) => ({
          round: round.round,
          groups: (round.groups || []).map((group: any) => ({
            name: group.name,
            table: formatTable(group.table || [])
          }))
        })),
        has_groups: specificTables.length > 0,
      };
    } catch (error: any) {
      logger.error('[FootyStats] League tables error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch league tables'
      });
    }
  });

  // Get league players for a season
  fastify.get('/footystats/league-players/:seasonId', async (request: FastifyRequest<{
    Params: { seasonId: string };
    Querystring: { page?: string; search?: string; position?: string };
  }>, reply: FastifyReply) => {
    try {
      const { seasonId } = request.params;
      const { page = '1', search = '', position = '' } = request.query;
      logger.info(`[FootyStats] Fetching players for season ${seasonId}, page ${page}...`);

      const playersData = await footyStatsAPI.getLeaguePlayers(parseInt(seasonId), parseInt(page));

      if (!playersData?.data) {
        return reply.status(404).send({
          success: false,
          error: 'Players not found'
        });
      }

      let players = playersData.data;

      // Client-side filtering (since API doesn't support it)
      if (search) {
        const searchLower = search.toLowerCase();
        players = players.filter((p: any) =>
          p.full_name?.toLowerCase().includes(searchLower) ||
          p.known_as?.toLowerCase().includes(searchLower)
        );
      }

      if (position && position !== 'all') {
        players = players.filter((p: any) =>
          p.position?.toLowerCase() === position.toLowerCase()
        );
      }

      // Format player data
      const formattedPlayers = players.map((player: any) => ({
        id: player.id,
        full_name: player.full_name,
        known_as: player.known_as || player.full_name,
        age: player.age,
        position: player.position,
        nationality: player.nationality,
        club_team_id: player.club_team_id,
        appearances: player.appearances_overall || 0,
        goals: player.goals_overall || 0,
        assists: player.assists_overall || 0,
        minutes_played: player.minutes_played_overall || 0,
      }));

      return {
        success: true,
        season_id: parseInt(seasonId),
        page: parseInt(page),
        total: formattedPlayers.length,
        players: formattedPlayers,
      };
    } catch (error: any) {
      logger.error('[FootyStats] League players error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch players'
      });
    }
  });

  // Get detailed stats for a specific player
  fastify.get('/footystats/player-stats/:playerId', async (request: FastifyRequest<{
    Params: { playerId: string };
  }>, reply: FastifyReply) => {
    try {
      const { playerId } = request.params;
      logger.info(`[FootyStats] Fetching stats for player ${playerId}...`);

      const playerData = await footyStatsAPI.getPlayerStats(parseInt(playerId));

      if (!playerData?.data || playerData.data.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Player stats not found'
        });
      }

      // API returns array of seasons - get the most recent
      const latestSeason = playerData.data[0];

      return {
        success: true,
        player: {
          id: latestSeason.id,
          full_name: latestSeason.full_name,
          known_as: latestSeason.known_as || latestSeason.full_name,
          position: latestSeason.position,
          nationality: latestSeason.nationality,
          age: latestSeason.age,
          club_team_id: latestSeason.club_team_id,

          // Basic stats
          appearances: latestSeason.appearances_overall || 0,
          minutes_played: latestSeason.minutes_played_overall || 0,
          goals: latestSeason.goals_overall || 0,
          assists: latestSeason.assists_overall || 0,
          goals_per_90: latestSeason.goals_per_90_overall || 0,
          assists_per_90: latestSeason.assists_per_90_overall || 0,

          // Advanced stats
          xg_per_90: latestSeason.xg_per_90_overall || 0,
          xa_per_90: latestSeason.xa_per_90_overall || 0,
          shots_per_90: latestSeason.shots_per_90_overall || 0,
          shot_accuracy: latestSeason.shot_accuraccy_percentage_overall || 0,
          passes_per_90: latestSeason.passes_per_90_overall || 0,
          pass_accuracy: latestSeason.pass_completion_rate_overall || 0,
          key_passes_per_90: latestSeason.key_passes_per_90_overall || 0,

          // Defensive stats
          tackles_per_90: latestSeason.tackles_per_90_overall || 0,
          interceptions_per_90: latestSeason.interceptions_per_90_overall || 0,

          // Cards
          yellow_cards: latestSeason.yellow_cards_overall || 0,
          red_cards: latestSeason.red_cards_overall || 0,
        },
        all_seasons: playerData.data, // Include all seasons for history
      };
    } catch (error: any) {
      logger.error('[FootyStats] Player stats error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch player stats'
      });
    }
  });

  // Get today's matches with FootyStats data
  fastify.get('/footystats/today', async (request: FastifyRequest<{
    Querystring: { date?: string };
  }>, reply: FastifyReply) => {
    try {
      // Support date parameter (format: YYYY-MM-DD)
      const dateParam = request.query.date;
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      const dateStr = dateParam || targetDate.toISOString().split('T')[0];

      logger.info(`[FootyStats] Fetching matches for date: ${dateStr}`);

      // Try to get cached data first
      const cached = await getCachedTodayMatches(targetDate);
      if (cached) {
        logger.info(`[FootyStats] Today matches - CACHE HIT (${cached.length} matches) for ${dateStr}`);
        return { count: cached.length, matches: cached, cached: true, date: dateStr };
      }

      logger.info(`[FootyStats] Today matches - CACHE MISS for ${dateStr}, fetching from API`);
      const response = await footyStatsAPI.getTodaysMatches(dateStr);

      if (!response.data || response.data.length === 0) {
        return { count: 0, matches: [], cached: false, date: dateStr };
      }

      // Helper: Get match data from TheSports DB (league + logos) - SINGLE QUERY
      const { pool } = await import('../database/connection');

      // Build team names list for bulk query
      const allTeamNames = response.data.flatMap((m: any) => [m.home_name, m.away_name]);
      const uniqueTeamNames = [...new Set(allTeamNames)];

      // Bulk fetch team logos
      const teamLogosResult = await pool.query(
        `SELECT name, logo_url FROM ts_teams WHERE name = ANY($1)`,
        [uniqueTeamNames]
      );

      const teamLogosMap = new Map<string, string>();
      teamLogosResult.rows.forEach((row: any) => {
        teamLogosMap.set(row.name.toLowerCase(), row.logo_url);
      });

      // Fuzzy fallback for teams not found - build fuzzy queries
      const missingTeams = uniqueTeamNames.filter(name =>
        !teamLogosMap.has(name.toLowerCase())
      );

      if (missingTeams.length > 0) {
        // Build parameterized query to avoid SQL injection
        const fuzzyConditions = missingTeams.map((name, index) => {
          return `LOWER(name) LIKE $${index + 2}`;
        }).join(' OR ');

        const fuzzyParams = missingTeams.map(name => {
          const firstWord = name.split(' ')[0];
          return `%${firstWord.toLowerCase()}%`;
        });

        const fuzzyResult = await pool.query(
          `SELECT name, logo_url FROM ts_teams WHERE ${fuzzyConditions} LIMIT $1`,
          [missingTeams.length, ...fuzzyParams]
        );

        fuzzyResult.rows.forEach((row: any) => {
          const matchingTeam = missingTeams.find(t =>
            row.name.toLowerCase().includes(t.split(' ')[0].toLowerCase())
          );
          if (matchingTeam && !teamLogosMap.has(matchingTeam.toLowerCase())) {
            teamLogosMap.set(matchingTeam.toLowerCase(), row.logo_url);
          }
        });
      }

      // Bulk fetch league names from ts_matches by team names
      const leagueNamesResult = await pool.query(
        `SELECT DISTINCT
           t1.name as home_name,
           t2.name as away_name,
           c.name as league_name
         FROM ts_matches m
         INNER JOIN ts_teams t1 ON m.home_team_id::text = t1.external_id::text
         INNER JOIN ts_teams t2 ON m.away_team_id::text = t2.external_id::text
         INNER JOIN ts_competitions c ON m.competition_id::text = c.external_id::text
         WHERE (t1.name = ANY($1) OR t2.name = ANY($1))
           AND m.match_time >= extract(epoch from NOW() - INTERVAL '7 days')::bigint
           AND m.match_time <= extract(epoch from NOW() + INTERVAL '7 days')::bigint`,
        [uniqueTeamNames]
      );

      const matchLeagueMap = new Map<string, string>();
      leagueNamesResult.rows.forEach((row: any) => {
        const key = `${row.home_name}|${row.away_name}`.toLowerCase();
        matchLeagueMap.set(key, row.league_name);
      });


      // Return matches with potentials, logos, and league names
      const matches = response.data.map((m: any, index: number) => {
        const homeLogo = teamLogosMap.get(m.home_name.toLowerCase()) || null;
        const awayLogo = teamLogosMap.get(m.away_name.toLowerCase()) || null;
        const matchKey = `${m.home_name}|${m.away_name}`.toLowerCase();
        let leagueName = matchLeagueMap.get(matchKey);

        // Fuzzy fallback: if exact match not found, try partial matching
        if (!leagueName) {
          const homeNameLower = m.home_name.toLowerCase();
          const awayNameLower = m.away_name.toLowerCase();

          for (const [key, value] of matchLeagueMap.entries()) {
            const [dbHome, dbAway] = key.split('|');

            // Check if both team names partially match
            const homeMatch = dbHome.includes(homeNameLower) || homeNameLower.includes(dbHome.split(' ')[0]);
            const awayMatch = dbAway.includes(awayNameLower) || awayNameLower.includes(dbAway.split(' ')[0]);

            if (homeMatch && awayMatch) {
              leagueName = value;
              break;
            }
          }
        }

        leagueName = leagueName || 'Bilinmeyen Lig';

        return {
          fs_id: m.id,
          homeID: m.homeID,
          awayID: m.awayID,
          competition_id: m.competition_id,
          home_name: m.home_name,
          away_name: m.away_name,
          home_logo: homeLogo,
          away_logo: awayLogo,
          league_name: leagueName,
          country: m.country || null,
          date_unix: m.date_unix,
          status: m.status,
          score: m.homeGoalCount != null ? `${m.homeGoalCount}-${m.awayGoalCount}` : null,
          potentials: {
            btts: m.btts_potential,
            over25: m.o25_potential,
            avg: m.avg_potential,
            over15: m.o15_potential,
            ht_over05: m.o05HT_potential || 0,
            corners: m.corners_potential,
            cards: m.cards_potential,
            shots: m.team_a_xg_prematch && m.team_b_xg_prematch
              ? Math.round((m.team_a_xg_prematch + m.team_b_xg_prematch) * 6)
              : null,
            fouls: m.corners_potential
              ? Math.round(20 + (m.corners_potential * 0.5))
              : null,
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
          trends: m.trends || null,
          h2h: m.h2h || null,
        };
      });

      // Cache the processed matches
      await setCachedTodayMatches(matches, targetDate);
      logger.info(`[FootyStats] Cached ${matches.length} matches for ${dateStr}`);

      return { count: matches.length, matches, cached: false, date: dateStr };
    } catch (error: any) {
      logger.error('[FootyStats] Today matches error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get detailed FootyStats match data by fs_id
  fastify.get('/footystats/match/:fsId', async (request: FastifyRequest<{
    Params: { fsId: string };
  }>, reply: FastifyReply) => {
    try {
      const { fsId } = request.params;
      const fsIdNum = parseInt(fsId);

      // Try to get cached data first
      const cached = await getCachedMatchStats(fsIdNum);
      if (cached) {
        logger.info(`[FootyStats] Match ${fsIdNum} - CACHE HIT`);
        return { ...cached, cached: true };
      }

      logger.info(`[FootyStats] Match ${fsIdNum} - CACHE MISS, fetching from API`);

      // 1. Get detailed match data from FootyStats /match endpoint
      let fsMatch: any = null;
      try {
        const matchResponse = await footyStatsAPI.getMatchDetails(fsIdNum);
        fsMatch = matchResponse.data;
        logger.info(`[FootyStats] Got match details for ${fsIdNum}`);
      } catch (matchErr: any) {
        logger.warn(`[FootyStats] Could not get match details: ${matchErr.message}`);
        // Fallback to today's matches
        const todaysMatches = await footyStatsAPI.getTodaysMatches();
        fsMatch = todaysMatches.data?.find((m: any) => m.id === fsIdNum);
      }

      if (!fsMatch) {
        return reply.status(404).send({ error: 'Match not found in FootyStats' });
      }

      // 2. Try to get team form data (FootyStats returns stats directly in array elements)
      let homeTeamStats: any = null;
      let awayTeamStats: any = null;

      logger.info(`[FootyStats] Match ${fsIdNum} - homeID: ${fsMatch.homeID}, awayID: ${fsMatch.awayID}`);

      try {
        if (fsMatch.homeID) {
          logger.info(`[FootyStats] Fetching lastX for home team ${fsMatch.homeID}`);
          const homeResponse = await footyStatsAPI.getTeamLastX(fsMatch.homeID);
          logger.info(`[FootyStats] Home response - data exists: ${!!homeResponse.data}, length: ${homeResponse.data?.length || 0}`);
          if (homeResponse.data && homeResponse.data.length > 0) {
            logger.info(`[FootyStats] First element keys: ${Object.keys(homeResponse.data[0]).join(', ')}`);
          }
          // Get last 5 matches data (first entry)
          const homeData = homeResponse.data?.find((d: any) => d.last_x_match_num === 5) || homeResponse.data?.[0];
          homeTeamStats = (homeData as any)?.stats;  // CORRECT: stats are inside .stats property!
          logger.info(`[FootyStats] Home stats - PPG: ${homeTeamStats?.seasonPPG_overall}, BTTS: ${homeTeamStats?.seasonBTTSPercentage_overall}%`);
        }
        if (fsMatch.awayID) {
          logger.info(`[FootyStats] Fetching lastX for away team ${fsMatch.awayID}`);
          const awayResponse = await footyStatsAPI.getTeamLastX(fsMatch.awayID);
          logger.info(`[FootyStats] Away response - data exists: ${!!awayResponse.data}, length: ${awayResponse.data?.length || 0}`);
          if (awayResponse.data && awayResponse.data.length > 0) {
            logger.info(`[FootyStats] First element keys: ${Object.keys(awayResponse.data[0]).join(', ')}`);
          }
          const awayData = awayResponse.data?.find((d: any) => d.last_x_match_num === 5) || awayResponse.data?.[0];
          awayTeamStats = (awayData as any)?.stats;  // CORRECT: stats are inside .stats property!
          logger.info(`[FootyStats] Away stats - PPG: ${awayTeamStats?.seasonPPG_overall}, BTTS: ${awayTeamStats?.seasonBTTSPercentage_overall}%`);
        }
      } catch (teamError: any) {
        logger.warn(`[FootyStats] Could not fetch team form: ${teamError.message}`);
      }

      // 3. Build detailed response
      const response = {
        fs_id: fsMatch.id,
        home_name: fsMatch.home_name,
        away_name: fsMatch.away_name,
        date_unix: fsMatch.date_unix,
        status: fsMatch.status,
        score: fsMatch.homeGoalCount != null ? `${fsMatch.homeGoalCount}-${fsMatch.awayGoalCount}` : null,
        potentials: {
          btts: fsMatch.btts_potential || null,
          over25: fsMatch.o25_potential || null,
          over15: fsMatch.avg_potential ? Math.min(Math.round(fsMatch.avg_potential * 30), 95) : null,
          corners: fsMatch.corners_potential || null,
          cards: fsMatch.cards_potential || null,
          // Calculate Shots Potential (using real team shot averages)
          shots: (() => {
            // PRIORITY 1: Use real team shot averages (home team's home avg + away team's away avg)
            const homeShotsAvg = homeTeamStats?.shotsAVG_home || 0;
            const awayShotsAvg = awayTeamStats?.shotsAVG_away || 0;

            if (homeShotsAvg > 0 && awayShotsAvg > 0) {
              return Math.round(homeShotsAvg + awayShotsAvg);
            }

            // PRIORITY 2: Use overall averages if home/away not available
            const homeShotsOverall = homeTeamStats?.shotsAVG_overall || 0;
            const awayShotsOverall = awayTeamStats?.shotsAVG_overall || 0;

            if (homeShotsOverall > 0 && awayShotsOverall > 0) {
              return Math.round(homeShotsOverall + awayShotsOverall);
            }

            // FALLBACK: Use xG-based calculation (~6 shots per 1.0 xG)
            const homeXg = fsMatch.team_a_xg_prematch || homeTeamStats?.xg_for_avg_overall || 0;
            const awayXg = fsMatch.team_b_xg_prematch || awayTeamStats?.xg_for_avg_overall || 0;
            const totalXg = homeXg + awayXg;
            return totalXg > 0 ? Math.round(totalXg * 6) : null;
          })(),
          // Calculate Fouls Potential (base 20 + corner-based adjustment)
          fouls: (() => {
            const cornersPot = fsMatch.corners_potential || 0;
            return cornersPot > 0 ? Math.round(20 + (cornersPot * 0.5)) : null;
          })(),
        },
        xg: {
          home: fsMatch.team_a_xg_prematch || homeTeamStats?.xg_for_avg_overall || null,
          away: fsMatch.team_b_xg_prematch || awayTeamStats?.xg_for_avg_overall || null,
          total: null as number | null,
        },
        odds: {
          home: fsMatch.odds_ft_1 || null,
          draw: fsMatch.odds_ft_x || null,
          away: fsMatch.odds_ft_2 || null,
        },
        form: {
          home: homeTeamStats ? (() => {
            // Helper function to calculate win percentage
            const calcWinPct = (wins: number, matches: number) =>
              matches > 0 ? Math.round((wins / matches) * 100) : null;

            return {
              // Form strings for badges (e.g. "WWLDW") - Not available in lastX endpoint
              formRun_overall: null,
              formRun_home: null,
              formRun_away: null,

              // PPG (Points Per Game) for each context
              ppg_overall: homeTeamStats.seasonPPG_overall || null,
              ppg_home: homeTeamStats.seasonPPG_home || null,
              ppg_away: homeTeamStats.seasonPPG_away || null,

              // Win Percentage (calculated from wins/matches)
              win_pct_overall: calcWinPct(homeTeamStats.seasonWinsNum_overall, homeTeamStats.seasonMatchesPlayed_overall),
              win_pct_home: calcWinPct(homeTeamStats.seasonWinsNum_home, homeTeamStats.seasonMatchesPlayed_home),
              win_pct_away: calcWinPct(homeTeamStats.seasonWinsNum_away, homeTeamStats.seasonMatchesPlayed_away),

              // Average Goals (total goals per match)
              avg_goals_overall: homeTeamStats.seasonAVG_overall || null,
              avg_goals_home: homeTeamStats.seasonAVG_home || null,
              avg_goals_away: homeTeamStats.seasonAVG_away || null,

              // Goals Scored (goals for per match) - Calculated
              scored_overall: homeTeamStats.seasonGoals_overall && homeTeamStats.seasonMatchesPlayed_overall
                ? parseFloat((homeTeamStats.seasonGoals_overall / homeTeamStats.seasonMatchesPlayed_overall).toFixed(2))
                : null,
              scored_home: homeTeamStats.seasonGoals_home && homeTeamStats.seasonMatchesPlayed_home
                ? parseFloat((homeTeamStats.seasonGoals_home / homeTeamStats.seasonMatchesPlayed_home).toFixed(2))
                : null,
              scored_away: homeTeamStats.seasonGoals_away && homeTeamStats.seasonMatchesPlayed_away
                ? parseFloat((homeTeamStats.seasonGoals_away / homeTeamStats.seasonMatchesPlayed_away).toFixed(2))
                : null,

              // Goals Conceded (goals against per match)
              conceded_overall: homeTeamStats.seasonConcededAVG_overall || null,
              conceded_home: homeTeamStats.seasonConcededAVG_home || null,
              conceded_away: homeTeamStats.seasonConcededAVG_away || null,

              // BTTS (Both Teams To Score) Percentage
              btts_pct_overall: homeTeamStats.seasonBTTSPercentage_overall || null,
              btts_pct_home: homeTeamStats.seasonBTTSPercentage_home || null,
              btts_pct_away: homeTeamStats.seasonBTTSPercentage_away || null,

              // Clean Sheet Percentage
              cs_pct_overall: homeTeamStats.seasonCSPercentage_overall || null,
              cs_pct_home: homeTeamStats.seasonCSPercentage_home || null,
              cs_pct_away: homeTeamStats.seasonCSPercentage_away || null,

              // Failed To Score Percentage
              fts_pct_overall: homeTeamStats.seasonFTSPercentage_overall || null,
              fts_pct_home: homeTeamStats.seasonFTSPercentage_home || null,
              fts_pct_away: homeTeamStats.seasonFTSPercentage_away || null,

              // Over 2.5 Goals Percentage
              over25_pct_overall: homeTeamStats.seasonOver25Percentage_overall || null,
              over25_pct_home: homeTeamStats.seasonOver25Percentage_home || null,
              over25_pct_away: homeTeamStats.seasonOver25Percentage_away || null,

              // xG (Expected Goals)
              xg_overall: homeTeamStats.xg_for_avg_overall || null,
              xg_home: homeTeamStats.xg_for_avg_home || null,
              xg_away: homeTeamStats.xg_for_avg_away || null,

              // xGA (Expected Goals Against)
              xga_overall: homeTeamStats.xg_against_avg_overall || null,
              xga_home: homeTeamStats.xg_against_avg_home || null,
              xga_away: homeTeamStats.xg_against_avg_away || null,
            };
          })() : null,
          away: awayTeamStats ? (() => {
            // Helper function to calculate win percentage
            const calcWinPct = (wins: number, matches: number) =>
              matches > 0 ? Math.round((wins / matches) * 100) : null;

            return {
              // Form strings for badges (e.g. "LWDWW") - Not available in lastX endpoint
              formRun_overall: null,
              formRun_home: null,
              formRun_away: null,

              // PPG (Points Per Game) for each context
              ppg_overall: awayTeamStats.seasonPPG_overall || null,
              ppg_home: awayTeamStats.seasonPPG_home || null,
              ppg_away: awayTeamStats.seasonPPG_away || null,

              // Win Percentage (calculated from wins/matches)
              win_pct_overall: calcWinPct(awayTeamStats.seasonWinsNum_overall, awayTeamStats.seasonMatchesPlayed_overall),
              win_pct_home: calcWinPct(awayTeamStats.seasonWinsNum_home, awayTeamStats.seasonMatchesPlayed_home),
              win_pct_away: calcWinPct(awayTeamStats.seasonWinsNum_away, awayTeamStats.seasonMatchesPlayed_away),

              // Average Goals (total goals per match)
              avg_goals_overall: awayTeamStats.seasonAVG_overall || null,
              avg_goals_home: awayTeamStats.seasonAVG_home || null,
              avg_goals_away: awayTeamStats.seasonAVG_away || null,

              // Goals Scored (goals for per match) - Calculated
              scored_overall: awayTeamStats.seasonGoals_overall && awayTeamStats.seasonMatchesPlayed_overall
                ? parseFloat((awayTeamStats.seasonGoals_overall / awayTeamStats.seasonMatchesPlayed_overall).toFixed(2))
                : null,
              scored_home: awayTeamStats.seasonGoals_home && awayTeamStats.seasonMatchesPlayed_home
                ? parseFloat((awayTeamStats.seasonGoals_home / awayTeamStats.seasonMatchesPlayed_home).toFixed(2))
                : null,
              scored_away: awayTeamStats.seasonGoals_away && awayTeamStats.seasonMatchesPlayed_away
                ? parseFloat((awayTeamStats.seasonGoals_away / awayTeamStats.seasonMatchesPlayed_away).toFixed(2))
                : null,

              // Goals Conceded (goals against per match)
              conceded_overall: awayTeamStats.seasonConcededAVG_overall || null,
              conceded_home: awayTeamStats.seasonConcededAVG_home || null,
              conceded_away: awayTeamStats.seasonConcededAVG_away || null,

              // BTTS (Both Teams To Score) Percentage
              btts_pct_overall: awayTeamStats.seasonBTTSPercentage_overall || null,
              btts_pct_home: awayTeamStats.seasonBTTSPercentage_home || null,
              btts_pct_away: awayTeamStats.seasonBTTSPercentage_away || null,

              // Clean Sheet Percentage
              cs_pct_overall: awayTeamStats.seasonCSPercentage_overall || null,
              cs_pct_home: awayTeamStats.seasonCSPercentage_home || null,
              cs_pct_away: awayTeamStats.seasonCSPercentage_away || null,

              // Failed To Score Percentage
              fts_pct_overall: awayTeamStats.seasonFTSPercentage_overall || null,
              fts_pct_home: awayTeamStats.seasonFTSPercentage_home || null,
              fts_pct_away: awayTeamStats.seasonFTSPercentage_away || null,

              // Over 2.5 Goals Percentage
              over25_pct_overall: awayTeamStats.seasonOver25Percentage_overall || null,
              over25_pct_home: awayTeamStats.seasonOver25Percentage_home || null,
              over25_pct_away: awayTeamStats.seasonOver25Percentage_away || null,

              // xG (Expected Goals)
              xg_overall: awayTeamStats.xg_for_avg_overall || null,
              xg_home: awayTeamStats.xg_for_avg_home || null,
              xg_away: awayTeamStats.xg_for_avg_away || null,

              // xGA (Expected Goals Against)
              xga_overall: awayTeamStats.xg_against_avg_overall || null,
              xga_home: awayTeamStats.xg_against_avg_home || null,
              xga_away: awayTeamStats.xg_against_avg_away || null,
            };
          })() : null,
        },
        h2h: fsMatch.h2h ? (() => {
          const totalMatches = fsMatch.h2h.previous_matches_results?.totalMatches || 0;
          const avgGoals = fsMatch.h2h.betting_stats?.avg_goals || 0;
          const bttsPct = fsMatch.h2h.betting_stats?.bttsPercentage || 0;
          const over25Pct = fsMatch.h2h.betting_stats?.over25Percentage || 0;

          // Calculate Over 1.5 and Over 3.5 based on avg_goals and over25Pct
          const calculateOver15 = () => {
            if (avgGoals >= 3.0) return 100;
            if (avgGoals >= 2.5) return 95;
            if (avgGoals >= 2.0) return 85;
            if (avgGoals >= 1.5) return 70;
            return Math.round(avgGoals * 40); // Rough estimate
          };

          const calculateOver35 = () => {
            if (avgGoals >= 4.5) return 90;
            if (avgGoals >= 4.0) return 75;
            if (avgGoals >= 3.5) return 60;
            if (avgGoals >= 3.0) return 45;
            if (avgGoals >= 2.5) return 30;
            return Math.round((avgGoals - 1.5) * 20); // Rough estimate
          };

          // Estimate clean sheets (inverse of BTTS with slight adjustment)
          const estimateCleanSheets = (isHome: boolean) => {
            // If BTTS is high, clean sheets are rare
            const baseCleanSheetPct = 100 - bttsPct;
            // Home teams typically get slightly more clean sheets
            const adjustment = isHome ? 1.1 : 0.9;
            return Math.max(0, Math.round(baseCleanSheetPct * adjustment));
          };

          return {
            total_matches: totalMatches,
            home_wins: fsMatch.h2h.previous_matches_results?.team_a_wins || 0,
            draws: fsMatch.h2h.previous_matches_results?.draw || 0,
            away_wins: fsMatch.h2h.previous_matches_results?.team_b_wins || 0,
            btts_pct: bttsPct,
            avg_goals: avgGoals,
            // New calculated fields
            over15_pct: calculateOver15(),
            over25_pct: over25Pct,
            over35_pct: calculateOver35(),
            home_clean_sheets_pct: estimateCleanSheets(true),
            away_clean_sheets_pct: estimateCleanSheets(false),
            // Match results
            matches: fsMatch.h2h.previous_matches_ids?.map((m: any) => ({
              date_unix: m.date_unix,
              home_team_id: m.team_a_id,
              away_team_id: m.team_b_id,
              home_goals: m.team_a_goals,
              away_goals: m.team_b_goals,
              score: `${m.team_a_goals}-${m.team_b_goals}`,
            })) || [],
          };
        })() : null,
        trends: (() => {
          // Convert FootyStats trends to Turkish using trends.generator
          const turkishTrends = generateTurkishTrends(
            fsMatch.home_name || 'Home Team',
            fsMatch.away_name || 'Away Team',
            {
              potentials: {
                btts: fsMatch.btts_potential,
                over25: fsMatch.o25_potential,
                over15: fsMatch.avg_potential ? Math.min(Math.round(fsMatch.avg_potential * 30), 95) : undefined,
              },
              form: {
                home: homeTeamStats ? {
                  ppg: homeTeamStats.seasonPPG_overall,
                  btts_pct: homeTeamStats.seasonBTTSPercentage_overall,
                  over25_pct: homeTeamStats.seasonOver25Percentage_overall,
                  overall: homeTeamStats.formRun_overall || null,       // NEW: Form string
                  home_only: homeTeamStats.formRun_home || null,         // NEW: Home form
                } : undefined,
                away: awayTeamStats ? {
                  ppg: awayTeamStats.seasonPPG_overall,
                  btts_pct: awayTeamStats.seasonBTTSPercentage_overall,
                  over25_pct: awayTeamStats.seasonOver25Percentage_overall,
                  overall: awayTeamStats.formRun_overall || null,        // NEW: Form string
                  away_only: awayTeamStats.formRun_away || null,         // NEW: Away form
                } : undefined,
              },
              h2h: fsMatch.h2h ? {
                total_matches: fsMatch.h2h.previous_matches_results?.totalMatches,
                home_wins: fsMatch.h2h.previous_matches_results?.team_a_wins,
                draws: fsMatch.h2h.previous_matches_results?.draw,
                away_wins: fsMatch.h2h.previous_matches_results?.team_b_wins,
                btts_pct: fsMatch.h2h.betting_stats?.bttsPercentage,
                avg_goals: fsMatch.h2h.betting_stats?.avg_goals,
              } : undefined,
              xg: {
                home: fsMatch.team_a_xg_prematch || homeTeamStats?.xg_for_avg_overall,
                away: fsMatch.team_b_xg_prematch || awayTeamStats?.xg_for_avg_overall,
                total: undefined,
              },
              trends: {
                home: fsMatch.trends?.home || [],
                away: fsMatch.trends?.away || [],
              },
            }
          );

          // Helper function to determine sentiment from Turkish text
          const determineSentiment = (text: string): string => {
            const lowerText = text.toLowerCase();

            // Positive indicators
            if (lowerText.includes('galibiyet') ||
                lowerText.includes('güçlü') ||
                lowerText.includes('yüksek gol') ||
                lowerText.includes('iyi form') ||
                lowerText.includes('kalesini gole kapatmış')) {
              return 'great';
            }

            // Negative indicators
            if (lowerText.includes('galibiyetsiz') ||
                lowerText.includes('zayıf') ||
                lowerText.includes('gol yemiş') ||
                lowerText.includes('form dalgalan')) {
              return 'bad';
            }

            // Neutral/informational
            return 'neutral';
          };

          // Return Turkish trends with smart sentiment detection
          return {
            home: turkishTrends.home.map((text: string) => ({
              sentiment: determineSentiment(text),
              text,
            })),
            away: turkishTrends.away.map((text: string) => ({
              sentiment: determineSentiment(text),
              text,
            })),
          };
        })(),
        // Debug: raw data for troubleshooting
        _debug: {
          has_h2h_raw: !!fsMatch.h2h,
          has_trends_raw: !!fsMatch.trends,
          home_team_id: fsMatch.homeID,
          away_team_id: fsMatch.awayID,
        }
      };

      // Calculate total xG
      if (response.xg.home && response.xg.away) {
        response.xg.total = response.xg.home + response.xg.away;
      }

      // Cache the match data - map response fields to MatchCacheData
      await setCachedMatchStats({
        fs_match_id: response.fs_id,
        home_name: response.home_name,
        away_name: response.away_name,
        match_date_unix: response.date_unix,
        status: response.status,
        btts_potential: response.potentials.btts ?? undefined,
        over25_potential: response.potentials.over25 ?? undefined,
        over15_potential: response.potentials.over15 ?? undefined,
        corners_potential: response.potentials.corners ?? undefined,
        cards_potential: response.potentials.cards ?? undefined,
        shots_potential: response.potentials.shots ?? undefined,
        fouls_potential: response.potentials.fouls ?? undefined,
        xg_home_prematch: response.xg.home ?? undefined,
        xg_away_prematch: response.xg.away ?? undefined,
        xg_total: response.xg.total ?? undefined,
        odds_home: response.odds.home ?? undefined,
        odds_draw: response.odds.draw ?? undefined,
        odds_away: response.odds.away ?? undefined,
        trends: response.trends,
        h2h_data: response.h2h,
        form_data: response.form,
      });
      logger.info(`[FootyStats] Cached match ${fsIdNum} data`);

      return { ...response, cached: false };
    } catch (error: any) {
      logger.error('[FootyStats] Match detail error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Clear all mappings (for re-run) - ADMIN ONLY
  fastify.delete('/footystats/mapping/clear', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // PR-4: Use repository for DB access
      await clearAllMappings();
      return { success: true, message: 'All mappings cleared' };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // Create migration tables - ADMIN ONLY
  fastify.post('/footystats/migrate', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // PR-4: Use repository for DB access
      await runMigrations();
      return { success: true, message: 'FootyStats tables created' };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================================================
  // CACHE MANAGEMENT ENDPOINTS - ADMIN ONLY
  // ============================================================================

  // Get cache statistics
  fastify.get('/footystats/cache/stats', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getCacheStats();
      return {
        success: true,
        stats
      };
    } catch (error: any) {
      logger.error('[FootyStats] Cache stats error:', error);
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // Invalidate cache for a specific match
  fastify.delete<{ Params: { matchId: string } }>('/footystats/cache/invalidate/:matchId', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const { matchId } = request.params;
      const fsIdNum = parseInt(matchId);

      await invalidateMatchCache(fsIdNum);
      logger.info(`[FootyStats] Cache invalidated for match ${fsIdNum}`);

      return {
        success: true,
        message: `Cache invalidated for match ${fsIdNum}`
      };
    } catch (error: any) {
      logger.error('[FootyStats] Cache invalidation error:', error);
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // Cleanup expired cache entries
  fastify.post('/footystats/cache/cleanup', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await cleanupExpiredCache();
      logger.info('[FootyStats] Expired cache cleaned up');

      return {
        success: true,
        message: 'Expired cache entries cleaned up'
      };
    } catch (error: any) {
      logger.error('[FootyStats] Cache cleanup error:', error);
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  logger.info('[Routes] FootyStats routes registered');
}
