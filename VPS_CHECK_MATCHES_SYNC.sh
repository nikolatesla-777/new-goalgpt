#!/bin/bash

# GoalGPT Backend - Check Matches Sync Status

PM2_APP_NAME="goalgpt-backend"

echo "🔍 Matches Sync Durumu Kontrolü..."
echo ""

# 1. Database matches count
echo "📊 Database Matches Count:"
cd /var/www/goalgpt
node -e "
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function checkMatches() {
  try {
    const result = await pool.query('SELECT COUNT(*) as c FROM ts_matches');
    console.log('ts_matches:', result.rows[0].c);
    
    // Check today's matches
    const todayResult = await pool.query(\"SELECT COUNT(*) as c FROM ts_matches WHERE DATE(match_time) = CURRENT_DATE\");
    console.log('Today matches:', todayResult.rows[0].c);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkMatches();
"
echo ""

# 2. Bootstrap matches sync logları
echo "📋 Bootstrap Matches Sync Logları:"
pm2 logs "$PM2_APP_NAME" --lines 500 --nostream | grep -iE "today.*schedule|match.*diary|syncing.*matches|matches.*synced" | tail -n 20
echo ""

# 3. API matches/recent test
echo "📋 API Matches Recent Test:"
curl -s http://localhost:3000/api/matches/recent | head -c 200
echo ""
echo ""

# 4. Son 50 log satırı
echo "📋 Son 50 Log Satırı:"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream | tail -n 30
echo ""

echo "✅ Check tamamlandı!"

