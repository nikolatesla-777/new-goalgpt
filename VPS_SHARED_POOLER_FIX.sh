#!/bin/bash

# GoalGPT Backend - Shared Pooler (IPv4 Compatible) Fix
# Supabase Dashboard → Connection Pooling → Shared Pooler (IPv4 COMPATIBLE)

PROJECT_DIR="/var/www/goalgpt"
PM2_APP_NAME="goalgpt-backend"

echo "🔧 Shared Pooler (IPv4 Compatible) Connection Fix Başlıyor..."
echo ""

# .env dosyasını yedekle
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "📋 Mevcut .env dosyası yedekleniyor..."
    cp "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Yedek oluşturuldu"
    echo ""
fi

# Shared Pooler (IPv4 Compatible) ile .env güncelle
# Supabase Dashboard → Connection Pooling → Shared Pooler
echo "🔄 Shared Pooler (IPv4 Compatible) ile .env güncelleniyor..."
cat << EOF > "$PROJECT_DIR/.env"
# Database (Supabase - Shared Pooler - IPv4 Compatible)
# Connection String: postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
# ÖNEMLİ: aws-1 (aws-0 değil!) - Shared Pooler için
DB_HOST=aws-1-eu-central-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.wakbsxzocfpngywyzdml
DB_PASSWORD=fH1MyVUk0h7a0t14
DB_MAX_CONNECTIONS=20

# TheSports API
THESPORTS_API_BASE_URL=https://api.thesports.com/v1/football
THESPORTS_API_SECRET=3205e4f6efe04a03f0055152c4aa0f37
THESPORTS_API_USER=goalgpt

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
EOF

echo "✅ .env dosyası güncellendi (Shared Pooler - IPv4 Compatible)"
echo ""
echo "📋 Yeni .env içeriği (DB bilgileri):"
grep -E "^DB_" "$PROJECT_DIR/.env"
echo ""

# Connection test
echo "🧪 Connection test başlıyor..."
cd "$PROJECT_DIR"
node -e '
const { Pool } = require("pg");
require("dotenv").config();

console.log("🔍 Connection bilgileri:");
console.log("  Host:", process.env.DB_HOST);
console.log("  Port:", process.env.DB_PORT);
console.log("  Database:", process.env.DB_NAME);
console.log("  User:", process.env.DB_USER);
console.log("");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

pool.query("SELECT version()")
  .then(result => {
    console.log("✅ Connection başarılı!");
    console.log("PostgreSQL version:", result.rows[0].version);
    process.exit(0);
  })
  .catch(error => {
    console.error("❌ Connection hatası:", error.message);
    console.error("Error code:", error.code);
    if (error.code === "ENETUNREACH") {
      console.error("");
      console.error("💡 ENETUNREACH hatası:");
      console.error("   - VPS IPv4-only network kullanıyor");
      console.error("   - Shared Pooler (IPv4 compatible) kullanmalıyız");
    } else if (error.code === "XX000") {
      console.error("");
      console.error("💡 Tenant or user not found hatası:");
      console.error("   - User adı veya password yanlış olabilir");
      console.error("   - Shared Pooler için user: postgres.wakbsxzocfpngywyzdml");
    }
    process.exit(1);
  });
'

TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    echo ""
    echo "✅ Connection test başarılı! PM2 restart yapılıyor..."
    pm2 restart "$PM2_APP_NAME" --update-env
    echo ""
    echo "📋 PM2 durumu:"
    pm2 status
    echo ""
    echo "✅ Shared Pooler (IPv4 Compatible) connection fix tamamlandı!"
    echo ""
    echo "📋 Sonraki adımlar:"
    echo "1. Logları kontrol et: pm2 logs $PM2_APP_NAME --lines 50"
    echo "2. API health test: curl http://localhost:3000/api/health"
    echo "3. API matches test: curl http://localhost:3000/api/matches/recent"
else
    echo ""
    echo "❌ Connection test başarısız!"
    echo ""
    echo "🔍 Kontrol et:"
    echo "1. Supabase Dashboard → Settings → Database → Password doğru mu?"
    echo "2. Shared Pooler connection string'i tekrar kontrol et"
    echo ""
    echo "💡 Yedek .env dosyası: $PROJECT_DIR/.env.backup.*"
fi


