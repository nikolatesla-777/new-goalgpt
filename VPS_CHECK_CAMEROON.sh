#!/bin/bash
# VPS'te çalıştır: bash VPS_CHECK_CAMEROON.sh

cd /var/www/goalgpt || exit 1

echo "🔍 Step 1: Find Cameroon match in database..."
echo ""

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
        m.external_id,
        m.status_id,
        m.match_time,
        m.first_half_kickoff_ts,
        m.second_half_kickoff_ts,
        m.minute,
        m.home_score_display,
        m.away_score_display,
        m.provider_update_time,
        m.updated_at,
        ht.name as home_team,
        at.name as away_team
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      WHERE (
        ht.name ILIKE '%cameroon%' OR at.name ILIKE '%cameroon%'
        OR ht.name ILIKE '%gabon%' OR at.name ILIKE '%gabon%'
      )
      AND m.match_time >= EXTRACT(EPOCH FROM NOW()) - 7200
      ORDER BY m.match_time DESC
      LIMIT 3
    \`);
    
    console.log('Found', result.rows.length, 'matches:');
    result.rows.forEach(m => {
      console.log(\`\n  Match: \${m.home_team} vs \${m.away_team}\`);
      console.log(\`    ID: \${m.external_id}\`);
      console.log(\`    Status: \${m.status_id} (\${m.status_id === 2 ? 'FIRST_HALF' : m.status_id === 3 ? 'HALF_TIME' : m.status_id === 4 ? 'SECOND_HALF' : 'OTHER'})\`);
      console.log(\`    Score: \${m.home_score_display || 0}-\${m.away_score_display || 0}\`);
      console.log(\`    Minute: \${m.minute || 'NULL'}\`);
      console.log(\`    Updated: \${new Date(m.updated_at).toLocaleString('tr-TR')}\`);
      console.log(\`    Provider update time: \${m.provider_update_time ? new Date(m.provider_update_time * 1000).toLocaleString('tr-TR') : 'NULL'}\`);
    });
  } finally {
    client.release();
    await pool.end();
  }
})();
"

echo ""
echo "🔍 Step 2: Check recent reconcile logs..."
echo ""

pm2 logs goalgpt-backend --lines 200 --nostream | grep -i "cameroon\|gabon\|reconcile.*done\|status.*3\|HALF_TIME" | tail -30

echo ""
echo "✅ Check complete. Run the provider check script next."
