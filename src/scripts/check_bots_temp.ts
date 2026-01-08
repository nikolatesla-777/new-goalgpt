import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { pool } from '../database/connection';

async function check() {
  try {
    // Bot rules
    console.log('=== AI BOT RULES ===');
    const rules = await pool.query(`
      SELECT * FROM ai_bot_rules ORDER BY priority DESC
    `);
    console.log('Toplam:', rules.rows.length);
    rules.rows.forEach((r: any) => {
      console.log(`- ${r.bot_display_name} (priority: ${r.priority}, active: ${r.is_active}, minute: ${r.minute_from}-${r.minute_to})`);
    });

    // Unique bot names in predictions
    console.log('\n=== PREDICTIONS DAKI UNIQUE BOTLAR ===');
    const preds = await pool.query(`
      SELECT COALESCE(canonical_bot_name, bot_name) as name, COUNT(*) as count
      FROM ai_predictions
      GROUP BY COALESCE(canonical_bot_name, bot_name)
      ORDER BY count DESC
    `);
    preds.rows.forEach((r: any) => {
      console.log(`- ${r.name}: ${r.count} tahmin`);
    });

    // Total predictions
    console.log('\n=== TOPLAM TAHMİN ===');
    const total = await pool.query(`SELECT COUNT(*) FROM ai_predictions`);
    console.log('Toplam:', total.rows[0].count);

    // Alert System / Manuel check
    console.log('\n=== MANUEL / ALERT SYSTEM ===');
    const manuel = await pool.query(`
      SELECT bot_name, COUNT(*) as count
      FROM ai_predictions
      WHERE bot_name ILIKE '%alert system%' OR bot_name ILIKE '%manuel%' OR bot_name ILIKE '%manual%'
      GROUP BY bot_name
    `);
    manuel.rows.forEach((r: any) => {
      console.log(`- ${r.bot_name}: ${r.count} tahmin`);
    });

  } finally {
    await pool.end();
  }
}

check().catch(console.error);
