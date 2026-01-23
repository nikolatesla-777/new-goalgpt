"use strict";
/**
 * Migration: Configure IY Bot Rules with specific minute ranges
 *
 * Requested Rules:
 * 1. ALERT: D   -> Min 10-14 (IY ÜST)
 * 2. CODE: 35   -> Min 15-19 (IY ÜST)
 * 3. Code Zero  -> Min 20    (IY ÜST)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const connection_1 = require("../connection");
const crypto_1 = require("crypto");
async function up() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // 1. ALERT: D (Update existing or insert)
        await client.query(`DELETE FROM ai_bot_rules WHERE bot_display_name = 'ALERT: D'`);
        await client.query(`
      INSERT INTO ai_bot_rules 
      (bot_group_id, bot_display_name, minute_from, minute_to, priority, is_active, display_template, prediction_period, base_prediction_type)
      VALUES 
      ($1, 'ALERT: D', 10, 14, 100, true, '⚡ {period} {value} ÜST ({minute}'' dk)', 'IY', 'ÜST')
    `, [(0, crypto_1.randomUUID)()]);
        console.log('✅ Configured ALERT: D (10-14)');
        // 2. CODE: 35
        await client.query(`DELETE FROM ai_bot_rules WHERE bot_display_name = 'CODE: 35'`);
        await client.query(`
      INSERT INTO ai_bot_rules 
      (bot_group_id, bot_display_name, minute_from, minute_to, priority, is_active, display_template, prediction_period, base_prediction_type)
      VALUES 
      ($1, 'CODE: 35', 15, 19, 100, true, '🤖 CODE:35 {period} {value} ÜST ({minute}'' dk)', 'IY', 'ÜST')
    `, [(0, crypto_1.randomUUID)()]);
        console.log('✅ Configured CODE: 35 (15-19)');
        // 3. Code Zero
        await client.query(`DELETE FROM ai_bot_rules WHERE bot_display_name = 'Code Zero'`);
        await client.query(`
      INSERT INTO ai_bot_rules 
      (bot_group_id, bot_display_name, minute_from, minute_to, priority, is_active, display_template, prediction_period, base_prediction_type)
      VALUES 
      ($1, 'Code Zero', 20, 20, 100, true, '🎱 Code Zero {period} {value} ÜST ({minute}'' dk)', 'IY', 'ÜST')
    `, [(0, crypto_1.randomUUID)()]);
        console.log('✅ Configured Code Zero (20)');
        await client.query('COMMIT');
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
    // No down needed really, this is configuration data
    console.log('No rollback for bot configuration');
}
// CLI runner
if (require.main === module) {
    const action = process.argv[2];
    if (action === 'up') {
        up().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    }
    else {
        console.log('Usage: npx tsx update-iy-bot-rules.ts up');
        process.exit(1);
    }
}
