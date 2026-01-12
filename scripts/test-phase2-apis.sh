#!/bin/bash

###############################################################################
# Phase 2 API Testing Script
# Interactive test runner for 18 Phase 2 API endpoints
#
# Usage: ./scripts/test-phase2-apis.sh [BASE_URL]
# Example: ./scripts/test-phase2-apis.sh https://staging.goalgpt.com
###############################################################################

set -e

# Configuration
BASE_URL="${1:-http://localhost:3000}"
TEST_RESULTS_FILE="test-results-phase2-$(date +%Y%m%d-%H%M%S).log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
TOTAL=0

echo "=========================================="
echo "Phase 2 API Testing Suite"
echo "=========================================="
echo ""
echo "Target: $BASE_URL"
echo "Results: $TEST_RESULTS_FILE"
echo ""

# Helper function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local headers="$5"
    local data="$6"

    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}[$TOTAL] Testing: $name${NC}"
    echo "  $method $endpoint"

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" $headers)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" $headers -d "$data")
    fi

    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status" == "$expected_status" ]; then
        echo -e "  ${GREEN}✅ PASS${NC} (HTTP $status)"
        PASSED=$((PASSED + 1))
        echo "[$TOTAL] PASS: $name (HTTP $status)" >> "$TEST_RESULTS_FILE"
    else
        echo -e "  ${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $status)"
        echo "  Response: $body"
        FAILED=$((FAILED + 1))
        echo "[$TOTAL] FAIL: $name (Expected: $expected_status, Got: $status)" >> "$TEST_RESULTS_FILE"
        echo "  Response: $body" >> "$TEST_RESULTS_FILE"
    fi
    echo ""
}

echo "=========================================="
echo "1. Health & Infrastructure Tests"
echo "=========================================="
echo ""

# Test 1: Health endpoint
test_endpoint "Health Check" "GET" "/api/health" "200"

echo "=========================================="
echo "2. Authentication Tests (Public Endpoints)"
echo "=========================================="
echo ""

# Test 2: Get user profile without token (should fail)
test_endpoint "Get Profile (No Auth)" "GET" "/api/auth/me" "401"

# Test 3: Token refresh without token (should fail)
test_endpoint "Refresh Token (No Token)" "POST" "/api/auth/refresh" "400" \
    "-H 'Content-Type: application/json'"

echo -e "${YELLOW}⚠️  OAuth tests require valid ID tokens.${NC}"
echo -e "${YELLOW}   These should be tested manually via mobile app or Firebase emulator.${NC}"
echo ""

echo "=========================================="
echo "3. XP System Tests (Public Endpoints)"
echo "=========================================="
echo ""

# Test 4: XP Leaderboard (public)
test_endpoint "XP Leaderboard" "GET" "/api/xp/leaderboard?limit=10" "200"

echo "=========================================="
echo "4. XP System Tests (Protected Endpoints)"
echo "=========================================="
echo ""

echo -e "${YELLOW}⚠️  Testing protected XP endpoints requires authentication.${NC}"
echo ""
echo "To test protected endpoints, you need a valid access token."
echo "Options:"
echo "  1. Sign in via OAuth to get a token"
echo "  2. Use an existing token from production/staging"
echo "  3. Generate a test token (for development only)"
echo ""
read -p "Do you have an access token? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter access token: " ACCESS_TOKEN
    echo ""

    # Test 5: Get user XP profile
    test_endpoint "Get User XP" "GET" "/api/xp/me" "200" \
        "-H 'Authorization: Bearer $ACCESS_TOKEN'"

    # Test 6: Update login streak
    test_endpoint "Update Login Streak" "POST" "/api/xp/login-streak" "200" \
        "-H 'Authorization: Bearer $ACCESS_TOKEN'"

    # Test 7: Get XP transactions
    test_endpoint "Get XP Transactions" "GET" "/api/xp/transactions?limit=10" "200" \
        "-H 'Authorization: Bearer $ACCESS_TOKEN'"

    echo "=========================================="
    echo "5. Credits System Tests (Protected Endpoints)"
    echo "=========================================="
    echo ""

    # Test 8: Get user credits
    test_endpoint "Get User Credits" "GET" "/api/credits/me" "200" \
        "-H 'Authorization: Bearer $ACCESS_TOKEN'"

    # Test 9: Get credit transactions
    test_endpoint "Get Credit Transactions" "GET" "/api/credits/transactions?limit=10" "200" \
        "-H 'Authorization: Bearer $ACCESS_TOKEN'"

    # Test 10: Get daily stats
    test_endpoint "Get Daily Stats" "GET" "/api/credits/daily-stats" "200" \
        "-H 'Authorization: Bearer $ACCESS_TOKEN'"

    # Test 11: Process ad reward
    echo "Testing ad reward endpoint..."
    test_endpoint "Process Ad Reward (1st)" "POST" "/api/credits/ad-reward" "200" \
        "-H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json'" \
        '{"adNetwork":"admob","adUnitId":"test-unit","adType":"rewarded_video","deviceId":"test-device"}'

    # Test 12: Verify ad fraud prevention (attempt 11th ad)
    echo "Testing ad fraud prevention..."
    echo "Attempting to watch 10 more ads rapidly..."
    for i in {2..11}; do
        status=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/credits/ad-reward" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"adNetwork\":\"admob\",\"adUnitId\":\"test-unit\",\"adType\":\"rewarded_video\",\"deviceId\":\"test-device-$i\"}")

        if [ $i -le 10 ]; then
            if [ "$status" == "200" ]; then
                echo "  Ad $i: ✅ Accepted (HTTP 200)"
            else
                echo "  Ad $i: ❌ Unexpected status $status"
            fi
        else
            if [ "$status" == "429" ]; then
                echo -e "  Ad $i: ${GREEN}✅ Correctly blocked${NC} (HTTP 429 - Fraud prevention working)"
                PASSED=$((PASSED + 1))
            else
                echo -e "  Ad $i: ${RED}❌ Should be blocked${NC} (Got HTTP $status)"
                FAILED=$((FAILED + 1))
            fi
        fi
    done
    TOTAL=$((TOTAL + 1))
    echo ""

else
    echo -e "${YELLOW}⚠️  Skipping protected endpoint tests (no auth token provided)${NC}"
    echo ""
fi

echo "=========================================="
echo "6. Admin Endpoint Tests"
echo "=========================================="
echo ""

echo -e "${YELLOW}⚠️  Admin endpoint tests require admin credentials.${NC}"
echo ""
read -p "Do you have an admin token? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter admin token: " ADMIN_TOKEN
    echo ""

    # Test 13: Grant XP (admin)
    test_endpoint "Grant XP (Admin)" "POST" "/api/xp/grant" "200" \
        "-H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json'" \
        '{"userId":"test-user-id","amount":100,"transactionType":"admin_grant","description":"Test XP grant"}'

    # Test 14: Grant Credits (admin)
    test_endpoint "Grant Credits (Admin)" "POST" "/api/credits/grant" "200" \
        "-H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json'" \
        '{"userId":"test-user-id","amount":50,"transactionType":"admin_grant","description":"Test credit grant"}'

else
    echo -e "${YELLOW}⚠️  Skipping admin endpoint tests (no admin token provided)${NC}"
    echo ""
fi

echo "=========================================="
echo "Test Results Summary"
echo "=========================================="
echo ""
echo -e "Total Tests:  $TOTAL"
echo -e "Passed:       ${GREEN}$PASSED${NC}"
echo -e "Failed:       ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo ""
    echo "Phase 2 API endpoints are working correctly."
    echo ""
    echo "Next Steps:"
    echo "1. Test OAuth flows manually via mobile app"
    echo "2. Verify database records created correctly"
    echo "3. Monitor for 24 hours on staging"
    echo "4. Proceed to production deployment"
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "Review the failures above and check:"
    echo "1. Server logs: pm2 logs goalgpt"
    echo "2. Database connectivity"
    echo "3. Environment variables (JWT_SECRET, etc.)"
    echo ""
    echo "Fix issues before proceeding to production."
fi

echo ""
echo "Detailed results saved to: $TEST_RESULTS_FILE"
echo ""
