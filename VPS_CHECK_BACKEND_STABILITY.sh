#!/bin/bash
# Check backend stability after database connection error fix
# VPS'te çalıştır: bash VPS_CHECK_BACKEND_STABILITY.sh

echo "🔍 Checking backend stability..."
echo ""

# Check PM2 status
echo "=== PM2 Status ==="
pm2 status
echo ""

# Check restart count
RESTART_COUNT=$(pm2 jlist | jq -r '.[] | select(.name=="goalgpt-backend") | .pm2_env.restart_time')
echo "Restart count: $RESTART_COUNT"
echo ""

# Check recent database pool warnings (should be warnings, not errors that cause exit)
echo "=== Recent Database Pool Messages (Last 30) ==="
pm2 logs goalgpt-backend --lines 200 --nostream | grep -i "pool.*error\|database.*pool\|Unexpected.*idle\|pool.*retry" | tail -30
echo ""

# Check if there are any "exiting" or "crash" messages
echo "=== Crash/Exit Messages (Last 20) ==="
pm2 logs goalgpt-backend --lines 100 --nostream | grep -i "exit\|crash\|fatal\|killed" | tail -20
echo ""

# Check backend uptime
UPTIME=$(pm2 jlist | jq -r '.[] | select(.name=="goalgpt-backend") | .pm2_env.pm_uptime')
if [ "$UPTIME" != "null" ] && [ "$UPTIME" != "0" ]; then
  UPTIME_SEC=$(( ( $(date +%s) * 1000 - $UPTIME ) / 1000 ))
  echo "✅ Backend uptime: ${UPTIME_SEC} seconds (~$(( $UPTIME_SEC / 60 )) minutes)"
else
  echo "⚠️  Backend just restarted (uptime calculation not available)"
fi
echo ""

# Check if backend is responding
echo "=== Backend Health Check ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/api/health || echo "❌ Backend not responding"
echo ""

echo "✅ Stability check complete"
echo ""
echo "💡 Expected behavior:"
echo "   - Restart count should NOT increase rapidly"
echo "   - Database pool errors should be logged as WARNINGS (not fatal)"
echo "   - Backend should stay online for several minutes without crashing"

