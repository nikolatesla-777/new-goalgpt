#!/bin/bash
# VPS Deploy Script - Ensures proper module installation before PM2 restart
# Run this script on VPS for deployment

set -e

echo "🚀 Starting deployment..."

cd /var/www/goalgpt

# CRITICAL: Do NOT stop backend - use reload instead for zero-downtime
# pm2 stop causes downtime - reload starts new instance before stopping old one
# Only stop if process doesn't exist (first deployment)
if ! pm2 list | grep -q "goalgpt-backend"; then
  echo "ℹ️ Backend process not found, will start after installation"
else
  echo "ℹ️ Backend process exists, will use reload for zero-downtime deployment"
fi

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Clean and reinstall modules
echo "📦 Installing dependencies..."
rm -rf node_modules/.package-lock.json
npm install

# Wait for filesystem sync
sleep 2

# CRITICAL: Zero-downtime deployment
# Use PM2 reload for graceful restart (zero-downtime)
echo "🔄 Reloading backend with zero-downtime..."
if pm2 list | grep -q "goalgpt-backend"; then
  # Process exists, use reload for zero-downtime
  pm2 reload goalgpt-backend --update-env
else
  # Process doesn't exist, start it
  pm2 start goalgpt-backend
fi

# Wait for backend to be ready (health check)
echo "🏥 Waiting for backend to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f -s http://localhost:3000/ready > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "⏳ Backend not ready yet, waiting... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "⚠️ WARNING: Backend health check failed after $MAX_RETRIES attempts"
  echo "Checking PM2 status..."
  pm2 status
  pm2 logs goalgpt-backend --lines 20
fi

# Build and restart frontend
echo "🔄 Building frontend..."
cd frontend
npm install
npm run build
pm2 restart goalgpt-frontend

# Status check
echo "✅ Deployment complete!"
pm2 status

# Health check
echo "🏥 Health check..."
sleep 3
curl -s http://localhost:3000/api/matches/diary?date=$(date +%Y-%m-%d) | head -c 200 || echo "Backend may need a moment..."
