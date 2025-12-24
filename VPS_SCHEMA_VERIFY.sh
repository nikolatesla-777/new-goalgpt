#!/bin/bash

# GoalGPT Backend - Schema Verification Script
# Database'de tabloların var olup olmadığını kontrol eder

PROJECT_DIR="/var/www/goalgpt"

echo "🔍 Schema Verification Başlıyor..."
echo ""

cd "$PROJECT_DIR"

# Database'de tablo listesini kontrol et
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

async function verifySchema() {
  try {
    // Tüm tabloları listele
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log("📋 Database Tabloları:");
    console.log("Toplam tablo sayısı:", tablesResult.rows.length);
    console.log("");
    
    if (tablesResult.rows.length === 0) {
      console.log("❌ Hiç tablo yok! Schema import edilmemiş.");
      process.exit(1);
    }
    
    // Önemli tabloları kontrol et
    const importantTables = [
      "matches",
      "teams", 
      "competitions",
      "categories",
      "countries",
      "ts_matches",
      "ts_teams",
      "ts_competitions"
    ];
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    
    console.log("✅ Mevcut Önemli Tablolar:");
    importantTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log("  ✅", table);
      } else {
        console.log("  ❌", table, "(YOK)");
      }
    });
    
    console.log("");
    console.log("📊 Tüm Tablolar:");
    tablesResult.rows.forEach(row => {
      console.log("  -", row.table_name);
    });
    
    // matches tablosu varsa, sayı kontrol et
    if (existingTables.includes("matches")) {
      const countResult = await pool.query("SELECT COUNT(*) as count FROM matches");
      console.log("");
      console.log("📈 Matches tablosu kayıt sayısı:", countResult.rows[0].count);
    }
    
    if (existingTables.includes("ts_matches")) {
      const countResult = await pool.query("SELECT COUNT(*) as count FROM ts_matches");
      console.log("📈 ts_matches tablosu kayıt sayısı:", countResult.rows[0].count);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Hata:", error.message);
    if (error.message.includes("does not exist")) {
      console.error("");
      console.error("💡 Schema import edilmemiş veya hatalı.");
      console.error("   Supabase SQL Editor'den SUPABASE_SCHEMA.sql dosyasını çalıştır.");
    }
    process.exit(1);
  }
}

verifySchema();
'

echo ""
echo "✅ Schema verification tamamlandı!"

