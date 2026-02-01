#!/bin/bash
# kpi-checkpoint.sh - 72-hour KPI tracking checkpoint

CHECKPOINT_ID=$(date +%Y%m%d_%H%M)
REPORT_DIR="/var/www/goalgpt/reports"
mkdir -p $REPORT_DIR

echo "=== KPI Checkpoint: $CHECKPOINT_ID ===" | tee $REPORT_DIR/kpi_$CHECKPOINT_ID.txt

# KPI 1: Pool Utilization
echo -e "\n--- Pool Utilization (Last 6h) ---" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt
grep "PoolMonitor" logs/combined.log | tail -360 | \
  grep -oP 'utilization \K[0-9.]+(?=%)' | \
  awk '{sum+=$1; count++; if($1>max) max=$1; if(min=="" || $1<min) min=$1}
       END {print "Avg: " sum/count "%, Min: " min "%, Max: " max "%"}' | \
  tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt

# KPI 2: Job Duration (Top 3 Jobs)
echo -e "\n--- Job Duration (Last 6h) ---" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt
for job in "Referral Tier 2 Processor" "Live Stats Sync" "Prediction Matcher"; do
  echo "  $job:" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt
  grep "✅ Job completed.*$job" logs/combined.log | tail -100 | \
    grep -oP '\(\K[0-9]+(?=ms\))' | \
    awk '{sum+=$1; count++} END {print "    Avg: " sum/count "ms, Count: " count}' | \
    tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt
done

# KPI 3: Slow Query Count
echo -e "\n--- Slow Query Count (Last 6h) ---" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt
slow_count=$(grep "\[DB\] Slow query" logs/combined.log | tail -1000 | wc -l)
echo "Count: $slow_count" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt

# KPI 4: Job Error Rate
echo -e "\n--- Job Error Rate (Last 6h) ---" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt
total_jobs=$(grep "🔄 Job started" logs/combined.log | tail -500 | wc -l)
failed_jobs=$(grep "❌ Job failed" logs/combined.log | tail -500 | wc -l)
error_rate=$(echo "scale=2; $failed_jobs / $total_jobs * 100" | bc)
echo "Total: $total_jobs, Failed: $failed_jobs, Rate: $error_rate%" | \
  tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt

# KPI 5: Lock Skip Count
echo -e "\n--- Lock Skip Count (Last 6h) ---" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt
lock_skips=$(grep "skipped_lock" logs/combined.log | tail -100 | wc -l)
echo "Count: $lock_skips" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt

# KPI 6: Concurrent Jobs at :00
echo -e "\n--- Concurrent Jobs (Database) ---" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt
psql $DATABASE_URL -t -c "
SELECT
  DATE_TRUNC('minute', started_at) AS minute,
  COUNT(*) FILTER (WHERE status = 'running') AS concurrent
FROM job_execution_logs
WHERE started_at >= NOW() - INTERVAL '6 hours'
  AND job_name IN (
    'Referral Tier 2 Processor', 'Referral Tier 3 Processor',
    'Scheduled Notifications', 'Live Stats Sync',
    'Badge Auto-Unlock', 'Prediction Matcher',
    'Stuck Match Finisher', 'Telegram Settlement'
  )
GROUP BY minute
ORDER BY concurrent DESC
LIMIT 5;
" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt

echo -e "\n=== Checkpoint Complete ===" | tee -a $REPORT_DIR/kpi_$CHECKPOINT_ID.txt
