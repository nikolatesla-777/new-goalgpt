
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function check() {
    try {
        // Query mirroring UnifiedPredictionService logic
        const res = await pool.query(`
            SELECT 
                p.id, p.bot_name, p.match_id, p.result, m.status_id,
                CASE 
                    WHEN m.status_id = 8 THEN COALESCE(m.home_score_regular, 0)
                    ELSE m.home_score_display
                END as home_score_display,
                CASE 
                    WHEN m.status_id = 8 THEN COALESCE(m.away_score_regular, 0)
                    ELSE m.away_score_display
                END as away_score_display,
                m.home_score_regular, m.away_score_regular
            FROM ai_predictions p
            LEFT JOIN ts_matches m ON p.match_id = m.external_id
            WHERE p.result IN ('won', 'lost')
            ORDER BY p.created_at DESC
            LIMIT 15
        `);

        console.table(res.rows.map(r => ({
            bot: r.bot_name,
            status: r.status_id,
            final_display: `${r.home_score_display}-${r.away_score_display}`,
            regular_raw: `${r.home_score_regular}-${r.away_score_regular}`
        })));

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

check();
