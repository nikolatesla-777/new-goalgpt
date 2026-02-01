#!/bin/bash
# rollback-stagger.sh - Emergency rollback

SERVER=$1  # SSH hostname

if [ -z "$SERVER" ]; then
  echo "Usage: $0 <server>"
  echo "Example: $0 root@142.93.103.128"
  exit 1
fi

echo "=== EMERGENCY ROLLBACK: Disabling Stagger ==="
echo "=== Server: $SERVER ==="

# Disable stagger
ssh $SERVER << 'ENDSSH'
cd /var/www/goalgpt
sed -i 's/JOB_STAGGER_ENABLED=true/JOB_STAGGER_ENABLED=false/' .env
pm2 reload ecosystem.config.js
ENDSSH

echo "=== Waiting 10 seconds ==="
sleep 10

# Verify rollback
echo "=== Verifying Rollback ==="
ssh $SERVER 'cd /var/www/goalgpt && \
  grep "Job stagger" logs/combined.log | tail -1'

echo "=== Rollback Complete ==="
echo "Expected log: '⏸️ Job stagger disabled'"
