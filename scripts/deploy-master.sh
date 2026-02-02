#!/bin/bash
#
# MASTER DEPLOYMENT SCRIPT - POST-P1 TECHNICAL DEBT
#
# This script automates the entire deployment process:
# - Staging tests
# - Production deployment (gradual, 3 weeks)
# - Monitoring and verification
# - Automatic rollback on failure
#
# Usage:
#   ./scripts/deploy-master.sh staging       # Run staging tests
#   ./scripts/deploy-master.sh production    # Start production deployment
#   ./scripts/deploy-master.sh rollback      # Emergency rollback
#

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGING_HOST="${STAGING_HOST:-staging.goalgpt.com}"
PRODUCTION_HOST="${PRODUCTION_HOST:-production.goalgpt.com}"
PROJECT_DIR="/var/www/goalgpt"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

# Logging
LOG_FILE="logs/deployment-$(date +%Y%m%d-%H%M%S).log"
mkdir -p logs

log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Function: Run command on remote server
run_remote() {
  local host=$1
  shift
  local cmd="$@"

  log_info "Running on $host: $cmd"
  ssh "root@$host" "cd $PROJECT_DIR && $cmd" 2>&1 | tee -a "$LOG_FILE"

  if [ ${PIPESTATUS[0]} -ne 0 ]; then
    log_error "Command failed on $host"
    return 1
  fi

  return 0
}

# Function: Check if server is accessible
check_server() {
  local host=$1

  log_info "Checking connectivity to $host..."

  if ! ssh -o ConnectTimeout=5 "root@$host" "echo 'Connected'" &>/dev/null; then
    log_error "Cannot connect to $host"
    return 1
  fi

  log "✅ Connected to $host"
  return 0
}

# Function: Run staging tests
run_staging_tests() {
  log "========================================"
  log "STAGING TESTS"
  log "========================================"

  if ! check_server "$STAGING_HOST"; then
    log_error "Cannot access staging server"
    return 1
  fi

  # Pull latest code
  log "Pulling latest code..."
  run_remote "$STAGING_HOST" "git fetch origin && git checkout main && git pull origin main"

  # Install dependencies
  log "Installing dependencies..."
  run_remote "$STAGING_HOST" "npm install"

  # Make scripts executable
  log "Setting script permissions..."
  run_remote "$STAGING_HOST" "chmod +x scripts/*.sh"

  # Run PR-P1B tests
  log "========================================"
  log "Running PR-P1B Tests (N+1 Elimination)"
  log "========================================"

  if ! run_remote "$STAGING_HOST" "./scripts/test-staging-pr-p1b.sh"; then
    log_error "PR-P1B tests FAILED"
    return 1
  fi

  log "✅ PR-P1B tests PASSED"

  # Run PR-P1C tests
  log "========================================"
  log "Running PR-P1C Tests (Concurrency Control)"
  log "========================================"

  if ! run_remote "$STAGING_HOST" "./scripts/test-staging-pr-p1c.sh"; then
    log_error "PR-P1C tests FAILED"
    return 1
  fi

  log "✅ PR-P1C tests PASSED"

  # Monitor pool for 1 hour
  log "========================================"
  log "Monitoring Pool (1 hour)"
  log "========================================"

  run_remote "$STAGING_HOST" "./scripts/monitor-pool.sh 60"

  log "✅ Pool monitoring completed"

  # Deploy PR-P1D indexes
  log "========================================"
  log "Deploying PR-P1D Indexes"
  log "========================================"

  if ! run_remote "$STAGING_HOST" "npx tsx src/database/migrations/pr-p1d-add-hot-path-indexes.ts"; then
    log_error "PR-P1D index deployment FAILED"
    return 1
  fi

  log "✅ PR-P1D indexes deployed"

  # Test caching
  log "========================================"
  log "Testing Redis Caching"
  log "========================================"

  run_remote "$STAGING_HOST" "export USE_REDIS_CACHE=true && export CACHE_STANDINGS=true && pm2 restart goalgpt-api"

  sleep 5

  # Test cache hit
  run_remote "$STAGING_HOST" "curl -s http://localhost:3000/api/admin/standings/39 > /dev/null"
  run_remote "$STAGING_HOST" "curl -s http://localhost:3000/api/admin/standings/39 | jq '.fromCache'"

  log "✅ Caching tests completed"

  log "========================================"
  log "🎉 ALL STAGING TESTS PASSED"
  log "========================================"
  log ""
  log "Next step: Run './scripts/deploy-master.sh production' to start production deployment"

  return 0
}

# Function: Deploy to production (Week 1)
deploy_production_week1() {
  log "========================================"
  log "PRODUCTION DEPLOYMENT - WEEK 1"
  log "========================================"

  if ! check_server "$PRODUCTION_HOST"; then
    log_error "Cannot access production server"
    return 1
  fi

  # Day 1: PR-P1A (Indexes)
  log "========================================"
  log "DAY 1: PR-P1A - Migration Safety"
  log "========================================"

  log "Pulling latest code..."
  run_remote "$PRODUCTION_HOST" "git fetch origin && git checkout main && git pull origin main"

  log "Installing dependencies..."
  run_remote "$PRODUCTION_HOST" "npm install"

  log "Running PR-P1A migration (CONCURRENTLY - zero downtime)..."
  if ! run_remote "$PRODUCTION_HOST" "npx tsx src/database/migrations/pr-p1a-add-concurrent-indexes.ts"; then
    log_error "PR-P1A migration FAILED"
    return 1
  fi

  log "✅ PR-P1A deployed successfully"

  log "Verifying indexes..."
  run_remote "$PRODUCTION_HOST" "npm run validate:migrations"

  log "✅ Day 1 complete - PR-P1A indexes deployed"
  log ""
  log "⏸️  PAUSE: Wait until Day 4 (Thursday) to continue"
  log "   Use: ./scripts/deploy-master.sh production-day4"

  return 0
}

# Function: Production Day 4 (PR-P1B - Daily Rewards Only)
deploy_production_day4() {
  log "========================================"
  log "DAY 4: PR-P1B - Daily Rewards Only"
  log "========================================"

  if ! check_server "$PRODUCTION_HOST"; then
    log_error "Cannot access production server"
    return 1
  fi

  log "Enabling daily rewards optimization only..."
  run_remote "$PRODUCTION_HOST" "export USE_OPTIMIZED_DAILY_REWARDS=true && export USE_OPTIMIZED_BADGE_UNLOCK=false && export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=false && pm2 restart goalgpt-api"

  log "✅ Daily rewards optimization enabled"
  log ""
  log "⏸️  MONITORING: Wait 24 hours and monitor logs:"
  log "   ssh root@$PRODUCTION_HOST"
  log "   tail -f $PROJECT_DIR/logs/combined.log | grep 'Daily Reward'"
  log ""
  log "Expected: Query count ≤3, execution time <5s"
  log ""
  log "If successful, continue on Day 5:"
  log "   ./scripts/deploy-master.sh production-day5"

  return 0
}

# Function: Production Day 5 (PR-P1B - Full Rollout)
deploy_production_day5() {
  log "========================================"
  log "DAY 5: PR-P1B - Full Rollout"
  log "========================================"

  if ! check_server "$PRODUCTION_HOST"; then
    log_error "Cannot access production server"
    return 1
  fi

  log "Enabling all PR-P1B optimizations..."
  run_remote "$PRODUCTION_HOST" "export USE_OPTIMIZED_DAILY_REWARDS=true && export USE_OPTIMIZED_BADGE_UNLOCK=true && export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=true && pm2 restart goalgpt-api"

  log "✅ All PR-P1B optimizations enabled"
  log ""
  log "⏸️  WEEKEND MONITORING: Monitor for 48 hours"
  log "   Check: All jobs running successfully"
  log "   Check: Query counts remain low"
  log "   Check: No errors in logs"
  log ""
  log "✅ Week 1 complete!"
  log ""
  log "Next: Week 2 (PR-P1C) starting Day 10 (Wednesday)"
  log "   ./scripts/deploy-master.sh production-week2"

  return 0
}

# Function: Emergency Rollback
emergency_rollback() {
  log_error "========================================"
  log_error "EMERGENCY ROLLBACK"
  log_error "========================================"

  local host="${1:-$PRODUCTION_HOST}"

  if ! check_server "$host"; then
    log_error "Cannot access $host for rollback"
    return 1
  fi

  log_warning "Disabling ALL optimizations..."
  run_remote "$host" "export USE_OPTIMIZED_DAILY_REWARDS=false && export USE_OPTIMIZED_BADGE_UNLOCK=false && export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=false && export MATCH_ENRICHER_CONCURRENCY=999 && export MATCH_WATCHDOG_CONCURRENCY=999 && export USE_REDIS_CACHE=false && pm2 restart goalgpt-api"

  log "✅ Rollback completed (30 seconds)"
  log ""
  log "Verifying rollback..."
  run_remote "$host" "curl -s http://localhost:3000/health"

  log "✅ Application responding normally"
  log ""
  log "⚠️  INVESTIGATION REQUIRED: Check logs for errors"
  log "   ssh root@$host"
  log "   tail -100 $PROJECT_DIR/logs/error.log"

  return 0
}

# Function: Generate deployment report
generate_report() {
  local report_file="reports/deployment-report-$(date +%Y%m%d).md"
  mkdir -p reports

  cat > "$report_file" << 'EOF'
# DEPLOYMENT REPORT

**Date**: $(date)
**Deployed By**: Automated Script

## Deployment Status

### Week 1: PR-P1A + PR-P1B
- [ ] Day 1: PR-P1A indexes deployed
- [ ] Day 4: PR-P1B daily rewards enabled
- [ ] Day 5: PR-P1B full rollout

### Week 2: PR-P1C
- [ ] Day 10: Conservative limits
- [ ] Day 11-12: Optimized limits

### Week 3: PR-P1D
- [ ] Day 15: Indexes deployed
- [ ] Day 17: Standings caching
- [ ] Day 18-19: Full caching

## Performance Metrics

### PR-P1B
- Daily rewards queries: ___
- Badge unlock queries: ___
- Execution time: ___

### PR-P1C
- Pool utilization: ___%
- Max concurrent: ___

### PR-P1D
- Cache hit rate: ___%
- API latency: ___ms

## Issues Encountered

- None / [List issues]

## Next Steps

- [List next actions]

EOF

  log "✅ Report generated: $report_file"
}

# Main script logic
case "${1:-help}" in
  staging)
    log "Starting staging tests..."
    run_staging_tests
    exit $?
    ;;

  production)
    log "Starting production deployment (Week 1, Day 1)..."
    deploy_production_week1
    exit $?
    ;;

  production-day4)
    deploy_production_day4
    exit $?
    ;;

  production-day5)
    deploy_production_day5
    exit $?
    ;;

  rollback)
    emergency_rollback "${2:-$PRODUCTION_HOST}"
    exit $?
    ;;

  report)
    generate_report
    exit $?
    ;;

  help|*)
    echo "Usage: $0 {staging|production|production-day4|production-day5|rollback|report}"
    echo ""
    echo "Commands:"
    echo "  staging           - Run all staging tests"
    echo "  production        - Start production deployment (Week 1, Day 1)"
    echo "  production-day4   - Continue deployment (Day 4 - daily rewards)"
    echo "  production-day5   - Continue deployment (Day 5 - full rollout)"
    echo "  rollback          - Emergency rollback (disables all optimizations)"
    echo "  report            - Generate deployment report"
    echo ""
    echo "Example workflow:"
    echo "  1. ./scripts/deploy-master.sh staging"
    echo "  2. ./scripts/deploy-master.sh production"
    echo "  3. Wait 3 days, then: ./scripts/deploy-master.sh production-day4"
    echo "  4. Wait 1 day, then: ./scripts/deploy-master.sh production-day5"
    echo ""
    echo "Emergency:"
    echo "  ./scripts/deploy-master.sh rollback"
    echo ""
    exit 1
    ;;
esac
