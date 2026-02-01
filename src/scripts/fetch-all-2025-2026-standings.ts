import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';

async function main() {
  console.log('🔄 FETCH ALL 2025-2026 SEASON STANDINGS\n');
  console.log('='.repeat(80));

  // Get all 2025-2026 seasons from database
  console.log('\nGetting all 2025-2026 seasons from ts_seasons...');
  const seasons = await pool.query(`
    SELECT
      s.external_id as season_id,
      s.year,
      c.external_id as comp_id,
      c.name as comp_name
    FROM ts_seasons s
    INNER JOIN ts_competitions c ON s.competition_id = c.external_id
    WHERE (s.year IN ('2025', '2026', '2025-2026') OR s.year LIKE '%2025%' OR s.year LIKE '%2026%')
      AND s.has_table = true
    ORDER BY c.name, s.year DESC
  `);

  console.log(`Found ${seasons.rows.length} seasons with table data\n`);

  let successCount = 0;
  let failedCount = 0;
  let emptyCount = 0;

  console.log('Fetching standings...\n');
  console.log('-'.repeat(80));

  for (const season of seasons.rows) {
    try {
      process.stdout.write(`${season.comp_name.substring(0, 40).padEnd(40)} `);

      const standings = await theSportsAPI.get('/season/recent/table/detail', {
        uuid: season.season_id
      });

      if (standings.results && standings.results.tables && standings.results.tables.length > 0) {
        const table = standings.results.tables[0];
        const rows = table.rows || [];

        if (rows.length > 0) {
          // Save to database
          await pool.query(`
            INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (season_id)
            DO UPDATE SET
              standings = EXCLUDED.standings,
              raw_response = EXCLUDED.raw_response,
              updated_at = NOW()
          `, [season.season_id, JSON.stringify(rows), JSON.stringify(standings)]);

          console.log(`✅ ${rows.length} teams`);
          successCount++;
        } else {
          console.log(`⚠️  Empty`);
          emptyCount++;
        }
      } else {
        console.log(`❌ No data`);
        failedCount++;
      }

      // Rate limit (120 requests/min = 1 every 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err: any) {
      console.log(`❌ Error: ${err.message.substring(0, 30)}`);
      failedCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log(`  Total Seasons: ${seasons.rows.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Empty: ${emptyCount}`);
  console.log(`  Failed: ${failedCount}`);

  // Verify key leagues
  console.log('\n' + '='.repeat(80));
  console.log('KEY LEAGUES VERIFICATION:\n');

  const keyLeagues = [
    { name: 'Turkish Super League', comp_id: '8y39mp1h6jmojxg' },
    { name: 'English Premier League', comp_id: null }, // Will find by name
    { name: 'Spanish La Liga', comp_id: null },
    { name: 'German Bundesliga', comp_id: null },
    { name: 'Italian Serie A', comp_id: null }
  ];

  for (const league of keyLeagues) {
    let query;
    if (league.comp_id) {
      query = await pool.query(`
        SELECT st.standings, st.updated_at, c.name as comp_name
        FROM ts_standings st
        INNER JOIN ts_seasons s ON st.season_id = s.external_id
        INNER JOIN ts_competitions c ON s.competition_id = c.external_id
        WHERE c.external_id = $1
          AND (s.year LIKE '%2025%' OR s.year LIKE '%2026%')
        ORDER BY st.updated_at DESC
        LIMIT 1
      `, [league.comp_id]);
    } else {
      query = await pool.query(`
        SELECT st.standings, st.updated_at, c.name as comp_name
        FROM ts_standings st
        INNER JOIN ts_seasons s ON st.season_id = s.external_id
        INNER JOIN ts_competitions c ON s.competition_id = c.external_id
        WHERE c.name ILIKE $1
          AND (s.year LIKE '%2025%' OR s.year LIKE '%2026%')
        ORDER BY st.updated_at DESC
        LIMIT 1
      `, [`%${league.name}%`]);
    }

    if (query.rows.length > 0) {
      const row = query.rows[0];
      const teams = row.standings.length;
      const lastUpdated = new Date(row.updated_at);
      const minutesAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);

      console.log(`✅ ${row.comp_name}`);
      console.log(`   ${teams} teams, updated ${minutesAgo} min ago`);

      // Show top 3
      row.standings.slice(0, 3).forEach((team: any, idx: number) => {
        console.log(`   ${idx + 1}. ${team.team_id.substring(0, 15)} - ${team.points} pts`);
      });
      console.log('');
    } else {
      console.log(`❌ ${league.name} - NOT FOUND\n`);
    }
  }

  console.log('='.repeat(80));

  await pool.end();
  process.exit(0);
}

main();
