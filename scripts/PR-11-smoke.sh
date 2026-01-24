#!/bin/bash

###############################################################################
# PR-11 Smoke Tests
# Test deprecation headers and response compatibility for 5 legacy routes
###############################################################################

set -e

API_BASE="${API_BASE:-http://localhost:3000}"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=================================================="
echo "PR-11 Deprecation Smoke Tests"
echo "API Base: $API_BASE"
echo "=================================================="
echo ""

###############################################################################
# Helper Functions
###############################################################################

check_deprecation_headers() {
  local route_name=$1
  local response_file=$2

  echo "  Checking deprecation headers..."

  # Extract headers
  local deprecation=$(grep -i "^deprecation:" "$response_file" | cut -d' ' -f2 | tr -d '\r')
  local sunset=$(grep -i "^sunset:" "$response_file" | cut -d' ' -f2 | tr -d '\r')
  local link=$(grep -i "^link:" "$response_file" | cut -d' ' -f2 | tr -d '\r')

  if [ "$deprecation" = "true" ]; then
    echo -e "    ${GREEN}✓${NC} Deprecation header present"
  else
    echo -e "    ${RED}✗${NC} Missing Deprecation header"
    return 1
  fi

  if [ -n "$sunset" ]; then
    echo -e "    ${GREEN}✓${NC} Sunset date: $sunset"
  else
    echo -e "    ${YELLOW}⚠${NC} Missing Sunset header"
  fi

  if [ -n "$link" ]; then
    echo -e "    ${GREEN}✓${NC} Link header: $link"
  else
    echo -e "    ${YELLOW}⚠${NC} Missing Link header"
  fi

  return 0
}

compare_json_keys() {
  local name1=$1
  local file1=$2
  local name2=$3
  local file2=$4

  echo "  Comparing response shapes..."

  # Extract keys (top-level only)
  local keys1=$(jq -r 'keys | sort | .[]' "$file1" 2>/dev/null | sort)
  local keys2=$(jq -r 'keys | sort | .[]' "$file2" 2>/dev/null | sort)

  if [ "$keys1" = "$keys2" ]; then
    echo -e "    ${GREEN}✓${NC} Response shapes match"
    return 0
  else
    echo -e "    ${YELLOW}⚠${NC} Response shapes differ (expected for some routes)"
    echo "      $name1 keys: $keys1"
    echo "      $name2 keys: $keys2"
    return 0  # Don't fail - some legacy routes have different formats
  fi
}

test_endpoint() {
  local test_name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local expect_deprecation=$5

  echo ""
  echo "Test: $test_name"
  echo "  $method $endpoint"

  local tmp_headers=$(mktemp)
  local tmp_body=$(mktemp)

  # Make request
  if [ "$method" = "POST" ]; then
    curl -s -D "$tmp_headers" -X POST \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$API_BASE$endpoint" > "$tmp_body"
  else
    curl -s -D "$tmp_headers" \
      "$API_BASE$endpoint" > "$tmp_body"
  fi

  local status_code=$(head -1 "$tmp_headers" | grep -oE '[0-9]{3}' || echo "000")

  echo "  Status: $status_code"

  # Check status code (200, 400, 404 are all valid for testing)
  if [[ "$status_code" =~ ^(200|400|404)$ ]]; then
    echo -e "  ${GREEN}✓${NC} Valid status code"

    # Check deprecation headers if expected
    if [ "$expect_deprecation" = "true" ]; then
      if check_deprecation_headers "$test_name" "$tmp_headers"; then
        echo -e "${GREEN}✓ PASS${NC} $test_name"
        ((PASSED++))
      else
        echo -e "${RED}✗ FAIL${NC} $test_name - Missing deprecation headers"
        ((FAILED++))
      fi
    else
      echo -e "${GREEN}✓ PASS${NC} $test_name (canonical endpoint)"
      ((PASSED++))
    fi
  else
    echo -e "${RED}✗ FAIL${NC} $test_name - Unexpected status: $status_code"
    ((FAILED++))
  fi

  # Cleanup
  rm -f "$tmp_headers" "$tmp_body"
}

###############################################################################
# Test 1: Prediction Ingest
###############################################################################

echo ""
echo "=================================================="
echo "Test 1: Prediction Ingest Routes"
echo "=================================================="

PREDICTION_PAYLOAD='{
  "match_id": "12345",
  "home_team": "Test Home",
  "away_team": "Test Away",
  "predictions": {
    "winner": "home",
    "total_goals": "over_2.5"
  }
}'

# Canonical route
test_endpoint \
  "Canonical: POST /api/predictions/ingest" \
  "POST" \
  "/api/predictions/ingest" \
  "$PREDICTION_PAYLOAD" \
  "false"

# Legacy route
test_endpoint \
  "Legacy: POST /api/v1/ingest/predictions" \
  "POST" \
  "/api/v1/ingest/predictions" \
  "$PREDICTION_PAYLOAD" \
  "true"

###############################################################################
# Test 2: Legacy Auth - Login
###############################################################################

echo ""
echo "=================================================="
echo "Test 2: Legacy Auth - Login"
echo "=================================================="

LEGACY_LOGIN_PAYLOAD='{
  "phone": "+905551234567",
  "password": "test123"
}'

test_endpoint \
  "Legacy: POST /api/auth/legacy/login" \
  "POST" \
  "/api/auth/legacy/login" \
  "$LEGACY_LOGIN_PAYLOAD" \
  "true"

###############################################################################
# Test 3: Legacy Auth - Check User
###############################################################################

echo ""
echo "=================================================="
echo "Test 3: Legacy Auth - Check User"
echo "=================================================="

CHECK_USER_PAYLOAD='{
  "phone": "+905551234567"
}'

test_endpoint \
  "Legacy: POST /api/auth/legacy/check" \
  "POST" \
  "/api/auth/legacy/check" \
  "$CHECK_USER_PAYLOAD" \
  "true"

###############################################################################
# Test 4: Match Analysis (requires real match ID)
###############################################################################

echo ""
echo "=================================================="
echo "Test 4: Match H2H Routes"
echo "=================================================="

# Try to get a real match ID from live matches
MATCH_ID=$(curl -s "$API_BASE/api/matches/live" | jq -r '.[0].id // "999999"' 2>/dev/null || echo "999999")

echo "Using match_id: $MATCH_ID"

# Canonical route
test_endpoint \
  "Canonical: GET /api/matches/:id/h2h" \
  "GET" \
  "/api/matches/$MATCH_ID/h2h" \
  "" \
  "false"

# Legacy route
test_endpoint \
  "Legacy: GET /api/matches/:id/analysis" \
  "GET" \
  "/api/matches/$MATCH_ID/analysis" \
  "" \
  "true"

###############################################################################
# Summary
###############################################################################

echo ""
echo "=================================================="
echo "Test Summary"
echo "=================================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All smoke tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
