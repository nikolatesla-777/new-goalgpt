# PR-F1 Deployment Checklist

**Commit**: 7c9296b
**Branch**: feature/canonical-snapshot-pr-f1
**Risk**: VERY LOW (display-only change)

---

## Pre-Deployment Checklist

- [x] ✅ Backend changes applied (2 locations in dailyLists.routes.ts)
- [x] ✅ Frontend changes applied (TelegramDailyLists.tsx)
- [x] ✅ Frontend built successfully (dist/ folder ready)
- [x] ✅ Git commit created
- [ ] 🔲 Changes pushed to remote repository
- [ ] 🔲 VPS backup created (optional but recommended)

---

## Deployment Commands

### Quick Deploy (5 minutes)

```bash
# 1. Push changes to remote
git push origin feature/canonical-snapshot-pr-f1

# 2. SSH to VPS
ssh root@142.93.103.128

# 3. Navigate and pull changes
cd /var/www/goalgpt
git fetch origin
git checkout feature/canonical-snapshot-pr-f1  # or merge to main first
git pull

# 4. Build frontend
cd frontend
npm run build
cd ..

# 5. Restart backend
pm2 restart goalgpt

# 6. Verify deployment
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/today" | jq '.generated_at'

# 7. Check logs
pm2 logs goalgpt --lines 50
```

---

## Verification Steps

### 1. API Verification
```bash
# Run verification script
./verify-timestamp-fix.sh

# Or manual check
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/today" | jq '{
  generated_at,
  first_list: .lists[0].generated_at,
  match: (.generated_at == .lists[0].generated_at)
}'
```

**Expected**: `match: true`

---

### 2. UI Verification

Open: https://partnergoalgpt.com/admin/telegram/daily-lists

**Test Cases**:
1. **Bugün Tab**:
   - Click "Bugün"
   - Check "Son güncelleme" card
   - ✅ Should show ~12:05:05 (DB time)
   - ❌ Should NOT show current time (e.g., 14:35:22)

2. **Dün Tab**:
   - Click "Dün"
   - Check "Son güncelleme" card
   - ✅ Should show timestamp (e.g., 11:58:33)
   - ❌ Should NOT show --:--

3. **Son 7 Gün Tab**:
   - Click "Son 7 Gün"
   - Check "Son güncelleme" card
   - ✅ Should show first date's timestamp
   - ❌ Should NOT show --:--

4. **Bu Ay Tab**:
   - Click "Bu Ay"
   - Check "Son güncelleme" card
   - ✅ Should show first date's timestamp
   - ❌ Should NOT show --:--

---

### 3. Database Cross-Check

```bash
ssh root@142.93.103.128

# Check what's in database
psql $DATABASE_URL -c "
  SELECT market,
         TO_CHAR(generated_at, 'HH24:MI:SS') as db_time,
         EXTRACT(EPOCH FROM generated_at) * 1000 as db_timestamp_ms
  FROM telegram_daily_lists
  WHERE list_date = CURRENT_DATE
  LIMIT 1;"
```

Compare `db_time` with UI "Son güncelleme" - they should match exactly.

---

## Rollback Plan (If Needed)

```bash
# SSH to VPS
ssh root@142.93.103.128
cd /var/www/goalgpt

# Revert to previous commit
git revert HEAD --no-edit

# Rebuild frontend
cd frontend
npm run build
cd ..

# Restart
pm2 restart goalgpt

# Verify rollback
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/today" | jq '.generated_at'
```

---

## Success Criteria

All checks must pass:
- ✅ API returns database timestamp (not current time)
- ✅ "Bugün" tab shows DB generation time
- ✅ "Dün" tab shows timestamp (not --:--)
- ✅ Historical tabs show timestamps (not --:--)
- ✅ No errors in pm2 logs
- ✅ No console errors in browser

---

## Post-Deployment

- [ ] 🔲 Verify all tabs in UI
- [ ] 🔲 Check API responses
- [ ] 🔲 Monitor pm2 logs for 10 minutes
- [ ] 🔲 Test on mobile browser (optional)
- [ ] 🔲 Update JIRA/task tracker (if applicable)
- [ ] 🔲 Notify team of deployment

---

**Deployment Time Estimate**: 5 minutes
**Risk Level**: VERY LOW
**Rollback Time**: <2 minutes
