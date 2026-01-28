# Trends Analysis Endpoint - Deployment Fix

## Problem
The `/api/footystats/trends-analysis` endpoint returns 404 error because the updated code hasn't been deployed to the VPS.

## Solution
Deploy the latest `footystats.routes.ts` file to the VPS.

---

## Deployment Steps

### Step 1: SSH to VPS
```bash
ssh root@142.93.103.128
cd /var/www/goalgpt
```

### Step 2: Pull Latest Code
```bash
git pull origin main
```

### Step 3: Clear tsx Cache (Important!)
```bash
rm -rf node_modules/.tsx
```

### Step 4: Restart Backend
```bash
pm2 restart goalgpt-backend
pm2 logs goalgpt-backend --lines 50
```

### Step 5: Test the Endpoint
```bash
curl -s "https://partnergoalgpt.com/api/footystats/trends-analysis" | jq
```

Expected response:
```json
{
  "success": true,
  "trends": {
    "goalTrends": [...],
    "cornerTrends": [...],
    "cardsTrends": [...],
    "formTrends": [...],
    "valueBets": [...]
  },
  "totalMatches": 50,
  "generated_at": "2026-01-28T..."
}
```

---

## Alternative: One-Line Deployment

```bash
ssh root@142.93.103.128 'cd /var/www/goalgpt && git pull && rm -rf node_modules/.tsx && pm2 restart goalgpt-backend' && sleep 3 && curl -s "https://partnergoalgpt.com/api/footystats/trends-analysis"
```

---

## What This Fixes

The trends-analysis endpoint was added to `src/routes/footystats.routes.ts` at line 1523 but wasn't deployed. It provides:

- **Goal Trends**: High BTTS/Over 2.5 matches
- **Corner Trends**: High corner potential matches
- **Cards Trends**: High cards potential matches
- **Form Trends**: Teams with xG advantage
- **Value Bets**: Mismatched odds vs predictions

The endpoint analyzes today's matches from FootyStats API and categorizes them by betting trends.

---

## Troubleshooting

If the endpoint still returns 404 after deployment:

1. Check PM2 logs for errors:
   ```bash
   pm2 logs goalgpt-backend --lines 100
   ```

2. Verify the route is loaded:
   ```bash
   pm2 logs goalgpt-backend | grep "FootyStats routes registered"
   ```

3. Check if tsx is caching old code:
   ```bash
   find node_modules/.tsx -name "*.js" -mtime +1 -delete
   pm2 restart goalgpt-backend
   ```

4. Verify FootyStats API key is loaded:
   ```bash
   pm2 logs goalgpt-backend | grep "FOOTYSTATS_API_KEY"
   ```

---

## Estimated Time
2-3 minutes

## Risk Level
Low (only adds new endpoint, doesn't modify existing)
