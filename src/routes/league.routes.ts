import { FastifyInstance } from 'fastify';
import { 
  getLeagueById, 
  getLeagueTeams, 
  getLeagueFixtures,
  getLeagueStandings
} from '../controllers/league.controller';

export default async function leagueRoutes(fastify: FastifyInstance) {
  // Get league teams - /api/leagues/:league_id/teams
  fastify.get('/:league_id/teams', getLeagueTeams);

  // Get league fixtures - /api/leagues/:league_id/fixtures
  fastify.get('/:league_id/fixtures', getLeagueFixtures);

  // Get league standings - /api/leagues/:league_id/standings
  fastify.get('/:league_id/standings', getLeagueStandings);

  // Get league by ID - /api/leagues/:league_id (must be after more specific routes)
  fastify.get('/:league_id', getLeagueById);
}

