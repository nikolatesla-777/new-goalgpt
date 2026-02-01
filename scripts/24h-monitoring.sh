#!/bin/bash
# 24h-monitoring.sh - Automated monitoring for P1 stagger validation
# Run this every 6 hours via cron: 37 */6 * * *

cd /var/www/goalgpt
REPORT_DIR="reports"
mkdir -p $REPORT_DIR

TIMESTAMP=$(date '+%Y%m%d_%H%M')
CHECKPOINT_NUM=$(( ($(date +%H) - 21) / 6 + 1 ))

echo "=== 24H MONITORING CHECKPOINT #${CHECKPOINT_NUM} ===" | tee $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
echo "Time: $(date '+%Y-%m-%d %H:%M:%S UTC')" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# 1. Health Check
echo "1. HEALTH CHECK" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
health=$(curl -s http://localhost:3000/api/health | grep -o '"ok":[^,]*')
echo "  Status: $health" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# 2. Job Execution Count
echo "2. JOB EXECUTION (Last 6h)" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
job_count=$(grep "Job started" logs/combined.log | tail -2000 | wc -l)
echo "  Total Jobs Started: $job_count" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

completed_count=$(grep "Job completed" logs/combined.log | tail -2000 | wc -l)
echo "  Total Jobs Completed: $completed_count" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

if [ $job_count -gt 0 ]; then
  rate=$(echo "scale=1; $completed_count * 100 / $job_count" | bc)
  echo "  Completion Rate: ${rate}%" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
fi
echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# 3. Job Durations
echo "3. JOB DURATIONS (avg ms)" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
for job in "Referral Tier 2" "Referral Tier 3" "Scheduled Notifications" "Live Stats Sync"; do
  avg=$(grep "Job completed.*$job" logs/combined.log | tail -100 | \
    grep -oP '\(\K[0-9]+(?=ms\))' | \
    awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print "N/A"}')
  echo "  $job: ${avg}ms" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
done
echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# 4. Stagger Verification
echo "4. STAGGER STATUS" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
stagger_jobs=$(grep "Job started.*staggered" logs/combined.log | tail -50 | \
  grep -oP 'Job started: \K[^(]+' | sed 's/ *$//' | sort -u | wc -l)
echo "  Jobs with stagger: $stagger_jobs" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

if [ $stagger_jobs -gt 0 ]; then
  echo "  Staggered jobs:" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
  grep "Job started.*staggered" logs/combined.log | tail -50 | \
    grep -oP 'Job started: \K[^(]+' | sed 's/ *$//' | sort -u | \
    nl | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
fi
echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# 5. Error Count
echo "5. ERROR ANALYSIS" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
error_count=$(grep "Job failed" logs/combined.log | tail -200 | wc -l)
echo "  Failed Jobs (last 200): $error_count" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

slow_queries=$(grep "Slow query" logs/combined.log | tail -200 | wc -l)
echo "  Slow Queries: $slow_queries" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# 6. Server Status
echo "6. SERVER STATUS" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
pm2_status=$(pm2 list | grep goalgpt-backend | grep -oP 'online|errored|stopped')
echo "  PM2 Status: $pm2_status" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

restarts=$(pm2 list | grep goalgpt-backend | grep -oP '↺\s+\K\d+')
echo "  PM2 Restarts: ${restarts:-0}" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# 7. Recent Job Examples
echo "7. RECENT JOB EXECUTIONS (last 10)" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
grep "Job started" logs/combined.log | tail -10 | \
  grep -oP '\d{2}:\d{2}:\d{2}.*' | \
  awk '{print "  " $1, $4, $5, $6, $7}' | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# 8. Assessment
echo "8. CHECKPOINT ASSESSMENT" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# Check success criteria
issues=0

if [ "$health" != '"ok":true' ]; then
  echo "  ⚠️  Health check failed" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
  issues=$((issues+1))
fi

if [ $job_count -gt 0 ] && [ $(echo "$rate < 99" | bc) -eq 1 ]; then
  echo "  ⚠️  Completion rate below 99%" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
  issues=$((issues+1))
fi

if [ $stagger_jobs -eq 0 ]; then
  echo "  ⚠️  No staggered jobs detected" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
  issues=$((issues+1))
fi

if [ "$pm2_status" != "online" ]; then
  echo "  ⚠️  PM2 not online" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
  issues=$((issues+1))
fi

if [ $issues -eq 0 ]; then
  echo "  ✅ All checks PASSED" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
else
  echo "  ⚠️  $issues issues detected" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
fi

echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
echo "=== CHECKPOINT #${CHECKPOINT_NUM} COMPLETE ===" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt
echo "" | tee -a $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt

# Append to master 24h log
cat $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt >> $REPORT_DIR/24h-monitoring-master.log
echo "Report saved to: $REPORT_DIR/24h_checkpoint_${TIMESTAMP}.txt"
