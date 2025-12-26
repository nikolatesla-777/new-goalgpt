/**
 * Test Match Enricher
 * 
 * Tests MatchEnricherService functionality
 */

import dotenv from 'dotenv';
import { TheSportsClient } from '../client/thesports-client';
import { TeamDataService } from '../team/teamData.service';
import { TeamLogoService } from '../team/teamLogo.service';
import { CompetitionService } from '../competition/competition.service';
import { MatchEnricherService } from './matchEnricher.service';
import { MatchRecent } from '../../../types/thesports/match';
import { MatchState } from '../../../types/thesports/enums';
import { logger } from '../../../utils/logger';

dotenv.config();

async function testMatchEnricher() {
  try {
    logger.info('Testing Match Enricher Service...');

    const client = new TheSportsClient();
    const teamDataService = new TeamDataService(client);
    const teamLogoService = new TeamLogoService(client);
    const competitionService = new CompetitionService(client);
    const matchEnricher = new MatchEnricherService(teamDataService, teamLogoService, competitionService);

    // Create test matches
    const testMatches: MatchRecent[] = [
      {
        id: 'match1',
        home_team_id: 'test_team_789',
        away_team_id: 'test_team_999',
        match_time: Math.floor(Date.now() / 1000),
        status: MatchState.NOT_STARTED,
      },
    ];

    // Enrich matches
    logger.info('Testing enrichMatches...');
    const enriched = await matchEnricher.enrichMatches(testMatches);

    logger.info(`✅ Enriched ${enriched.length} matches`);
    logger.info(`✅ Home team: ${enriched[0].home_team.name}`);
    logger.info(`✅ Away team: ${enriched[0].away_team.name}`);

    logger.info('✅ All match enricher tests passed!');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Match enricher test failed:', error);
    process.exit(1);
  }
}

testMatchEnricher();

