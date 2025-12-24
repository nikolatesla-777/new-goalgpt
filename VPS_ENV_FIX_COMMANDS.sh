#!/bin/bash

# GoalGPT Backend - VPS .env Fix Script
# Bu script VPS'te .env dosyasını Supabase connection ile günceller

PROJECT_DIR="/var/www/goalgpt"
ENV_FILE="$PROJECT_DIR/.env"

echo "🔧 GoalGPT Backend - .env Fix Başlıyor..."

# 1. .env dosyasını yedekle
if [ -f "$ENV_FILE" ]; then
    echo "📦 Mevcut .env dosyası yedekleniyor..."
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Yedek oluşturuldu"
fi

# 2. .env dosyasını oluştur/güncelle
echo "📝 .env dosyası oluşturuluyor..."
cat > "$ENV_FILE" << 'EOF'
# GoalGPT Backend - Environment Variables (Supabase)
# Generated: $(date)

# Database (Supabase - Connection Pooling)
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

echo "✅ .env dosyası oluşturuldu"

# 3. .env dosyasını kontrol et
echo ""
echo "📋 .env dosyası içeriği:"
echo "---"
cat "$ENV_FILE" | grep -E "^DB_|^THESPORTS_|^PORT=|^NODE_ENV="
echo "---"

# 4. PM2 restart
echo ""
echo "🔄 PM2 restart yapılıyor..."
pm2 restart goalgpt-backend

# 5. Durum kontrolü
echo ""
echo "📊 PM2 durumu:"
pm2 status

echo ""
echo "✅ .env fix tamamlandı!"
echo ""
echo "📋 Sonraki adımlar:"
echo "1. Logları kontrol et: pm2 logs goalgpt-backend --lines 30"
echo "2. Database connection test: curl http://localhost:3000/api/health"
echo "3. API test: curl http://localhost:3000/api/matches/recent"

