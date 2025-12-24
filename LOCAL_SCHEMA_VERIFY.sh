#!/bin/bash

# GoalGPT Backend - Local Schema Verification Script
# Bu script local'den Supabase'e bağlanıp schema'yı kontrol eder

echo "🔍 Local Schema Verification Başlıyor..."
echo ""

# Node.js ile schema kontrol
node << 'EOF'
const { Pool } = require("pg");

const pool = new Pool({
  host: "aws-1-eu-central-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.wakbsxzocfpngywyzdml",
  password: "fH1MyVUk0h7a0t14",
  ssl: { rejectUnauthorized: false },
});

async function verifySchema() {
  try {
    console.log("🔍 Supabase'e bağlanılıyor...");
    console.log("Host: aws-1-eu-central-1.pooler.supabase.com");
    console.log("");
    
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
      console.log("");
      console.log("💡 Supabase SQL Editor'den SUPABASE_SCHEMA.sql dosyasını çalıştır.");
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
    let foundImportant = false;
    importantTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log("  ✅", table);
        foundImportant = true;
      } else {
        console.log("  ❌", table, "(YOK)");
      }
    });
    
    if (!foundImportant) {
      console.log("");
      console.log("⚠️  Önemli tablolar bulunamadı!");
      console.log("   Schema import edilmemiş veya farklı isimlerle oluşturulmuş.");
    }
    
    console.log("");
    console.log("📊 Tüm Tablolar (ilk 20):");
    tablesResult.rows.slice(0, 20).forEach(row => {
      console.log("  -", row.table_name);
    });
    
    if (tablesResult.rows.length > 20) {
      console.log("  ... ve", (tablesResult.rows.length - 20), "tablo daha");
    }
    
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
    
    console.log("");
    console.log("✅ Schema verification tamamlandı!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Hata:", error.message);
    if (error.message.includes("does not exist")) {
      console.error("");
      console.error("💡 Schema import edilmemiş veya hatalı.");
      console.error("   Supabase SQL Editor'den SUPABASE_SCHEMA.sql dosyasını çalıştır.");
    } else if (error.message.includes("Tenant or user not found")) {
      console.error("");
      console.error("💡 Connection hatası: User veya password yanlış.");
    }
    process.exit(1);
  }
}

verifySchema();
EOF
