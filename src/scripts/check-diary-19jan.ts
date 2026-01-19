/**
 * Check if Jan 19, 2026 diary is synced in database
 */

import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function checkDiary() {
  const client = await pool.connect();
  try {
    // 19 Ocak 2026 TSİ (UTC+3)
    const startOfDay = Math.floor(new Date('2026-01-19T00:00:00+03:00').getTime() / 1000);
    const endOfDay = Math.floor(new Date('2026-01-20T00:00:00+03:00').getTime() / 1000);

    console.log('📅 19 Ocak 2026 Bülten Kontrolü');
    console.log('================================');
    console.log(`Tarih: ${new Date(startOfDay * 1000).toISOString()} - ${new Date(endOfDay * 1000).toISOString()}`);
    console.log('');

    // 1. Toplam maç
    const totalResult = await client.query(
      'SELECT COUNT(*) as total FROM ts_matches WHERE match_time >= $1 AND match_time < $2',
      [startOfDay, endOfDay]
    );
    console.log('📊 TOPLAM MAÇ:', totalResult.rows[0].total);
    console.log('');

    // 2. Status dağılımı
    const statusResult = await client.query(`
      SELECT status_id, COUNT(*) as count
      FROM ts_matches
      WHERE match_time >= $1 AND match_time < $2
      GROUP BY status_id
      ORDER BY count DESC
    `, [startOfDay, endOfDay]);

    const statusNames: Record<number, string> = {
      1: 'NOT_STARTED',
      2: 'FIRST_HALF',
      3: 'HALF_TIME',
      4: 'SECOND_HALF',
      5: 'OVERTIME',
      7: 'PENALTIES',
      8: 'ENDED',
      9: 'POSTPONED',
      10: 'CANCELLED'
    };

    console.log('📈 STATUS DAĞILIMI:');
    statusResult.rows.forEach((row: any) => {
      const name = statusNames[row.status_id] || 'UNKNOWN';
      console.log(`   ${name} (${row.status_id}): ${row.count} maç`);
    });
    console.log('');

    // 3. Sync zamanı
    const syncResult = await client.query(`
      SELECT MAX(updated_at) as last_update, MIN(updated_at) as first_update
      FROM ts_matches
      WHERE match_time >= $1 AND match_time < $2
    `, [startOfDay, endOfDay]);

    if (syncResult.rows[0].last_update) {
      console.log('🕐 SYNC ZAMANLARI:');
      console.log('   İlk:', syncResult.rows[0].first_update);
      console.log('   Son:', syncResult.rows[0].last_update);
    } else {
      console.log('⚠️ VERİ YOK - Henüz sync yapılmamış!');
    }
    console.log('');

    // 4. Örnek maçlar
    const sampleResult = await client.query(`
      SELECT
        m.external_id as id,
        m.match_time,
        m.status_id,
        ht.name as home_team,
        at.name as away_team,
        c.name as competition,
        m.home_score_display as home_score,
        m.away_score_display as away_score
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
      WHERE m.match_time >= $1 AND m.match_time < $2
      ORDER BY m.match_time ASC
      LIMIT 10
    `, [startOfDay, endOfDay]);

    if (sampleResult.rows.length > 0) {
      console.log('🔍 ÖRNEK MAÇLAR (ilk 10):');
      sampleResult.rows.forEach((row: any, i: number) => {
        const time = new Date(row.match_time * 1000).toLocaleTimeString('tr-TR', {
          timeZone: 'Europe/Istanbul',
          hour: '2-digit',
          minute: '2-digit'
        });
        const score = row.home_score !== null ? `${row.home_score}-${row.away_score}` : '-';
        console.log(`   ${i + 1}. [${time}] ${row.home_team || '?'} vs ${row.away_team || '?'} (${score}) - ${row.competition || '?'}`);
      });
    } else {
      console.log('🔍 Örnek maç bulunamadı.');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

checkDiary().catch(console.error);
