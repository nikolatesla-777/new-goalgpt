#!/bin/bash

# PR-F1 Verification Script
# Tests the "Son güncelleme" timestamp fix

echo "============================================"
echo "PR-F1: Timestamp Display Fix - Verification"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${1:-https://partnergoalgpt.com/api/telegram/daily-lists}"

echo "📍 Testing API: $API_URL"
echo ""

# Test 1: Check /today endpoint
echo "Test 1: /today endpoint timestamp"
echo "-----------------------------------"
RESPONSE=$(curl -s "$API_URL/today")
GENERATED_AT=$(echo "$RESPONSE" | jq -r '.generated_at')
FIRST_LIST_AT=$(echo "$RESPONSE" | jq -r '.lists[0].generated_at // "null"')

echo "API generated_at:       $GENERATED_AT"
echo "First list generated_at: $FIRST_LIST_AT"

if [ "$GENERATED_AT" = "$FIRST_LIST_AT" ]; then
    echo -e "${GREEN}✅ PASS: Timestamps match${NC}"
else
    echo -e "${RED}❌ FAIL: Timestamps don't match${NC}"
fi
echo ""

# Test 2: Check if timestamp is from database (not current time)
echo "Test 2: Timestamp is historical (not current time)"
echo "---------------------------------------------------"
CURRENT_TIME=$(date +%s)000  # Current timestamp in milliseconds
TIME_DIFF=$((CURRENT_TIME - GENERATED_AT))
TIME_DIFF_SECONDS=$((TIME_DIFF / 1000))

echo "Current time: $CURRENT_TIME"
echo "Generated at: $GENERATED_AT"
echo "Difference:   ${TIME_DIFF_SECONDS}s ago"

if [ $TIME_DIFF_SECONDS -gt 60 ]; then
    echo -e "${GREEN}✅ PASS: Timestamp is historical (> 1 minute old)${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Timestamp is very recent (< 1 minute)${NC}"
fi
echo ""

# Test 3: Check /range endpoint includes generated_at
echo "Test 3: /range endpoint includes generated_at"
echo "----------------------------------------------"
END_DATE=$(date +%Y-%m-%d)
START_DATE=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "1 day ago" +%Y-%m-%d)
RANGE_RESPONSE=$(curl -s "$API_URL/range?start=$START_DATE&end=$END_DATE")
RANGE_GENERATED_AT=$(echo "$RANGE_RESPONSE" | jq -r '.data[0].generated_at // "null"')

echo "Range endpoint generated_at: $RANGE_GENERATED_AT"

if [ "$RANGE_GENERATED_AT" != "null" ] && [ "$RANGE_GENERATED_AT" != "" ]; then
    echo -e "${GREEN}✅ PASS: Range endpoint includes generated_at${NC}"
else
    echo -e "${RED}❌ FAIL: Range endpoint missing generated_at${NC}"
fi
echo ""

# Test 4: Display human-readable timestamps
echo "Test 4: Human-readable timestamp display"
echo "-----------------------------------------"
if [ "$GENERATED_AT" != "null" ]; then
    # Convert milliseconds to seconds for date command
    TIMESTAMP_SECONDS=$((GENERATED_AT / 1000))
    READABLE_DATE=$(date -r $TIMESTAMP_SECONDS "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -d "@$TIMESTAMP_SECONDS" "+%Y-%m-%d %H:%M:%S")
    echo "Generated at: $READABLE_DATE"
    echo -e "${GREEN}✅ This should match the time shown in admin panel${NC}"
else
    echo -e "${RED}❌ No timestamp available${NC}"
fi
echo ""

echo "============================================"
echo "Verification Complete"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Open https://partnergoalgpt.com/admin/telegram/daily-lists"
echo "2. Verify 'Son güncelleme' shows: $READABLE_DATE"
echo "3. Check 'Dün', 'Son 7 Gün', 'Bu Ay' tabs show timestamps"
echo ""
