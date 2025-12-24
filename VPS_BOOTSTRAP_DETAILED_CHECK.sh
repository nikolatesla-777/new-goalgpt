#!/bin/bash

# GoalGPT Backend - Detailed Bootstrap Check
# Bootstrap'ın neden matches sync etmediğini kontrol eder

PM2_APP_NAME="goalgpt-backend"

echo "🔍 Detailed Bootstrap Check Başlıyor..."
echo ""

# 1. Bootstrap başlangıç logları
echo "📋 Bootstrap Başlangıç Logları:"
pm2 logs "$PM2_APP_NAME" --lines 1000 --nostream | grep -iE "bootstrap|starting.*sequence|database.*empty|sync.*categories|sync.*countries|sync.*competitions|sync.*teams|today.*schedule|fetching.*diary" | head -n 30
echo ""

# 2. Bootstrap complete mesajı
echo "📋 Bootstrap Complete Mesajı:"
pm2 logs "$PM2_APP_NAME" --lines 1000 --nostream | grep -iE "bootstrap.*complete|bootstrap.*ready|system.*ready" | tail -n 5
echo ""

# 3. Today's schedule sync durumu
echo "📋 Today's Schedule Sync Durumu:"
pm2 logs "$PM2_APP_NAME" --lines 1000 --nostream | grep -iE "today.*schedule|match.*diary|found.*matches|syncing.*matches|matches.*synced" | tail -n 20
echo ""

# 4. Master data sync durumu
echo "📋 Master Data Sync Durumu:"
pm2 logs "$PM2_APP_NAME" --lines 1000 --nostream | grep -iE "categories.*synced|countries.*synced|competitions.*synced|teams.*synced" | tail -n 10
echo ""

# 5. Error logları (bootstrap ile ilgili)
echo "❌ Bootstrap Error Logları:"
pm2 logs "$PM2_APP_NAME" --err --lines 200 --nostream | grep -iE "bootstrap|sync.*failed|today.*schedule.*failed" | tail -n 10
echo ""

# 6. Database'de master data kontrolü
echo "📊 Database Master Data Kontrolü:"
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

async function checkMasterData() {
  try {
    const [categories, countries, competitions, teams, matches] = await Promise.all([
      pool.query("SELECT COUNT(*) as c FROM ts_categories"),
      pool.query("SELECT COUNT(*) as c FROM ts_countries"),
      pool.query("SELECT COUNT(*) as c FROM ts_competitions"),
      pool.query("SELECT COUNT(*) as c FROM ts_teams"),
      pool.query("SELECT COUNT(*) as c FROM ts_matches")
    ]);
    
    console.log("ts_categories:", categories.rows[0].c);
    console.log("ts_countries:", countries.rows[0].c);
    console.log("ts_competitions:", competitions.rows[0].c);
    console.log("ts_teams:", teams.rows[0].c);
    console.log("ts_matches:", matches.rows[0].c);
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkMasterData();
'
echo ""

# 7. Son 50 log satırı (genel durum)
echo "📋 Son 50 Log Satırı (Genel Durum):"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream | tail -n 50
echo ""

echo "✅ Detailed bootstrap check tamamlandı!"

