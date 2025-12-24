#!/bin/bash
cd /var/www/goalgpt

echo "=== Recent DetailLive Reconcile Logs for k82rekhgxp2grep ==="
pm2 logs goalgpt-backend --lines 500 | grep -i "k82rekhgxp2grep\|DetailLive.*reconcile\|KickoffTS" | tail -50

echo ""
echo "=== ProactiveCheck Logs ==="
pm2 logs goalgpt-backend --lines 300 | grep -i "ProactiveCheck" | tail -30

echo ""
echo "=== Checking why first_half_kickoff_ts is NULL ==="
node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
(async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(\`
      SELECT 
        external_id,
        status_id,
        match_time,
        first_half_kickoff_ts,
        second_half_kickoff_ts,
        provider_update_time,
        last_event_ts,
        updated_at,
        home_score_display,
        away_score_display,
        minute
      FROM ts_matches
      WHERE external_id = 'k82rekhgxp2grep'
    \`);
    if (result.rows.length > 0) {
      const m = result.rows[0];
      console.log('Status:', m.status_id);
      console.log('Match Time:', new Date(m.match_time * 1000).toISOString());
      console.log('First Half Kickoff:', m.first_half_kickoff_ts ? new Date(m.first_half_kickoff_ts * 1000).toISOString() : 'NULL ⚠️');
      console.log('Provider Update Time:', m.provider_update_time ? new Date(m.provider_update_time * 1000).toISOString() : 'NULL ⚠️');
      console.log('Last Event TS:', m.last_event_ts ? new Date(m.last_event_ts * 1000).toISOString() : 'NULL');
      console.log('Updated At:', m.updated_at ? new Date(m.updated_at).toISOString() : 'NULL');
    }
  } finally {
    client.release();
    await pool.end();
  }
})();
"
