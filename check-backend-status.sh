#!/bin/bash
# Check backend status on VPS

echo "🔍 Checking backend status on VPS..."

ssh root@142.93.103.128 << 'EOF'
  echo "📊 PM2 Status:"
  pm2 status || echo "❌ PM2 not running"
  
  echo ""
  echo "🔍 Backend Process:"
  pm2 list | grep goalgpt-backend || echo "❌ goalgpt-backend not found"
  
  echo ""
  echo "📋 Backend Logs (last 30 lines):"
  pm2 logs goalgpt-backend --lines 30 --nostream || echo "❌ Cannot get logs"
  
  echo ""
  echo "🏥 Health Check:"
  curl -f -s http://localhost:3000/ready && echo "✅ Backend is ready" || echo "❌ Backend not ready"
  
  echo ""
  echo "🌐 Port 3000:"
  netstat -tlnp | grep 3000 || echo "❌ Port 3000 not listening"
  
  echo ""
  echo "📁 Directory check:"
  ls -la /var/www/goalgpt/ecosystem.config.js 2>/dev/null && echo "✅ ecosystem.config.js exists" || echo "❌ ecosystem.config.js missing"
EOF

echo ""
echo "✅ Check complete"

