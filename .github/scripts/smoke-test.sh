#!/bin/bash
set -euo pipefail

# Phase 5-2: Smoke Test Script
# Starts server, verifies /ready and /api/matches/live contract, then stops server.

PORT=3999
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_PID=""
LOG_FILE="/tmp/goalgpt-smoke-test.log"

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "🛑 Stopping server (PID: $SERVER_PID)..."
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    sleep 2
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "🚀 Starting server on port $PORT..."

# Start server in background
PORT=$PORT NODE_ENV=production npm run start > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "⏳ Waiting for server to start (PID: $SERVER_PID)..."

# Wait for /ready endpoint (max 60 seconds)
MAX_WAIT=60
ELAPSED=0
READY=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  if curl -s -f "${BASE_URL}/ready" > /dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [ $((ELAPSED % 5)) -eq 0 ]; then
    echo "  Still waiting... (${ELAPSED}s)"
  fi
done

if [ "$READY" != "true" ]; then
  echo "❌ Server did not become ready within ${MAX_WAIT}s"
  echo "📋 Last 50 lines of server log:"
  tail -50 "$LOG_FILE"
  exit 1
fi

echo "✅ Server is ready"

# Test /ready endpoint
echo "🔍 Testing /ready endpoint..."
READY_RESPONSE=$(curl -s "${BASE_URL}/ready")
READY_OK=$(echo "$READY_RESPONSE" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.ok ? 'true' : 'false');" || echo "false")

if [ "$READY_OK" != "true" ]; then
  echo "❌ /ready endpoint returned ok=false"
  echo "Response: $READY_RESPONSE"
  exit 1
fi

echo "✅ /ready endpoint OK"

# Test /api/matches/live contract (minute_text must be present for all matches)
echo "🔍 Testing /api/matches/live contract (minute_text)..."
LIVE_RESPONSE=$(curl -s "${BASE_URL}/api/matches/live")

# Check that every match has minute_text
LIVE_CHECK=$(echo "$LIVE_RESPONSE" | node -e "
const fs = require('fs');
const raw = fs.readFileSync(0, 'utf-8');
const j = JSON.parse(raw);
const matches = (j.data?.results) || (j.results) || [];
const missing = matches.filter(m => m.minute_text == null || m.minute_text === '');
if (missing.length) {
  console.error('FAIL: ' + missing.length + ' matches missing minute_text');
  process.exit(1);
}
console.log('PASS: ' + matches.length + ' matches, all have minute_text');
" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ /api/matches/live contract check FAILED"
  echo "$LIVE_CHECK"
  exit 1
fi

echo "✅ $LIVE_CHECK"

echo "✅ All smoke tests passed"





