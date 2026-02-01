// src/scripts/inspect-team-stats-fields.ts
import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  const result = await pool.query(`
    SELECT stats FROM fs_team_season_stats WHERE fs_season_id = 14972 LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('No data found');
    process.exit(1);
  }

  const teamStats = result.rows[0].stats;

  console.log('='.repeat(80));
  console.log('Team Stats Structure Analysis');
  console.log('='.repeat(80));
  console.log('');

  console.log('Root keys:', Object.keys(teamStats));
  console.log('');

  // Check for AI-critical fields at root level
  const rootChecks = [
    'seasonBTTSPercentage_overall',
    'seasonOver25Percentage_overall',
    'seasonPPG_overall',
    'cornersAVG_overall',
    'cardsAVG_overall',
    'xg_for_avg_overall',
    'xg_against_avg_overall',
  ];

  console.log('AI-Critical Field Check (root level):');
  for (const field of rootChecks) {
    const value = teamStats[field];
    if (value !== undefined) {
      console.log(`  ✅ ${field}: ${value}`);
    }
  }

  console.log('');
  console.log('Sample numeric fields (first 20):');
  const numericFields = [];
  for (const [key, value] of Object.entries(teamStats)) {
    if (typeof value === 'number') {
      numericFields.push(`${key}: ${value}`);
      if (numericFields.length >= 20) break;
    }
  }
  numericFields.forEach(f => console.log(`  ${f}`));

  process.exit(0);
}

main();
