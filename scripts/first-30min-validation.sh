#!/bin/bash
# first-30min-validation.sh - CRITICAL first 30 minutes validation
# Run this immediately after enabling stagger (Phase 2 or Phase 4)

set -e

echo "=== P1 STAGGER - FIRST 30 MINUTES VALIDATION ==="
echo "=== Started: $(date) ==="
echo ""

cd /var/www/goalgpt

# === 1. VERIFY STAGGER ENABLED (30 seconds) ===
echo "[1/8] Verifying stagger enabled..."
if grep "Job stagger enabled" logs/combined.log | tail -1 | grep -q "collision-free"; then
  echo "✅ PASS: Stagger enabled (collision-free)"
else
  echo "❌ FAIL: Stagger not enabled or collision detected"
  echo "ACTION REQUIRED: Check .env file and restart"
  exit 1
fi

# === 2. VERIFY 6-FIELD CRON SCHEDULED (1 minute) ===
echo ""
echo "[2/8] Verifying 6-field cron scheduled..."
stagger_count=$(grep "Staggered:" logs/combined.log | wc -l)
if [ "$stagger_count" -gt 0 ]; then
  echo "✅ PASS: 6-field cron applied ($stagger_count jobs)"
  grep "Staggered:" logs/combined.log | head -3
else
  echo "❌ FAIL: No staggered schedules found"
  exit 1
fi

# === 3. VERIFY JOBS SPREAD ACROSS SECONDS (2 minutes - wait for job cycle) ===
echo ""
echo "[3/8] Verifying jobs spread across seconds (waiting 90 seconds for full cycle)..."
sleep 90

unique_seconds=$(grep "🔄 Job started" logs/combined.log | tail -20 | \
  awk '{print $2}' | cut -d: -f3 | sort -u | wc -l)

if [ "$unique_seconds" -ge 5 ]; then
  echo "✅ PASS: Jobs spread across $unique_seconds different seconds"
  echo "Second distribution:"
  grep "🔄 Job started" logs/combined.log | tail -20 | \
    awk '{print $2}' | cut -d: -f3 | sort | uniq -c
else
  echo "❌ FAIL: Jobs still clustered at :00 (only $unique_seconds unique seconds)"
  exit 1
fi

# === 4. VERIFY POOL UTILIZATION DROP (5 minutes - sample period) ===
echo ""
echo "[4/8] Verifying pool utilization drop (waiting 5 minutes for sample)..."
sleep 300

avg_util=$(grep "PoolMonitor" logs/combined.log | tail -10 | \
  grep -oP 'utilization \K[0-9.]+(?=%)' | \
  awk '{sum+=$1; count++} END {print sum/count}')

if (( $(echo "$avg_util < 50" | bc -l) )); then
  echo "✅ PASS: Pool utilization at ${avg_util}% (target: <50%)"
else
  echo "⚠️  WARNING: Pool utilization at ${avg_util}% (target: <50%)"
  echo "Continue monitoring, but consider rollback if >70%"
fi

# === 5. VERIFY NO ERRORS (5 minutes) ===
echo ""
echo "[5/8] Checking for stagger-related errors..."
error_count=$(tail -100 logs/error.log | grep -E "(stagger|Job failed|CRITICAL)" | wc -l)

if [ "$error_count" -eq 0 ]; then
  echo "✅ PASS: No stagger-related errors"
else
  echo "❌ FAIL: Found $error_count errors"
  tail -20 logs/error.log
  echo "ACTION REQUIRED: ROLLBACK IMMEDIATELY"
  exit 1
fi

# === 6. VERIFY COLLISION-FREE (instant) ===
echo ""
echo "[6/8] Checking for collision warnings..."
if grep -q "collision" logs/combined.log; then
  echo "❌ FAIL: Collision warnings detected"
  grep "collision" logs/combined.log | tail -5
  echo "ACTION REQUIRED: Fix offset config and rollback"
  exit 1
else
  echo "✅ PASS: No collisions detected"
fi

# === 7. VERIFY JOB COMPLETION RATE (10 minutes - wait for jobs) ===
echo ""
echo "[7/8] Verifying job completion rate (waiting 10 minutes)..."
sleep 600

recent_started=$(grep "🔄 Job started" logs/combined.log | tail -50 | wc -l)
recent_completed=$(grep "✅ Job completed" logs/combined.log | tail -50 | wc -l)
completion_rate=$(echo "scale=2; $recent_completed / $recent_started * 100" | bc)

if (( $(echo "$completion_rate >= 90" | bc -l) )); then
  echo "✅ PASS: Completion rate ${completion_rate}% (Started: $recent_started, Completed: $recent_completed)"
else
  echo "❌ FAIL: Low completion rate ${completion_rate}%"
  echo "ACTION REQUIRED: Jobs may be hanging, investigate"
  exit 1
fi

# === 8. VERIFY CONCURRENT EXECUTION REDUCED (database query) ===
echo ""
echo "[8/8] Checking concurrent execution (database)..."
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
  concurrent=$(psql $DATABASE_URL -t -c "
    SELECT COUNT(*) as running_now
    FROM job_execution_logs
    WHERE status = 'running'
      AND started_at > NOW() - INTERVAL '2 minutes'
      AND job_name IN ('Referral Tier 2 Processor', 'Live Stats Sync', 'Scheduled Notifications');
  " | tr -d ' ')

  if [ "$concurrent" -le 2 ]; then
    echo "✅ PASS: Concurrent jobs = $concurrent (target: ≤2)"
  else
    echo "⚠️  WARNING: Concurrent jobs = $concurrent (target: ≤2)"
    echo "Continue monitoring"
  fi
else
  echo "⚠️  SKIP: Database not accessible from this environment"
fi

# === FINAL DECISION ===
echo ""
echo "============================================="
echo "=== VALIDATION COMPLETE ==="
echo "=== Completed: $(date) ==="
echo "============================================="
echo ""
echo "✅ ALL CRITICAL CHECKS PASSED"
echo ""
echo "Next steps:"
echo "1. Continue monitoring for 72 hours"
echo "2. Run KPI checkpoints every 6 hours:"
echo "   bash scripts/kpi-checkpoint.sh"
echo "3. If any issues arise, rollback with:"
echo "   bash scripts/rollback-stagger.sh <server>"
echo ""
