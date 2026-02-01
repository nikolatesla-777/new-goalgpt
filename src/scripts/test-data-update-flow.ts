import dotenv from 'dotenv';
import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('🔍 TEST: Data Update → Season Recent Table Detail Flow');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Get data updates (changed season_ids in last 120 seconds)
    console.log('STEP 1: Fetching /data/update...');
    console.log('-'.repeat(80));
    const dataUpdate = await theSportsAPI.get('/data/update', {});

    console.log('Response keys:', Object.keys(dataUpdate));
    console.log('Full response:');
    console.log(JSON.stringify(dataUpdate, null, 2).slice(0, 10000));
    console.log('');

    // Check if there are updated season_ids
    if (dataUpdate.results && dataUpdate.results.season_ids) {
      const seasonIds = dataUpdate.results.season_ids;
      console.log(`✅ Found ${seasonIds.length} updated season_ids`);
      console.log('Season IDs:', seasonIds.slice(0, 10));
      console.log('');

      if (seasonIds.length > 0) {
        // Step 2: Get standings for first updated season
        console.log('STEP 2: Fetching standings for first season_id...');
        console.log('-'.repeat(80));
        const firstSeasonId = seasonIds[0];
        console.log('Season ID:', firstSeasonId);

        const standings = await theSportsAPI.get('/season/recent/table/detail', {
          season_id: firstSeasonId
        });

        console.log('Standings response:');
        console.log(JSON.stringify(standings, null, 2).slice(0, 5000));
        console.log('');
      }
    } else {
      console.log('ℹ️  No updated season_ids in last 120 seconds');
      console.log('');

      // Try to find Süper Lig season and request it directly
      console.log('STEP 2 (Alternative): Trying Süper Lig season directly...');
      console.log('-'.repeat(80));

      const superligSeason = await pool.query(`
        SELECT s.external_id as season_id, c.name
        FROM ts_seasons s
        INNER JOIN ts_competitions c ON s.competition_id = c.external_id
        WHERE c.external_id = '8y39mp1h6jmojxg'
        ORDER BY s.external_id DESC
        LIMIT 1;
      `);

      if (superligSeason.rows.length > 0) {
        const seasonId = superligSeason.rows[0].season_id;
        console.log('Süper Lig Season ID:', seasonId);
        console.log('Competition:', superligSeason.rows[0].name);
        console.log('');

        // Note: This might not work if season isn't in "recent updates"
        console.log('Attempting /season/recent/table/detail for Süper Lig...');
        const standings = await theSportsAPI.get('/season/recent/table/detail', {
          season_id: seasonId
        });

        console.log('Response:');
        console.log(JSON.stringify(standings, null, 2));
      }
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
  }

  await pool.end();
  process.exit(0);
}

main();
