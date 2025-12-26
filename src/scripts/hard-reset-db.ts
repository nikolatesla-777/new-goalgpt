/**
 * Hard Reset Database Script
 * Truncates core tables for clean slate testing
 */

import { pool } from '../../src/database/connection';
import { logger } from '../utils/logger';

async function hardReset() {
  const client = await pool.connect();
  try {
    logger.info('🗑️ Starting hard reset...');
    
    await client.query('BEGIN');
    
    // Truncate tables
    await client.query('TRUNCATE TABLE ts_matches CASCADE');
    logger.info('✅ Truncated ts_matches');
    
    await client.query('TRUNCATE TABLE ts_competitions CASCADE');
    logger.info('✅ Truncated ts_competitions');
    
    await client.query('TRUNCATE TABLE ts_stages CASCADE');
    logger.info('✅ Truncated ts_stages');
    
    // Reset sync state
    await client.query("DELETE FROM ts_sync_state WHERE entity_type = 'match'");
    logger.info('✅ Reset match sync state');
    
    await client.query('COMMIT');
    logger.info('✅ Hard reset completed successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Hard reset failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  hardReset()
    .then(() => {
      logger.info('✅ Hard reset script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Hard reset script failed:', error);
      process.exit(1);
    });
}

export { hardReset };









