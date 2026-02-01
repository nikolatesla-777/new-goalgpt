import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  try {
    // Get first team_id from fs_matches
    const result = await pool.query(`
      SELECT DISTINCT home_team_fs_id AS team_id
      FROM fs_matches
      WHERE home_team_fs_id IS NOT NULL
      LIMIT 1
    `);

    const teamId = result.rows[0].team_id;
    console.log(`Testing with team_id=${teamId}`);
    console.log('');

    const apiKey = process.env.FOOTYSTATS_API_KEY;
    const url = new URL("https://api.football-data-api.com/team");
    url.searchParams.set("key", apiKey!);
    url.searchParams.set("team_id", String(teamId));
    url.searchParams.set("include", "stats");

    console.log('URL:', url.toString().replace(apiKey!, 'KEY'));
    console.log('');

    const res = await fetch(url.toString());
    console.log('Response status:', res.status, res.statusText);
    console.log('');

    const data = await res.json();
    console.log('Response structure:');
    console.log('  success:', data.success);
    console.log('  data type:', typeof data.data);
    console.log('  data keys:', data.data ? Object.keys(data.data).slice(0, 20) : 'null');
    console.log('');

    if (Array.isArray(data.data)) {
      console.log(`✅ data.data is an array with ${data.data.length} items`);
      console.log('');

      // Show all available seasons
      console.log('Available seasons:');
      data.data.forEach((item: any, idx: number) => {
        console.log(`  ${idx + 1}. Season: ${item.season}, Competition: ${item.competition_id}, ID: ${item.id}`);
      });
      console.log('');

      // Show first item details
      if (data.data[0]) {
        const firstItem = data.data[0];
        console.log('First item details:');
        console.log('  id:', firstItem.id);
        console.log('  name:', firstItem.name);
        console.log('  competition_id:', firstItem.competition_id);
        console.log('  season:', firstItem.season);
        console.log('  stats exists:', !!firstItem.stats);

        if (firstItem.stats) {
          console.log('  stats keys (first 20):', Object.keys(firstItem.stats).slice(0, 20));
          console.log('  seasonMatchesPlayed_overall:', firstItem.stats.seasonMatchesPlayed_overall);
          console.log('  seasonPPG_overall:', firstItem.stats.seasonPPG_overall);
        }
      }
    } else {
      console.log('❌ data.data is not an array');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }

    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
