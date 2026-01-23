"use strict";
/**
 * Create ts_referees Table Migration
 *
 * Creates the ts_referees table for storing referee/official data from TheSports API
 * Critical for future "Card/Penalty" AI predictions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTsRefereesTable = createTsRefereesTable;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function createTsRefereesTable() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Create ts_referees table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_referees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(100),
        logo VARCHAR(500),
        country_id VARCHAR(255),
        birthday BIGINT,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
        // Add missing columns if table already exists
        await client.query(`
      ALTER TABLE ts_referees
      ADD COLUMN IF NOT EXISTS country_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS birthday BIGINT
    `);
        // Create indexes for fast lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_referees_external_id ON ts_referees(external_id)
    `);
        // Index for country lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_referees_country_id ON ts_referees(country_id)
    `);
        // Index for name searches
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_referees_name ON ts_referees(name)
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ ts_referees table created successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to create ts_referees table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if executed directly
if (require.main === module) {
    createTsRefereesTable()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
