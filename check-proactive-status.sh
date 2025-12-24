#!/bin/bash
cd /var/www/goalgpt

echo "=== ProactiveCheck Worker Status ==="
pm2 logs goalgpt-backend --lines 200 | grep -i "ProactiveCheck.*Worker started\|ProactiveCheck.*Found.*matches\|ProactiveCheck.*suspicious\|ProactiveCheck.*Completed" | tail -20

echo ""
echo "=== Checking if worker finds END matches ==="
# Check last 5 minutes of logs
pm2 logs goalgpt-backend --lines 500 | grep -i "ProactiveCheck" | tail -30

echo ""
echo "=== Database Query Test (matches that ProactiveCheck should find) ==="
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
    const nowTs = Math.floor(Date.now() / 1000);
    const TSI_OFFSET_SECONDS = 3 * 3600;
    const nowDate = new Date(nowTs * 1000);
    const year = nowDate.getUTCFullYear();
    const month = nowDate.getUTCMonth();
    const day = nowDate.getUTCDate();
    const todayStartTSI = Math.floor((Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000) / 1000);
    const todayEndTSI = todayStartTSI + 86400;
    const minTimeForEnd = nowTs - (150 * 60);
    
    const query = \`
      SELECT 
        external_id,
        match_time,
        status_id,
        EXTRACT(EPOCH FROM NOW()) - match_time as seconds_ago
      FROM ts_matches
      WHERE match_time >= \$1
        AND match_time < \$2
        AND (
          (status_id = 1 AND match_time <= \$3)
          OR
          (status_id = 8 AND match_time >= \$4)
        )
      ORDER BY match_time ASC
      LIMIT 10
    \`;
    
    const result = await client.query(query, [todayStartTSI, todayEndTSI, nowTs, minTimeForEnd]);
    console.log(\`Found \${result.rows.length} matches that ProactiveCheck should process:\`);
    result.rows.forEach(m => {
      console.log(\`  - \${m.external_id}: status=\${m.status_id}, \${Math.floor(m.seconds_ago/60)} minutes ago\`);
    });
  } finally {
    client.release();
    await pool.end();
  }
})();
"
