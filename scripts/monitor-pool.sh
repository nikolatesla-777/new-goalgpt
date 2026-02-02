#!/bin/bash
#
# Pool Monitoring Script
#
# Usage: ./scripts/monitor-pool.sh [duration_minutes]
# Example: ./scripts/monitor-pool.sh 60  # Monitor for 60 minutes
#

# Default to 30 minutes if no duration specified
DURATION=${1:-30}
INTERVAL=5  # Check every 5 seconds

echo "======================================"
echo "DATABASE POOL MONITOR"
echo "======================================"
echo "Duration: ${DURATION} minutes"
echo "Interval: ${INTERVAL} seconds"
echo "Started: $(date)"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Statistics
MAX_ACTIVE=0
MAX_UTILIZATION=0
TOTAL_CHECKS=0
WARNINGS=0

# Calculate end time
END_TIME=$(($(date +%s) + DURATION * 60))

# Header
printf "%-20s %-10s %-10s %-10s %-15s %-15s\n" "Time" "Active" "Idle" "Waiting" "Utilization" "Status"
echo "------------------------------------------------------------------------------------"

while [ $(date +%s) -lt $END_TIME ]; do
  # Fetch pool stats
  POOL_STATS=$(curl -s http://localhost:3000/health/pool 2>/dev/null)

  if [ -n "$POOL_STATS" ]; then
    ACTIVE=$(echo $POOL_STATS | jq -r '.active' 2>/dev/null || echo "0")
    IDLE=$(echo $POOL_STATS | jq -r '.idle' 2>/dev/null || echo "0")
    WAITING=$(echo $POOL_STATS | jq -r '.waiting' 2>/dev/null || echo "0")
    TOTAL=$(echo $POOL_STATS | jq -r '.total' 2>/dev/null || echo "20")

    # Calculate utilization
    if [ -n "$ACTIVE" ] && [ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
      UTILIZATION=$((ACTIVE * 100 / TOTAL))
    else
      UTILIZATION=0
    fi

    # Track max values
    if [ "$ACTIVE" -gt "$MAX_ACTIVE" ]; then
      MAX_ACTIVE=$ACTIVE
    fi

    if [ "$UTILIZATION" -gt "$MAX_UTILIZATION" ]; then
      MAX_UTILIZATION=$UTILIZATION
    fi

    # Determine status
    STATUS=""
    if [ "$UTILIZATION" -lt 50 ]; then
      STATUS="${GREEN}HEALTHY${NC}"
    elif [ "$UTILIZATION" -lt 75 ]; then
      STATUS="${YELLOW}WARNING${NC}"
      ((WARNINGS++))
    else
      STATUS="${RED}CRITICAL${NC}"
      ((WARNINGS++))
    fi

    # Display
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    printf "%-20s %-10s %-10s %-10s %-15s " "$TIMESTAMP" "$ACTIVE" "$IDLE" "$WAITING" "${UTILIZATION}%"
    echo -e "$STATUS"

    ((TOTAL_CHECKS++))
  else
    echo "$(date +"%Y-%m-%d %H:%M:%S") - ERROR: Could not fetch pool stats"
  fi

  sleep $INTERVAL
done

echo ""
echo "======================================"
echo "MONITORING SUMMARY"
echo "======================================"
echo "Duration: ${DURATION} minutes"
echo "Total checks: $TOTAL_CHECKS"
echo "Max active connections: $MAX_ACTIVE"
echo "Max utilization: ${MAX_UTILIZATION}%"
echo "Warnings: $WARNINGS"
echo ""

if [ $MAX_UTILIZATION -lt 50 ]; then
  echo -e "${GREEN}✓ EXCELLENT${NC}: Pool utilization stayed below 50%"
elif [ $MAX_UTILIZATION -lt 75 ]; then
  echo -e "${YELLOW}⚠ ACCEPTABLE${NC}: Pool utilization reached ${MAX_UTILIZATION}%"
else
  echo -e "${RED}✗ CRITICAL${NC}: Pool utilization exceeded 75% (max: ${MAX_UTILIZATION}%)"
fi

echo ""
echo "Completed: $(date)"
