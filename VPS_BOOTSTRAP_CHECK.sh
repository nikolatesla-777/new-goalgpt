#!/bin/bash

# GoalGPT Backend - Bootstrap Status Check
# Bootstrap durumunu ve matches endpoint'ini kontrol et

PM2_APP_NAME="goalgpt-backend"
API_BASE_URL="http://localhost:3000"

echo "🔍 Bootstrap Status Check Başlıyor..."
echo ""

# 1. Bootstrap logları
echo "📋 Bootstrap Logları (son 50 satır):"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream | grep -E "bootstrap|Bootstrap|sync|Sync|complete|Complete|✅|❌|error|Error" | tail -n 20
echo ""

# 2. Database'de match sayısı kontrol
echo "📊 Database Match Count Check:"
cd /var/www/goalgpt
node -e '
const { Pool } = require("pg");
require("dotenv").config();

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
    // Total matches
    const totalResult = await pool.query("SELECT COUNT(*) as count FROM matches");
    console.log("Total matches:", totalResult.rows[0].count);
    
    // Today matches
    const todayResult = await pool.query("SELECT COUNT(*) as count FROM matches WHERE DATE(match_time) = CURRENT_DATE");
    console.log("Today matches:", todayResult.rows[0].count);
    
    // Live matches (status_id IN (2,3,4,5,7))
    const liveResult = await pool.query("SELECT COUNT(*) as count FROM matches WHERE status_id IN (2,3,4,5,7)");
    console.log("Live matches:", liveResult.rows[0].count);
    
    // Recent matches (last 24 hours)
    const recentResult = await pool.query("SELECT COUNT(*) as count FROM matches WHERE match_time >= NOW() - INTERVAL '\''24 hours'\''");
    console.log("Recent matches (24h):", recentResult.rows[0].count);
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkMatches();
'
echo ""

# 3. API Matches Recent (detailed)
echo "⚽ API Matches Recent (Detailed):"
RESPONSE=$(curl -s "$API_BASE_URL/api/matches/recent")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# 4. PM2 Status
echo "📊 PM2 Status:"
pm2 status | grep "$PM2_APP_NAME"
echo ""

echo "✅ Bootstrap check tamamlandı!"


