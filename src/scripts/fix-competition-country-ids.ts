/**
 * Fix Missing country_id in ts_competitions
 * 
 * Maps competitions to their countries using TheSports API data
 */

import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { logger } from '../utils/logger';

async function fixCompetitionCountryIds(): Promise<void> {
  const client = await pool.connect();
  const theSportsClient = new TheSportsClient();

  try {
    logger.info('🔄 Starting competition country_id fix...');

    // Get competitions missing country_id
    const missingResult = await client.query(`
      SELECT external_id, name, category_id 
      FROM ts_competitions 
      WHERE country_id IS NULL
      LIMIT 500
    `);

    logger.info(`Found ${missingResult.rows.length} competitions missing country_id`);

    if (missingResult.rows.length === 0) {
      logger.info('✅ No competitions missing country_id');
      return;
    }

    let updated = 0;
    let errors = 0;

    // Fetch competition details from API and update country_id
    for (const comp of missingResult.rows) {
      try {
        // Try to get country from API using competition/detail endpoint
        const response = await theSportsClient.getCompetitionDetail(comp.external_id);
        
        if (response?.results?.[0]?.country_id) {
          const countryId = response.results[0].country_id;
          
          await client.query(`
            UPDATE ts_competitions 
            SET country_id = $1, updated_at = NOW()
            WHERE external_id = $2
          `, [countryId, comp.external_id]);
          
          updated++;
          
          if (updated % 50 === 0) {
            logger.info(`Progress: ${updated} competitions updated`);
          }
        } else {
          // Try category_id as fallback (some categories are country-specific)
          logger.debug(`No country_id from API for competition ${comp.external_id}`);
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        errors++;
        logger.error(`Error updating competition ${comp.external_id}:`, error.message);
      }
    }

    logger.info(`✅ Fix completed: ${updated} updated, ${errors} errors`);

  } catch (error: any) {
    logger.error('❌ Fix failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Alternative: Update from existing API response data in competitions table
async function fixFromExistingData(): Promise<void> {
  const client = await pool.connect();

  try {
    logger.info('🔄 Fixing country_id from category mapping...');

    // Many competitions can be mapped via category -> country relationship
    // Categories like "England", "Spain", etc. map directly to countries
    const result = await client.query(`
      UPDATE ts_competitions c
      SET country_id = cat.country_id
      FROM ts_categories cat
      WHERE c.category_id = cat.external_id
        AND c.country_id IS NULL
        AND cat.country_id IS NOT NULL
    `);

    logger.info(`✅ Updated ${result.rowCount} competitions from category mapping`);

    // Check remaining
    const remainingResult = await client.query(`
      SELECT COUNT(*) as count FROM ts_competitions WHERE country_id IS NULL
    `);

    logger.info(`Remaining without country_id: ${remainingResult.rows[0].count}`);

  } catch (error: any) {
    logger.error('❌ Fix failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (require.main === module) {
  fixFromExistingData()
    .then(() => {
      logger.info('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
}

export { fixCompetitionCountryIds, fixFromExistingData };

