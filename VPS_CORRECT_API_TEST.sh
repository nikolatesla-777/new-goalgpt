#!/bin/bash

# GoalGPT Backend - Correct API Test Script
# Health endpoint /health (prefix yok, /api/health değil)

API_BASE_URL="http://localhost:3000"

echo "🧪 Correct API Test Başlıyor..."
echo ""

# 1. Root endpoint
echo "📋 Root Endpoint (/):"
curl -s "$API_BASE_URL/" | jq . 2>/dev/null || curl -s "$API_BASE_URL/"
echo ""
echo ""

# 2. Health endpoint (DOĞRU: /health, /api/health değil)
echo "🏥 Health Check (/health):"
curl -s "$API_BASE_URL/health" | jq . 2>/dev/null || curl -s "$API_BASE_URL/health"
echo ""
echo ""

# 3. Readiness endpoint
echo "✅ Readiness Check (/ready):"
curl -s "$API_BASE_URL/ready" | jq . 2>/dev/null || curl -s "$API_BASE_URL/ready"
echo ""
echo ""

# 4. API Matches Recent
echo "⚽ API Matches Recent (/api/matches/recent):"
RESPONSE=$(curl -s "$API_BASE_URL/api/matches/recent")
MATCH_COUNT=$(echo "$RESPONSE" | jq '.matches | length' 2>/dev/null || echo "N/A")
echo "Match count: $MATCH_COUNT"
echo "Response (first 500 chars):"
echo "$RESPONSE" | head -c 500
echo ""
echo ""

# 5. PM2 Logs (son 20 satır - bootstrap durumu)
echo "📋 PM2 Logs (son 20 satır - bootstrap durumu):"
pm2 logs goalgpt-backend --lines 20 --nostream | grep -E "bootstrap|Bootstrap|database|Database|connection|Connection|error|Error|✅|❌" | tail -n 10
echo ""

echo "✅ API test tamamlandı!"

