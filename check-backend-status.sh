#!/bin/bash
echo "🔍 Checking backend status..."
echo ""
echo "1. Testing localhost API:"
curl -s http://localhost:3000/api/health | head -20 || echo "❌ Backend not responding on localhost:3000"
echo ""
echo "2. Testing live matches endpoint:"
curl -s http://localhost:3000/api/matches/live | head -50 || echo "❌ /api/matches/live not responding"
