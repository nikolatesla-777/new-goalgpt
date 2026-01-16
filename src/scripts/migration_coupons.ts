
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration for Coupons System...');

        await client.query('BEGIN');

        // 1. Create ai_coupons table
        console.log('Creating ai_coupons table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS ai_coupons (
                id UUID PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                total_rate DECIMAL(10, 2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pending',
                access_type VARCHAR(50) DEFAULT 'VIP',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // 2. Add coupon_id to ai_predictions
        console.log('Adding coupon_id to ai_predictions...');
        await client.query(`
            ALTER TABLE ai_predictions 
            ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES ai_coupons(id) ON DELETE SET NULL;
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
