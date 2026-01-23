"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = playerRoutes;
const player_controller_1 = require("../controllers/player.controller");
async function playerRoutes(fastify) {
    // Search players - /api/players/search
    fastify.get('/search', player_controller_1.searchPlayers);
    // Get players by team - /api/players/team/:teamId
    fastify.get('/team/:teamId', player_controller_1.getPlayersByTeam);
    // Get player by ID - /api/players/:playerId (must be after more specific routes)
    fastify.get('/:playerId', player_controller_1.getPlayerById);
}
