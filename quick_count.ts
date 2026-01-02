
import { pool } from './src/database/connection';
import * as dotenv from 'dotenv';
dotenv.config();

async function countLive() {
    const res = await pool.query("SELECT COUNT(*) FROM ts_matches WHERE status_id IN (2, 3, 4, 5, 7, 9, 10, 13)");
    console.log(`Live Count: ${res.rows[0].count}`);
    process.exit(0);
}

countLive();
