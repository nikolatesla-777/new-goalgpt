# UUID Fix Deployment Instructions

## Problem
The `/api/telegram/daily-lists/today` endpoint returns error: `{"error":"operator does not exist: uuid = character varying"}`

## Root Cause
Database queries in `telegram.routes.js` are using incorrect type casting that causes PostgreSQL to fail when comparing UUID and VARCHAR columns.

## Solution
Fix 3 critical queries by casting BOTH sides of comparisons to `::text` type.

---

## Deployment Steps

### Step 1: SSH to VPS
```bash
ssh root@partnergoalgpt.com
cd /var/www/goalgpt/dist
```

### Step 2: Create Backup
```bash
cp routes/telegram.routes.js routes/telegram.routes.js.backup-$(date +%Y%m%d-%H%M%S)
```

### Step 3: Apply Fixes

Run these sed commands to fix the 3 critical queries:

```bash
# Fix 1: League name lookup (line ~475)
sed -i 's/JOIN ts_competitions c ON m\.competition_id = c\.id::varchar/JOIN ts_competitions c ON m.competition_id::text = c.id::text/g' routes/telegram.routes.js

# Fix 2: Live scores query - home team join (line ~830)
sed -i 's/INNER JOIN ts_teams t1 ON m\.home_team_id = t1\.external_id::varchar/INNER JOIN ts_teams t1 ON m.home_team_id::text = t1.external_id::text/g' routes/telegram.routes.js

# Fix 3: Live scores query - away team join (line ~831)
sed -i 's/INNER JOIN ts_teams t2 ON m\.away_team_id = t2\.external_id::varchar/INNER JOIN ts_teams t2 ON m.away_team_id::text = t2.external_id::text/g' routes/telegram.routes.js
```

### Step 4: Verify Fixes
```bash
echo "Checking fixes..."
grep -n "ts_competitions c ON" routes/telegram.routes.js | head -5
grep -n "ts_teams t1 ON" routes/telegram.routes.js | head -5
grep -n "ts_teams t2 ON" routes/telegram.routes.js | head -5
```

Expected output should show `::text` casts on BOTH sides:
- `m.competition_id::text = c.id::text`
- `m.home_team_id::text = t1.external_id::text`
- `m.away_team_id::text = t2.external_id::text`

### Step 5: Restart Backend
```bash
pm2 restart goalgpt-backend
pm2 logs goalgpt-backend --lines 50
```

### Step 6: Test the Endpoint
```bash
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/today" | jq
```

Expected: Should return JSON with lists, NOT an error.

---

## Alternative: One-Line Deployment Script

Copy/paste this entire command block:

```bash
ssh root@partnergoalgpt.com 'cd /var/www/goalgpt/dist && \
  cp routes/telegram.routes.js routes/telegram.routes.js.backup-$(date +%Y%m%d-%H%M%S) && \
  sed -i "s/JOIN ts_competitions c ON m\.competition_id = c\.id::varchar/JOIN ts_competitions c ON m.competition_id::text = c.id::text/g" routes/telegram.routes.js && \
  sed -i "s/INNER JOIN ts_teams t1 ON m\.home_team_id = t1\.external_id::varchar/INNER JOIN ts_teams t1 ON m.home_team_id::text = t1.external_id::text/g" routes/telegram.routes.js && \
  sed -i "s/INNER JOIN ts_teams t2 ON m\.away_team_id = t2\.external_id::varchar/INNER JOIN ts_teams t2 ON m.away_team_id::text = t2.external_id::text/g" routes/telegram.routes.js && \
  echo "✅ Fixes applied! Restarting..." && \
  pm2 restart goalgpt-backend' && \
sleep 3 && \
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/today"
```

---

## What Changed

### Before (BROKEN):
```javascript
// Query 1
JOIN ts_competitions c ON m.competition_id = c.id::varchar

// Query 2 & 3
INNER JOIN ts_teams t1 ON m.home_team_id = t1.external_id::varchar
INNER JOIN ts_teams t2 ON m.away_team_id = t2.external_id::varchar
```

### After (FIXED):
```javascript
// Query 1
JOIN ts_competitions c ON m.competition_id::text = c.id::text

// Query 2 & 3
INNER JOIN ts_teams t1 ON m.home_team_id::text = t1.external_id::text
INNER JOIN ts_teams t2 ON m.away_team_id::text = t2.external_id::text
```

**Why `::text`?**
- Works with both UUID and VARCHAR columns
- PostgreSQL implicitly converts both types to text for comparison
- More robust than `::varchar` which fails if column is UUID

---

## Rollback (if needed)

```bash
ssh root@partnergoalgpt.com
cd /var/www/goalgpt/dist/routes
ls -lt telegram.routes.js.backup-* | head -1  # Find latest backup
cp telegram.routes.js.backup-XXXXXX telegram.routes.js  # Restore backup
pm2 restart goalgpt-backend
```

---

## Source Files (Already Fixed)

The following source files have been updated with the same fixes:
- `/Users/utkubozbay/Downloads/GoalGPT/project/src/routes/telegram.routes.ts`

These fixes will automatically be included next time the backend is compiled and deployed.

---

## Testing Checklist

After deployment, verify:
- [ ] `curl https://partnergoalgpt.com/api/telegram/daily-lists/today` returns JSON (no error)
- [ ] Frontend "Bugün" filter shows matches (not "Bugün için uygun maç bulunamadı")
- [ ] PM2 logs show no UUID errors: `pm2 logs goalgpt-backend --lines 100 | grep -i uuid`
- [ ] Other endpoints still work (smoke test): `curl https://partnergoalgpt.com/api/matches/live`

---

**Estimated Deployment Time**: 2-3 minutes
**Risk Level**: Low (only affects 3 queries, backup created automatically)
**Downtime**: ~5 seconds (PM2 restart)
