#!/bin/bash
# Quick check - no Node.js, just direct DB query if possible, or simpler approach

cd /var/www/goalgpt || exit 1

echo "🔍 Quick check: Cameroon match status..."
echo ""

# Try direct psql if available
if command -v psql &> /dev/null; then
  export PGPASSWORD=$(grep DB_PASSWORD .env | cut -d '=' -f2)
  psql -h $(grep DB_HOST .env | cut -d '=' -f2) \
       -U $(grep DB_USER .env | cut -d '=' -f2) \
       -d $(grep DB_NAME .env | cut -d '=' -f2) \
       -p $(grep DB_PORT .env | cut -d '=' -f2) \
       -c "SELECT m.external_id, m.status_id, ht.name as home, at.name as away, m.minute FROM ts_matches m LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id LEFT JOIN ts_teams at ON m.away_team_id = at.external_id WHERE (ht.name ILIKE '%cameroon%' OR at.name ILIKE '%cameroon%' OR ht.name ILIKE '%gabon%' OR at.name ILIKE '%gabon%') AND m.match_time >= EXTRACT(EPOCH FROM NOW()) - 7200 ORDER BY m.match_time DESC LIMIT 1;" 2>/dev/null
else
  echo "⚠️ psql not available, using Node.js..."
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
        SELECT m.external_id, m.status_id, ht.name as home, at.name as away, m.minute
        FROM ts_matches m
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        WHERE (ht.name ILIKE '%cameroon%' OR at.name ILIKE '%cameroon%' OR ht.name ILIKE '%gabon%' OR at.name ILIKE '%gabon%')
        AND m.match_time >= EXTRACT(EPOCH FROM NOW()) - 7200
        ORDER BY m.match_time DESC LIMIT 1
      \`);
      if (result.rows.length > 0) {
        const m = result.rows[0];
        console.log(\`Match: \${m.home} vs \${m.away}\`);
        console.log(\`Status: \${m.status_id} (\${m.status_id === 2 ? 'FIRST_HALF' : m.status_id === 3 ? 'HALF_TIME ✅' : m.status_id === 4 ? 'SECOND_HALF' : 'OTHER'})\`);
        console.log(\`Minute: \${m.minute || 'NULL'}\`);
        console.log(\`ID: \${m.external_id}\`);
      } else {
        console.log('No match found');
      }
    } finally {
      client.release();
      await pool.end();
    }
  })();
  "
fi

echo ""
echo "✅ Quick check complete"
