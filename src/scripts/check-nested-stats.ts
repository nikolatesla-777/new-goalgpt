// src/scripts/check-nested-stats.ts
import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  const result = await pool.query(`
    SELECT stats FROM fs_team_season_stats WHERE fs_season_id = 14972 LIMIT 1
  `);

  const teamData = result.rows[0].stats;

  console.log('Checking nested stats object:');
  if (teamData.stats) {
    console.log('✅ teamData.stats exists');
    console.log('Keys:', Object.keys(teamData.stats).slice(0, 30));
    console.log('');

    const statsObj = teamData.stats;
    const checks = [
      'seasonBTTSPercentage_overall',
      'seasonOver25Percentage_overall',
      'seasonPPG_overall',
      'cornersAVG_overall',
      'cardsAVG_overall',
      'xg_for_avg_overall',
      'xg_against_avg_overall',
    ];

    console.log('AI-Critical fields in teamData.stats:');
    for (const field of checks) {
      const value = statsObj[field];
      if (value !== undefined) {
        console.log(`  ✅ ${field}: ${value}`);
      }
    }
  } else {
    console.log('❌ teamData.stats not found');
  }

  process.exit(0);
}

main();
