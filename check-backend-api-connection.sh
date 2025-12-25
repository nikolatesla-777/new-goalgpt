#!/bin/bash

echo "🔍 Checking backend API connection..."
echo ""

# Check PM2 status
echo "=== PM2 Status ==="
pm2 status
echo ""

# Check backend logs
echo "=== Backend Logs (last 20 lines) ==="
pm2 logs goalgpt-backend --lines 20 --nostream | tail -20
echo ""

# Check if port 3000 is listening
echo "=== Port 3000 Status ==="
netstat -tuln | grep :3000 || ss -tuln | grep :3000 || echo "Port 3000 not listening"
echo ""

# Try to curl localhost
echo "=== Testing localhost:3000 ==="
curl -s http://localhost:3000/api/matches/live | head -c 200 || echo "❌ Failed to connect to localhost:3000"
echo ""
echo ""

# Check if backend process is running
echo "=== Backend Process ==="
ps aux | grep "goalgpt-backend" | grep -v grep || echo "❌ Backend process not found"
echo ""

