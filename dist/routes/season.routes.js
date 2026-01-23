"use strict";
/**
 * Season Routes
 *
 * Fastify route definitions for season-related endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = seasonRoutes;
const match_controller_1 = require("../controllers/match.controller");
async function seasonRoutes(fastify, options) {
    /**
     * GET /api/seasons/:season_id/standings
     * Get season standings (league table)
     */
    fastify.get('/:season_id/standings', match_controller_1.getSeasonStandings);
}
