# Phase 3B - Madde 5: Watchdog Implementation Report

**Date:** 2025-12-21  
**Status:** ✅ COMPLETED  
**Implementation Time:** ~1 hour

---

## Executive Summary

Phase 3B - Madde 5 (Watchdog) başarıyla implement edildi. Watchdog service ve worker, stale live maçları tespit edip reconcile tetikleyerek sistemin sağlığını koruyor. Tüm kritik invariant'lar korunuyor, HALF_TIME için özel threshold (900s) ile false positive'ler önleniyor.

**Key Achievements:**
- ✅ DB-only stale match selection (API çağrısı yok)
- ✅ Status-specific thresholds (120s for live, 900s for HALF_TIME)
- ✅ Watchdog doğrudan `updated_at` update etmez. `updated_at` yalnızca reconcile akışında (MatchDetailLive/WebSocket DB update'leri) değişebilir.
- ✅ Deterministic test başarılı
- ✅ Worker server'a entegre edildi

---

## Critical Invariants (VERIFIED)

### ✅ DO NOT List - All Enforced

1. **DO NOT update updated_at inside watchdog code**
   - ✅ Watchdog doğrudan `updated_at` update etmez
   - ✅ `updated_at` yalnızca reconcile akışında (MatchDetailLive/WebSocket DB update'leri) değişebilir

2. **DO NOT calculate or modify minute**
   - ✅ Minute Engine'e dokunulmadı
   - ✅ Watchdog minute hesaplaması yapmıyor

3. **DO NOT add fallback match selection**
   - ✅ Hiçbir yerde `r[0]`/`v[0]` fallback yok
   - ✅ SQL query doğrudan `external_id` kullanıyor

4. **DO NOT overwrite kickoff timestamps**
   - ✅ Watchdog kickoff alanlarına dokunmuyor
   - ✅ Sadece reconcile tetikliyor

5. **DO NOT apply TSİ offset to DB values**
   - ✅ DB sadece Unix seconds (UTC reference) tutar
   - ✅ `nowTs = Math.floor(Date.now() / 1000)` kullanılıyor

6. **Watchdog must be DB-only**
   - ✅ Service sadece DB sorgusu yapıyor
   - ✅ API çağrısı yok (sadece reconcile trigger)

---

## Files Created

### 1. `src/services/thesports/match/matchWatchdog.service.ts`

**Purpose:** DB-only service to identify stale live matches

**Key Method:**
```typescript
async findStaleLiveMatches(
  nowTs: number,
  staleSeconds: number = 120,
  halfTimeStaleSeconds: number = 900,
  limit: number = 50
): Promise<StaleMatch[]>
```

**Type Definition:**
```typescript
type StaleMatch = {
  matchId: string;
  statusId: number;
  reason: string;
  lastEventTs: number | null;
  providerUpdateTime: number | null;
  updatedAt: string;
};
```

**Selection Logic:**
- **Status filter:** `status_id IN (2, 3, 4, 5, 7)`
- **Time filter:** `match_time <= nowTs + 3600` (avoid far-future matches)
- **Stale detection (ANY can trigger):**
  - `last_event_ts IS NULL OR <= nowTs - threshold`
  - OR `provider_update_time IS NULL OR <= nowTs - threshold`
  - OR `updated_at <= NOW() - threshold`

**Status-Specific Thresholds:**
- `status_id IN (2, 4, 5, 7)` → `staleSeconds = 120`
- `status_id = 3` (HALF_TIME) → `halfTimeStaleSeconds = 900` (15 min)

**SQL Query:**
```sql
SELECT
  external_id,
  status_id,
  last_event_ts,
  provider_update_time,
  updated_at
FROM ts_matches
WHERE
  status_id IN (2, 3, 4, 5, 7)
  AND match_time <= $1::BIGINT + 3600
  AND (
    last_event_ts IS NULL OR last_event_ts <= $1::BIGINT - CASE WHEN status_id = 3 THEN $3::INTEGER ELSE $2::INTEGER END
    OR provider_update_time IS NULL OR provider_update_time <= $1::BIGINT - CASE WHEN status_id = 3 THEN $3::INTEGER ELSE $2::INTEGER END
    OR updated_at <= NOW() - make_interval(secs => CASE WHEN status_id = 3 THEN $3::INTEGER ELSE $2::INTEGER END)
  )
ORDER BY updated_at ASC
LIMIT $4
```

**Parameters:**
- `$1` → `nowTs` (Unix seconds)
- `$2` → `staleSeconds` (120)
- `$3` → `halfTimeStaleSeconds` (900)
- `$4` → `limit` (50)

**Reason Assignment:**
- Priority: `last_event_ts` → `provider_update_time` → `updated_at`
- Returns descriptive reason string for logging

### 2. `src/jobs/matchWatchdog.job.ts`

**Purpose:** Background worker to detect and recover stale live matches

**Key Features:**
- Runs every 30 seconds
- Processes up to 50 stale matches per tick
- Uses `isRunning` guard to prevent overlap
- Triggers reconcile with `null` override (no update_time injection)

**tick() Flow:**
1. Check `isRunning` guard (skip if already running)
2. `nowTs = Math.floor(Date.now() / 1000)`
3. `stales = await findStaleLiveMatches(nowTs, 120, 900, 50)`
4. If empty: log `[Watchdog] tick: 0 stale matches`
5. If found:
   - For each stale match:
     - Log full details: `match_id`, `status`, `reason`, `last_event_ts`, `provider_update_time`, `updated_at`
     - Call `reconcileMatchToDatabase(matchId, null)` (try/catch per match)
     - Track `reconciledOk` and `reconciledFail`
6. Summary log: `[Watchdog] tick: scanned=X stale=Y reconciled=Y ok=... fail=... (Xms)`

**Critical:** Watchdog does NOT update `updated_at` directly. It only triggers reconcile; reconcile may update `updated_at`.

### 3. `src/scripts/test-phase3b-watchdog.ts`

**Purpose:** Deterministic test script to verify Watchdog selection logic

**Test Cases:**
1. **Stale Live Match (MUST be selected):**
   - `status_id = 2`
   - `last_event_ts = nowTs - 1000` (stale)
   - `provider_update_time = nowTs - 1000` (stale)
   - `updated_at = NOW() - INTERVAL '1000 seconds'`

2. **Fresh Live Match (MUST NOT be selected):**
   - `status_id = 2`
   - `last_event_ts = nowTs - 30` (fresh)
   - `provider_update_time = nowTs - 30` (fresh)

3. **Not-Live Match (MUST NOT be selected):**
   - `status_id = 1` (NOT_STARTED)
   - Stale timestamps but wrong status

**Assertions:**
- ✅ Stale match is selected
- ✅ Fresh match is excluded
- ✅ Not-live match is excluded
- ✅ Exactly 1 test match selected
- ✅ Reason correctly assigned

**Note:** Test filters results to only test matches (prefix `phase3b_test_watchdog_`) to avoid interference from real DB data.

---

## Files Modified

### 1. `src/server.ts`

**Changes:**
- Import `MatchWatchdogWorker` and `MatchDetailLiveService`
- Declare `matchWatchdogWorker` variable
- Instantiate `MatchDetailLiveService` with `theSportsClient`
- Create and start `MatchWatchdogWorker` after `MatchMinuteWorker`
- Stop worker on graceful shutdown

**Code Snippets:**
```typescript
import { MatchWatchdogWorker } from './jobs/matchWatchdog.job';
import { MatchDetailLiveService } from './services/thesports/match/matchDetailLive.service';

let matchWatchdogWorker: MatchWatchdogWorker | null = null;

// On startup (after MatchMinuteWorker):
const matchDetailLiveService = new MatchDetailLiveService(theSportsClient);
matchWatchdogWorker = new MatchWatchdogWorker(matchDetailLiveService);
matchWatchdogWorker.start();

// On shutdown:
try { matchWatchdogWorker?.stop(); } catch (e: any) { logger.error('Failed to stop MatchWatchdogWorker:', e); }
```

### 2. `package.json`

**Changes:**
- Added script: `"test:phase3b-watchdog": "tsx src/scripts/test-phase3b-watchdog.ts"`

### 3. `PHASE3B_PLAN.md`

**Changes:**
- Updated status header: `(5/8 completed - Madde 1–5 ✅ COMPLETE)`
- Marked Madde 5 as ✅ COMPLETED
- Added proof test output

---

## Proof Test Results

### Test Execution

**Command:** `npm run test:phase3b-watchdog`

**Output:**
```
🧪 TEST: Watchdog Selection Logic
======================================================================
✅ Created stale match: phase3b_test_watchdog_stale_1 (status=2, last_event_ts=1766345551, stale)
✅ Created fresh match: phase3b_test_watchdog_fresh_1 (status=2, last_event_ts=1766346521, fresh)
✅ Created not-live match: phase3b_test_watchdog_notlive_1 (status=1, should NOT be selected)

🔍 Running findStaleLiveMatches(nowTs=1766346551, staleSeconds=120, halfTimeStaleSeconds=900, limit=50)...

📊 Results: Found 13 total stale match(es) (1 test matches)
  - match_id=phase3b_test_watchdog_stale_1 status=2 reason=last_event_ts stale
✅ PASS: Stale match phase3b_test_watchdog_stale_1 was correctly selected
✅ PASS: Fresh match phase3b_test_watchdog_fresh_1 was correctly excluded
✅ PASS: Not-live match phase3b_test_watchdog_notlive_1 was correctly excluded
✅ PASS: Exactly 1 stale match selected
✅ PASS: Reason correctly assigned: last_event_ts stale

======================================================================
✅ DETERMINISTIC TEST PASSED: Watchdog selection verified
======================================================================
```

### Test Verification

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| Stale match selected | ✅ | ✅ | ✅ PASS |
| Fresh match excluded | ✅ | ✅ | ✅ PASS |
| Not-live match excluded | ✅ | ✅ | ✅ PASS |
| Exactly 1 test match | ✅ | ✅ | ✅ PASS |
| Reason assigned | ✅ | ✅ | ✅ PASS |

---

## SQL Evidence: Status-Specific Thresholds

### SQL Query (matchWatchdog.service.ts, line 52-70)

```sql
SELECT
  external_id,
  status_id,
  last_event_ts,
  provider_update_time,
  updated_at
FROM ts_matches
WHERE
  status_id IN (2, 3, 4, 5, 7)
  AND match_time <= $1::BIGINT + 3600
  AND (
    last_event_ts IS NULL OR last_event_ts <= $1::BIGINT - CASE WHEN status_id = 3 THEN $3::INTEGER ELSE $2::INTEGER END
    OR provider_update_time IS NULL OR provider_update_time <= $1::BIGINT - CASE WHEN status_id = 3 THEN $3::INTEGER ELSE $2::INTEGER END
    OR updated_at <= NOW() - make_interval(secs => CASE WHEN status_id = 3 THEN $3::INTEGER ELSE $2::INTEGER END)
  )
ORDER BY updated_at ASC
LIMIT $4
```

**Critical Observations:**
- `CASE WHEN status_id = 3 THEN $3 ELSE $2 END` → Status 3 (HALF_TIME) uses 900s, others use 120s
- `INTERVAL '1 second'` multiplication for safe parameterization (no string interpolation)
- All three timestamp fields checked (last_event_ts, provider_update_time, updated_at)

---

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `npm run test:phase3b-watchdog` exits 0 | ✅ | Test passes with all assertions |
| Watchdog job exists, starts/stops cleanly | ✅ | Worker registered in server.ts |
| Watchdog service selects stale matches correctly | ✅ | Test verifies selection logic |
| No code updates `updated_at` directly | ✅ | Watchdog only calls reconcile |
| No API fallback selection introduced | ✅ | Service is DB-only |
| Server boots successfully | ✅ | Worker starts without errors |
| Watchdog logs appear | ✅ | Worker logs tick summaries |

---

## Implementation Details

### Worker Configuration

- **Interval:** 30 seconds
- **Batch Size:** 50 matches per tick
- **Query Filter:** `status_id IN (2, 3, 4, 5, 7)`
- **Time Filter:** `match_time <= nowTs + 3600`
- **Stale Thresholds:**
  - Status 2/4/5/7: 120 seconds
  - Status 3 (HALF_TIME): 900 seconds (15 minutes)

### Selection Logic

**Stale Detection (ANY can trigger):**
- `last_event_ts IS NULL OR <= nowTs - threshold`
- OR `provider_update_time IS NULL OR <= nowTs - threshold`
- OR `updated_at <= NOW() - threshold`

**Reason Priority:**
1. `last_event_ts stale` (if applicable)
2. `provider_update_time stale` (if applicable)
3. `updated_at stale` (if applicable)
4. `multiple timestamps stale` (fallback)

### Reconcile Trigger

**Method:** `reconcileMatchToDatabase(matchId, null)`

**Override:** `null` (no update_time injection)

**Rationale:** Watchdog is for recovery, not update_time injection. Reconcile will fetch fresh data from API.

### Logging

**INFO Level Logs:**
- `[Watchdog] tick: 0 stale matches` (if none found)
- `[Watchdog] stale match_id=X status=Y reason=Z last_event_ts=... provider_update_time=... updated_at=...` (per match)
- `[Watchdog] tick: scanned=X stale=Y reconciled=Y ok=... fail=... (Xms)` (summary)

**ERROR Level Logs:**
- `[Watchdog] reconcile failed for ${matchId}:` (per-match errors)

---

## HALF_TIME Threshold Rationale

**Problem:** HALF_TIME (status 3) matches normally have a 15-minute break. Using 120s threshold would cause false positives (matches treated as stale during normal HT break).

**Solution:** Use relaxed threshold `halfTimeStaleSeconds = 900` (15 minutes) for HALF_TIME status.

**Implementation:**
- SQL query uses `CASE WHEN status_id = 3 THEN $3 ELSE $2 END`
- Service method accepts `halfTimeStaleSeconds` parameter
- Worker calls with `findStaleLiveMatches(nowTs, 120, 900, 50)`

**Result:** HALF_TIME matches are not falsely treated as stale during normal break, but will still be detected if truly stale (>15 min).

---

## Typecheck Status

**Command:** `npm run typecheck`

**Result:** ✅ No new TypeScript errors introduced

**Watchdog Files:** ✅ No TypeScript errors

---

## Next Steps (Phase 3B Remaining)

Watchdog implementasyonu tamamlandı. Phase 3B'de kalan maddeler:
- Madde 6: Phase 3A Optimistic Locking ile Uyum (zaten yapıldı, doğrulama gerekebilir)
- Madde 7: "DB-Only Controllers" Korunuyor
- Madde 8: Test kanıtı (deterministic)

---

## Summary

Phase 3B - Madde 5 (Watchdog) başarıyla implement edildi ve test edildi. Tüm kritik invariant'lar korunuyor, HALF_TIME için özel threshold ile false positive'ler önleniyor. Watchdog doğrudan `updated_at` update etmez; `updated_at` yalnızca reconcile akışında değişebilir. Deterministic test tüm senaryoları doğruladı.

**Status:** ✅ **COMPLETE**

---

## Delta / What Changed

### Revizyon 1: SQL Interval Standardization
- **Changed:** `updated_at <= NOW() - (CASE ... * INTERVAL '1 second')` 
- **To:** `updated_at <= NOW() - make_interval(secs => CASE ... END)`
- **Reason:** Parametreli interval kullanımı için `make_interval` standardına geçildi
- **File:** `src/services/thesports/match/matchWatchdog.service.ts`

### Revizyon 2: Report Clarity on updated_at Invariant
- **Changed:** "✅ updated_at hiç değiştirilmiyor" ifadesi
- **To:** "Watchdog doğrudan `updated_at` update etmez. `updated_at` yalnızca reconcile akışında (MatchDetailLive/WebSocket DB update'leri) değişebilir."
- **Reason:** İfade netleştirildi - watchdog doğrudan update etmez, ama reconcile tetiklediği için dolaylı olarak değişebilir
- **File:** `PHASE3B_MADDE5_WATCHDOG_IMPLEMENTATION_REPORT.md`

### Test Evidence

**Command:** `npm run test:phase3b-watchdog`
```
🧪 TEST: Watchdog Selection Logic
======================================================================
✅ Created stale match: phase3b_test_watchdog_stale_1 (status=2, last_event_ts=1766346178, stale)
✅ Created fresh match: phase3b_test_watchdog_fresh_1 (status=2, last_event_ts=1766347148, fresh)
✅ Created not-live match: phase3b_test_watchdog_notlive_1 (status=1, should NOT be selected)

🔍 Running findStaleLiveMatches(nowTs=1766347178, staleSeconds=120, halfTimeStaleSeconds=900, limit=50)...

📊 Results: Found 22 total stale match(es) (1 test matches)
  - match_id=phase3b_test_watchdog_stale_1 status=2 reason=last_event_ts stale
✅ PASS: Stale match phase3b_test_watchdog_stale_1 was correctly selected
✅ PASS: Fresh match phase3b_test_watchdog_fresh_1 was correctly excluded
✅ PASS: Not-live match phase3b_test_watchdog_notlive_1 was correctly excluded
✅ PASS: Exactly 1 stale match selected
✅ PASS: Reason correctly assigned: last_event_ts stale

======================================================================
✅ DETERMINISTIC TEST PASSED: Watchdog selection verified
======================================================================
```

**Command:** `npm run typecheck`
```
(No watchdog-related errors)
```

**Result:** ✅ All tests pass, no new TypeScript errors introduced

