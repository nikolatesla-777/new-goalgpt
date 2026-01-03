/**
 * Migration: Add prediction_period and base_prediction_type to ai_bot_rules
 * 
 * These columns define how each bot generates predictions based on current score:
 * - prediction_period: 'IY' (first half) or 'MS' (full match)
 * - base_prediction_type: 'ÜST', 'ALT', 'KG VAR', etc.
 */

import { pool } from '../connection';

export async function up(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Add new columns
        await client.query(`
      ALTER TABLE ai_bot_rules 
      ADD COLUMN IF NOT EXISTS prediction_period VARCHAR(10) DEFAULT 'MS';
    `);

        await client.query(`
      ALTER TABLE ai_bot_rules 
      ADD COLUMN IF NOT EXISTS base_prediction_type VARCHAR(50) DEFAULT 'ÜST';
    `);

        // Update existing bot rules with correct period and type
        // ALERT: D (1-15' dakika) → IY ÜST
        await client.query(`
      UPDATE ai_bot_rules 
      SET prediction_period = 'IY', 
          base_prediction_type = 'ÜST',
          display_template = '⚡ {period} {value} ÜST ({minute}'' dk)'
      WHERE bot_display_name = 'ALERT: D';
    `);

        // 70. Dakika Botu (65-75') → MS ÜST
        await client.query(`
      UPDATE ai_bot_rules 
      SET prediction_period = 'MS', 
          base_prediction_type = 'ÜST',
          display_template = '🎯 {period} {value} ÜST ({minute}'' dk)'
      WHERE bot_display_name = '70. Dakika Botu';
    `);

        // BOT 007 (fallback) → Auto-detect period based on minute
        await client.query(`
      UPDATE ai_bot_rules 
      SET prediction_period = 'AUTO', 
          base_prediction_type = 'ÜST',
          display_template = '🤖 {period} {value} ÜST ({minute}'' dk)'
      WHERE bot_display_name = 'BOT 007';
    `);

        await client.query('COMMIT');
        console.log('✅ Added prediction_period and base_prediction_type to ai_bot_rules');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function down(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE ai_bot_rules 
      DROP COLUMN IF EXISTS prediction_period;
    `);
        await client.query(`
      ALTER TABLE ai_bot_rules 
      DROP COLUMN IF EXISTS base_prediction_type;
    `);
        await client.query('COMMIT');
        console.log('✅ Removed prediction_period and base_prediction_type from ai_bot_rules');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// CLI runner
if (require.main === module) {
    const action = process.argv[2];
    if (action === 'up') {
        up().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    } else if (action === 'down') {
        down().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    } else {
        console.log('Usage: npx tsx add-instant-settlement-columns.ts [up|down]');
        process.exit(1);
    }
}
