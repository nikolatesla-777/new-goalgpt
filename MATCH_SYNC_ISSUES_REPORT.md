# Match Sync Issues Report

**Date:** 2025-12-23  
**Status:** 🔴 **CRITICAL ISSUES DETECTED**

---

## Summary

1. **37 matches missing** (87 in DB, expected 124)
2. **0 live matches** (expected ~16 based on Aiscore)
3. **21 matches** have `match_time` passed but status still `NOT_STARTED` (need status update)
4. **Last update:** 6 hours ago (06:52:49 UTC)

---

## Diagnostic Results

### Total Matches Today
- **In DB:** 87
- **Expected:** 124
- **Missing:** 37 matches

### Status Breakdown
- Status 1 (NOT_STARTED): 83
- Status 8 (END): 2
- Status 13 (UNKNOWN): 2
- **Status 2,4,5,7 (LIVE): 0** ⚠️

### Critical Issue: Stale Matches
- **21 matches** have `match_time` passed but status still `NOT_STARTED`
- Oldest match is **23 minutes ago**
- These matches need status update from API

---

## Root Causes

### 1. DailyMatchSyncWorker Issues
- **Problem:** 37 matches not synced (sync errors in logs)
- **Evidence:** Log shows "Failed to sync match" errors with "input syntax for type integer"
- **Impact:** Missing matches in DB

### 2. DataUpdateWorker Not Updating Status
- **Problem:** Status updates not happening (last update 6 hours ago)
- **Expected:** DataUpdateWorker should run every 20 seconds
- **Impact:** 21 matches stuck in NOT_STARTED status

### 3. getLiveMatches() API Fallback Not Working
- **Problem:** `getLiveMatches()` should call API for "should be live" matches but status not updating
- **Impact:** Live matches not appearing in `/api/matches/live` endpoint

---

## Immediate Actions Required

### Action 1: Check DataUpdateWorker Status
```bash
# Check if DataUpdateWorker is running
tail -100 logs/combined.log | grep -E "dataupdate|DataUpdate" | tail -20

# Check worker startup
grep "worker.started" logs/combined.log | grep -i "dataupdate" | tail -5
```

### Action 2: Manually Trigger Status Updates
```bash
# Run diagnostic script to see which matches need update
npx tsx check-match-issues.ts

# Manually reconcile "should be live" matches
# (See fix-live-matches-status.ts script)
```

### Action 3: Check DailyMatchSyncWorker
```bash
# Check last sync time
tail -200 logs/combined.log | grep -E "DailyDiary|dailyMatchSync" | tail -20

# Check sync errors
tail -200 logs/combined.log | grep -E "Failed to sync|sync.*error" | tail -20
```

### Action 4: Force Re-sync Today's Matches
```bash
# Check if DailyMatchSyncWorker can be manually triggered
# Or restart server to trigger sync
```

---

## Long-term Fixes

1. **Fix sync errors:** Investigate "input syntax for type integer" errors in DailyMatchSyncWorker
2. **Improve DataUpdateWorker:** Ensure it's running and updating status correctly
3. **Add monitoring:** Alert when matches are stuck in NOT_STARTED after match_time passes
4. **Improve error handling:** Better logging for sync failures

---

## Next Steps

1. ✅ Run diagnostic script (`check-match-issues.ts`)
2. ⏳ Check DataUpdateWorker logs
3. ⏳ Manually reconcile 21 stale matches
4. ⏳ Investigate DailyMatchSyncWorker sync errors
5. ⏳ Force re-sync today's matches

---

**Report Generated:** 2025-12-23



