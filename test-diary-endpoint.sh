#!/bin/bash
# Test /api/matches/diary endpoint
# Usage: bash test-diary-endpoint.sh [date]

DATE=${1:-"2025-12-24"}
API_URL=${API_URL:-"http://localhost:3000"}

echo "🔍 Testing /api/matches/diary endpoint"
echo "Date: $DATE"
echo "API URL: $API_URL"
echo ""

curl -v "${API_URL}/api/matches/diary?date=${DATE}" 2>&1 | head -50

echo ""
echo ""
echo "✅ Test complete"

