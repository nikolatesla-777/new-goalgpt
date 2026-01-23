"use strict";
/**
 * Migration: Add first_half_stats column to ts_matches
 *
 * This column stores the stats snapshot at halftime
 * Used to calculate 2nd half stats: (current_total - first_half_stats)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(pool) {
    const client = await pool.connect();
    try {
        // Check if column already exists
        const checkResult = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'ts_matches' 
            AND column_name = 'first_half_stats'
        `);
        if (checkResult.rows.length === 0) {
            await client.query(`
                ALTER TABLE ts_matches 
                ADD COLUMN first_half_stats JSONB DEFAULT NULL
            `);
            console.log('✅ Added first_half_stats column to ts_matches');
        }
        else {
            console.log('⏭️ first_half_stats column already exists, skipping');
        }
        // Also add trend_data column if it doesn't exist
        const checkTrendData = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'ts_matches' 
            AND column_name = 'trend_data'
        `);
        if (checkTrendData.rows.length === 0) {
            await client.query(`
                ALTER TABLE ts_matches 
                ADD COLUMN trend_data JSONB DEFAULT NULL
            `);
            console.log('✅ Added trend_data column to ts_matches');
        }
        else {
            console.log('⏭️ trend_data column already exists, skipping');
        }
    }
    finally {
        client.release();
    }
}
async function down(pool) {
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE ts_matches 
            DROP COLUMN IF EXISTS first_half_stats
        `);
        await client.query(`
            ALTER TABLE ts_matches 
            DROP COLUMN IF EXISTS trend_data
        `);
        console.log('✅ Dropped first_half_stats and trend_data columns from ts_matches');
    }
    finally {
        client.release();
    }
}
