#!/bin/bash

# GoalGPT Backend - Next Steps After Password Change
# Schema verification ve bootstrap kontrol

PROJECT_DIR="/var/www/goalgpt"
PM2_APP_NAME="goalgpt-backend"

echo "🔍 Schema ve Bootstrap Kontrol Başlıyor..."
echo ""

# 1. Code güncelle
echo "📥 Code güncelleniyor..."
cd "$PROJECT_DIR"
git pull origin main
echo ""

# 2. Schema verification
echo "📋 Schema Verification:"
bash VPS_SCHEMA_VERIFY.sh
echo ""

# 3. PM2 Status
echo "📊 PM2 Status:"
pm2 status
echo ""

# 4. PM2 Logs (bootstrap durumu)
echo "📋 PM2 Logs (son 50 satır - bootstrap durumu):"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream | grep -E "bootstrap|Bootstrap|sync|Sync|complete|Complete|✅|❌|error|Error|database|Database" | tail -n 20
echo ""

# 5. API Health Check
echo "🏥 API Health Check:"
curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health
echo ""
echo ""

# 6. API Readiness Check (database connection)
echo "✅ API Readiness Check (database connection):"
curl -s http://localhost:3000/ready | jq . 2>/dev/null || curl -s http://localhost:3000/ready
echo ""
echo ""

# 7. Database Match Count
echo "📊 Database Match Count:"
cd "$PROJECT_DIR"
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
    if (await pool.query("SELECT 1 FROM ts_matches LIMIT 1").then(() => true).catch(() => false)) {
      const result = await pool.query("SELECT COUNT(*) as count FROM ts_matches");
      console.log("ts_matches kayıt sayısı:", result.rows[0].count);
    } else {
      console.log("ts_matches tablosu yok veya erişilemiyor");
    }
    process.exit(0);
  } catch (error) {
    console.error("Hata:", error.message);
    process.exit(1);
  }
}

checkMatches();
'
echo ""

echo "✅ Kontrol tamamlandı!"

