"use strict";
/**
 * Test Match Enricher
 *
 * Tests MatchEnricherService functionality
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const teamData_service_1 = require("../team/teamData.service");
const teamLogo_service_1 = require("../team/teamLogo.service");
const competition_service_1 = require("../competition/competition.service");
const matchEnricher_service_1 = require("./matchEnricher.service");
const enums_1 = require("../../../types/thesports/enums");
const logger_1 = require("../../../utils/logger");
dotenv_1.default.config();
async function testMatchEnricher() {
    try {
        logger_1.logger.info('Testing Match Enricher Service...');
        const teamDataService = new teamData_service_1.TeamDataService();
        const teamLogoService = new teamLogo_service_1.TeamLogoService();
        const competitionService = new competition_service_1.CompetitionService();
        const matchEnricher = new matchEnricher_service_1.MatchEnricherService(teamDataService, teamLogoService, competitionService);
        // Create test matches
        const testMatches = [
            {
                id: 'match1',
                home_team_id: 'test_team_789',
                away_team_id: 'test_team_999',
                match_time: Math.floor(Date.now() / 1000),
                status: enums_1.MatchState.NOT_STARTED,
            },
        ];
        // Enrich matches
        logger_1.logger.info('Testing enrichMatches...');
        const enriched = await matchEnricher.enrichMatches(testMatches);
        logger_1.logger.info(`✅ Enriched ${enriched.length} matches`);
        logger_1.logger.info(`✅ Home team: ${enriched[0].home_team.name}`);
        logger_1.logger.info(`✅ Away team: ${enriched[0].away_team.name}`);
        logger_1.logger.info('✅ All match enricher tests passed!');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ Match enricher test failed:', error);
        process.exit(1);
    }
}
testMatchEnricher();
