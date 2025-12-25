# Minute Extraction Fix - Root Cause Analysis

**Date:** 2025-12-25  
**Issue:** Minute is NULL for live matches, even though provider sends `score[4]` (liveKickoffTime)

---

## 🔍 Root Cause

### Problem Identified

1. **WebSocket doesn't send minute** - Only sends status, score, incidents, stats
2. **Provider doesn't send minute in detail_live** - Only sends `score[4]` (liveKickoffTime)
3. **Minute must be calculated from kickoff timestamps** - But kickoff timestamps are NULL

### Why Kickoff Timestamps Are NULL

**Code Logic (CORRECT):**
- `reconcileMatchToDatabase()` extracts `liveKickoffTime` from `score[4]` (satır 241-245)
- Sets `second_half_kickoff_ts` if status is 4 and NULL (satır 533-537)
- Calculates minute from kickoff timestamps (satır 572-584)

**But:**
- `reconcileMatchToDatabase()` may not have been called for this match
- Or `liveKickoffTime` extraction failed (unlikely, since force reconcile found it)

---

## ✅ Solution

### Immediate Fix (Manual)
- `force-reconcile-boliyohuto.js` script successfully:
  1. Extracted `score[4]` from provider: `1766642577`
  2. Set `second_half_kickoff_ts = 1766642577`
  3. Set `first_half_kickoff_ts = match_time`
  4. Calculated minute: `91`

### Long-term Fix (Automatic)

**Ensure `reconcileMatchToDatabase()` is called for all live matches:**

1. **MatchSyncWorker** already calls `reconcileMatchToDatabase()` every 15 seconds for status 4 matches
2. **But:** If match was already status 4 when system started, it may have been missed

**Solution:** Run proactive reconciliation for all status 4 matches with NULL kickoff timestamps:

```sql
SELECT external_id 
FROM ts_matches 
WHERE status_id = 4 
  AND second_half_kickoff_ts IS NULL
```

Then call `reconcileMatchToDatabase()` for each.

---

## 📊 Current State

### WebSocket Messages
- ❌ **No minute** in `score` array: `[match_id, status_id, home_data[], away_data[], message_timestamp]`
- ❌ **No minute** in `tlive` array: timeline/phase updates only
- ❌ **No minute** in `incidents`: event data only
- ❌ **No minute** in `stats`: statistics only

### Provider detail_live Response
- ✅ **Status ID** in `score[1]`
- ✅ **Live Kickoff Time** in `score[4]` (for SECOND_HALF, this is second half start time)
- ❌ **No minute** in root object (`minute`, `match_minute`, etc.)

### Minute Calculation
- ✅ **Logic exists** in `calculateMinuteFromKickoffs()` (satır 286-333)
- ✅ **Called automatically** in `reconcileMatchToDatabase()` (satır 572-584)
- ❌ **Fails if kickoff timestamps are NULL**

---

## 🎯 Next Steps

1. ✅ **Manual fix applied** - Boliyohuto match minute is now `91`
2. ⏳ **Automatic fix needed** - Ensure all status 4 matches get reconciled
3. ⏳ **Monitor** - Check if other matches have NULL minutes

---

**Status:** ✅ MANUAL FIX APPLIED  
**Next:** Run proactive reconciliation for all status 4 matches with NULL kickoff timestamps

