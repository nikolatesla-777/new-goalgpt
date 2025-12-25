#!/bin/bash

echo "🔧 Starting backend and checking minute display..."
echo ""

# Navigate to project directory
cd /var/www/goalgpt || exit 1

# Pull latest changes
echo "=== Pulling latest changes ==="
git pull origin main
echo ""

# Check PM2 status
echo "=== PM2 Status ==="
pm2 status
echo ""

# Restart backend
echo "=== Restarting backend ==="
pm2 restart goalgpt-backend
sleep 3
echo ""

# Check if backend is running
echo "=== Checking backend process ==="
pm2 status goalgpt-backend
echo ""

# Check backend logs for errors
echo "=== Backend logs (last 10 lines) ==="
pm2 logs goalgpt-backend --lines 10 --nostream | tail -10
echo ""

# Test API endpoint
echo "=== Testing /api/matches/live endpoint ==="
curl -s http://localhost:3000/api/matches/live | jq '.data.results[0] | {id, minute, minute_text, status_id, home_team_name, away_team_name}' 2>/dev/null || echo "❌ Failed to fetch or parse API response"
echo ""

echo "✅ Done. Check the output above for minute and minute_text values."

