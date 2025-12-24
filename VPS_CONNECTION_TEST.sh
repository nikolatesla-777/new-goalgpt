#!/bin/bash

# GoalGPT Backend - Supabase Connection Test
# Bu script Supabase connection'ı test eder

echo "🧪 Supabase Connection Test Başlıyor..."
echo ""

# .env dosyasını kontrol et
ENV_FILE="/var/www/goalgpt/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env dosyası bulunamadı: $ENV_FILE"
    exit 1
fi

echo "📋 .env dosyası içeriği (DB bilgileri):"
grep -E "^DB_" "$ENV_FILE" | sed 's/PASSWORD=.*/PASSWORD=***/'
echo ""

# Connection string oluştur
DB_HOST=$(grep "^DB_HOST=" "$ENV_FILE" | cut -d'=' -f2)
DB_PORT=$(grep "^DB_PORT=" "$ENV_FILE" | cut -d'=' -f2)
DB_NAME=$(grep "^DB_NAME=" "$ENV_FILE" | cut -d'=' -f2)
DB_USER=$(grep "^DB_USER=" "$ENV_FILE" | cut -d'=' -f2)
DB_PASSWORD=$(grep "^DB_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2)

echo "🔍 Connection bilgileri:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: ***"
echo ""

# psql ile test
echo "🔌 psql ile connection test:"
if command -v psql &> /dev/null; then
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" 2>&1 | head -n 5
else
    echo "⚠️  psql bulunamadı, Node.js ile test edilecek"
fi
echo ""

# Node.js ile test
echo "🔌 Node.js ile connection test:"
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
  ssl: process.env.DB_HOST?.includes('supabase') || process.env.DB_HOST?.includes('pooler') 
    ? { rejectUnauthorized: false }
    : false,
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

echo ""
echo "✅ Test tamamlandı!"



