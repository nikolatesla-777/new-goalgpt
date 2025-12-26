---
description: How to deploy changes to VPS
---

# VPS Deployment Workflow

## CRITICAL: 502 Error Prevention
The backend crashes with `MODULE_NOT_FOUND: dotenv` if PM2 is restarted before npm install completes.

## Correct Deployment Steps
// turbo-all

1. SSH into VPS:
   ```bash
   ssh root@142.93.103.128
   ```
   Password: Qawsed.3535

2. Run the deploy script:
   ```bash
   bash /var/www/goalgpt/deploy.sh
   ```

This script:
- Stops PM2 backend first
- Pulls latest code
- Runs npm install
- Waits 2 seconds
- Starts PM2 backend
- Builds frontend with memory limit
- Restarts frontend

## Alternative Manual Deploy
```bash
cd /var/www/goalgpt
pm2 stop goalgpt-backend
git pull origin main
npm install
sleep 2
pm2 start goalgpt-backend
cd frontend && NODE_OPTIONS="--max-old-space-size=512" npm run build && pm2 restart goalgpt-frontend
```

## Known Issues

### 15-Second Match Start Delay
- Current polling interval is 20 seconds for `/data/update` endpoint
- Matches appear ~15 seconds after they actually start
- To fix: Reduce polling interval or implement WebSocket/MQTT

### 502 Error After Deploy
- Cause: PM2 restarts before npm install completes
- Solution: Always stop PM2 before git pull and npm install
