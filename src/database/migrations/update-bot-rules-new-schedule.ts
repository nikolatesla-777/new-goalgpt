/**
 * Migration: Update Bot Rules with New Schedule
 * 
 * New bot assignment rules:
 * - 10-14: ALERT D
 * - 15: CODE: 35
 * - 20-24: Code Zero
 * - 65-69: BOT 007
 * - 70-75: Algoritma: 01
 * - 0-90: BOT 007 (fallback)
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function up(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete old bot rules (clean slate)
    logger.info('[BotRules] Deleting old bot rules...');
    await client.query(`
      DELETE FROM ai_bot_rules
      WHERE bot_display_name IN ('ALERT: D', '70. Dakika Botu', 'BOT 007', 'Alert System')
    `);

    // 2. Insert new bot rules with correct priority
    // Priority: Higher = More specific (single minute > narrow range > wide range)
    logger.info('[BotRules] Inserting new bot rules...');

    // CODE: 35 - Single minute (15), highest priority
    await client.query(`
      INSERT INTO ai_bot_rules (
        bot_display_name, minute_from, minute_to, priority,
        is_active, prediction_period, base_prediction_type,
        display_template
      ) VALUES (
        'CODE: 35', 15, 15, 100,
        true, 'IY', 'ÜST',
        '⚡ {period} {value} ÜST ({minute}'' dk)'
      )
    `);

    // ALERT D - 10-14 (5 minutes), high priority
    await client.query(`
      INSERT INTO ai_bot_rules (
        bot_display_name, minute_from, minute_to, priority,
        is_active, prediction_period, base_prediction_type,
        display_template
      ) VALUES (
        'ALERT D', 10, 14, 50,
        true, 'IY', 'ÜST',
        '⚡ {period} {value} ÜST ({minute}'' dk)'
      )
    `);

    // Code Zero - 20-24 (5 minutes), high priority
    await client.query(`
      INSERT INTO ai_bot_rules (
        bot_display_name, minute_from, minute_to, priority,
        is_active, prediction_period, base_prediction_type,
        display_template
      ) VALUES (
        'Code Zero', 20, 24, 50,
        true, 'IY', 'ÜST',
        '🎯 {period} {value} ÜST ({minute}'' dk)'
      )
    `);

    // BOT 007 - 65-69 (5 minutes), high priority
    await client.query(`
      INSERT INTO ai_bot_rules (
        bot_display_name, minute_from, minute_to, priority,
        is_active, prediction_period, base_prediction_type,
        display_template
      ) VALUES (
        'BOT 007', 65, 69, 50,
        true, 'MS', 'ÜST',
        '🤖 {period} {value} ÜST ({minute}'' dk)'
      )
    `);

    // Algoritma: 01 - 70-75 (6 minutes), high priority
    await client.query(`
      INSERT INTO ai_bot_rules (
        bot_display_name, minute_from, minute_to, priority,
        is_active, prediction_period, base_prediction_type,
        display_template
      ) VALUES (
        'Algoritma: 01', 70, 75, 50,
        true, 'MS', 'ÜST',
        '🧠 {period} {value} ÜST ({minute}'' dk)'
      )
    `);

    // BOT 007 - Fallback (0-90), lowest priority
    await client.query(`
      INSERT INTO ai_bot_rules (
        bot_display_name, minute_from, minute_to, priority,
        is_active, prediction_period, base_prediction_type,
        display_template
      ) VALUES (
        'BOT 007', 0, 90, 1,
        true, 'AUTO', 'ÜST',
        '🤖 {period} {value} ÜST ({minute}'' dk)'
      )
    `);

    await client.query('COMMIT');
    logger.info('✅ Bot rules updated successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to update bot rules:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Restore old rules
    await client.query(`
      DELETE FROM ai_bot_rules
      WHERE bot_display_name IN ('ALERT D', 'CODE: 35', 'Code Zero', 'Algoritma: 01', 'BOT 007')
    `);

    // Restore original rules
    await client.query(`
      INSERT INTO ai_bot_rules (bot_display_name, minute_from, minute_to, priority) 
      VALUES 
        ('ALERT: D', 1, 15, 10),
        ('70. Dakika Botu', 65, 75, 20),
        ('BOT 007', 0, 90, 1)
      ON CONFLICT DO NOTHING
    `);

    await client.query('COMMIT');
    logger.info('✅ Bot rules reverted');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to revert bot rules:', error);
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
    console.log('Usage: npx tsx update-bot-rules-new-schedule.ts [up|down]');
    process.exit(1);
  }
}

