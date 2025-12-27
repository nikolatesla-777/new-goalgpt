# EMERGENCY: Backend Not Running - 502 Error

## Problem
Backend is not running on VPS, causing 502 Bad Gateway errors.

## Immediate Fix

Run this command on your local machine (with SSH access to VPS):

```bash
./manual-backend-restart.sh
```

Or manually SSH to VPS:

```bash
ssh root@142.93.103.128

# Then run:
cd /var/www/goalgpt
git pull origin main
npm install --production
mkdir -p logs

# Stop existing
pm2 stop goalgpt-backend 2>/dev/null || pm2 delete goalgpt-backend 2>/dev/null

# Start fresh
if [ -f ecosystem.config.js ]; then
  pm2 start ecosystem.config.js
else
  pm2 start npm --name "goalgpt-backend" -- start
fi

pm2 save

# Wait and check
sleep 5
curl http://localhost:3000/ready
pm2 status
pm2 logs goalgpt-backend --lines 30 --nostream
```

## Check Backend Status

```bash
./check-backend-status.sh
```

## Why This Happened

1. Deployment may have failed silently
2. Backend process may have crashed and PM2 didn't restart it
3. PM2 may not be running
4. Dependencies may be missing

## Permanent Fix (After Manual Restart)

1. Check deployment logs: https://github.com/nikolatesla-777/new-goalgpt/actions
2. Verify PM2 startup: `pm2 startup` on VPS
3. Verify ecosystem.config.js exists
4. Verify dependencies are installed
