#!/bin/bash

# GoalGPT Backend - PM2 Environment Variables Update
# PM2 restart --update-env ile environment variables'ı güncelle

echo "🔄 PM2 environment variables güncelleniyor..."

# PM2 restart with --update-env flag
pm2 restart goalgpt-backend --update-env

echo ""
echo "✅ PM2 restart tamamlandı (--update-env ile)"
echo ""
echo "📊 PM2 durumu:"
pm2 status

echo ""
echo "📋 Sonraki adımlar:"
echo "1. Logları kontrol et: pm2 logs goalgpt-backend --lines 30"
echo "2. Database connection test: curl http://localhost:3000/api/health"
echo "3. API test: curl http://localhost:3000/api/matches/recent"


