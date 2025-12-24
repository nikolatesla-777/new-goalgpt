#!/bin/bash
# Phase 4-5 WS1: Load test for /api/matches/diary endpoint
# Usage: ./scripts/load-test/diary.sh
# Date format fallback: YYYY-MM-DD first, then YYYYMMDD if fails

set -e

echo "🚀 Load Testing: /api/matches/diary"
echo "==================================="
echo "Configuration: 20 concurrent connections, 30 seconds duration"
echo ""

TODAY_DASH=$(date +%Y-%m-%d)
TODAY_NO_DASH=$(date +%Y%m%d)

echo "Trying date format: YYYY-MM-DD ($TODAY_DASH)"
if autocannon -c 20 -d 30 "http://localhost:3000/api/matches/diary?date=$TODAY_DASH"; then
  echo "✅ Load test completed with YYYY-MM-DD format"
else
  echo "⚠️  YYYY-MM-DD format failed, trying YYYYMMDD ($TODAY_NO_DASH)"
  autocannon -c 20 -d 30 "http://localhost:3000/api/matches/diary?date=$TODAY_NO_DASH"
  echo "✅ Load test completed with YYYYMMDD format"
fi




