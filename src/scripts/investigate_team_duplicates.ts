/**
 * Investigate Team Duplicate Players
 * Check why duplicate players appear on team page
 */

import { pool } from '../database/connection';

const TEAM_ID = 'z318q66hp66qo9j';

async function investigate() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('🔍 TAKIM OYUNCU DUPLICATE ANALİZİ');
    console.log(`Takım ID: ${TEAM_ID}`);
    console.log('========================================\n');

    // 1. Get team info
    const teamInfo = await client.query(`
      SELECT * FROM ts_teams WHERE external_id = $1
    `, [TEAM_ID]);

    if (teamInfo.rows.length === 0) {
      console.log('❌ Takım bulunamadı!');
      return;
    }

    const team = teamInfo.rows[0];
    console.log('📋 TAKIM BİLGİSİ:');
    console.log(`  Ad: ${team.name}`);
    console.log(`  Lig ID: ${team.competition_id}`);
    console.log(`  Ülke ID: ${team.country_id}`);
    console.log(`  is_duplicate: ${team.is_duplicate}`);
    console.log(`  uid: ${team.uid}`);

    // 2. Get ALL players for this team
    const allPlayers = await client.query(`
      SELECT
        external_id,
        name,
        short_name,
        position,
        shirt_number,
        age,
        market_value,
        is_duplicate,
        uid,
        created_at,
        updated_at
      FROM ts_players
      WHERE team_id = $1
      ORDER BY name, external_id
    `, [TEAM_ID]);

    console.log(`\n👥 TOPLAM OYUNCU: ${allPlayers.rows.length}`);

    // 3. Check for name duplicates
    const nameCount: Record<string, any[]> = {};
    for (const player of allPlayers.rows) {
      const key = player.name?.toLowerCase() || 'unnamed';
      if (!nameCount[key]) nameCount[key] = [];
      nameCount[key].push(player);
    }

    const duplicateNames = Object.entries(nameCount).filter(([_, players]) => players.length > 1);

    console.log(`\n⚠️  AYNI İSİMLİ OYUNCULAR: ${duplicateNames.length} grup`);

    for (const [name, players] of duplicateNames) {
      console.log(`\n  "${name}" (${players.length} kayıt):`);
      for (const p of players) {
        console.log(`    - ID: ${p.external_id}`);
        console.log(`      Position: ${p.position}, Shirt: ${p.shirt_number}, Age: ${p.age}`);
        console.log(`      is_duplicate: ${p.is_duplicate}, uid: ${p.uid}`);
        console.log(`      Created: ${p.created_at}`);
      }
    }

    // 4. Check for external_id duplicates (shouldn't exist due to UNIQUE constraint)
    const idCount: Record<string, number> = {};
    for (const player of allPlayers.rows) {
      idCount[player.external_id] = (idCount[player.external_id] || 0) + 1;
    }
    const duplicateIds = Object.entries(idCount).filter(([_, count]) => count > 1);
    console.log(`\n🔑 AYNI EXTERNAL_ID: ${duplicateIds.length} (olmamalı)`);

    // 5. Check if is_duplicate field is being used
    const duplicateFlagged = allPlayers.rows.filter(p => p.is_duplicate === true);
    console.log(`\n🏷️  is_duplicate=true OLAN: ${duplicateFlagged.length}`);

    // 6. List all players with details
    console.log('\n📝 TÜM OYUNCULAR:');
    console.log('------------------------');
    for (const p of allPlayers.rows) {
      const dupMark = p.is_duplicate ? ' [DUP]' : '';
      console.log(`  ${p.shirt_number || '-'} | ${p.name}${dupMark} | ${p.position || 'N/A'} | ID: ${p.external_id}`);
    }

    // 7. Check the API endpoint logic
    console.log('\n\n🔧 KONTROL EDİLMESİ GEREKENLER:');
    console.log('------------------------');
    console.log('1. Backend API: GET /api/players/team/:teamId');
    console.log('2. Frontend: getPlayersByTeam() fonksiyonu');
    console.log('3. TeamCardPage.tsx: players state nasıl render ediliyor');

  } catch (error) {
    console.error('Hata:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

investigate();
