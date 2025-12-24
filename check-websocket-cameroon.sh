#!/bin/bash
# Check WebSocket logs for Cameroon match HALF_TIME transition
# VPS'te çalıştır: bash check-websocket-cameroon.sh

MATCH_ID="jw2r09hk9d3erz8"

echo "🔍 Checking WebSocket logs for Cameroon match: $MATCH_ID"
echo ""

# Check PM2 logs for WebSocket-related events
echo "=== WebSocket Connection Status ==="
pm2 logs goalgpt-backend --lines 100 --nostream | grep -i "websocket\.\(connecting\|connected\|subscribed\)" | tail -5

echo ""
echo "=== Recent tlive messages for this match ==="
pm2 logs goalgpt-backend --lines 500 --nostream | grep -i "$MATCH_ID.*tlive" | tail -20

echo ""
echo "=== Status updates for this match ==="
pm2 logs goalgpt-backend --lines 500 --nostream | grep -i "$MATCH_ID.*status" | tail -20

echo ""
echo "=== HALF_TIME detection attempts ==="
pm2 logs goalgpt-backend --lines 500 --nostream | grep -i "$MATCH_ID" | grep -i "half.time\|ht\|devre" | tail -20

echo ""
echo "=== Any match state transitions ==="
pm2 logs goalgpt-backend --lines 500 --nostream | grep -i "$MATCH_ID.*transition\|inferStatus\|HALF_TIME" | tail -20

echo ""
echo "=== Database update attempts ==="
pm2 logs goalgpt-backend --lines 500 --nostream | grep -i "$MATCH_ID.*updateMatch.*Status\|updateMatchStatusInDatabase" | tail -20

