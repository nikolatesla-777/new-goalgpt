"use strict";
/**
 * Migration: Add uid and is_duplicate columns to Competition, Team, Player, Coach tables
 *
 * Handles duplicate data via uid field:
 * - uid is empty/null: Master record (active data)
 * - uid has value: Duplicate record merged into the uid value
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUidColumnsToEntities = addUidColumnsToEntities;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function addUidColumnsToEntities() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Add uid and is_duplicate columns to ts_competitions
        await client.query(`
      ALTER TABLE ts_competitions
      ADD COLUMN IF NOT EXISTS uid VARCHAR(255),
      ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false
    `);
        // Add uid and is_duplicate columns to ts_teams
        await client.query(`
      ALTER TABLE ts_teams
      ADD COLUMN IF NOT EXISTS uid VARCHAR(255),
      ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false
    `);
        // Add uid and is_duplicate columns to ts_players
        await client.query(`
      ALTER TABLE ts_players
      ADD COLUMN IF NOT EXISTS uid VARCHAR(255),
      ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false
    `);
        // Add uid and is_duplicate columns to ts_coaches
        await client.query(`
      ALTER TABLE ts_coaches
      ADD COLUMN IF NOT EXISTS uid VARCHAR(255),
      ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false
    `);
        // Create indexes on uid for fast lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_competitions_uid ON ts_competitions(uid)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_teams_uid ON ts_teams(uid)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_players_uid ON ts_players(uid)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_coaches_uid ON ts_coaches(uid)
    `);
        // Create indexes on is_duplicate for filtering
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_competitions_is_duplicate ON ts_competitions(is_duplicate)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_teams_is_duplicate ON ts_teams(is_duplicate)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_players_is_duplicate ON ts_players(is_duplicate)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_coaches_is_duplicate ON ts_coaches(is_duplicate)
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ uid and is_duplicate columns added to all entities successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to add uid columns:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if executed directly
if (require.main === module) {
    addUidColumnsToEntities()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
