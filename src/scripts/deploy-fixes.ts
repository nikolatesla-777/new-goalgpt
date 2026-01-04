
import { pool } from '../database/connection';

async function deployFixes() {
    try {
        console.log('Starting deployment fixes...');

        // 1. Add access_type column
        try {
            console.log('Adding access_type column...');
            await pool.query(`
                ALTER TABLE ai_predictions 
                ADD COLUMN IF NOT EXISTS access_type VARCHAR(10) DEFAULT 'VIP';
            `);
            console.log('access_type column ensured.');
        } catch (e) {
            console.error('Error adding access_type:', e);
        }

        // 2. Insert Alert System bot rule
        try {
            console.log('Inserting Alert System bot rule...');
            // Check if exists first to avoid duplicates if gen_random_uuid changes ID
            const check = await pool.query("SELECT id FROM ai_bot_rules WHERE bot_display_name = 'Alert System'");
            if (check.rows.length === 0) {
                await pool.query(`
                    INSERT INTO ai_bot_rules (
                        id, bot_group_id, bot_display_name, minute_from, minute_to, 
                        priority, is_active, prediction_period, base_prediction_type
                    ) VALUES (
                        gen_random_uuid(), gen_random_uuid(), 'Alert System', 
                        0, 99, 999, true, 'AUTO', 'ÜST'
                    );
                `);
                console.log('Alert System bot rule inserted.');
            } else {
                console.log('Alert System bot rule already exists.');
            }
        } catch (e: any) {
            console.error('Error inserting bot rule:', e);
            // Fallback for UUID generation if gen_random_uuid not available
            if (e.message?.includes('gen_random_uuid')) {
                console.log('Retrying with crypto UUID...');
                const crypto = require('crypto');
                await pool.query(`
                    INSERT INTO ai_bot_rules (
                        id, bot_group_id, bot_display_name, minute_from, minute_to, 
                        priority, is_active, prediction_period, base_prediction_type
                    ) VALUES (
                        $1, $2, 'Alert System', 
                        0, 99, 999, true, 'AUTO', 'ÜST'
                    );
                `, [crypto.randomUUID(), crypto.randomUUID()]);
                console.log('Alert System bot rule inserted (fallback).');
            }
        }

        console.log('Deployment fixes completed.');
        process.exit(0);
    } catch (e) {
        console.error('Fatal error:', e);
        process.exit(1);
    }
}

deployFixes();
