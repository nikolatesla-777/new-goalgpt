#!/bin/bash

# GoalGPT Backend - Diagnostic Script
# API endpoint sorunlarını ve bootstrap durumunu kontrol eder

PM2_APP_NAME="goalgpt-backend"
API_BASE_URL="http://localhost:3000"

echo "🔍 Diagnostic Check Başlıyor..."
echo ""

# 1. PM2 Status
echo "📊 PM2 Status:"
pm2 status
echo ""

# 2. PM2 Process Info
echo "📋 PM2 Process Info:"
pm2 describe "$PM2_APP_NAME" | head -n 20
echo ""

# 3. Server Port Check
echo "🔌 Port 3000 Check:"
netstat -tlnp | grep :3000 || ss -tlnp | grep :3000 || echo "Port 3000 dinlenmiyor!"
echo ""

# 4. PM2 Logs (son 30 satır - hata kontrolü)
echo "📋 PM2 Logs (son 30 satır - hata kontrolü):"
pm2 logs "$PM2_APP_NAME" --lines 30 --nostream | tail -n 30
echo ""

# 5. API Health Check (timeout ile)
echo "🏥 API Health Check (5s timeout):"
timeout 5 curl -s "$API_BASE_URL/health" || echo "❌ Timeout veya connection hatası"
echo ""
echo ""

# 6. Bootstrap durumu (detaylı)
echo "📋 Bootstrap Durumu:"
pm2 logs "$PM2_APP_NAME" --lines 500 --nostream | grep -iE "bootstrap|sync.*complete|today.*schedule|matches.*sync" | tail -n 20
echo ""

# 7. Error log kontrolü
echo "❌ Error Log Kontrolü:"
pm2 logs "$PM2_APP_NAME" --err --lines 50 --nostream | tail -n 20
echo ""

# 8. Database connection test
echo "🔌 Database Connection Test:"
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

pool.query("SELECT COUNT(*) as c FROM ts_matches")
  .then(r => {
    console.log("ts_matches:", r.rows[0].c);
    process.exit(0);
  })
  .catch(e => {
    console.error("DB Error:", e.message);
    process.exit(1);
  });
'
echo ""

echo "✅ Diagnostic check tamamlandı!"

