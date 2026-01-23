"use strict";
/**
 * Create ts_venues Table Migration
 *
 * Creates the ts_venues table for storing venue/stadium data from TheSports API
 * Critical for "Home Advantage" analysis and future Weather integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTsVenuesTable = createTsVenuesTable;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function createTsVenuesTable() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Create ts_venues table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_venues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        city VARCHAR(255),
        capacity INTEGER,
        country_id VARCHAR(255),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
        // Add missing columns if table already exists
        await client.query(`
      ALTER TABLE ts_venues
      ADD COLUMN IF NOT EXISTS country_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS city VARCHAR(255),
      ADD COLUMN IF NOT EXISTS capacity INTEGER
    `);
        // Create indexes for fast lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_venues_external_id ON ts_venues(external_id)
    `);
        // Index for country lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_venues_country_id ON ts_venues(country_id)
    `);
        // Index for name searches
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_venues_name ON ts_venues(name)
    `);
        // Index for city searches
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_venues_city ON ts_venues(city)
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ ts_venues table created successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to create ts_venues table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if executed directly
if (require.main === module) {
    createTsVenuesTable()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
