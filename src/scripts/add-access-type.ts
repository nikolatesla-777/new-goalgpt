
import { pool } from '../database/connection';

async function migrate() {
    try {
        console.log('Adding access_type to ai_predictions...');
        await pool.query(`
            ALTER TABLE ai_predictions 
            ADD COLUMN IF NOT EXISTS access_type VARCHAR(10) DEFAULT 'VIP';
        `);
        console.log('Done.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrate();
