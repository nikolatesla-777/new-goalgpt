#!/bin/bash

# GoalGPT Backend - Final Test Script
# Connection başarılı, şimdi logları ve API'leri test ediyoruz

PM2_APP_NAME="goalgpt-backend"
API_BASE_URL="http://localhost:3000/api"

echo "🧪 Final Test Başlıyor..."
echo ""

# 1. PM2 Status
echo "📊 PM2 Status:"
pm2 status
echo ""

# 2. PM2 Logs (son 50 satır)
echo "📋 PM2 Logs (son 50 satır):"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream
echo ""

# 3. API Health Check
echo "🏥 API Health Check:"
curl -s "$API_BASE_URL/health" | jq . 2>/dev/null || curl -s "$API_BASE_URL/health"
echo ""
echo ""

# 4. API Matches Recent Test
echo "⚽ API Matches Recent Test:"
curl -s "$API_BASE_URL/matches/recent" | jq '.matches | length' 2>/dev/null || echo "Response: $(curl -s "$API_BASE_URL/matches/recent" | head -c 200)"
echo ""

# 5. Database Connection Test (from logs)
echo "🔍 Database Connection Test (loglardan):"
pm2 logs "$PM2_APP_NAME" --lines 100 --nostream | grep -i "database\|connection\|bootstrap" | tail -n 10
echo ""

echo "✅ Final test tamamlandı!"

