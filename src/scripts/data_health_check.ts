/**
 * Data Health Check Script
 * Analyzes database for data quality and relationships
 */

import { pool } from '../database/connection';

async function checkDataHealth() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('📊 GOALGPT VERİTABANI SAĞLIK RAPORU');
    console.log('========================================\n');

    // 1. TABLE COUNTS
    console.log('📈 TABLO KAYIT SAYILARI:');
    console.log('------------------------');

    const tables = [
      { name: 'ts_categories', label: 'Kategoriler' },
      { name: 'ts_countries', label: 'Ülkeler' },
      { name: 'ts_competitions', label: 'Ligler/Turnuvalar' },
      { name: 'ts_seasons', label: 'Sezonlar' },
      { name: 'ts_stages', label: 'Aşamalar' },
      { name: 'ts_teams', label: 'Takımlar' },
      { name: 'ts_players', label: 'Oyuncular' },
      { name: 'ts_coaches', label: 'Teknik Direktörler' },
      { name: 'ts_venues', label: 'Stadyumlar' },
      { name: 'ts_referees', label: 'Hakemler' },
      { name: 'ts_matches', label: 'Maçlar' },
    ];

    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table.name}`);
      const count = Number(result.rows[0].count);
      console.log(`  ${table.label}: ${count.toLocaleString()}`);
    }

    // 2. DUPLICATE ANALYSIS
    console.log('\n⚠️  DUPLICATE ANALİZİ:');
    console.log('------------------------');

    // Teams duplicates
    const teamDupes = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_duplicate = true) as duplicates,
        COUNT(*) FILTER (WHERE is_duplicate = false OR is_duplicate IS NULL) as masters,
        COUNT(*) as total
      FROM ts_teams
    `);
    console.log(`  Takımlar: ${teamDupes.rows[0].masters} master, ${teamDupes.rows[0].duplicates} duplicate`);

    // Players duplicates
    const playerDupes = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_duplicate = true) as duplicates,
        COUNT(*) FILTER (WHERE is_duplicate = false OR is_duplicate IS NULL) as masters,
        COUNT(*) as total
      FROM ts_players
    `);
    console.log(`  Oyuncular: ${playerDupes.rows[0].masters} master, ${playerDupes.rows[0].duplicates} duplicate`);

    // Competitions duplicates
    const compDupes = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_duplicate = true) as duplicates,
        COUNT(*) FILTER (WHERE is_duplicate = false OR is_duplicate IS NULL) as masters,
        COUNT(*) as total
      FROM ts_competitions
    `);
    console.log(`  Ligler: ${compDupes.rows[0].masters} master, ${compDupes.rows[0].duplicates} duplicate`);

    // 3. RELATIONSHIP INTEGRITY
    console.log('\n🔗 İLİŞKİ BÜTÜNLÜĞÜ:');
    console.log('------------------------');

    // Players without team
    const orphanPlayers = await client.query(`
      SELECT COUNT(*) FROM ts_players WHERE team_id IS NULL OR team_id = ''
    `);
    console.log(`  Takımsız oyuncular: ${Number(orphanPlayers.rows[0].count).toLocaleString()}`);

    // Players with non-existent team
    const brokenPlayerTeam = await client.query(`
      SELECT COUNT(*) FROM ts_players p
      WHERE p.team_id IS NOT NULL
        AND p.team_id != ''
        AND NOT EXISTS (SELECT 1 FROM ts_teams t WHERE t.external_id = p.team_id)
    `);
    console.log(`  Var olmayan takıma bağlı oyuncular: ${brokenPlayerTeam.rows[0].count}`);

    // Teams without competition
    const orphanTeams = await client.query(`
      SELECT COUNT(*) FROM ts_teams WHERE competition_id IS NULL OR competition_id = ''
    `);
    console.log(`  Ligsiz takımlar: ${Number(orphanTeams.rows[0].count).toLocaleString()}`);

    // Teams with non-existent competition
    const brokenTeamComp = await client.query(`
      SELECT COUNT(*) FROM ts_teams t
      WHERE t.competition_id IS NOT NULL
        AND t.competition_id != ''
        AND NOT EXISTS (SELECT 1 FROM ts_competitions c WHERE c.external_id = t.competition_id)
    `);
    console.log(`  Var olmayan lige bağlı takımlar: ${brokenTeamComp.rows[0].count}`);

    // Competitions without country
    const orphanComps = await client.query(`
      SELECT COUNT(*) FROM ts_competitions WHERE country_id IS NULL OR country_id = ''
    `);
    console.log(`  Ülkesiz ligler: ${orphanComps.rows[0].count}`);

    // 4. DATA COMPLETENESS
    console.log('\n📋 VERİ TAMAMI:');
    console.log('------------------------');

    // Teams with logo
    const teamsWithLogo = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE logo_url IS NOT NULL AND logo_url != '') as with_logo,
        COUNT(*) as total
      FROM ts_teams WHERE is_duplicate = false OR is_duplicate IS NULL
    `);
    const logoPercent = ((teamsWithLogo.rows[0].with_logo / teamsWithLogo.rows[0].total) * 100).toFixed(1);
    console.log(`  Logosu olan takımlar: ${teamsWithLogo.rows[0].with_logo}/${teamsWithLogo.rows[0].total} (${logoPercent}%)`);

    // Players with photo
    const playersWithPhoto = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE logo IS NOT NULL AND logo != '') as with_photo,
        COUNT(*) as total
      FROM ts_players WHERE is_duplicate = false OR is_duplicate IS NULL
    `);
    const photoPercent = ((playersWithPhoto.rows[0].with_photo / playersWithPhoto.rows[0].total) * 100).toFixed(1);
    console.log(`  Fotoğrafı olan oyuncular: ${playersWithPhoto.rows[0].with_photo}/${playersWithPhoto.rows[0].total} (${photoPercent}%)`);

    // Players with market value
    const playersWithValue = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE market_value IS NOT NULL AND market_value > 0) as with_value,
        COUNT(*) as total
      FROM ts_players WHERE is_duplicate = false OR is_duplicate IS NULL
    `);
    const valuePercent = ((playersWithValue.rows[0].with_value / playersWithValue.rows[0].total) * 100).toFixed(1);
    console.log(`  Piyasa değeri olan oyuncular: ${playersWithValue.rows[0].with_value}/${playersWithValue.rows[0].total} (${valuePercent}%)`);

    // 5. TOP COUNTRIES & COMPETITIONS
    console.log('\n🌍 EN ÇOK TAKIM OLAN ÜLKELER:');
    console.log('------------------------');
    const topCountries = await client.query(`
      SELECT c.name, COUNT(t.id) as team_count
      FROM ts_countries c
      LEFT JOIN ts_teams t ON t.country_id = c.external_id AND (t.is_duplicate = false OR t.is_duplicate IS NULL)
      GROUP BY c.id, c.name
      ORDER BY team_count DESC
      LIMIT 10
    `);
    for (const row of topCountries.rows) {
      console.log(`  ${row.name}: ${row.team_count} takım`);
    }

    console.log('\n🏆 EN ÇOK TAKIM OLAN LİGLER:');
    console.log('------------------------');
    const topComps = await client.query(`
      SELECT c.name, COUNT(t.id) as team_count
      FROM ts_competitions c
      LEFT JOIN ts_teams t ON t.competition_id = c.external_id AND (t.is_duplicate = false OR t.is_duplicate IS NULL)
      WHERE c.is_duplicate = false OR c.is_duplicate IS NULL
      GROUP BY c.id, c.name
      ORDER BY team_count DESC
      LIMIT 10
    `);
    for (const row of topComps.rows) {
      console.log(`  ${row.name}: ${row.team_count} takım`);
    }

    // 6. RECENT SYNC STATUS
    console.log('\n🔄 SON SYNC DURUMU:');
    console.log('------------------------');
    const syncState = await client.query(`
      SELECT entity_type,
             to_timestamp(last_updated_at) as last_api_update,
             last_sync_at
      FROM ts_sync_state
      ORDER BY last_sync_at DESC
    `);
    for (const row of syncState.rows) {
      const syncTime = row.last_sync_at ? new Date(row.last_sync_at).toLocaleString('tr-TR') : 'Hiç';
      console.log(`  ${row.entity_type}: ${syncTime}`);
    }

    console.log('\n========================================');
    console.log('✅ Rapor tamamlandı');
    console.log('========================================\n');

  } catch (error) {
    console.error('Hata:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDataHealth();
