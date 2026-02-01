// src/scripts/inspect-footystats-response.ts
import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  const result = await pool.query(`
    SELECT stats FROM fs_league_season_stats WHERE fs_season_id = 14972
  `);

  if (result.rows.length === 0) {
    console.log('No data found');
    process.exit(1);
  }

  const stats = result.rows[0].stats;

  console.log('='.repeat(80));
  console.log('FootyStats Response Structure Analysis');
  console.log('='.repeat(80));
  console.log('');

  console.log('Root keys:', Object.keys(stats));
  console.log('');

  if (stats.data) {
    console.log('stats.data keys (first 30):', Object.keys(stats.data).slice(0, 30));
    console.log('');

    // Check for AI-critical fields
    const checks = [
      'seasonBTTSPercentage',
      'seasonBTTSPercentage_overall',
      'btts_percentage',
      'seasonOver25Percentage',
      'seasonOver25Percentage_overall',
      'over25_percentage',
      'cornersAVG_overall',
      'corners_avg_overall',
      'cardsAVG_overall',
      'cards_avg_overall',
      'seasonAVG_overall',
      'season_avg_overall',
    ];

    console.log('AI-Critical Field Check:');
    for (const field of checks) {
      const value = stats.data[field];
      if (value !== undefined) {
        console.log(`  ✅ ${field}: ${value}`);
      }
    }

    console.log('');
    console.log('All numeric/percentage fields in data:');
    for (const [key, value] of Object.entries(stats.data)) {
      if (typeof value === 'number' && (key.includes('AVG') || key.includes('Percentage') || key.includes('avg') || key.includes('percentage'))) {
        console.log(`  ${key}: ${value}`);
      }
    }
  }

  process.exit(0);
}

main();
