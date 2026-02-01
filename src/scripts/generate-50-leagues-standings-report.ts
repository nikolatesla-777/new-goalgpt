import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('📊 50 LİG PUAN DURUMU RAPORU');
  console.log('='.repeat(100));
  console.log('');

  try {
    // 1. Get FootyStats 50 allowlisted competitions
    const allowlistResult = await pool.query(`
      SELECT competition_id, name, country
      FROM fs_competitions_allowlist
      WHERE is_enabled = TRUE
      ORDER BY name;
    `);

    console.log(`📋 FootyStats Allowlist: ${allowlistResult.rows.length} lig`);
    console.log('');

    // 2. Get all TheSports competitions with their latest standings
    const tsCompetitionsWithStandings = await pool.query(`
      SELECT
        c.external_id as comp_id,
        c.name as comp_name,
        s.season_id,
        s.standings,
        s.updated_at
      FROM ts_competitions c
      INNER JOIN ts_seasons seas ON seas.competition_id = c.external_id
      INNER JOIN ts_standings s ON s.season_id = seas.external_id
      WHERE jsonb_typeof(s.standings) = 'array'
      ORDER BY c.name, s.updated_at DESC;
    `);

    console.log(`✅ TheSports Competitions with Standings: ${tsCompetitionsWithStandings.rows.length} kayıt`);
    console.log('');

    // 3. Match FootyStats competitions with TheSports standings
    console.log('🔗 EŞLEŞTİRME SONUÇLARI:');
    console.log('='.repeat(100));
    console.log('');

    let matchedCount = 0;
    let unmatchedCount = 0;
    const matchedLeagues: any[] = [];

    for (const fsComp of allowlistResult.rows) {
      // Try fuzzy matching by name
      const tsComp = tsCompetitionsWithStandings.rows.find((ts: any) => {
        if (!ts.comp_name) return false;

        const fsName = fsComp.name.toLowerCase().trim();
        const tsName = ts.comp_name.toLowerCase().trim();

        // Exact match
        if (tsName === fsName) return true;

        // Contains match
        if (tsName.includes(fsName) || fsName.includes(tsName)) return true;

        // Special cases
        if (fsName.includes('super') && fsName.includes('lig') && tsName.includes('super') && tsName.includes('turkish')) return true;
        if (fsName.includes('liga') && tsName.includes('liga')) return true;
        if (fsName.includes('league') && tsName.includes('league') && (fsName.includes('premier') === tsName.includes('premier'))) return true;
        if (fsName.includes('bundesliga') && tsName.includes('bundesliga')) return true;
        if (fsName.includes('serie') && tsName.includes('serie')) return true;
        if (fsName.includes('ligue') && tsName.includes('ligue')) return true;

        return false;
      });

      if (tsComp && Array.isArray(tsComp.standings) && tsComp.standings.length > 0) {
        matchedCount++;

        // Calculate how old the data is
        const updatedAt = new Date(tsComp.updated_at);
        const now = new Date();
        const diffMs = now.getTime() - updatedAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        const ageStr = diffDays > 0 ? `${diffDays} gün ${diffHours} saat önce` : `${diffHours} saat önce`;
        const freshness = diffDays === 0 ? '🟢' : diffDays <= 2 ? '🟡' : '🔴';

        console.log(`✅ ${freshness} [FS:${fsComp.competition_id}] ${fsComp.name} (${fsComp.country})`);
        console.log(`   TheSports: ${tsComp.comp_name}`);
        console.log(`   Teams: ${tsComp.standings.length} | Last Updated: ${ageStr}`);
        console.log('');

        matchedLeagues.push({
          fs_id: fsComp.competition_id,
          fs_name: fsComp.name,
          fs_country: fsComp.country,
          ts_comp_name: tsComp.comp_name,
          ts_season_id: tsComp.season_id,
          team_count: tsComp.standings.length,
          updated_at: tsComp.updated_at,
          age_days: diffDays,
          standings: tsComp.standings
        });
      } else {
        unmatchedCount++;
        console.log(`❌ [FS:${fsComp.competition_id}] ${fsComp.name} (${fsComp.country}) - PUAN DURUMU YOK`);
      }
    }

    console.log('');
    console.log('='.repeat(100));
    console.log('ÖZET:');
    console.log(`  Eşleşen: ${matchedCount}/${allowlistResult.rows.length}`);
    console.log(`  Eşleşmeyen: ${unmatchedCount}`);
    console.log(`  Veri Tazeliği: 🟢 <1 gün | 🟡 1-2 gün | 🔴 >2 gün`);
    console.log('='.repeat(100));
    console.log('');

    // 4. Show detailed standings for matched leagues
    if (matchedLeagues.length > 0) {
      console.log('📊 DETAYLI PUAN DURUMLARI:');
      console.log('='.repeat(100));
      console.log('');

      for (const league of matchedLeagues) {
        console.log(`\n🏆 ${league.fs_name} (${league.fs_country})`);
        console.log(`TheSports: ${league.ts_comp_name}`);
        console.log(`Son Güncelleme: ${league.age_days} gün önce`);
        console.log('─'.repeat(90));

        // Get team names
        const teamIds = league.standings.map((t: any) => t.team_id);
        const teams = await pool.query(`
          SELECT external_id, name
          FROM ts_teams
          WHERE external_id = ANY($1::text[])
        `, [teamIds]);

        const teamMap: any = {};
        teams.rows.forEach(t => teamMap[t.external_id] = t.name);

        // Show top 10 or all teams if less than 10
        const teamsToShow = league.standings.slice(0, Math.min(10, league.standings.length));

        teamsToShow.forEach((team: any) => {
          const teamName = teamMap[team.team_id] || 'Unknown';
          console.log(`  ${team.position}. ${teamName.padEnd(30)} ${team.points} pts (MP:${team.played} W:${team.won} D:${team.drawn} L:${team.lost} GD:${team.goal_diff})`);
        });

        if (league.standings.length > 10) {
          console.log(`  ... (${league.standings.length - 10} takım daha)`);
        }
      }
    }

    console.log('');
    console.log('='.repeat(100));
    console.log('✅ Rapor tamamlandı!');
    console.log('');
    console.log('NOT: Puan durumları database\'den alınmıştır. Süper Lig için son güncelleme 6 gün önce.');
    console.log('     Canlı maç sırasında /table/live endpoint\'i kullanılarak güncel veriler çekilebilir.');

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

main();
