#!/bin/bash

# GoalGPT Backend - Direct Connection Fix for Supabase
# Connection pooling (6543) çalışmıyor, direct connection (5432) deniyoruz

PROJECT_DIR="/var/www/goalgpt"
PM2_APP_NAME="goalgpt-backend"

echo "🔧 Direct Connection Fix Başlıyor..."
echo ""

# .env dosyasını yedekle
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "📋 Mevcut .env dosyası yedekleniyor..."
    cp "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.pooling.bak"
    echo "✅ Yedek oluşturuldu: $PROJECT_DIR/.env.pooling.bak"
    echo ""
fi

# Direct connection ile .env güncelle
echo "🔄 Direct connection (port 5432) ile .env güncelleniyor..."
cat << EOF > "$PROJECT_DIR/.env"
# Database (Supabase - Direct Connection - Port 5432)
DB_HOST=aws-0-eu-central-1.pooler.supabase.com
DB_PORT=5432
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

echo "✅ .env dosyası güncellendi (Direct Connection - Port 5432)"
echo ""
echo "📋 Yeni .env içeriği:"
grep -E "^DB_" "$PROJECT_DIR/.env"
echo ""

# Connection test
echo "🧪 Connection test başlıyor..."
cd "$PROJECT_DIR"
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
  connectionTimeoutMillis: 10000,
});

pool.query('SELECT version()')
  .then(result => {
    console.log('✅ Connection başarılı!');
    console.log('PostgreSQL version:', result.rows[0].version);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Connection hatası:', error.message);
    console.error('Error code:', error.code);
    process.exit(1);
  });
"

TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    echo ""
    echo "✅ Connection test başarılı! PM2 restart yapılıyor..."
    pm2 restart "$PM2_APP_NAME" --update-env
    echo ""
    echo "📋 PM2 durumu:"
    pm2 status
    echo ""
    echo "✅ Direct connection fix tamamlandı!"
    echo ""
    echo "📋 Sonraki adımlar:"
    echo "1. Logları kontrol et: pm2 logs $PM2_APP_NAME --lines 50"
    echo "2. API test: curl http://localhost:3000/api/health"
else
    echo ""
    echo "❌ Connection test başarısız!"
    echo ""
    echo "🔍 Alternatif çözümler:"
    echo "1. Supabase Dashboard → Settings → Database → Connection string kontrol et"
    echo "2. Password'u reset et: Supabase Dashboard → Settings → Database → Reset database password"
    echo "3. Connection string formatını kontrol et (farklı format olabilir)"
    echo ""
    echo "💡 Yedek .env dosyası: $PROJECT_DIR/.env.pooling.bak"
fi


