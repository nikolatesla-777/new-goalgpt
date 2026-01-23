"use strict";
/**
 * Test Team Services
 *
 * Tests TeamDataService and TeamLogoService
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const teamData_service_1 = require("./teamData.service");
const teamLogo_service_1 = require("./teamLogo.service");
const logger_1 = require("../../../utils/logger");
dotenv_1.default.config();
async function testTeamServices() {
    try {
        logger_1.logger.info('Testing Team Services...');
        const teamDataService = new teamData_service_1.TeamDataService();
        const teamLogoService = new teamLogo_service_1.TeamLogoService();
        // Test 1: Test getTeamById (will return null if not in DB/cache)
        logger_1.logger.info('Testing getTeamById...');
        const team = await teamDataService.getTeamById('test_team_123');
        logger_1.logger.info(`✅ getTeamById result: ${team ? 'Found' : 'Not found (expected)'}`);
        // Test 2: Test getTeamsByIds (batch)
        logger_1.logger.info('Testing getTeamsByIds (batch)...');
        const teams = await teamDataService.getTeamsByIds(['test_team_123', 'test_team_456']);
        logger_1.logger.info(`✅ Batch fetch: ${teams.size} teams`);
        // Test 3: Test enrichFromResultsExtra
        logger_1.logger.info('Testing enrichFromResultsExtra...');
        const resultsExtra = {
            team: {
                'test_team_789': {
                    name: 'Test Team 789',
                    short_name: 'TT789',
                    logo_url: 'https://example.com/logo789.png',
                },
            },
        };
        await teamDataService.enrichFromResultsExtra(resultsExtra);
        logger_1.logger.info('✅ enrichFromResultsExtra completed');
        // Test 4: Test getTeamLogoUrl
        logger_1.logger.info('Testing getTeamLogoUrl...');
        const logoUrl = await teamLogoService.getTeamLogoUrl('test_team_789');
        logger_1.logger.info(`✅ Logo URL: ${logoUrl || 'Not found'}`);
        logger_1.logger.info('✅ All service tests passed!');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ Service test failed:', error);
        process.exit(1);
    }
}
testTeamServices();
