#!/bin/bash
# Phase 4-5 WS1: Load test for /api/matches/recent endpoint
# Usage: ./scripts/load-test/recent.sh

set -e

echo "🚀 Load Testing: /api/matches/recent"
echo "===================================="
echo "Configuration: 30 concurrent connections, 30 seconds duration"
echo ""

autocannon -c 30 -d 30 "http://localhost:3000/api/matches/recent?page=1&limit=50"


