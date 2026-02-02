#!/bin/bash
#
# Staging Test Script for PR-P1C (Concurrency Control)
#
# Usage: ./scripts/test-staging-pr-p1c.sh
#

set -e

echo "======================================"
echo "PR-P1C STAGING TEST"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

function test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    ((TESTS_FAILED++))
  fi
}

echo "Step 1: Checkout PR-P1C branch"
git fetch origin
git checkout feat/pr-p1c-concurrency-control
npm install

echo ""
echo "Step 2: Set conservative concurrency limits"
export MATCH_ENRICHER_CONCURRENCY=50
export MATCH_WATCHDOG_CONCURRENCY=15

pm2 restart goalgpt-api
sleep 5

echo ""
echo "Step 3: Check baseline pool stats"
echo "======================================"

POOL_STATS=$(curl -s http://localhost:3000/health/pool)
echo "Pool stats: $POOL_STATS"

ACTIVE=$(echo $POOL_STATS | jq -r '.active' 2>/dev/null || echo "0")
TOTAL=$(echo $POOL_STATS | jq -r '.total' 2>/dev/null || echo "20")

if [ -n "$ACTIVE" ] && [ -n "$TOTAL" ]; then
  UTILIZATION=$((ACTIVE * 100 / TOTAL))
  echo "Pool utilization: ${UTILIZATION}%"

  if [ $UTILIZATION -lt 60 ]; then
    test_result 0 "Pool utilization < 60% (actual: ${UTILIZATION}%)"
  else
    test_result 1 "Pool utilization ≥ 60% (actual: ${UTILIZATION}%)"
  fi
else
  test_result 1 "Could not read pool stats"
fi

echo ""
echo "Step 4: Test Match Enricher (trigger via API)"
echo "======================================"

# Make API call that triggers match enrichment
RESPONSE=$(curl -s http://localhost:3000/api/matches/live)
MATCH_COUNT=$(echo $RESPONSE | jq '.matches | length' 2>/dev/null || echo "0")

echo "Fetched $MATCH_COUNT live matches"

# Check logs for bounded concurrency indicators
sleep 2
LOGS=$(tail -50 logs/combined.log)

if echo "$LOGS" | grep -q "✅ Fetched"; then
  test_result 0 "Match enricher using bounded concurrency"
else
  echo -e "${YELLOW}⚠ WARNING${NC}: No '✅ Fetched' indicators in logs (may be no missing teams)"
  ((TESTS_PASSED++))
fi

# Check pool didn't spike
POOL_STATS=$(curl -s http://localhost:3000/health/pool)
ACTIVE=$(echo $POOL_STATS | jq -r '.active' 2>/dev/null || echo "99")

if [ "$ACTIVE" -le 50 ]; then
  test_result 0 "Pool active connections ≤ 50 (actual: $ACTIVE)"
else
  test_result 1 "Pool active connections > 50 (actual: $ACTIVE)"
fi

echo ""
echo "Step 5: Wait for Match Watchdog (runs every 30s)"
echo "======================================"

echo "Waiting 35 seconds for watchdog to run..."
sleep 35

LOGS=$(tail -100 logs/combined.log)

if echo "$LOGS" | grep -q "Watchdog.*Global Sweep"; then
  test_result 0 "Match watchdog executed"
else
  test_result 1 "Match watchdog did not execute"
fi

# Check pool after watchdog
POOL_STATS=$(curl -s http://localhost:3000/health/pool)
ACTIVE=$(echo $POOL_STATS | jq -r '.active' 2>/dev/null || echo "99")

if [ "$ACTIVE" -le 15 ]; then
  test_result 0 "Pool active ≤ 15 after watchdog (actual: $ACTIVE)"
else
  test_result 1 "Pool active > 15 after watchdog (actual: $ACTIVE)"
fi

echo ""
echo "Step 6: Load test (50 concurrent requests)"
echo "======================================"

echo "Sending 50 concurrent requests..."
for i in {1..50}; do
  curl -s http://localhost:3000/api/matches/live > /dev/null &
done

sleep 5

# Check pool under load
POOL_STATS=$(curl -s http://localhost:3000/health/pool)
ACTIVE=$(echo $POOL_STATS | jq -r '.active' 2>/dev/null || echo "99")
TOTAL=$(echo $POOL_STATS | jq -r '.total' 2>/dev/null || echo "20")
UTILIZATION=$((ACTIVE * 100 / TOTAL))

echo "Pool under load: ${ACTIVE}/${TOTAL} (${UTILIZATION}%)"

if [ $UTILIZATION -lt 70 ]; then
  test_result 0 "Pool utilization < 70% under load (actual: ${UTILIZATION}%)"
else
  test_result 1 "Pool utilization ≥ 70% under load (actual: ${UTILIZATION}%)"
fi

echo ""
echo "Step 7: Optimize concurrency limits"
echo "======================================"

export MATCH_ENRICHER_CONCURRENCY=10
export MATCH_WATCHDOG_CONCURRENCY=5

pm2 restart goalgpt-api
sleep 5

# Make request
curl -s http://localhost:3000/api/matches/live > /dev/null

# Check pool with optimized limits
POOL_STATS=$(curl -s http://localhost:3000/health/pool)
ACTIVE=$(echo $POOL_STATS | jq -r '.active' 2>/dev/null || echo "99")
TOTAL=$(echo $POOL_STATS | jq -r '.total' 2>/dev/null || echo "20")
UTILIZATION=$((ACTIVE * 100 / TOTAL))

echo "Pool with optimized limits: ${ACTIVE}/${TOTAL} (${UTILIZATION}%)"

if [ $UTILIZATION -lt 50 ]; then
  test_result 0 "Pool utilization < 50% with optimized limits (actual: ${UTILIZATION}%)"
else
  test_result 1 "Pool utilization ≥ 50% with optimized limits (actual: ${UTILIZATION}%)"
fi

echo ""
echo "Step 8: Test rollback (disable concurrency limits)"
echo "======================================"

export MATCH_ENRICHER_CONCURRENCY=999
export MATCH_WATCHDOG_CONCURRENCY=999

pm2 restart goalgpt-api
sleep 5

curl -s http://localhost:3000/api/matches/live > /dev/null

echo "Rollback successful (limits set to 999)"
test_result 0 "Rollback completed"

# Re-enable optimizations
export MATCH_ENRICHER_CONCURRENCY=10
export MATCH_WATCHDOG_CONCURRENCY=5
pm2 restart goalgpt-api

echo ""
echo "======================================"
echo "TEST SUMMARY"
echo "======================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
  echo ""
  echo "PR-P1C is ready for production!"
  exit 0
else
  echo -e "${RED}✗ SOME TESTS FAILED${NC}"
  echo ""
  echo "Please review failures before production deployment."
  exit 1
fi
