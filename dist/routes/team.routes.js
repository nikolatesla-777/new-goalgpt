"use strict";
/**
 * Team Routes
 *
 * Fastify route definitions for team-related endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = teamRoutes;
const team_controller_1 = require("../controllers/team.controller");
const player_controller_1 = require("../controllers/player.controller");
async function teamRoutes(fastify, options) {
    /**
     * GET /api/teams/search
     * Search teams by name
     */
    fastify.get('/search', team_controller_1.searchTeams);
    /**
     * GET /api/teams/:team_id/fixtures
     * Get team fixtures (past and upcoming matches)
     */
    fastify.get('/:team_id/fixtures', team_controller_1.getTeamFixtures);
    /**
     * GET /api/teams/:team_id/standings
     * Get team's position in standings
     */
    fastify.get('/:team_id/standings', team_controller_1.getTeamStandings);
    /**
     * GET /api/teams/:team_id/players
     * Get team squad/players
     */
    fastify.get('/:team_id/players', player_controller_1.getPlayersByTeam);
    /**
     * GET /api/teams/:team_id
     * Get team details
     * NOTE: Must be registered LAST as a catch-all route
     */
    fastify.get('/:team_id', team_controller_1.getTeamById);
}
