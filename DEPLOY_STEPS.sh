#!/bin/bash

# Telegram Channel ID Fix - Deploy Steps
# Run this script on your local terminal

echo "================================"
echo "TELEGRAM CHANNEL ID FIX - DEPLOY"
echo "================================"
echo ""
echo "Current Issue: Bot is trying to send to wrong channel"
echo "Fix: Update TELEGRAM_CHANNEL_ID to -1003764965770"
echo ""
echo "Step 1: SSH to VPS..."
ssh utkubozbay@partnergoalgpt.com << 'ENDSSH'

echo "Step 2: Navigate to project..."
cd /var/www/goalgpt

echo "Step 3: Backup current .env..."
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

echo "Step 4: Update TELEGRAM_CHANNEL_ID..."
sed -i 's/TELEGRAM_CHANNEL_ID=.*/TELEGRAM_CHANNEL_ID=-1003764965770/' .env

echo "Step 5: Verify the change..."
echo "Current Telegram config:"
grep "TELEGRAM_" .env

echo ""
echo "Step 6: Restart backend..."
pm2 restart goalgpt-backend --update-env

echo ""
echo "Step 7: Check backend status..."
pm2 status

echo ""
echo "✅ Deploy completed!"
echo "Now test at: https://partnergoalgpt.com/admin/telegram"

ENDSSH
