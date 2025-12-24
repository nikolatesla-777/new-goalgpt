#!/bin/bash

# GoalGPT Backend - Bootstrap Fix Script
# Competitions sync edilmemiş, bootstrap matches sync'e geçemiyor

PM2_APP_NAME="goalgpt-backend"

echo "🔧 Bootstrap Fix Başlıyor..."
echo ""

# Sorun: ts_competitions: 0
# Bootstrap matches sync'e geçemiyor çünkü competitions yok
# Competitions sync'i manuel başlat

echo "📋 Sorun:"
echo "  - ts_competitions: 0 (competitions sync edilmemiş)"
echo "  - Bootstrap matches sync'e geçemiyor"
echo "  - Match diary tarih: 20251225 (yarın, yanlış!)"
echo ""

# 1. PM2 Logs - competitions sync durumu
echo "📋 Competitions Sync Durumu:"
pm2 logs "$PM2_APP_NAME" --lines 1000 --nostream | grep -iE "competition|competitions.*sync|sync.*competitions" | tail -n 20
echo ""

# 2. Bootstrap başlangıç logları (tam)
echo "📋 Bootstrap Başlangıç Logları (Tam):"
pm2 logs "$PM2_APP_NAME" --lines 2000 --nostream | grep -iE "starting.*bootstrap|bootstrap.*sequence|database.*empty|running.*initial.*sync" | head -n 10
echo ""

# 3. Database'de competitions kontrolü
echo "📊 Database Competitions Kontrolü:"
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

async function checkCompetitions() {
  try {
    const result = await pool.query("SELECT COUNT(*) as c FROM ts_competitions");
    console.log("ts_competitions:", result.rows[0].c);
    
    if (result.rows[0].c === "0") {
      console.log("");
      console.log("❌ Competitions sync edilmemiş!");
      console.log("   Bootstrap matches sync'e geçemiyor.");
      console.log("");
      console.log("💡 Çözüm: PM2 restart yap veya competitions sync worker'ı manuel başlat");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkCompetitions();
'
echo ""

# 4. PM2 restart önerisi
echo "💡 Öneri:"
echo "  PM2 restart yaparak bootstrap'ı tekrar başlat:"
echo "  pm2 restart goalgpt-backend --update-env"
echo ""

echo "✅ Bootstrap fix check tamamlandı!"

