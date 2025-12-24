#!/bin/bash

# GoalGPT Backend - Bootstrap Competitions Sync Check

PM2_APP_NAME="goalgpt-backend"

echo "🔍 Bootstrap Competitions Sync Kontrolü..."
echo ""

# 1. Bootstrap başlangıç logları
echo "📋 Bootstrap Başlangıç Logları:"
pm2 logs "$PM2_APP_NAME" --lines 200 --nostream | grep -iE "starting.*bootstrap|database.*data|competitions.*missing|syncing.*competitions" | head -n 10
echo ""

# 2. Competitions sync logları
echo "📋 Competitions Sync Logları:"
pm2 logs "$PM2_APP_NAME" --lines 200 --nostream | grep -iE "competitions|competition.*sync" | tail -n 20
echo ""

# 3. Database competitions count
echo "📊 Database Competitions Count:"
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
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkCompetitions();
'
echo ""

# 4. Son 30 log satırı (genel durum)
echo "📋 Son 30 Log Satırı:"
pm2 logs "$PM2_APP_NAME" --lines 30 --nostream
echo ""

echo "✅ Check tamamlandı!"
