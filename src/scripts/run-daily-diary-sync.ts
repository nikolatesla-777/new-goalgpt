/**
 * Manual trigger script for Daily Diary Sync (3-day window)
 * 
 * Usage:
 *   npx tsx src/scripts/run-daily-diary-sync.ts
 * 
 * This will sync yesterday, today, and tomorrow (TSİ) matches to database.
 */

import dotenv from 'dotenv';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { DailyMatchSyncWorker } from '../jobs/dailyMatchSync.job';
import { logger } from '../utils/logger';

dotenv.config();

async function main() {
  logger.info('🚀 Starting manual Daily Diary Sync (3-day window)...');
  
  try {
    const client = new TheSportsClient();
    const worker = new DailyMatchSyncWorker(client);
    
    await worker.syncThreeDayWindow({ reason: 'MANUAL_SCRIPT' });
    
    logger.info('✅ Manual sync completed successfully');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Manual sync failed:', error);
    process.exit(1);
  }
}

main();




