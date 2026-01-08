/**
 * Reset Players Script
 *
 * Clears all player data and triggers a fresh sync from TheSports API
 * Use this to fix massive duplicate issues by starting fresh
 *
 * WARNING: This will DELETE ALL player data!
 * Usage:
 *   npx ts-node src/scripts/reset_players.ts confirm
 */

import { pool } from '../database/connection';
import { PlayerSyncService } from '../services/thesports/player/playerSync.service';
import { logger } from '../utils/logger';

const CONFIRM_FLAG = process.argv[2];

async function resetPlayers() {
  if (CONFIRM_FLAG !== 'confirm') {
    console.log('\n========================================');
    console.log('PLAYER VERİSİ SIFIRLAMA');
    console.log('========================================');
    console.log('\nDİKKAT: Bu script TÜM player verilerini silecek!');
    console.log('\nKullanım: npx ts-node src/scripts/reset_players.ts confirm');
    console.log('\n"confirm" parametresi olmadan script çalışmaz.');
    console.log('========================================\n');
    return;
  }

  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('PLAYER VERİSİ SIFIRLAMA BAŞLIYOR');
    console.log('========================================\n');

    // 1. Get current count
    const beforeCount = await client.query('SELECT COUNT(*) FROM ts_players');
    console.log(`Mevcut player sayısı: ${Number(beforeCount.rows[0].count).toLocaleString()}`);

    // 2. Get duplicate count before
    const dupsBefore = await client.query(`
      SELECT COUNT(*) FROM ts_players WHERE is_duplicate = true
    `);
    console.log(`Duplicate olarak işaretli: ${dupsBefore.rows[0].count}`);

    // 3. Get orphan count before
    const orphansBefore = await client.query(`
      SELECT COUNT(*) FROM ts_players WHERE team_id IS NULL OR team_id = ''
    `);
    console.log(`Takımsız player: ${Number(orphansBefore.rows[0].count).toLocaleString()}`);

    console.log('\n--- ADIM 1: Player tablosunu temizliyorum ---');

    // 4. Delete all players
    await client.query('TRUNCATE TABLE ts_players CASCADE');
    console.log('Tüm player verileri silindi.');

    // 5. Reset sync state for player
    console.log('\n--- ADIM 2: Sync state sıfırlanıyor ---');
    await client.query(`
      DELETE FROM ts_sync_state WHERE entity_type = 'player'
    `);
    console.log("'player' için sync state silindi. Sonraki sync tam güncelleme yapacak.");

    console.log('\n--- ADIM 3: Player verilerini API\'den çekiyorum ---');
    console.log('Bu işlem uzun sürebilir (1M+ player)...\n');

    // Release connection before sync (sync service will use its own connections)
    client.release();

    // 6. Trigger full sync
    const playerSyncService = new PlayerSyncService();
    const result = await playerSyncService.sync();

    console.log('\n========================================');
    console.log('SIFIRLAMA TAMAMLANDI');
    console.log('========================================');
    console.log(`Toplam çekilen: ${result.total.toLocaleString()}`);
    console.log(`Başarıyla kaydedilen: ${result.synced.toLocaleString()}`);
    console.log(`Hatalar: ${result.errors}`);
    console.log(`Mod: ${result.isFullUpdate ? 'TAM GÜNCELLEME' : 'ARTIMLI'}`);

    // Get new stats
    const newClient = await pool.connect();
    try {
      const afterCount = await newClient.query('SELECT COUNT(*) FROM ts_players');
      console.log(`\nYeni player sayısı: ${Number(afterCount.rows[0].count).toLocaleString()}`);

      const dupsAfter = await newClient.query(`
        SELECT COUNT(*) FROM ts_players WHERE is_duplicate = true
      `);
      console.log(`Duplicate olarak işaretli: ${dupsAfter.rows[0].count}`);

      const orphansAfter = await newClient.query(`
        SELECT COUNT(*) FROM ts_players WHERE team_id IS NULL OR team_id = ''
      `);
      console.log(`Takımsız player: ${Number(orphansAfter.rows[0].count).toLocaleString()}`);
    } finally {
      newClient.release();
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('Hata:', error);
    client.release();
  } finally {
    await pool.end();
  }
}

resetPlayers();
