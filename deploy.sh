#!/bin/bash
# VPS Deploy Script - Ensures proper module installation before PM2 restart
# Run this script on VPS for deployment

set -e

echo "🚀 Starting deployment..."

cd /var/www/goalgpt

# Stop backend first to avoid module conflicts
echo "⏹️ Stopping backend..."
pm2 stop goalgpt-backend || true

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Clean and reinstall modules
echo "📦 Installing dependencies..."
rm -rf node_modules/.package-lock.json
npm install

# Wait for filesystem sync
sleep 2

# Start backend
echo "🔄 Starting backend..."
pm2 start goalgpt-backend

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
