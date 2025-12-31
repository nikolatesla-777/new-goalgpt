/**
 * Team Routes
 * 
 * Fastify route definitions for team-related endpoints
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  getTeamById,
  getTeamFixtures,
  getTeamStandings,
  searchTeams,
} from '../controllers/team.controller';
import { getPlayersByTeam } from '../controllers/player.controller';

export default async function teamRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  /**
   * GET /api/teams/search
   * Search teams by name
   */
  fastify.get('/search', searchTeams);

  /**
   * GET /api/teams/:team_id/fixtures
   * Get team fixtures (past and upcoming matches)
   */
  fastify.get('/:team_id/fixtures', getTeamFixtures);

  /**
   * GET /api/teams/:team_id/standings
   * Get team's position in standings
   */
  fastify.get('/:team_id/standings', getTeamStandings);

  /**
   * GET /api/teams/:team_id/players
   * Get team squad/players
   */
  fastify.get('/:team_id/players', getPlayersByTeam);

  /**
   * GET /api/teams/:team_id
   * Get team details
   * NOTE: Must be registered LAST as a catch-all route
   */
  fastify.get('/:team_id', getTeamById);
}

