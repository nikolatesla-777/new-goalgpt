"use strict";
/**
 * Migration: Add display_template column to ai_bot_rules
 *
 * This allows each bot rule to have a customizable display text template
 * that gets shown to users. Template supports {minute} placeholder.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const connection_1 = require("../connection");
async function up() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Add display_template column
        await client.query(`
      ALTER TABLE ai_bot_rules 
      ADD COLUMN IF NOT EXISTS display_template VARCHAR(500) DEFAULT NULL;
    `);
        // Update existing rules with default templates
        await client.query(`
      UPDATE ai_bot_rules 
      SET display_template = '⚡ Erken Gol Fırsatı! ({minute}'' dk)'
      WHERE bot_display_name = 'ALERT: D';
    `);
        await client.query(`
      UPDATE ai_bot_rules 
      SET display_template = '🎯 70. Dakika Özel! ({minute}'' dk)'
      WHERE bot_display_name = '70. Dakika Botu';
    `);
        await client.query(`
      UPDATE ai_bot_rules 
      SET display_template = '🤖 AI Tahmini ({minute}'' dk)'
      WHERE bot_display_name = 'BOT 007';
    `);
        await client.query('COMMIT');
        console.log('✅ Added display_template column to ai_bot_rules');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function down() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE ai_bot_rules 
      DROP COLUMN IF EXISTS display_template;
    `);
        await client.query('COMMIT');
        console.log('✅ Removed display_template column from ai_bot_rules');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
// CLI runner
if (require.main === module) {
    const action = process.argv[2];
    if (action === 'up') {
        up().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    }
    else if (action === 'down') {
        down().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    }
    else {
        console.log('Usage: npx tsx add-bot-rule-templates.ts [up|down]');
        process.exit(1);
    }
}
