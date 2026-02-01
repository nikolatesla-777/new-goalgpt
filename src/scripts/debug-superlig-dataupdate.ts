import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';

async function main() {
  console.log('🔍 DEBUG: Süper Lig in /data/update\n');
  console.log('='.repeat(80));

  // Step 1: Get data/update
  console.log('\nSTEP 1: Fetching /data/update...');
  const dataUpdate = await theSportsAPI.get('/data/update', {});

  // Extract all season updates
  const allSeasonUpdates: any[] = [];
  ['3', '4', '5', '6'].forEach(key => {
    if (dataUpdate.results[key] && Array.isArray(dataUpdate.results[key])) {
      console.log(`Key "${key}": ${dataUpdate.results[key].length} items`);
      allSeasonUpdates.push(...dataUpdate.results[key]);
    }
  });

  const seasonIds = [...new Set(allSeasonUpdates.map((item: any) => item.season_id))];
  console.log(`\nTotal unique season_ids: ${seasonIds.length}`);
  console.log('Season IDs:', seasonIds.slice(0, 20));

  // Step 2: Check if Süper Lig season is in the list
  const superligSeasonId = '4zp5rzgh8xvq82w';
  console.log(`\n\nSTEP 2: Checking for Süper Lig season: ${superligSeasonId}`);

  if (seasonIds.includes(superligSeasonId)) {
    console.log('✅ FOUND in /data/update!');
  } else {
    console.log('❌ NOT FOUND in /data/update');
    console.log('\nThis means Süper Lig has no changes in last 120 seconds');
  }

  // Step 3: Get all Turkish league seasons from database
  console.log(`\n\nSTEP 3: All Turkish league seasons in recent updates:`);
  const turkishSeasons = await pool.query(`
    SELECT s.external_id, s.year, c.name
    FROM ts_seasons s
    INNER JOIN ts_competitions c ON s.competition_id = c.external_id
    WHERE s.external_id = ANY($1::text[])
      AND (c.name LIKE '%Turkish%' OR c.name LIKE '%Turkey%')
  `, [seasonIds]);

  console.log(`Found ${turkishSeasons.rows.length} Turkish league seasons:`);
  turkishSeasons.rows.forEach(row => {
    console.log(`  - ${row.name} (${row.year}) - ${row.external_id}`);
  });

  // Step 4: Try direct fetch for Süper Lig
  console.log(`\n\nSTEP 4: Direct fetch /season/recent/table/detail for Süper Lig...`);
  try {
    const standings = await theSportsAPI.get('/season/recent/table/detail', {
      uuid: superligSeasonId
    });

    if (standings.results && standings.results.tables && standings.results.tables.length > 0) {
      const table = standings.results.tables[0];
      const rows = table.rows || [];
      console.log(`✅ Got ${rows.length} teams`);

      // Find Trabzonspor
      const trabzonspor = rows.find((team: any) => team.team_id === 'kn54qllhy0dqvy9');
      if (trabzonspor) {
        console.log(`\n🏆 Trabzonspor:`);
        console.log(`   Position: ${trabzonspor.position}`);
        console.log(`   Points: ${trabzonspor.points}`);
        console.log(`   Wins: ${trabzonspor.wins}`);
        console.log(`   Draws: ${trabzonspor.draws}`);
        console.log(`   Losses: ${trabzonspor.losses}`);
      }

      // Top 3
      console.log(`\nTop 3:`);
      rows.slice(0, 3).forEach((team: any) => {
        console.log(`   ${team.position}. ${team.team_id} - ${team.points} pts`);
      });
    } else {
      console.log('❌ No tables in response');
      console.log('Response:', JSON.stringify(standings, null, 2).slice(0, 500));
    }
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    console.log('Response code:', err.response?.status);
  }

  await pool.end();
  process.exit(0);
}

main();
