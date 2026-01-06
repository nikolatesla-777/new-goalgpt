
import { pool } from '../database/connection';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

const envPath = '/var/www/goalgpt/.env';
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';
}

const SEED_BOTS = [
    {
        bot_display_name: 'Alert System',
        bot_group_id: null,
        minute_from: null,
        minute_to: null,
        prediction_type_pattern: 'Manuel',
        priority: 100
    },
    {
        bot_display_name: 'Alert D',
        bot_group_id: null,
        minute_from: 1,
        minute_to: 15,
        prediction_type_pattern: null,
        priority: 90
    },
    {
        bot_display_name: 'Algoritma 01',
        bot_group_id: null,
        minute_from: 0,
        minute_to: 90,
        prediction_type_pattern: null,
        priority: 80
    },
    {
        bot_display_name: 'Code 35',
        bot_group_id: null,
        minute_from: 35,
        minute_to: 45,
        prediction_type_pattern: null,
        priority: 70
    },
    {
        bot_display_name: 'Code Zero',
        bot_group_id: null,
        minute_from: 0,
        minute_to: 90,
        prediction_type_pattern: null,
        priority: 60
    },
    {
        bot_display_name: 'BOT 007',
        bot_group_id: null,
        minute_from: 0,
        minute_to: 90,
        prediction_type_pattern: null,
        priority: 50
    },
    {
        bot_display_name: '70. Dakika Botu',
        bot_group_id: null,
        minute_from: 70,
        minute_to: 90,
        prediction_type_pattern: null,
        priority: 40
    }
];

async function cleanupAndSeed() {
    try {
        console.log('--- CLEANING UP BOT RULES ---');

        // 1. Delete all existing rules
        await pool.query('DELETE FROM ai_bot_rules');
        console.log('✓ Deleted all existing rules');

        // 2. Insert clean rules
        for (const bot of SEED_BOTS) {
            await pool.query(
                `INSERT INTO ai_bot_rules (
                    id, 
                    bot_display_name, 
                    bot_group_id, 
                    minute_from, 
                    minute_to, 
                    prediction_type_pattern, 
                    priority, 
                    is_active, 
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())`,
                [
                    uuidv4(),
                    bot.bot_display_name,
                    bot.bot_group_id,
                    bot.minute_from,
                    bot.minute_to,
                    bot.prediction_type_pattern,
                    bot.priority
                ]
            );
            console.log(`✓ Inserted: ${bot.bot_display_name}`);
        }

        console.log('--- CLEANUP COMPLETE ---');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

cleanupAndSeed();
