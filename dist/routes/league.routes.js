"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = leagueRoutes;
const league_controller_1 = require("../controllers/league.controller");
async function leagueRoutes(fastify) {
    // Get league teams - /api/leagues/:league_id/teams
    fastify.get('/:league_id/teams', league_controller_1.getLeagueTeams);
    // Get league fixtures - /api/leagues/:league_id/fixtures
    fastify.get('/:league_id/fixtures', league_controller_1.getLeagueFixtures);
    // Get league standings - /api/leagues/:league_id/standings
    fastify.get('/:league_id/standings', league_controller_1.getLeagueStandings);
    // Get league by ID - /api/leagues/:league_id (must be after more specific routes)
    fastify.get('/:league_id', league_controller_1.getLeagueById);
}
