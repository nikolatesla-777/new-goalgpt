/**
 * Deep Data Analysis Script
 * Investigates orphan records and data quality issues
 */

import { pool } from '../database/connection';

async function deepAnalysis() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('🔍 DERİN VERİ ANALİZİ');
    console.log('========================================\n');

    // 1. ORPHAN PLAYERS ANALYSIS
    console.log('👤 TAKIMSIZ OYUNCU ANALİZİ:');
    console.log('------------------------');

    // Are these free agents or data issues?
    const orphanPlayersByPosition = await client.query(`
      SELECT
        COALESCE(position, 'Bilinmiyor') as position,
        COUNT(*) as count
      FROM ts_players
      WHERE team_id IS NULL OR team_id = ''
      GROUP BY position
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('  Pozisyona göre takımsız oyuncular:');
    for (const row of orphanPlayersByPosition.rows) {
      console.log(`    ${row.position}: ${Number(row.count).toLocaleString()}`);
    }

    // Do orphan players have market value? (if yes, they're likely real players)
    const orphanPlayersWithValue = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE market_value > 0) as with_value,
        COUNT(*) as total,
        SUM(CASE WHEN market_value > 0 THEN market_value ELSE 0 END) as total_value
      FROM ts_players
      WHERE team_id IS NULL OR team_id = ''
    `);
    console.log(`\n  Takımsız ama değeri olan: ${orphanPlayersWithValue.rows[0].with_value} oyuncu`);
    console.log(`  Toplam değer: €${(Number(orphanPlayersWithValue.rows[0].total_value) / 1000000).toFixed(0)}M`);

    // Sample orphan players with value
    const sampleOrphanPlayers = await client.query(`
      SELECT name, position, market_value, age, nationality
      FROM ts_players
      WHERE (team_id IS NULL OR team_id = '')
        AND market_value > 0
      ORDER BY market_value DESC
      LIMIT 10
    `);
    console.log('\n  En değerli takımsız oyuncular:');
    for (const row of sampleOrphanPlayers.rows) {
      const value = row.market_value ? `€${(Number(row.market_value) / 1000000).toFixed(1)}M` : 'N/A';
      console.log(`    ${row.name} (${row.position || 'N/A'}) - ${value}`);
    }

    // 2. ORPHAN TEAMS ANALYSIS
    console.log('\n\n🏟️ LİGSİZ TAKIM ANALİZİ:');
    console.log('------------------------');

    // Teams without competition - by country
    const orphanTeamsByCountry = await client.query(`
      SELECT
        COALESCE(c.name, 'Ülkesiz') as country,
        COUNT(*) as count
      FROM ts_teams t
      LEFT JOIN ts_countries c ON t.country_id = c.external_id
      WHERE t.competition_id IS NULL OR t.competition_id = ''
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('  Ülkeye göre ligsiz takımlar:');
    for (const row of orphanTeamsByCountry.rows) {
      console.log(`    ${row.country}: ${row.count} takım`);
    }

    // Sample orphan teams
    const sampleOrphanTeams = await client.query(`
      SELECT t.name, c.name as country
      FROM ts_teams t
      LEFT JOIN ts_countries c ON t.country_id = c.external_id
      WHERE t.competition_id IS NULL OR t.competition_id = ''
      LIMIT 15
    `);
    console.log('\n  Örnek ligsiz takımlar:');
    for (const row of sampleOrphanTeams.rows) {
      console.log(`    ${row.name} (${row.country || 'Ülkesiz'})`);
    }

    // 3. PLAYERS WITH TEAMS - VERIFICATION
    console.log('\n\n✅ TAKIMLI OYUNCU VERİFİKASYONU:');
    console.log('------------------------');

    // Players per team distribution
    const playersPerTeam = await client.query(`
      SELECT
        t.name as team_name,
        COUNT(p.id) as player_count
      FROM ts_teams t
      LEFT JOIN ts_players p ON p.team_id = t.external_id
      WHERE t.is_duplicate = false OR t.is_duplicate IS NULL
      GROUP BY t.id, t.name
      HAVING COUNT(p.id) > 0
      ORDER BY player_count DESC
      LIMIT 10
    `);
    console.log('  En çok oyuncusu olan takımlar:');
    for (const row of playersPerTeam.rows) {
      console.log(`    ${row.team_name}: ${row.player_count} oyuncu`);
    }

    // Teams with 0 players
    const teamsWithNoPlayers = await client.query(`
      SELECT COUNT(*) as count
      FROM ts_teams t
      WHERE (t.is_duplicate = false OR t.is_duplicate IS NULL)
        AND NOT EXISTS (SELECT 1 FROM ts_players p WHERE p.team_id = t.external_id)
    `);
    console.log(`\n  Hiç oyuncusu olmayan takımlar: ${teamsWithNoPlayers.rows[0].count}`);

    // 4. MATCH DATA QUALITY
    console.log('\n\n⚽ MAÇ VERİSİ KALİTESİ:');
    console.log('------------------------');

    const matchQuality = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL) as with_both_teams,
        COUNT(*) FILTER (WHERE competition_id IS NOT NULL) as with_competition,
        COUNT(*) FILTER (WHERE venue_id IS NOT NULL) as with_venue,
        COUNT(*) FILTER (WHERE statistics IS NOT NULL) as with_statistics,
        COUNT(*) FILTER (WHERE incidents IS NOT NULL) as with_incidents
      FROM ts_matches
    `);
    const mq = matchQuality.rows[0];
    console.log(`  Toplam maç: ${mq.total}`);
    console.log(`  İki takımı da olan: ${mq.with_both_teams} (${((mq.with_both_teams/mq.total)*100).toFixed(1)}%)`);
    console.log(`  Lig bilgisi olan: ${mq.with_competition} (${((mq.with_competition/mq.total)*100).toFixed(1)}%)`);
    console.log(`  Stadyum bilgisi olan: ${mq.with_venue} (${((mq.with_venue/mq.total)*100).toFixed(1)}%)`);
    console.log(`  İstatistikleri olan: ${mq.with_statistics} (${((mq.with_statistics/mq.total)*100).toFixed(1)}%)`);
    console.log(`  Olayları olan: ${mq.with_incidents} (${((mq.with_incidents/mq.total)*100).toFixed(1)}%)`);

    // 5. TURKISH LEAGUE CHECK
    console.log('\n\n🇹🇷 TÜRKİYE VERİSİ KONTROLÜ:');
    console.log('------------------------');

    const turkeyCountry = await client.query(`
      SELECT external_id, name FROM ts_countries WHERE name ILIKE '%turkey%' OR name ILIKE '%türk%'
    `);
    if (turkeyCountry.rows.length > 0) {
      const turkeyId = turkeyCountry.rows[0].external_id;
      console.log(`  Ülke ID: ${turkeyId}`);

      const turkishComps = await client.query(`
        SELECT name, external_id FROM ts_competitions
        WHERE country_id = $1 AND (is_duplicate = false OR is_duplicate IS NULL)
        ORDER BY name
      `, [turkeyId]);
      console.log(`\n  Türk Ligleri (${turkishComps.rows.length} adet):`);
      for (const row of turkishComps.rows) {
        console.log(`    - ${row.name}`);
      }

      const turkishTeams = await client.query(`
        SELECT COUNT(*) FROM ts_teams
        WHERE country_id = $1 AND (is_duplicate = false OR is_duplicate IS NULL)
      `, [turkeyId]);
      console.log(`\n  Türk Takımları: ${turkishTeams.rows[0].count}`);

      // Sample Turkish teams
      const sampleTurkishTeams = await client.query(`
        SELECT t.name, c.name as competition
        FROM ts_teams t
        LEFT JOIN ts_competitions c ON t.competition_id = c.external_id
        WHERE t.country_id = $1 AND (t.is_duplicate = false OR t.is_duplicate IS NULL)
        LIMIT 15
      `, [turkeyId]);
      console.log('  Örnek Türk takımları:');
      for (const row of sampleTurkishTeams.rows) {
        console.log(`    ${row.name} → ${row.competition || 'Ligsiz'}`);
      }
    }

    // 6. DUPLICATE DETAILS
    console.log('\n\n🔄 DUPLICATE DETAYLARI:');
    console.log('------------------------');

    const duplicateTeamSample = await client.query(`
      SELECT
        d.name as duplicate_name,
        d.external_id as duplicate_id,
        m.name as master_name,
        m.external_id as master_id
      FROM ts_teams d
      JOIN ts_teams m ON d.uid = m.external_id
      WHERE d.is_duplicate = true
      LIMIT 10
    `);
    console.log('  Duplicate → Master takım örnekleri:');
    for (const row of duplicateTeamSample.rows) {
      console.log(`    "${row.duplicate_name}" (${row.duplicate_id}) → "${row.master_name}" (${row.master_id})`);
    }

    console.log('\n========================================');
    console.log('✅ Derin analiz tamamlandı');
    console.log('========================================\n');

  } catch (error) {
    console.error('Hata:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

deepAnalysis();
