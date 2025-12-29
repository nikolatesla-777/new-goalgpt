import { FastifyInstance } from 'fastify';
import { 
  getPlayerById, 
  searchPlayers, 
  getPlayersByTeam 
} from '../controllers/player.controller';

export default async function playerRoutes(fastify: FastifyInstance) {
  // Search players - /api/players/search
  fastify.get('/search', searchPlayers);

  // Get players by team - /api/players/team/:teamId
  fastify.get('/team/:teamId', getPlayersByTeam);

  // Get player by ID - /api/players/:playerId (must be after more specific routes)
  fastify.get('/:playerId', getPlayerById);
}
