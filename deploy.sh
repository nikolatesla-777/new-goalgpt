#!/bin/bash
# VPS Deploy Script - Simple and guaranteed to work

cd /var/www/goalgpt
git pull origin main
npm install

# Ensure logs directory exists
mkdir -p logs

# Start or restart backend with PM2
if pm2 list | grep -q "goalgpt-backend"; then
  echo "🔄 Restarting existing backend..."
  pm2 restart goalgpt-backend --update-env
else
  echo "🆕 Starting new backend..."
  pm2 start ecosystem.config.js || pm2 start npm --name "goalgpt-backend" -- start
fi

# Save PM2 process list
pm2 save || true

# Wait for backend to be ready
echo "🏥 Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -f -s http://localhost:3000/ready > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️ Backend not ready after 60s, checking PM2 status..."
    pm2 status
    pm2 logs goalgpt-backend --lines 20 --nostream || true
  fi
  sleep 2
done

cd frontend
npm install
npm run build
cp -r dist/* /var/www/goalgpt-frontend/
echo "✅ Deploy completed"
