/**
 * Manual Post-Match Processing
 * 
 * Manually trigger post-match persistence for a specific match
 * Useful for testing and fixing missed matches
 */

import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { PostMatchProcessor } from '../services/liveData/postMatchProcessor';
import { logger } from '../utils/logger';

const matchId = process.argv[2];

if (!matchId) {
  logger.error('Usage: npx tsx src/scripts/manual-post-match-process.ts <match_id>');
  process.exit(1);
}

async function manualPostMatchProcess() {
  try {
    logger.info(`🔄 Manually processing post-match data for: ${matchId}`);

    const client = new TheSportsClient();
    const processor = new PostMatchProcessor(client);

    await processor.onMatchEnded(matchId);

    logger.info(`✅ Post-match processing completed for: ${matchId}`);
  } catch (error: any) {
    logger.error(`❌ Post-match processing failed for ${matchId}:`, error);
    process.exit(1);
  }
}

manualPostMatchProcess().catch(console.error);

