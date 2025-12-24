#!/bin/bash

# GoalGPT Backend - Test Commands
# Bu script VPS'te database connection ve API'yi test eder

echo "🧪 GoalGPT Backend - Test Başlıyor..."
echo ""

# 1. PM2 Status
echo "📊 PM2 Status:"
pm2 status
echo ""

# 2. Logları kontrol et
echo "📋 Son 30 log satırı:"
pm2 logs goalgpt-backend --lines 30 --nostream
echo ""

# 3. Database connection test
echo "🔍 Database Connection Test:"
curl -s http://localhost:3000/api/health || echo "❌ Health endpoint çalışmıyor"
echo ""
echo ""

# 4. API test
echo "🔍 API Test (Recent Matches):"
curl -s http://localhost:3000/api/matches/recent | head -c 200
echo ""
echo ""

# 5. Error kontrolü
echo "🔍 Son 10 error log:"
pm2 logs goalgpt-backend --lines 100 --nostream | grep -i error | tail -n 10 || echo "✅ Error yok"
echo ""

echo "✅ Test tamamlandı!"

