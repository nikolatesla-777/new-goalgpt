/**
 * Batch Process Ended Matches
 * 
 * Processes all ended matches from today that are missing data.
 * This ensures users see complete data when viewing finished match details.
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { PostMatchProcessor } from '../services/liveData/postMatchProcessor';

async function batchProcessEndedMatches() {
  const client = await pool.connect();
  try {
    logger.info('🔄 Starting batch processing of ended matches...\n');

    // Find all ended matches from today that are missing data
    const result = await client.query(`
      SELECT 
        external_id as match_id,
        external_id,
        season_id,
        home_team_id,
        away_team_id,
        home_score_display as home_score,
        away_score_display as away_score,
        match_time,
        status_id
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
        AND (
          statistics IS NULL 
          OR incidents IS NULL 
          OR trend_data IS NULL 
          OR player_stats IS NULL
        )
      ORDER BY match_time DESC
    `);

    // Ensure match_id is set correctly (use external_id if match_id is null/undefined)
    const matches = result.rows.map(match => ({
      ...match,
      match_id: match.match_id || match.external_id
    }));


    if (matches.length === 0) {
      logger.info('✅ No matches need processing');
      return;
    }

    const theSportsClient = new TheSportsClient();
    const processor = new PostMatchProcessor(theSportsClient);

    let success = 0;
    let failed = 0;
    const errors: Array<{ match_id: string; error: string }> = [];

    logger.info(`🚀 Processing ${matches.length} matches...\n`);

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const progress = `[${i + 1}/${matches.length}]`;
      
      try {
        logger.info(`${progress} Processing: ${match.match_id} (${new Date(match.match_time * 1000).toISOString()})`);
        
        const processResult = await processor.processMatchEnd(match);
        
        if (processResult.success) {
          success++;
          logger.info(`${progress} ✅ Success: ${match.match_id} (stats=${processResult.stats_saved}, incidents=${processResult.incidents_saved}, trend=${processResult.trend_saved}, players=${processResult.player_stats_saved})`);
        } else {
          failed++;
          errors.push({ match_id: match.match_id, error: processResult.error || 'Unknown error' });
          logger.warn(`${progress} ⚠️ Partial success: ${match.match_id} - ${processResult.error || 'Some data missing'}`);
        }

        // Small delay between processing to avoid rate limiting
        if (i < matches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

      } catch (error: any) {
        failed++;
        errors.push({ match_id: match.match_id, error: error.message });
        logger.error(`${progress} ❌ Failed: ${match.match_id} - ${error.message}`);
      }
    }

    logger.info(`\n=== SUMMARY ===`);
    logger.info(`Total matches: ${matches.length}`);
    logger.info(`✅ Success: ${success}`);
    logger.info(`❌ Failed: ${failed}`);
    
    if (errors.length > 0) {
      logger.warn(`\n⚠️ Failed matches (${errors.length}):`);
      errors.slice(0, 10).forEach(err => {
        logger.warn(`  - ${err.match_id}: ${err.error}`);
      });
      if (errors.length > 10) {
        logger.warn(`  ... and ${errors.length - 10} more`);
      }
    }

    logger.info(`\n✅ Batch processing completed!`);

  } catch (error: any) {
    logger.error('Batch processing failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

batchProcessEndedMatches().catch(console.error);

