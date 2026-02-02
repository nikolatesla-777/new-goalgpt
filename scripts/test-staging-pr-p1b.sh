#!/bin/bash
#
# Staging Test Script for PR-P1B (N+1 Query Elimination)
#
# Usage: ./scripts/test-staging-pr-p1b.sh
#

set -e

echo "======================================"
echo "PR-P1B STAGING TEST"
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

echo "Step 1: Checkout PR-P1B branch"
git fetch origin
git checkout feat/pr-p1b-n+1-elimination
npm install

echo ""
echo "Step 2: Enable all feature flags"
export USE_OPTIMIZED_DAILY_REWARDS=true
export USE_OPTIMIZED_BADGE_UNLOCK=true
export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=true

pm2 restart goalgpt-api
sleep 5

echo ""
echo "Step 3: Test Daily Reward Reminders"
echo "======================================"

# Run job and capture output
OUTPUT=$(npm run job:dailyRewardReminders 2>&1 || true)

# Check for optimized indicator
if echo "$OUTPUT" | grep -q "✅ Optimized:"; then
  test_result 0 "Daily rewards using optimized path"
else
  test_result 1 "Daily rewards NOT using optimized path"
fi

# Check query count
QUERY_COUNT=$(echo "$OUTPUT" | grep -oP "(?<=\()\\d+(?= queries total)" || echo "999")
if [ "$QUERY_COUNT" -le 3 ]; then
  test_result 0 "Query count ≤ 3 (actual: $QUERY_COUNT)"
else
  test_result 1 "Query count > 3 (actual: $QUERY_COUNT)"
fi

# Check execution time
DURATION=$(echo "$OUTPUT" | grep -oP "(?<=in )\\d+(?=ms)" | tail -1 || echo "99999")
if [ "$DURATION" -lt 5000 ]; then
  test_result 0 "Execution time < 5s (actual: ${DURATION}ms)"
else
  test_result 1 "Execution time ≥ 5s (actual: ${DURATION}ms)"
fi

echo ""
echo "Step 4: Test Badge Auto-Unlock"
echo "======================================"

OUTPUT=$(npm run job:badgeAutoUnlock 2>&1 || true)

if echo "$OUTPUT" | grep -q "✅ Batch unlocked:"; then
  test_result 0 "Badge unlock using batch insert"
else
  test_result 1 "Badge unlock NOT using batch insert"
fi

DURATION=$(echo "$OUTPUT" | grep -oP "(?<=in )\\d+(?=ms)" | tail -1 || echo "99999")
if [ "$DURATION" -lt 10000 ]; then
  test_result 0 "Execution time < 10s (actual: ${DURATION}ms)"
else
  test_result 1 "Execution time ≥ 10s (actual: ${DURATION}ms)"
fi

echo ""
echo "Step 5: Test Scheduled Notifications"
echo "======================================"

OUTPUT=$(npm run job:scheduledNotifications 2>&1 || true)

if echo "$OUTPUT" | grep -q "Scheduled Notifications"; then
  test_result 0 "Scheduled notifications job completed"
else
  test_result 1 "Scheduled notifications job failed"
fi

echo ""
echo "Step 6: Test Rollback (Disable Optimizations)"
echo "======================================"

export USE_OPTIMIZED_DAILY_REWARDS=false
pm2 restart goalgpt-api
sleep 5

OUTPUT=$(npm run job:dailyRewardReminders 2>&1 || true)

if echo "$OUTPUT" | grep -q "❌ Legacy:"; then
  test_result 0 "Rollback to legacy path successful"
else
  test_result 1 "Rollback to legacy path failed"
fi

# Re-enable optimizations
export USE_OPTIMIZED_DAILY_REWARDS=true
export USE_OPTIMIZED_BADGE_UNLOCK=true
export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=true
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
  echo "PR-P1B is ready for production!"
  exit 0
else
  echo -e "${RED}✗ SOME TESTS FAILED${NC}"
  echo ""
  echo "Please review failures before production deployment."
  exit 1
fi
