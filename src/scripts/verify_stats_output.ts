
import { pool } from '../database/connection';
import { aiPredictionService } from '../services/ai/aiPrediction.service';
import dotenv from 'dotenv';
import path from 'path';

// Load env
const envPath = '/var/www/goalgpt/.env';
dotenv.config({ path: envPath });

// Fallback logic for connection (Hardcoded if needed)
if (!process.env.DATABASE_URL) {
    // Explicitly set for this test script if env fails
    process.env.DATABASE_URL = 'postgres://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';
}

async function verify() {
    try {
        console.log('--- VERIFYING STATS CALCULATION ---');
        const stats = await aiPredictionService.getBotPerformanceStats();
        console.log(JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end(); // Close connection
    }
}

verify();
