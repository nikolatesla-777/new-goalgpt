#!/bin/bash
# VPS Deploy Script - Simple and guaranteed to work

cd /var/www/goalgpt
git pull origin main
npm install --production
pm2 restart goalgpt-backend
sleep 3
cd frontend
npm install
npm run build
cp -r dist/* /var/www/goalgpt-frontend/
echo "✅ Deploy completed"
