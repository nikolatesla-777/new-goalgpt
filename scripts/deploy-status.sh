#!/bin/bash
#
# DEPLOYMENT STATUS CHECKER
#
# Real-time monitoring of deployment progress
#
# Usage:
#   ./scripts/deploy-status.sh                  # Check all environments
#   ./scripts/deploy-status.sh staging          # Check staging only
#   ./scripts/deploy-status.sh production       # Check production only
#

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
STAGING_HOST="${STAGING_HOST:-staging.goalgpt.com}"
PRODUCTION_HOST="${PRODUCTION_HOST:-production.goalgpt.com}"
PROJECT_DIR="/var/www/goalgpt"

# Function: Get feature flag status
check_feature_flags() {
  local host=$1
  local env_name=$2

  echo ""
  echo -e "${BLUE}========================================"
  echo -e "${env_name} - FEATURE FLAGS STATUS"
  echo -e "========================================${NC}"

  local flags=$(ssh "root@$host" "cd $PROJECT_DIR && pm2 env goalgpt-api 2>/dev/null" | grep -E "USE_OPTIMIZED|CONCURRENCY|USE_REDIS_CACHE|CACHE_" || echo "")

  if [ -z "$flags" ]; then
    echo -e "${YELLOW}⚠️  No feature flags detected${NC}"
    return
  fi

  echo "$flags" | while read line; do
    if [[ $line == *"true"* ]]; then
      echo -e "${GREEN}✅${NC} $line"
    elif [[ $line == *"false"* ]]; then
      echo -e "${RED}❌${NC} $line"
    else
      echo -e "${YELLOW}ℹ️${NC}  $line"
    fi
  done
}

# Function: Check database indexes
check_indexes() {
  local host=$1
  local env_name=$2

  echo ""
  echo -e "${BLUE}========================================"
  echo -e "${env_name} - DATABASE INDEXES"
  echo -e "========================================${NC}"

  local index_count=$(ssh "root@$host" "cd $PROJECT_DIR && psql \$DATABASE_URL -t -c \"SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_%';\"" 2>/dev/null || echo "0")

  echo "Total custom indexes: $index_count"

  if [ "$index_count" -ge 20 ]; then
    echo -e "${GREEN}✅ PR-P1A indexes deployed${NC}"
  else
    echo -e "${YELLOW}⚠️  PR-P1A indexes missing${NC}"
  fi

  if [ "$index_count" -ge 29 ]; then
    echo -e "${GREEN}✅ PR-P1D indexes deployed${NC}"
  else
    echo -e "${YELLOW}⚠️  PR-P1D indexes missing${NC}"
  fi
}

# Function: Check pool utilization
check_pool() {
  local host=$1
  local env_name=$2

  echo ""
  echo -e "${BLUE}========================================"
  echo -e "${env_name} - DATABASE POOL"
  echo -e "========================================${NC}"

  local pool_stats=$(ssh "root@$host" "curl -s http://localhost:3000/health/pool 2>/dev/null" || echo "{}")

  if [ "$pool_stats" == "{}" ]; then
    echo -e "${RED}❌ Cannot fetch pool stats${NC}"
    return
  fi

  local active=$(echo "$pool_stats" | jq -r '.active // 0' 2>/dev/null || echo "0")
  local total=$(echo "$pool_stats" | jq -r '.total // 20' 2>/dev/null || echo "20")
  local utilization=$((active * 100 / total))

  echo "Active connections: $active / $total"
  echo "Utilization: ${utilization}%"

  if [ "$utilization" -lt 50 ]; then
    echo -e "${GREEN}✅ HEALTHY (< 50%)${NC}"
  elif [ "$utilization" -lt 75 ]; then
    echo -e "${YELLOW}⚠️  WARNING (50-75%)${NC}"
  else
    echo -e "${RED}❌ CRITICAL (> 75%)${NC}"
  fi
}

# Function: Check Redis cache
check_cache() {
  local host=$1
  local env_name=$2

  echo ""
  echo -e "${BLUE}========================================"
  echo -e "${env_name} - REDIS CACHE"
  echo -e "========================================${NC}"

  local redis_ping=$(ssh "root@$host" "redis-cli ping 2>/dev/null" || echo "")

  if [ "$redis_ping" != "PONG" ]; then
    echo -e "${YELLOW}⚠️  Redis not available${NC}"
    return
  fi

  echo -e "${GREEN}✅ Redis connected${NC}"

  local key_count=$(ssh "root@$host" "redis-cli DBSIZE 2>/dev/null" | grep -oP '\d+' || echo "0")
  echo "Cached keys: $key_count"

  local hits=$(ssh "root@$host" "redis-cli INFO stats 2>/dev/null" | grep keyspace_hits | grep -oP '\d+' || echo "0")
  local misses=$(ssh "root@$host" "redis-cli INFO stats 2>/dev/null" | grep keyspace_misses | grep -oP '\d+' || echo "1")

  if [ "$hits" -gt 0 ]; then
    local hit_rate=$((hits * 100 / (hits + misses)))
    echo "Cache hit rate: ${hit_rate}%"

    if [ "$hit_rate" -ge 80 ]; then
      echo -e "${GREEN}✅ Excellent (≥80%)${NC}"
    elif [ "$hit_rate" -ge 60 ]; then
      echo -e "${YELLOW}⚠️  Good (60-80%)${NC}"
    else
      echo -e "${RED}❌ Poor (<60%)${NC}"
    fi
  fi
}

# Function: Check job performance
check_jobs() {
  local host=$1
  local env_name=$2

  echo ""
  echo -e "${BLUE}========================================"
  echo -e "${env_name} - JOB PERFORMANCE"
  echo -e "========================================${NC}"

  # Check last daily rewards job
  local last_daily=$(ssh "root@$host" "cd $PROJECT_DIR && tail -100 logs/combined.log | grep 'Daily Reward' | tail -1" 2>/dev/null || echo "")

  if [ -n "$last_daily" ]; then
    echo "Last daily rewards job:"
    echo "$last_daily"

    if echo "$last_daily" | grep -q "✅ Optimized"; then
      echo -e "${GREEN}✅ Using optimized path${NC}"
    else
      echo -e "${YELLOW}⚠️  Using legacy path${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  No recent daily rewards job${NC}"
  fi
}

# Function: Overall health check
check_environment() {
  local host=$1
  local env_name=$2

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}   ${env_name} ENVIRONMENT STATUS${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Check connectivity
  if ! ssh -o ConnectTimeout=5 "root@$host" "echo 'Connected'" &>/dev/null; then
    echo -e "${RED}❌ Cannot connect to $host${NC}"
    return 1
  fi

  echo -e "${GREEN}✅ Connected to $host${NC}"

  # Run all checks
  check_feature_flags "$host" "$env_name"
  check_indexes "$host" "$env_name"
  check_pool "$host" "$env_name"
  check_cache "$host" "$env_name"
  check_jobs "$host" "$env_name"

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Main script
case "${1:-all}" in
  staging)
    check_environment "$STAGING_HOST" "STAGING"
    ;;

  production)
    check_environment "$PRODUCTION_HOST" "PRODUCTION"
    ;;

  all|*)
    check_environment "$STAGING_HOST" "STAGING"
    echo ""
    check_environment "$PRODUCTION_HOST" "PRODUCTION"
    ;;
esac

echo ""
echo -e "${BLUE}Status check complete.${NC}"
echo ""
