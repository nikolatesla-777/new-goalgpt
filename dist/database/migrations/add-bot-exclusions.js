"use strict";
/**
 * Migration: Add exclusion columns to ai_bot_rules
 *
 * Adds:
 * - excluded_countries: Array of country IDs to exclude
 * - excluded_competitions: Array of competition IDs to exclude
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
const connection_1 = require("../connection");
async function migrate() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        console.log('=== ADDING EXCLUSION COLUMNS TO ai_bot_rules ===');
        // Add excluded_countries column
        await client.query(`
      ALTER TABLE ai_bot_rules
      ADD COLUMN IF NOT EXISTS excluded_countries TEXT[] DEFAULT '{}'
    `);
        console.log('✓ excluded_countries column added');
        // Add excluded_competitions column
        await client.query(`
      ALTER TABLE ai_bot_rules
      ADD COLUMN IF NOT EXISTS excluded_competitions TEXT[] DEFAULT '{}'
    `);
        console.log('✓ excluded_competitions column added');
        // Verify columns
        const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_bot_rules'
      ORDER BY ordinal_position
    `);
        console.log('\n=== ai_bot_rules TABLE STRUCTURE ===');
        result.rows.forEach((r) => {
            console.log(`- ${r.column_name}: ${r.data_type}`);
        });
        await client.query('COMMIT');
        console.log('\n✅ Migration completed successfully!');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    }
    finally {
        client.release();
        await connection_1.pool.end();
    }
}
migrate().catch(console.error);
