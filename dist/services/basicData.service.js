"use strict";
/**
 * Basic Data Service
 *
 * Master service for syncing all "Basic Info" entities from TheSports API
 * This service will coordinate syncing of:
 * 1. Category (Country/Region)
 * 2. Competition (Leagues)
 * 3. Team (Clubs)
 * 4. Player (Squads)
 * 5. Coach (Managers)
 * 6. Referee (Officials)
 * 7. Venue (Stadiums)
 * 8. Season (Years/Dates)
 * 9. Stage (Tournament Phases)
 *
 * Each entity will have its own sync method that:
 * - Fetches data from TheSports API
 * - Transforms to our database schema
 * - Upserts into PostgreSQL
 * - Handles rate limiting and errors
 *
 * STATUS: Architecture skeleton - waiting for API documentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicDataService = void 0;
class BasicDataService {
    constructor() {
        // Will be initialized with TheSportsClient and repositories
    }
}
exports.BasicDataService = BasicDataService;
