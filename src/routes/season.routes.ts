/**
 * Season Routes
 * 
 * Fastify route definitions for season-related endpoints
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getSeasonStandings } from '../controllers/match.controller';

export default async function seasonRoutes(
    fastify: FastifyInstance,
    options: FastifyPluginOptions
) {
    /**
     * GET /api/seasons/:season_id/standings
     * Get season standings (league table)
     */
    fastify.get('/:season_id/standings', getSeasonStandings);
}
