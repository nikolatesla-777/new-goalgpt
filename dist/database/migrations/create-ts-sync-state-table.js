"use strict";
/**
 * Migration: Create ts_sync_state table
 *
 * Tracks last sync time for each entity type to enable incremental updates
 * Entity types: competition, team, player, coach, referee, venue, season, stage, category, country
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTsSyncStateTable = createTsSyncStateTable;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function createTsSyncStateTable() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Create ts_sync_state table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_sync_state (
        entity_type VARCHAR(50) PRIMARY KEY,
        last_updated_at BIGINT,
        last_sync_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
        // Create index for fast lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_sync_state_entity_type ON ts_sync_state(entity_type)
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ ts_sync_state table created successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to create ts_sync_state table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if called directly
if (require.main === module) {
    createTsSyncStateTable()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
