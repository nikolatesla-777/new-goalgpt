import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { pool } from '../database/connection';

async function cleanup() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Silinecek bot isimleri
    const botsToDelete = [
      '70. Dakika Botu',
      'IY-1',
      'AI Bot',
      'Manual'
    ];

    console.log('=== SİLİNECEK TAHMİNLER ===');
    for (const botName of botsToDelete) {
      const result = await client.query(
        `DELETE FROM ai_predictions WHERE bot_name = $1 OR canonical_bot_name = $1 RETURNING id`,
        [botName]
      );
      console.log(`- ${botName}: ${result.rowCount} tahmin silindi`);
    }

    // 2. Kalacak botlar için rules tablosunu güncelle
    // Önce mevcut rules'ı kontrol et
    console.log('\n=== MEVCUT BOT RULES ===');
    const existingRules = await client.query('SELECT * FROM ai_bot_rules ORDER BY bot_display_name');
    existingRules.rows.forEach((r: any) => {
      console.log(`- ${r.bot_display_name}`);
    });

    // Code Zero var mı kontrol et
    const codeZeroExists = existingRules.rows.some((r: any) => r.bot_display_name === 'Code Zero');
    if (!codeZeroExists) {
      console.log('\n=== CODE ZERO EKLENİYOR ===');
      await client.query(`
        INSERT INTO ai_bot_rules (bot_display_name, minute_from, minute_to, is_active, created_at)
        VALUES ('Code Zero', 0, 90, true, NOW())
      `);
      console.log('- Code Zero eklendi');
    }

    // 3. Priority kolonunu kaldır (eğer varsa)
    console.log('\n=== PRIORITY KOLONU KALDIRILIYOR ===');
    try {
      await client.query('ALTER TABLE ai_bot_rules DROP COLUMN IF EXISTS priority');
      console.log('- priority kolonu kaldırıldı');
    } catch (e) {
      console.log('- priority kolonu zaten yok veya kaldırılamadı');
    }

    // 4. Sonuç durumu
    console.log('\n=== YENİ DURUM ===');
    const finalRules = await client.query('SELECT * FROM ai_bot_rules ORDER BY bot_display_name');
    console.log('Bot Rules:');
    finalRules.rows.forEach((r: any) => {
      console.log(`- ${r.bot_display_name} (minute: ${r.minute_from ?? 'null'}-${r.minute_to ?? 'null'}, active: ${r.is_active})`);
    });

    const finalPreds = await client.query(`
      SELECT COALESCE(canonical_bot_name, bot_name) as name, COUNT(*) as count
      FROM ai_predictions
      GROUP BY COALESCE(canonical_bot_name, bot_name)
      ORDER BY count DESC
    `);
    console.log('\nPredictions:');
    finalPreds.rows.forEach((r: any) => {
      console.log(`- ${r.name}: ${r.count} tahmin`);
    });

    const total = await client.query('SELECT COUNT(*) FROM ai_predictions');
    console.log(`\nToplam: ${total.rows[0].count} tahmin`);

    await client.query('COMMIT');
    console.log('\n✅ Tüm işlemler başarıyla tamamlandı!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Hata:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup().catch(console.error);
