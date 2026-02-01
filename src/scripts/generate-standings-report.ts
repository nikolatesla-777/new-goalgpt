import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('📊 50 LİG PUAN DURUMU RAPORU');
  console.log('='.repeat(80));
  console.log('');

  // 1. Get FootyStats 50 allowlisted competitions
  const allowlistResult = await pool.query(`
    SELECT
      competition_id,
      name,
      country
    FROM fs_competitions_allowlist
    WHERE is_enabled = TRUE
    ORDER BY name;
  `);

  console.log(`✅ FootyStats Allowlist: ${allowlistResult.rows.length} lig`);
  console.log('');

  // 2. Get all recent TheSports standings
  const standingsResult = await pool.query(`
    SELECT
      s.id,
      s.competition_id,
      s.season_id,
      s.standings,
      s.updated_at,
      c.name as competition_name,
      c.external_id as competition_external_id
    FROM ts_standings s
    LEFT JOIN ts_competitions c ON s.competition_id = c.external_id
    WHERE s.updated_at >= NOW() - INTERVAL '7 days'
      AND jsonb_typeof(s.standings) = 'array'
    ORDER BY s.updated_at DESC;
  `);

  console.log(`✅ TheSports Standings: ${standingsResult.rows.length} kayıt`);
  console.log('');

  // 3. Try to match by competition names
  console.log('Eşleştirme Sonuçları:');
  console.log('='.repeat(80));

  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const fsComp of allowlistResult.rows) {
    // Try to find matching TheSports standing
    const tsStanding = standingsResult.rows.find(ts => {
      if (!ts.competition_name) return false;

      const fsName = fsComp.name.toLowerCase().trim();
      const tsName = ts.competition_name.toLowerCase().trim();

      // Fuzzy match
      return tsName.includes(fsName) || fsName.includes(tsName) ||
             (fsName.includes('liga') && tsName.includes('liga')) ||
             (fsName.includes('league') && tsName.includes('league'));
    });

    if (tsStanding && tsStanding.standings.length > 0) {
      matchedCount++;

      console.log(`✅ [${fsComp.competition_id}] ${fsComp.name} (${fsComp.country})`);
      console.log(`   TheSports: ${tsStanding.competition_name}`);
      console.log(`   Teams: ${tsStanding.standings.length}`);

      // Show top 3
      const standings = tsStanding.standings;
      const teamIds = standings.slice(0, 3).map((t: any) => t.team_id);

      const teams = await pool.query(`
        SELECT external_id, name
        FROM ts_teams
        WHERE external_id = ANY($1::text[])
      `, [teamIds]);

      const teamMap: any = {};
      teams.rows.forEach(t => teamMap[t.external_id] = t.name);

      standings.slice(0, 3).forEach((team: any) => {
        const teamName = teamMap[team.team_id] || 'Unknown';
        console.log(`     ${team.position}. ${teamName} - ${team.points} pts`);
      });

      console.log('');
    } else {
      unmatchedCount++;
      console.log(`❌ [${fsComp.competition_id}] ${fsComp.name} (${fsComp.country}) - PUAN DURUMU YOK`);
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('ÖZET:');
  console.log(`  Eşleşen: ${matchedCount}/${allowlistResult.rows.length}`);
  console.log(`  Eşleşmeyen: ${unmatchedCount}`);
  console.log('='.repeat(80));

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
