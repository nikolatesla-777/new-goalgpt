#!/bin/bash
# Check backend status and database handler logs
# VPS'te çalıştır: bash check-backend-status.sh

echo "🔍 Checking backend status..."
echo ""

# Check PM2 status
echo "=== PM2 Status ==="
pm2 list
echo ""

# Check backend logs (last 50 lines)
echo "=== Backend Logs (Last 50 lines) ==="
pm2 logs goalgpt-backend --lines 50 --nostream | tail -50
echo ""

# Check for database errors
echo "=== Database Handler Errors ==="
pm2 logs goalgpt-backend --lines 200 --nostream | grep -i "dbhandler\|database\|connection\|pool\|error" | tail -30
echo ""

# Check if backend is responding
echo "=== Backend Health Check ==="
curl -s http://localhost:3000/api/matches/diary?date=2025-12-24 | head -20 || echo "❌ Backend not responding"
echo ""
