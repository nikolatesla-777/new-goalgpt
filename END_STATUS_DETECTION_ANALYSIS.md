# END Status Detection Analysis

**Date:** 2025-12-24  
**Critical Issue:** Matches finishing (FT) are not being detected quickly enough

---

## 🔍 Root Cause Analysis

### Current END Detection Mechanisms

1. **WebSocket tlive messages** (Primary - Fastest)
   - Endpoint: `wss://api.thesports.com/v1/football/ws`
   - Detection: Keyword matching ("FT", "Full Time", "Bitti")
   - Speed: Real-time (instant)
   - Reliability: ⚠️ Depends on provider sending tlive messages

2. **MatchSyncWorker reconcile** (Secondary - Every 30s)
   - Endpoint: `/match/detail_live?match_id=xxx`
   - Detection: Provider returns `status_id=8`
   - Speed: Every 30 seconds (for status 2, 4, 5)
   - Reliability: ✅ Provider-authoritative

3. **MatchWatchdogWorker** (Tertiary - DISABLED)
   - Endpoint: `/match/recent/list` + `/match/detail_live`
   - Detection: Match not in recent/list OR status_id=8 in detail_live
   - Speed: Every 20 seconds (when enabled)
   - Status: ❌ **DISABLED** - Not running

---

## ❌ Problem Identified

**Issue:** When a match finishes (FT), the system relies on:
1. WebSocket tlive message (may not arrive)
2. MatchSyncWorker reconcile every 30 seconds (too slow)

**Result:** Matches can remain in SECOND_HALF (status 4) for up to 30 seconds after FT, even though provider already marked them as END (status 8).

---

## ✅ Solution Implemented

### Fix: More Frequent Reconciliation for SECOND_HALF Matches

**File:** `src/jobs/matchSync.job.ts`

**Change:**
- Added dedicated interval for SECOND_HALF (status 4) matches
- Reconciliation frequency: **Every 15 seconds** (instead of 30 seconds)
- This ensures END detection within 15 seconds of provider update

**Code:**
```typescript
// Tier-1.5 reconcile: enqueue SECOND_HALF matches every 15 seconds
// CRITICAL: Second half matches can finish at any time, need frequent checks for status 8 (END)
this.secondHalfInterval = setInterval(() => {
  this.enqueueMatchesForReconcile(this.SECOND_HALF_STATUS_IDS, 'SecondHalfReconcile', 500)
    .catch(err => logger.error('[SecondHalfReconcile] enqueue interval error:', err));
}, 15000); // Every 15 seconds for faster END detection
```

---

## 📊 Expected Behavior After Fix

1. **WebSocket tlive** (if available): Instant END detection
2. **MatchSyncWorker SECOND_HALF reconcile**: END detection within 15 seconds
3. **MatchSyncWorker general reconcile**: END detection within 30 seconds (fallback)

**Maximum delay:** 15 seconds (instead of 30 seconds)

---

## 🔍 Endpoint Used for END Detection

**Primary Endpoint:** `/match/detail_live?match_id=xxx`

**How it works:**
1. MatchSyncWorker queries database for status 4 matches
2. Enqueues them for reconciliation
3. Calls `MatchDetailLiveService.reconcileMatchToDatabase(match_id)`
4. Service calls `/match/detail_live` endpoint
5. If provider returns `status_id=8`, database is updated immediately

**Code Path:**
```
MatchSyncWorker.reconcileLiveMatches()
  → enqueueMatchesForReconcile([4], ...)
  → processReconcileQueue()
  → MatchDetailLiveService.reconcileMatchToDatabase()
  → GET /match/detail_live?match_id=xxx
  → Provider returns status_id=8
  → UPDATE ts_matches SET status_id=8 WHERE external_id=xxx
```

---

## ⚠️ Important Notes

1. **No optimistic locking on status transition** - `reconcileMatchToDatabase()` updates status_id directly from provider
2. **Provider is authoritative** - If provider says status_id=8, we update immediately
3. **WebSocket is fastest** - But not always reliable (depends on provider sending tlive messages)
4. **15-second interval** - Balances speed with API rate limits

---

## 🧪 Testing

To verify END detection is working:

1. Find a match in SECOND_HALF (status 4)
2. Wait for it to finish (check Aiscore or provider directly)
3. Check database within 15 seconds:
   ```sql
   SELECT external_id, status_id, updated_at 
   FROM ts_matches 
   WHERE external_id = 'match_id_here';
   ```
4. Status should change to 8 (END) within 15 seconds of provider update

---

**Status:** ✅ FIXED  
**Commit:** `ed2a0ee` - "CRITICAL FIX: Add frequent reconciliation for SECOND_HALF matches (every 15s) for faster END/FT detection"

