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
    console.log(`Testing LastX API with team_id=${teamId}`);
    console.log('');

    const apiKey = process.env.FOOTYSTATS_API_KEY;
    const url = new URL("https://api.football-data-api.com/lastx");
    url.searchParams.set("key", apiKey!);
    url.searchParams.set("team_id", String(teamId));

    console.log('URL:', url.toString().replace(apiKey!, 'KEY'));
    console.log('');

    const res = await fetch(url.toString());
    console.log('Response status:', res.status, res.statusText);
    console.log('');

    const data = await res.json();
    console.log('Response structure:');
    console.log('  success:', data.success);
    console.log('  data type:', Array.isArray(data.data) ? 'array' : typeof data.data);
    console.log('  data length:', Array.isArray(data.data) ? data.data.length : 'N/A');
    console.log('');

    if (Array.isArray(data.data) && data.data.length > 0) {
      console.log(`✅ data.data is an array with ${data.data.length} items`);
      console.log('');

      // Show all items
      console.log('All items:');
      data.data.forEach((item: any, idx: number) => {
        console.log(`  ${idx + 1}. Window: ${item.last_x_home_away_or_overall}, ID: ${item.id}, Competition: ${item.competition_id}, Season: ${item.season}`);
      });
      console.log('');

      // Show first item details
      if (data.data[0]) {
        const firstItem = data.data[0];
        console.log('First item (full structure):');
        console.log('  id:', firstItem.id);
        console.log('  name:', firstItem.name);
        console.log('  competition_id:', firstItem.competition_id);
        console.log('  season:', firstItem.season);
        console.log('  last_x_home_away_or_overall:', firstItem.last_x_home_away_or_overall);
        console.log('  table_position:', firstItem.table_position);
        console.log('  stats exists:', !!firstItem.stats);
        console.log('');

        if (firstItem.stats) {
          const statsKeys = Object.keys(firstItem.stats);
          console.log('  stats keys (first 30):', statsKeys.slice(0, 30));
          console.log('  total stats keys:', statsKeys.length);
          console.log('');

          // Look for recorded_matches indicators
          console.log('  Key fields for Last X detection:');
          const lastXFields = statsKeys.filter(k => k.toLowerCase().includes('last'));
          console.log('    Fields with "last":', lastXFields.slice(0, 10));
          console.log('');

          // Check specific fields
          console.log('  Sample values:');
          console.log('    last5MatchesPlayed:', firstItem.stats.last5MatchesPlayed);
          console.log('    last6MatchesPlayed:', firstItem.stats.last6MatchesPlayed);
          console.log('    last10MatchesPlayed:', firstItem.stats.last10MatchesPlayed);
          console.log('    last5PPG_overall:', firstItem.stats.last5PPG_overall);
          console.log('    last5BTTSPercentage_overall:', firstItem.stats.last5BTTSPercentage_overall);
          console.log('    last5Over25Percentage_overall:', firstItem.stats.last5Over25Percentage_overall);
        }
      }

      console.log('');
      console.log('Full response (first item):');
      console.log(JSON.stringify(data.data[0], null, 2));
    } else {
      console.log('❌ data.data is not an array or empty');
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
