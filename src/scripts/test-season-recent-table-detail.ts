import dotenv from 'dotenv';
import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('🔍 TEST: /season/recent/table/detail');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test 1: Parametresiz istek
    console.log('TEST 1: Parametresiz istek');
    console.log('-'.repeat(80));
    const test1 = await theSportsAPI.get('/season/recent/table/detail', {});
    console.log('Response keys:', Object.keys(test1));
    console.log('Results type:', typeof test1.results);
    console.log('Results:', JSON.stringify(test1, null, 2).slice(0, 5000));
    console.log('');

    // Test 2: Süper Lig season_id ile
    console.log('TEST 2: Süper Lig season_id ile');
    console.log('-'.repeat(80));
    const superligSeason = await pool.query(`
      SELECT s.external_id as season_id
      FROM ts_seasons s
      INNER JOIN ts_competitions c ON s.competition_id = c.external_id
      WHERE c.external_id = '8y39mp1h6jmojxg'
      ORDER BY s.external_id DESC
      LIMIT 1;
    `);

    if (superligSeason.rows.length > 0) {
      const seasonId = superligSeason.rows[0].season_id;
      console.log('Season ID:', seasonId);

      const test2 = await theSportsAPI.get('/season/recent/table/detail', {
        season_id: seasonId
      });
      console.log('Response:', JSON.stringify(test2, null, 2).slice(0, 5000));
    }
    console.log('');

    // Test 3: competition_id ile
    console.log('TEST 3: competition_id ile');
    console.log('-'.repeat(80));
    const test3 = await theSportsAPI.get('/season/recent/table/detail', {
      competition_id: '8y39mp1h6jmojxg'
    });
    console.log('Response:', JSON.stringify(test3, null, 2).slice(0, 5000));
    console.log('');

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
