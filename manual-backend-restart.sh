#!/bin/bash
# Manual backend restart on VPS - EMERGENCY FIX

echo "🚨 EMERGENCY: Restarting backend on VPS..."

ssh root@142.93.103.128 << 'EOF'
  set -e
  
  cd /var/www/goalgpt
  
  echo "📥 Pulling latest code..."
  git pull origin main || echo "⚠️ Git pull failed, continuing..."
  
  echo "📦 Installing dependencies..."
  npm install --production || echo "⚠️ npm install failed, continuing..."
  
  echo "📁 Creating logs directory..."
  mkdir -p logs
  
  echo "🔄 Stopping existing backend..."
  pm2 stop goalgpt-backend 2>/dev/null || pm2 delete goalgpt-backend 2>/dev/null || echo "No existing process"
  
  echo "🆕 Starting backend..."
  if [ -f ecosystem.config.js ]; then
    echo "Using ecosystem.config.js"
    pm2 start ecosystem.config.js
  else
    echo "Using npm start"
    pm2 start npm --name "goalgpt-backend" -- start
  fi
  
  echo "💾 Saving PM2 process list..."
  pm2 save || echo "⚠️ pm2 save failed"
  
  echo "⏳ Waiting 5 seconds for backend to start..."
  sleep 5
  
  echo "🏥 Health check..."
  for i in {1..15}; do
    if curl -f -s http://localhost:3000/ready > /dev/null 2>&1; then
      echo "✅ Backend is ready!"
      break
    fi
    echo "⏳ Waiting... ($i/15)"
    sleep 2
  done
  
  echo ""
  echo "📊 PM2 Status:"
  pm2 status
  
  echo ""
  echo "📋 Last 20 lines of backend logs:"
  pm2 logs goalgpt-backend --lines 20 --nostream || echo "Cannot get logs"
  
  echo ""
  echo "🌐 Testing backend endpoint:"
  curl -s http://localhost:3000/ready || echo "❌ Backend not responding"
EOF

echo ""
echo "✅ Manual restart complete"


