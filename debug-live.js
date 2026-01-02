const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [k, ...v] = line.split('=');
        if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
    });
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    const client = await pool.connect();
    try {
        console.log('Checking types...');
        const types = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ts_matches' 
      AND column_name IN ('external_id', 'status_id', 'home_score_display')
    `);
        console.log(types.rows);

        const matchId = '318q66hx664vqo9';
        console.log(`Trying update for ${matchId}...`);

        // Explicit casting test
        await client.query(`
      UPDATE ts_matches SET
        status_id = $1,
        updated_at = NOW()
      WHERE external_id = $2
    `, [1, matchId]);

        console.log('Update success!');

    } catch (error) {
        console.error('Update failed:', error.message);
    } finally {
        client.release();
        pool.end();
    }
})();
