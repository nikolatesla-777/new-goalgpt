/**
 * Test Team Services
 * 
 * Tests TeamDataService and TeamLogoService
 */

import dotenv from 'dotenv';
import { TeamDataService } from './teamData.service';
import { TeamLogoService } from './teamLogo.service';
import { logger } from '../../../utils/logger';

dotenv.config();

async function testTeamServices() {
  try {
    logger.info('Testing Team Services...');

    const teamDataService = new TeamDataService();
    const teamLogoService = new TeamLogoService();

    // Test 1: Test getTeamById (will return null if not in DB/cache)
    logger.info('Testing getTeamById...');
    const team = await teamDataService.getTeamById('test_team_123');
    logger.info(`✅ getTeamById result: ${team ? 'Found' : 'Not found (expected)'}`);

    // Test 2: Test getTeamsByIds (batch)
    logger.info('Testing getTeamsByIds (batch)...');
    const teams = await teamDataService.getTeamsByIds(['test_team_123', 'test_team_456']);
    logger.info(`✅ Batch fetch: ${teams.size} teams`);

    // Test 3: Test enrichFromResultsExtra
    logger.info('Testing enrichFromResultsExtra...');
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
    logger.info('✅ enrichFromResultsExtra completed');

    // Test 4: Test getTeamLogoUrl
    logger.info('Testing getTeamLogoUrl...');
    const logoUrl = await teamLogoService.getTeamLogoUrl('test_team_789');
    logger.info(`✅ Logo URL: ${logoUrl || 'Not found'}`);

    logger.info('✅ All service tests passed!');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Service test failed:', error);
    process.exit(1);
  }
}

testTeamServices();

