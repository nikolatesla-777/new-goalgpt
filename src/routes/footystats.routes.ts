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
          league: match.league_name || 'Unknown League',
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

  // Get today's matches with FootyStats data
  fastify.get('/footystats/today', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const response = await footyStatsAPI.getTodaysMatches();

      if (!response.data || response.data.length === 0) {
        return { count: 0, matches: [] };
      }

      // Helper: Get match data from TheSports DB (league + logos) - SINGLE QUERY
      const { pool } = await import('../database/connection');

      // Build team names list for bulk query
      const allTeamNames = response.data.flatMap((m: any) => [m.home_name, m.away_name]);
      const uniqueTeamNames = [...new Set(allTeamNames)];

      // Bulk fetch team logos
      const teamLogosResult = await pool.query(
        `SELECT name, logo_url FROM ts_teams WHERE name = ANY($1::text[])`,
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
        const fuzzyConditions = missingTeams.map(name => {
          const firstWord = name.split(' ')[0];
          return `LOWER(name) LIKE '%${firstWord.toLowerCase()}%'`;
        }).join(' OR ');

        const fuzzyResult = await pool.query(
          `SELECT name, logo_url FROM ts_teams WHERE ${fuzzyConditions} LIMIT ${missingTeams.length}`
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
         INNER JOIN ts_teams t1 ON m.home_team_id = t1.external_id
         INNER JOIN ts_teams t2 ON m.away_team_id = t2.external_id
         INNER JOIN ts_competitions c ON m.competition_id = c.external_id
         WHERE (t1.name = ANY($1::text[]) OR t2.name = ANY($1::text[]))
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

        leagueName = leagueName || 'Unknown League';

        return {
          fs_id: m.id,
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

      return { count: matches.length, matches };
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

      // 1. Get detailed match data from FootyStats /match endpoint
      let fsMatch: any = null;
      try {
        const matchResponse = await footyStatsAPI.getMatchDetails(fsIdNum);
        fsMatch = matchResponse.data;

        // 🔍 DEBUG: Log H2H structure
        console.error('\n🔍 [FootyStats API] H2H data for', fsIdNum);
        console.error('  h2h:', JSON.stringify(fsMatch.h2h, null, 2));

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
          home: homeTeamStats ? {
            ppg: homeTeamStats.seasonPPG_overall || null,
            btts_pct: homeTeamStats.seasonBTTSPercentage_overall || null,
            over25_pct: homeTeamStats.seasonOver25Percentage_overall || null,
            overall: homeTeamStats.formRun_overall || null,          // Form string (e.g. "WWLDW")
            home_only: homeTeamStats.formRun_home || null,           // Home-only form
          } : null,
          away: awayTeamStats ? {
            ppg: awayTeamStats.seasonPPG_overall || null,
            btts_pct: awayTeamStats.seasonBTTSPercentage_overall || null,
            over25_pct: awayTeamStats.seasonOver25Percentage_overall || null,
            overall: awayTeamStats.formRun_overall || null,           // Form string (e.g. "LWDWW")
            away_only: awayTeamStats.formRun_away || null,           // Away-only form
          } : null,
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
                over15: fsMatch.avg_potential ? Math.min(Math.round(fsMatch.avg_potential * 30), 95) : null,
              },
              form: {
                home: homeTeamStats ? {
                  ppg: homeTeamStats.seasonPPG_overall,
                  btts_pct: homeTeamStats.seasonBTTSPercentage_overall,
                  over25_pct: homeTeamStats.seasonOver25Percentage_overall,
                  overall: homeTeamStats.formRun_overall || null,       // NEW: Form string
                  home_only: homeTeamStats.formRun_home || null,         // NEW: Home form
                } : null,
                away: awayTeamStats ? {
                  ppg: awayTeamStats.seasonPPG_overall,
                  btts_pct: awayTeamStats.seasonBTTSPercentage_overall,
                  over25_pct: awayTeamStats.seasonOver25Percentage_overall,
                  overall: awayTeamStats.formRun_overall || null,        // NEW: Form string
                  away_only: awayTeamStats.formRun_away || null,         // NEW: Away form
                } : null,
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
                total: null,
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

      return response;
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

  logger.info('[Routes] FootyStats routes registered');
}
