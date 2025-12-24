#!/bin/bash

# GoalGPT Backend - Correct Supabase Connection Fix
# Supabase Dashboard'dan alınan doğru connection string ile güncelleme

PROJECT_DIR="/var/www/goalgpt"
PM2_APP_NAME="goalgpt-backend"

echo "🔧 Correct Supabase Connection Fix Başlıyor..."
echo ""

# .env dosyasını yedekle
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "📋 Mevcut .env dosyası yedekleniyor..."
    cp "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Yedek oluşturuldu"
    echo ""
fi

# Doğru connection string ile .env güncelle
echo "🔄 Doğru Supabase connection string ile .env güncelleniyor..."
cat << EOF > "$PROJECT_DIR/.env"
# Database (Supabase - Direct Connection - Dashboard'dan alınan)
# Connection String: postgresql://postgres:[PASSWORD]@db.wakbsxzocfpngywyzdml.supabase.co:5432/postgres
DB_HOST=db.wakbsxzocfpngywyzdml.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
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

echo "✅ .env dosyası güncellendi (Doğru Supabase connection)"
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
    if (error.code === "XX000") {
      console.error("");
      console.error("💡 Tenant or user not found hatası:");
      console.error("   - User adı veya password yanlış olabilir");
      console.error("   - Supabase Dashboard → Settings → Database → Password kontrol et");
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
    echo "✅ Correct connection fix tamamlandı!"
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
    echo "2. Supabase Dashboard → Settings → Database → Connection string tekrar kontrol et"
    echo ""
    echo "💡 Yedek .env dosyası: $PROJECT_DIR/.env.backup.*"
fi

