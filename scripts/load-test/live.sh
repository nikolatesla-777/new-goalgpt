#!/bin/bash
# Phase 4-5 WS1: Load test for /api/matches/live endpoint
# Usage: ./scripts/load-test/live.sh

set -e

echo "🚀 Load Testing: /api/matches/live"
echo "==================================="
echo "Configuration: 50 concurrent connections, 30 seconds duration"
echo ""

autocannon -c 50 -d 30 http://localhost:3000/api/matches/live




