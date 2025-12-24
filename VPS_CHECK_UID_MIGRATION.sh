#!/bin/bash

# GoalGPT Backend - Check UID Migration Status

PM2_APP_NAME="goalgpt-backend"

echo "🔍 UID Migration & Bootstrap Kontrolü..."
echo ""

# 1. Database'de uid kolonlarını kontrol et
echo "📊 Database UID Kolonları Kontrolü:"
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

async function checkUidColumns() {
  try {
    // Check ts_competitions
    const compResult = await pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_competitions' AND column_name IN ('uid', 'is_duplicate')\");
    console.log('ts_competitions uid columns:', compResult.rows.length, '/ 2');
    
    // Check ts_teams
    const teamResult = await pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_teams' AND column_name IN ('uid', 'is_duplicate')\");
    console.log('ts_teams uid columns:', teamResult.rows.length, '/ 2');
    
    if (compResult.rows.length < 2 || teamResult.rows.length < 2) {
      console.log('');
      console.log('❌ UID kolonları eksik! Supabase migration çalıştırılmalı.');
      console.log('   SUPABASE_ADD_UID_COLUMNS.sql dosyasını Supabase SQL Editor'de çalıştır.');
    } else {
      console.log('');
      console.log('✅ UID kolonları mevcut.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUidColumns();
"
echo ""

# 2. Bootstrap başlangıç logları
echo "📋 Bootstrap Başlangıç Logları:"
pm2 logs "$PM2_APP_NAME" --lines 200 --nostream | grep -iE "starting.*bootstrap|database.*data|competitions.*missing|syncing.*competitions" | head -n 10
echo ""

# 3. Competitions sync logları
echo "📋 Competitions Sync Logları:"
pm2 logs "$PM2_APP_NAME" --lines 200 --nostream | grep -iE "competitions|competition.*sync|uid.*does.*not.*exist" | tail -n 20
echo ""

# 4. Database competitions count
echo "📊 Database Competitions Count:"
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

async function checkCompetitions() {
  try {
    const result = await pool.query('SELECT COUNT(*) as c FROM ts_competitions');
    console.log('ts_competitions:', result.rows[0].c);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkCompetitions();
"
echo ""

# 5. Son 30 log satırı (genel durum)
echo "📋 Son 30 Log Satırı:"
pm2 logs "$PM2_APP_NAME" --lines 30 --nostream
echo ""

echo "✅ Check tamamlandı!"

