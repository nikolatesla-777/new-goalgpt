#!/bin/bash
# InPlay Guru - Deploy Script
# Sunucuya bağlan ve inplayguru'yu kur/güncelle

set -e

SERVER="root@142.93.103.128"
DEPLOY_DIR="/var/www/goalgpt"

echo "========================================"
echo "  InPlay Guru Deploy"
echo "========================================"
echo ""

ssh $SERVER << 'ENDSSH'
  set -e

  echo "📥 Pulling latest code..."
  cd /var/www/goalgpt
  git pull origin main

  echo ""
  echo "📦 Installing inplayguru dependencies..."
  cd /var/www/goalgpt/inplayguru
  npm ci --production=false

  echo ""
  echo "🔨 Building inplayguru (Next.js)..."
  npm run build

  echo ""
  echo "🚀 Starting/Restarting inplayguru with PM2..."
  cd /var/www/goalgpt

  # inplayguru-web zaten çalışıyorsa yeniden başlat, yoksa ecosystem ile başlat
  if pm2 list | grep -q "inplayguru-web"; then
    pm2 restart inplayguru-web
    echo "✅ inplayguru-web restarted"
  else
    pm2 start ecosystem.config.js --only inplayguru-web
    echo "✅ inplayguru-web started"
  fi

  pm2 save

  echo ""
  echo "⏳ Waiting for startup..."
  sleep 5

  echo ""
  echo "🏥 Health check (port 3001)..."
  for i in {1..10}; do
    if curl -f -s http://localhost:3001 > /dev/null 2>&1; then
      echo "✅ InPlay Guru is running on port 3001!"
      break
    fi
    echo "  Waiting... ($i/10)"
    sleep 3
  done

  echo ""
  echo "📊 PM2 Status:"
  pm2 status

ENDSSH

echo ""
echo "✅ Deploy complete!"
echo "🌐 InPlay Guru: http://142.93.103.128:3001"
