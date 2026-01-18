/**
 * FootyStats Integration Routes
 *
 * Admin endpoints for managing FootyStats integration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mappingService } from '../services/footystats/mapping.service';
import { footyStatsAPI } from '../services/footystats/footystats.client';
import { safeQuery } from '../database/connection';
import { logger } from '../utils/logger';

export async function footyStatsRoutes(fastify: FastifyInstance): Promise<void> {
  // Debug: Test database query
  fastify.get('/footystats/debug-db', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tables = await safeQuery<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 20`
      );

      let competitionsCount = 0;
      let competitionColumns: string[] = [];
      let sampleCompetitions: any[] = [];
      let countryColumns: string[] = [];
      let sampleCountries: any[] = [];
      try {
        const competitions = await safeQuery<{ count: string }>('SELECT COUNT(*) as count FROM ts_competitions');
        competitionsCount = parseInt(competitions[0]?.count || '0');

        const columns = await safeQuery<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_competitions' ORDER BY ordinal_position`
        );
        competitionColumns = columns.map(c => c.column_name);

        const samples = await safeQuery<any>('SELECT * FROM ts_competitions LIMIT 3');
        sampleCompetitions = samples;

        // Check ts_countries structure
        const countryCol = await safeQuery<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_countries' ORDER BY ordinal_position`
        );
        countryColumns = countryCol.map(c => c.column_name);

        const countrySamples = await safeQuery<any>('SELECT * FROM ts_countries LIMIT 3');
        sampleCountries = countrySamples;
      } catch (e) {
        // table may not exist
      }

      // Check ts_teams and ts_matches structure
      let teamColumns: string[] = [];
      let matchColumns: string[] = [];
      let sampleTeams: any[] = [];
      try {
        const teamCol = await safeQuery<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_teams' ORDER BY ordinal_position`
        );
        teamColumns = teamCol.map(c => c.column_name);

        const matchCol = await safeQuery<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_matches' ORDER BY ordinal_position LIMIT 20`
        );
        matchColumns = matchCol.map(c => c.column_name);

        const teamSamples = await safeQuery<any>('SELECT id, name, external_id FROM ts_teams LIMIT 2');
        sampleTeams = teamSamples;
      } catch (e) {}

      return {
        tables: tables.map(t => t.table_name),
        ts_competitions_count: competitionsCount,
        ts_competitions_columns: competitionColumns,
        sample_competitions: sampleCompetitions,
        ts_countries_columns: countryColumns,
        sample_countries: sampleCountries,
        ts_teams_columns: teamColumns,
        ts_matches_columns: matchColumns,
        sample_teams: sampleTeams,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

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

      const leagues = await safeQuery<{ id: string; name: string; country_name: string }>(query, params);
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

  // Test FootyStats API
  fastify.get('/footystats/test', async (request: FastifyRequest<{
    Querystring: { q?: string };
  }>, reply: FastifyReply) => {
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
    const verified = await safeQuery<any>(
      `SELECT ts_id, ts_name, fs_id, fs_name, confidence_score
       FROM integration_mappings
       WHERE entity_type = 'league' AND is_verified = true
       ORDER BY confidence_score DESC
       LIMIT 50`
    );
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
    const results = await safeQuery<any>(
      `SELECT ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified, entity_type
       FROM integration_mappings
       WHERE LOWER(ts_name) LIKE $1 OR LOWER(fs_name) LIKE $1
       ORDER BY confidence_score DESC
       LIMIT 50`,
      [`%${q.toLowerCase()}%`]
    );
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
      const matchResult = await safeQuery<any>(
        `SELECT m.id, m.external_id, m.home_team_id, m.away_team_id,
                m.competition_id, m.match_time, m.status_id,
                m.home_scores, m.away_scores,
                ht.name as home_team_name, ht.logo_url as home_logo,
                at.name as away_team_name, at.logo_url as away_logo,
                c.name as league_name
         FROM ts_matches m
         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
         LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
         WHERE m.external_id = $1`,
        [matchId]
      );

      if (matchResult.length === 0) {
        return reply.status(404).send({ error: 'Match not found' });
      }

      const match = matchResult[0];

      // 2. Get FootyStats team mappings
      const homeTeamMapping = await safeQuery<any>(
        `SELECT fs_id FROM integration_mappings
         WHERE entity_type = 'team' AND ts_name = $1`,
        [match.home_team_name]
      );

      const awayTeamMapping = await safeQuery<any>(
        `SELECT fs_id FROM integration_mappings
         WHERE entity_type = 'team' AND ts_name = $1`,
        [match.away_team_name]
      );

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
        h2h: fsMatchData?.h2h ? {
          total_matches: fsMatchData.h2h.previous_matches_results?.totalMatches || 0,
          home_wins: fsMatchData.h2h.previous_matches_results?.team_a_wins || 0,
          draws: fsMatchData.h2h.previous_matches_results?.draw || 0,
          away_wins: fsMatchData.h2h.previous_matches_results?.team_b_wins || 0,
          btts_percentage: fsMatchData.h2h.betting_stats?.bttsPercentage || null,
          avg_goals: fsMatchData.h2h.betting_stats?.avg_goals || null,
        } : null,
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

      // Return matches with potentials
      const matches = response.data.map((m: any) => ({
        fs_id: m.id,
        home_name: m.home_name,
        away_name: m.away_name,
        league_name: m.competition_name || m.league_name || null,
        country: m.country || null,
        date_unix: m.date_unix,
        status: m.status,
        score: m.homeGoalCount != null ? `${m.homeGoalCount}-${m.awayGoalCount}` : null,
        potentials: {
          btts: m.btts_potential,
          over25: m.o25_potential,
          avg: m.avg_potential,
        },
        xg: {
          home: m.team_a_xg_prematch,
          away: m.team_b_xg_prematch,
        },
        odds: {
          home: m.odds_ft_1,
          draw: m.odds_ft_x,
          away: m.odds_ft_2,
        }
      }));

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

      // 2. Try to get team form data (stats are inside .stats object)
      let homeTeamStats: any = null;
      let awayTeamStats: any = null;

      try {
        if (fsMatch.homeID) {
          const homeResponse = await footyStatsAPI.getTeamLastX(fsMatch.homeID);
          // Get last 5 matches data (first entry)
          const homeData = homeResponse.data?.find((d: any) => d.last_x_match_num === 5) || homeResponse.data?.[0];
          homeTeamStats = homeData?.stats;
          logger.info(`[FootyStats] Got home team stats for ${fsMatch.homeID}: PPG=${homeTeamStats?.seasonPPG_overall || 'no data'}`);
        }
        if (fsMatch.awayID) {
          const awayResponse = await footyStatsAPI.getTeamLastX(fsMatch.awayID);
          const awayData = awayResponse.data?.find((d: any) => d.last_x_match_num === 5) || awayResponse.data?.[0];
          awayTeamStats = awayData?.stats;
          logger.info(`[FootyStats] Got away team stats for ${fsMatch.awayID}: PPG=${awayTeamStats?.seasonPPG_overall || 'no data'}`);
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
            overall: homeTeamStats.formRun_overall || null,
            home_only: homeTeamStats.formRun_home || null,
            ppg: homeTeamStats.seasonPPG_overall || null,
            btts_pct: homeTeamStats.seasonBTTSPercentage_overall || null,
            over25_pct: homeTeamStats.seasonOver25Percentage_overall || null,
          } : null,
          away: awayTeamStats ? {
            overall: awayTeamStats.formRun_overall || null,
            away_only: awayTeamStats.formRun_away || null,
            ppg: awayTeamStats.seasonPPG_overall || null,
            btts_pct: awayTeamStats.seasonBTTSPercentage_overall || null,
            over25_pct: awayTeamStats.seasonOver25Percentage_overall || null,
          } : null,
        },
        h2h: fsMatch.h2h ? {
          total_matches: fsMatch.h2h.previous_matches_results?.totalMatches || 0,
          home_wins: fsMatch.h2h.previous_matches_results?.team_a_wins || 0,
          draws: fsMatch.h2h.previous_matches_results?.draw || 0,
          away_wins: fsMatch.h2h.previous_matches_results?.team_b_wins || 0,
          btts_pct: fsMatch.h2h.betting_stats?.bttsPercentage || null,
          avg_goals: fsMatch.h2h.betting_stats?.avg_goals || null,
        } : null,
        trends: {
          home: (fsMatch.trends?.home || []).map((t: any) => ({
            sentiment: Array.isArray(t) ? t[0] : (t.sentiment || 'neutral'),
            text: Array.isArray(t) ? t[1] : (t.text || String(t)),
          })),
          away: (fsMatch.trends?.away || []).map((t: any) => ({
            sentiment: Array.isArray(t) ? t[0] : (t.sentiment || 'neutral'),
            text: Array.isArray(t) ? t[1] : (t.text || String(t)),
          })),
        },
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

  // Debug: Test raw FootyStats API responses
  fastify.get('/footystats/debug-api/:fsId', async (request: FastifyRequest<{
    Params: { fsId: string };
  }>, reply: FastifyReply) => {
    try {
      const { fsId } = request.params;
      const fsIdNum = parseInt(fsId);

      const results: any = {
        match_details: null,
        match_details_error: null,
        home_team_form: null,
        home_team_error: null,
        away_team_form: null,
        away_team_error: null,
      };

      // 1. Test getMatchDetails
      try {
        const matchResponse = await footyStatsAPI.getMatchDetails(fsIdNum);
        results.match_details = matchResponse;
      } catch (err: any) {
        results.match_details_error = err.message;
      }

      // 2. Get basic match info first
      const todaysMatches = await footyStatsAPI.getTodaysMatches();
      const basicMatch = todaysMatches.data?.find((m: any) => m.id === fsIdNum);
      results.basic_match = basicMatch ? {
        id: basicMatch.id,
        homeID: basicMatch.homeID,
        awayID: basicMatch.awayID,
        home_name: basicMatch.home_name,
        away_name: basicMatch.away_name,
      } : null;

      // 3. Test getTeamLastX for home team
      if (basicMatch?.homeID) {
        try {
          const homeResponse = await footyStatsAPI.getTeamLastX(basicMatch.homeID);
          results.home_team_form = homeResponse;
        } catch (err: any) {
          results.home_team_error = err.message;
        }
      }

      // 4. Test getTeamLastX for away team
      if (basicMatch?.awayID) {
        try {
          const awayResponse = await footyStatsAPI.getTeamLastX(basicMatch.awayID);
          results.away_team_form = awayResponse;
        } catch (err: any) {
          results.away_team_error = err.message;
        }
      }

      return results;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Clear all mappings (for re-run)
  fastify.delete('/footystats/mapping/clear', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await safeQuery('DELETE FROM integration_mappings');
      return { success: true, message: 'All mappings cleared' };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // Create migration tables
  fastify.post('/footystats/migrate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Run migrations
      const migrations = [
        // integration_mappings
        `CREATE TABLE IF NOT EXISTS integration_mappings (
          id SERIAL PRIMARY KEY,
          entity_type VARCHAR(50) NOT NULL,
          ts_id VARCHAR(100) NOT NULL,
          ts_name VARCHAR(255),
          fs_id INTEGER NOT NULL,
          fs_name VARCHAR(255),
          confidence_score DECIMAL(5,2),
          is_verified BOOLEAN DEFAULT FALSE,
          verified_by VARCHAR(100),
          verified_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(entity_type, ts_id),
          UNIQUE(entity_type, fs_id)
        )`,
        // fs_match_stats
        `CREATE TABLE IF NOT EXISTS fs_match_stats (
          id SERIAL PRIMARY KEY,
          match_id VARCHAR(100) NOT NULL UNIQUE,
          fs_match_id INTEGER,
          btts_potential INTEGER,
          o25_potential INTEGER,
          avg_potential DECIMAL(4,2),
          corners_potential DECIMAL(5,2),
          cards_potential DECIMAL(5,2),
          xg_home_prematch DECIMAL(4,2),
          xg_away_prematch DECIMAL(4,2),
          trends JSONB,
          h2h_data JSONB,
          odds_comparison JSONB,
          risk_level VARCHAR(20),
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        // fs_team_form
        `CREATE TABLE IF NOT EXISTS fs_team_form (
          id SERIAL PRIMARY KEY,
          team_id VARCHAR(100) NOT NULL,
          fs_team_id INTEGER,
          season_id VARCHAR(50),
          form_string_overall VARCHAR(20),
          form_string_home VARCHAR(20),
          form_string_away VARCHAR(20),
          ppg_overall DECIMAL(4,2),
          ppg_home DECIMAL(4,2),
          ppg_away DECIMAL(4,2),
          xg_for_avg DECIMAL(4,2),
          xg_against_avg DECIMAL(4,2),
          btts_percentage INTEGER,
          over25_percentage INTEGER,
          clean_sheet_percentage INTEGER,
          failed_to_score_percentage INTEGER,
          corners_avg DECIMAL(4,2),
          cards_avg DECIMAL(4,2),
          goal_timing JSONB,
          last_x_matches INTEGER DEFAULT 5,
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(team_id, season_id, last_x_matches)
        )`,
      ];

      for (const sql of migrations) {
        await safeQuery(sql);
      }

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
