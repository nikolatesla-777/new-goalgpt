#!/bin/bash
# Monitor backend stability for 2 minutes
# VPS'te çalıştır: bash VPS_MONITOR_BACKEND.sh

echo "🔍 Monitoring backend stability for 2 minutes..."
echo ""

# Initial status
echo "=== Initial Status ==="
pm2 status | grep goalgpt-backend
INITIAL_RESTARTS=$(pm2 jlist | jq -r '.[] | select(.name=="goalgpt-backend") | .pm2_env.restart_time')
echo "Initial restart count: $INITIAL_RESTARTS"
echo ""

# Monitor for 2 minutes (check every 30 seconds)
for i in {1..4}; do
  echo "⏱️  Checking again in 30 seconds... ($i/4)"
  sleep 30
  
  CURRENT_RESTARTS=$(pm2 jlist | jq -r '.[] | select(.name=="goalgpt-backend") | .pm2_env.restart_time')
  UPTIME=$(pm2 jlist | jq -r '.[] | select(.name=="goalgpt-backend") | .pm2_env.pm_uptime')
  
  if [ "$UPTIME" != "null" ] && [ "$UPTIME" != "0" ]; then
    UPTIME_SEC=$(( ( $(date +%s) * 1000 - $UPTIME ) / 1000 ))
    UPTIME_MIN=$(( $UPTIME_SEC / 60 ))
    UPTIME_REMAINING=$(( $UPTIME_SEC % 60 ))
    echo "   ✅ Backend uptime: ${UPTIME_MIN}m ${UPTIME_REMAINING}s"
  else
    echo "   ⚠️  Backend just restarted"
  fi
  
  if [ "$CURRENT_RESTARTS" != "$INITIAL_RESTARTS" ]; then
    echo "   ❌ RESTART COUNT INCREASED: $INITIAL_RESTARTS -> $CURRENT_RESTARTS"
    echo "   Checking logs for crash reason..."
    pm2 logs goalgpt-backend --lines 50 --nostream | grep -i "error\|crash\|exit\|fatal" | tail -10
  else
    echo "   ✅ Restart count stable: $CURRENT_RESTARTS"
  fi
  
  # Check for database pool errors
  POOL_ERRORS=$(pm2 logs goalgpt-backend --lines 100 --nostream | grep -i "pool.*error\|database.*pool" | tail -5)
  if [ ! -z "$POOL_ERRORS" ]; then
    echo "   📋 Recent pool messages:"
    echo "$POOL_ERRORS" | head -3
  fi
  
  echo ""
done

echo "=== Final Status ==="
pm2 status | grep goalgpt-backend
FINAL_RESTARTS=$(pm2 jlist | jq -r '.[] | select(.name=="goalgpt-backend") | .pm2_env.restart_time')
echo "Final restart count: $FINAL_RESTARTS"

if [ "$FINAL_RESTARTS" == "$INITIAL_RESTARTS" ]; then
  echo ""
  echo "✅ SUCCESS: Backend is stable! No crashes in 2 minutes."
else
  RESTART_DIFF=$(( $FINAL_RESTARTS - $INITIAL_RESTARTS ))
  echo ""
  echo "⚠️  Backend crashed $RESTART_DIFF time(s) in 2 minutes. Checking logs..."
  pm2 logs goalgpt-backend --lines 100 --nostream | grep -i "error\|crash\|exit\|fatal\|database\|pool" | tail -20
fi

