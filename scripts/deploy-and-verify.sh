#!/bin/bash
# deploy-and-verify.sh - Universal deployment script

set -e  # Exit on error

PHASE=$1  # "staging-baseline", "staging-stagger", "prod-baseline", "prod-stagger"
SERVER=$2  # SSH hostname

if [ -z "$PHASE" ] || [ -z "$SERVER" ]; then
  echo "Usage: $0 <phase> <server>"
  echo "Example: $0 staging-stagger root@staging.goalgpt.com"
  exit 1
fi

echo "=== Phase: $PHASE ==="
echo "=== Server: $SERVER ==="

# Step 1: SSH and pull code
ssh $SERVER << 'ENDSSH'
cd /var/www/goalgpt
git fetch origin
git checkout main
git pull
npm ci --production
ENDSSH

# Step 2: Configure based on phase
case $PHASE in
  "staging-baseline")
    ssh $SERVER 'cd /var/www/goalgpt && \
      sed -i "s/JOB_STAGGER_ENABLED=.*/JOB_STAGGER_ENABLED=false/" .env && \
      sed -i "s/DB_POOL_LOG_INTERVAL_MS=.*/DB_POOL_LOG_INTERVAL_MS=30000/" .env'
    ;;
  "staging-stagger")
    ssh $SERVER 'cd /var/www/goalgpt && \
      sed -i "s/JOB_STAGGER_ENABLED=.*/JOB_STAGGER_ENABLED=true/" .env'
    ;;
  "prod-baseline")
    ssh $SERVER 'cd /var/www/goalgpt && \
      sed -i "s/JOB_STAGGER_ENABLED=.*/JOB_STAGGER_ENABLED=false/" .env && \
      sed -i "s/DB_POOL_LOG_INTERVAL_MS=.*/DB_POOL_LOG_INTERVAL_MS=60000/" .env'
    ;;
  "prod-stagger")
    ssh $SERVER 'cd /var/www/goalgpt && \
      sed -i "s/JOB_STAGGER_ENABLED=.*/JOB_STAGGER_ENABLED=true/" .env'
    ;;
  *)
    echo "Invalid phase: $PHASE"
    exit 1
    ;;
esac

# Step 3: Reload
echo "=== Reloading PM2 ==="
ssh $SERVER 'cd /var/www/goalgpt && pm2 reload ecosystem.config.js'

# Step 4: Wait for startup
echo "=== Waiting 15 seconds for startup ==="
sleep 15

# Step 5: Health check
echo "=== Health Check ==="
ssh $SERVER 'curl -f http://localhost:3000/api/health || exit 1'

# Step 6: Verify logs
echo "=== Verifying Logs ==="
ssh $SERVER 'cd /var/www/goalgpt && tail -50 logs/combined.log | grep "Job scheduled"'

case $PHASE in
  "staging-stagger"|"prod-stagger")
    echo "=== Verifying Stagger Enabled ==="
    ssh $SERVER 'cd /var/www/goalgpt && grep "Job stagger enabled" logs/combined.log | tail -1'
    ;;
  *)
    echo "=== Verifying Stagger Disabled ==="
    ssh $SERVER 'cd /var/www/goalgpt && grep "Job stagger disabled" logs/combined.log | tail -1'
    ;;
esac

echo "=== Deployment Complete ==="
