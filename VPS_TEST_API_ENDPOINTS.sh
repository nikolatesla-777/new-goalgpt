#!/bin/bash

# GoalGPT Backend - Test API Endpoints

echo "🔍 API Endpoints Test..."
echo ""

# 1. Health check
echo "📋 Health Check:"
curl -s http://localhost:3000/health | head -c 200
echo ""
echo ""

# 2. Ready check
echo "📋 Ready Check:"
curl -s http://localhost:3000/ready | head -c 200
echo ""
echo ""

# 3. Matches Recent (with timeout)
echo "📋 Matches Recent (10s timeout):"
timeout 10 curl -s http://localhost:3000/api/matches/recent 2>&1 | head -c 500
echo ""
echo ""

# 4. Matches Diary (today)
echo "📋 Matches Diary (today):"
timeout 10 curl -s "http://localhost:3000/api/matches/diary?date=$(date +%Y-%m-%d)" 2>&1 | head -c 500
echo ""
echo ""

# 5. Matches Live
echo "📋 Matches Live:"
timeout 10 curl -s http://localhost:3000/api/matches/live 2>&1 | head -c 500
echo ""
echo ""

echo "✅ API test tamamlandı!"
