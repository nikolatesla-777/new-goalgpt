#!/bin/bash

# GoalGPT Backend - IPv4 Compatible Connection Fix
# ENETUNREACH hatası: VPS IPv4-only, Supabase direct connection IPv6 kullanıyor
# Connection pooling (IPv4 compatible) kullanmalıyız

PROJECT_DIR="/var/www/goalgpt"
PM2_APP_NAME="goalgpt-backend"

echo "🔧 IPv4 Compatible Connection Fix Başlıyor..."
echo ""

# .env dosyasını yedekle
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "📋 Mevcut .env dosyası yedekleniyor..."
    cp "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.direct.bak"
    echo "✅ Yedek oluşturuldu"
    echo ""
fi

# IPv4 compatible connection pooling ile .env güncelle
# Supabase Dashboard → Connection String → Connection Pooling → Transaction mode
echo "🔄 IPv4 compatible connection pooling ile .env güncelleniyor..."
cat << EOF > "$PROJECT_DIR/.env"
# Database (Supabase - Connection Pooling - IPv4 Compatible)
# Connection Pooling kullan (IPv4 compatible, ENETUNREACH hatası için)
# Supabase Dashboard → Connection String → Connection Pooling → Transaction mode
DB_HOST=aws-0-eu-central-1.pooler.supabase.com
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

echo "✅ .env dosyası güncellendi (Connection Pooling - IPv4 Compatible)"
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
      console.error("   - Supabase direct connection IPv6 kullanıyor");
      console.error("   - Connection pooling (IPv4 compatible) kullanmalıyız");
      console.error("");
      console.error("🔍 Supabase Dashboard kontrol:");
      console.error("   1. Supabase Dashboard → Settings → Database");
      console.error("   2. Connection String → Connection Pooling sekmesi");
      console.error("   3. Transaction mode connection string kopyala");
    } else if (error.code === "XX000") {
      console.error("");
      console.error("💡 Tenant or user not found hatası:");
      console.error("   - User adı veya password yanlış olabilir");
      console.error("   - Connection pooling için user: postgres.wakbsxzocfpngywyzdml");
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
    echo "✅ IPv4 compatible connection fix tamamlandı!"
    echo ""
    echo "📋 Sonraki adımlar:"
    echo "1. Logları kontrol et: pm2 logs $PM2_APP_NAME --lines 50"
    echo "2. API health test: curl http://localhost:3000/api/health"
    echo "3. API matches test: curl http://localhost:3000/api/matches/recent"
else
    echo ""
    echo "❌ Connection test başarısız!"
    echo ""
    echo "🔍 Supabase Dashboard'dan Connection Pooling bilgilerini kontrol et:"
    echo "   1. Supabase Dashboard → Settings → Database"
    echo "   2. Connection String → Connection Pooling sekmesi"
    echo "   3. Transaction mode connection string kopyala"
    echo "   4. Format: postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    echo ""
    echo "💡 Yedek .env dosyası: $PROJECT_DIR/.env.direct.bak"
fi


