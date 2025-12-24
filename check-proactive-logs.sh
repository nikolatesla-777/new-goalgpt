#!/bin/bash
# Check ProactiveMatchStatusCheckWorker detailed logs

echo "=== ProactiveCheck Detailed Logs ==="
echo ""
echo "Checking for 'proactive.check' events:"
pm2 logs goalgpt-backend --lines 100 | grep -i "proactive.check" | tail -20

echo ""
echo "Checking for detail_live errors:"
pm2 logs goalgpt-backend --lines 100 | grep -i "detail_live\|DetailLive" | tail -20

echo ""
echo "Checking for reconcile errors:"
pm2 logs goalgpt-backend --lines 100 | grep -i "reconcile\|reconciliation" | tail -20

echo ""
echo "Recent ProactiveCheck summary:"
pm2 logs goalgpt-backend --lines 50 | grep -i "ProactiveCheck.*Completed\|ProactiveCheck.*Found" | tail -10


