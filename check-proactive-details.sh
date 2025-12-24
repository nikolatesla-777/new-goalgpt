#!/bin/bash
# Check detailed ProactiveMatchStatusCheckWorker logs

echo "=== ProactiveCheck - No Update Events ==="
pm2 logs goalgpt-backend --lines 500 | grep -i "proactive.check.no_update" | tail -20

echo ""
echo "=== DetailLive - Reconcile Results ==="
pm2 logs goalgpt-backend --lines 500 | grep -i "DetailLive.*reconcile\|detail_live.reconcile" | tail -20

echo ""
echo "=== DetailLive - Warnings (0 rows affected) ==="
pm2 logs goalgpt-backend --lines 500 | grep -i "UPDATE affected 0 rows\|Nothing to update" | tail -20

echo ""
echo "=== ProactiveCheck - Match IDs Being Checked ==="
pm2 logs goalgpt-backend --lines 500 | grep -E "proactive.check.start|proactive.check.success|proactive.check.no_update" | tail -30

echo ""
echo "=== Recent ProactiveCheck Summary ==="
pm2 logs goalgpt-backend --lines 100 | grep -i "ProactiveCheck.*Completed\|ProactiveCheck.*Found" | tail -10

