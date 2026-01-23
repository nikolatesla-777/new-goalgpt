"use strict";
/**
 * Migration: Add display_prediction column to ai_predictions
 *
 * This column stores admin-defined text shown to users,
 * separate from the parsed prediction_type and prediction_value
 * which are used internally for result calculation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const connection_1 = require("../connection");
async function up() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Add display_prediction column for user-facing text
        await client.query(`
      ALTER TABLE ai_predictions 
      ADD COLUMN IF NOT EXISTS display_prediction VARCHAR(500) DEFAULT NULL;
    `);
        // Add index for filtering predictions with/without display text
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_has_display 
      ON ai_predictions((display_prediction IS NOT NULL));
    `);
        await client.query('COMMIT');
        console.log('✅ Added display_prediction column to ai_predictions');
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
      DROP INDEX IF EXISTS idx_ai_predictions_has_display;
    `);
        await client.query(`
      ALTER TABLE ai_predictions 
      DROP COLUMN IF EXISTS display_prediction;
    `);
        await client.query('COMMIT');
        console.log('✅ Removed display_prediction column from ai_predictions');
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
        console.log('Usage: npx tsx add-display-prediction.ts [up|down]');
        process.exit(1);
    }
}
