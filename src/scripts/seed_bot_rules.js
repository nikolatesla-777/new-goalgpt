
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'goalgpt',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
};

const pool = new Pool(config);

const RULES = [
    {
        bot_group_id: 'manual',
        bot_display_name: 'Alert System',
        minute_from: null,
        minute_to: null,
        prediction_type_pattern: 'Manuel',
        priority: 100
    },
    {
        bot_group_id: 'alert-d',
        bot_display_name: 'Alert D',
        minute_from: 1,
        minute_to: 15,
        prediction_type_pattern: null,
        priority: 90
    },
    {
        bot_group_id: 'bot-007',
        bot_display_name: 'BOT 007',
        minute_from: null,
        minute_to: null,
        prediction_type_pattern: null,
        priority: 85
    },
    {
        bot_group_id: 'algo-01',
        bot_display_name: 'Algoritma 01',
        minute_from: 0,
        minute_to: 90,
        prediction_type_pattern: null,
        priority: 80
    },
    {
        bot_group_id: 'code-35',
        bot_display_name: 'Code 35',
        minute_from: 35,
        minute_to: 45,
        prediction_type_pattern: null,
        priority: 70
    },
    {
        bot_group_id: 'code-zero',
        bot_display_name: 'Code Zero',
        minute_from: 0,
        minute_to: 90,
        prediction_type_pattern: null,
        priority: 60
    }
];

async function run() {
    try {
        console.log('--- SEEDING BOT RULES ---');

        // Check column type for bot_group_id just in case
        const colType = await pool.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ai_bot_rules' AND column_name = 'bot_group_id'
    `);

        const isGroupUuid = colType.rows[0]?.data_type === 'uuid';
        console.log(`bot_group_id type: ${colType.rows[0]?.data_type}`);

        await pool.query('TRUNCATE TABLE ai_bot_rules');
        console.log('Truncated rules.');

        for (const rule of RULES) {
            const id = crypto.randomUUID();
            // If group id needs to be UUID and we have string, we might issue.
            // But let's assume it's VARCHAR based on usage. 
            // If it returns 'uuid' above, we generate a UUID for group too (which defeats the purpose of named groups but satisfies FK constraints if any).

            let groupId = rule.bot_group_id;
            if (isGroupUuid) {
                groupId = crypto.randomUUID(); // Fallback if schema requires UUID
                console.log(`Generating UUID for group ${rule.bot_group_id}: ${groupId}`);
            }

            await pool.query(`
            INSERT INTO ai_bot_rules (
                id, bot_group_id, bot_display_name, minute_from, minute_to, 
                prediction_type_pattern, priority, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
                id, groupId, rule.bot_display_name,
                rule.minute_from, rule.minute_to, rule.prediction_type_pattern,
                rule.priority, true
            ]);
            console.log(`Inserted: ${rule.bot_display_name}`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

run();
