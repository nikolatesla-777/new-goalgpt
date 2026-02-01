import { pool } from '../database/connection';

async function main() {
  console.log('🔍 ANALYZING STANDINGS DATA STRUCTURE\n');
  console.log('='.repeat(80));

  // Get Süper Lig standings
  const result = await pool.query(`
    SELECT raw_response
    FROM ts_standings st
    INNER JOIN ts_seasons s ON st.season_id = s.external_id
    WHERE s.competition_id = '8y39mp1h6jmojxg'
      AND s.year LIKE '%2025%'
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('No data found');
    await pool.end();
    process.exit(0);
  }

  const rawResponse = result.rows[0].raw_response;

  console.log('\nFull API Response Structure:');
  console.log(JSON.stringify(rawResponse, null, 2).substring(0, 3000));

  console.log('\n\nFirst Team Data (Galatasaray):');
  if (rawResponse.results?.tables?.[0]?.rows?.[0]) {
    const firstTeam = rawResponse.results.tables[0].rows[0];
    console.log('Available fields:');
    Object.keys(firstTeam).forEach(key => {
      console.log(`  - ${key}: ${firstTeam[key]}`);
    });
  }

  await pool.end();
  process.exit(0);
}

main();
