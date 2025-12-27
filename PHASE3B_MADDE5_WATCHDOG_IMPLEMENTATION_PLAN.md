# Phase 3B - Madde 5: Watchdog Implementation Plan

## Goal
Implement Phase 3B - Madde 5: Watchdog service and worker for stale live match recovery. Watchdog identifies stale matches using last_event_ts, provider_update_time, and updated_at thresholds, then triggers reconcile. Must not break Phase 3A optimistic locking or Phase 3B minute engine invariants.

## Critical Invariants (MUST NOT BREAK)

1. **DO NOT update updated_at directly in watchdog** - Only reconcile paths update it
2. **DO NOT calculate minutes in watchdog** - Minute Engine handles this
3. **DO NOT add fallback match selection** - No r[0]/v[0] fallbacks
4. **DO NOT overwrite kickoff timestamps** - Write-once only
5. **DO NOT add TSİ offset to DB** - Unix seconds only

## Implementation Steps

### Step 1: Create MatchWatchdogService

**File:** `src/services/thesports/match/matchWatchdog.service.ts` (NEW)

**Responsibilities:**
- Select stale live matches from DB (DB-only, no API calls)
- Return list of match IDs with reason and timestamp info

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

**Method Signature:**
```typescript
async findStaleLiveMatches(
  nowTs: number,
  staleSeconds: number = 120,
  halfTimeStaleSeconds: number = 900,
  limit: number = 50
): Promise<StaleMatch[]>
```

**DB Selection Logic:**
- **Live-like statuses:**
  - `status_id IN (2, 4, 5, 7)` use `staleSeconds = 120`
  - `status_id = 3` (HALF_TIME) use a relaxed threshold `halfTimeStaleSeconds = 900` (15 min) to avoid false stale during HT
- `match_time <= nowTs + 3600` (avoid far-future matches; allow slight skew)
- AND at least ONE of:
  - `last_event_ts IS NULL OR last_event_ts <= nowTs - threshold`
  - OR `provider_update_time IS NULL OR provider_update_time <= nowTs - threshold`
  - OR `updated_at <= NOW() - INTERVAL '<threshold> seconds'`

(Where `threshold` is `staleSeconds` for statuses 2/4/5/7, and `halfTimeStaleSeconds` for status 3.)

**SQL Query Pattern:**
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
    last_event_ts IS NULL OR last_event_ts <= $1::BIGINT - CASE WHEN status_id = 3 THEN $3 ELSE $2 END
    OR provider_update_time IS NULL OR provider_update_time <= $1::BIGINT - CASE WHEN status_id = 3 THEN $3 ELSE $2 END
    OR updated_at <= NOW() - make_interval(secs => CASE WHEN status_id = 3 THEN $3 ELSE $2 END)
  )
ORDER BY updated_at ASC
LIMIT $4;
```

- `$1 = nowTs (unix seconds)`
- `$2 = staleSeconds (default 120)`
- `$3 = halfTimeStaleSeconds (default 900)`
- `$4 = limit (default 50)`

**Reason Assignment:**
- If `last_event_ts` is stale: `reason = "last_event_ts stale"`
- Else if `provider_update_time` is stale: `reason = "provider_update_time stale"`
- Else if `updated_at` is stale: `reason = "updated_at stale"`
- Else: `reason = "multiple timestamps stale"`

**Note:** Service is DB-only. No API calls, no reconcile calls. Only selection logic.

### Step 2: Create MatchWatchdogWorker

**File:** `src/jobs/matchWatchdog.job.ts` (NEW)

**Structure (follow MatchMinuteWorker pattern):**
```typescript
export class MatchWatchdogWorker {
  private matchWatchdogService: MatchWatchdogService;
  private matchDetailLiveService: MatchDetailLiveService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(matchDetailLiveService: MatchDetailLiveService) {
    this.matchWatchdogService = new MatchWatchdogService();
    this.matchDetailLiveService = matchDetailLiveService;
  }
}
```

**tick() Method:**
1. Check `isRunning` guard (skip if already running)
2. `nowTs = Math.floor(Date.now() / 1000)`
3. `stales = await this.matchWatchdogService.findStaleLiveMatches(nowTs, 120, 900, 50)`
4. If empty: log `[Watchdog] tick: 0 stale matches`
5. If not empty:
   - For each stale match:
     - Log: `[Watchdog] stale match_id=... status=... reason=... last_event_ts=... provider_update_time=... updated_at=...`
     - Try/catch around reconcile:
       ```typescript
       try {
         await this.matchDetailLiveService.reconcileMatchToDatabase(
           stale.matchId,
           null  // No override - watchdog is for recovery, not update_time injection
         );
         reconciledOk++;
       } catch (error: any) {
         logger.error(`[Watchdog] reconcile failed for ${stale.matchId}:`, error);
         reconciledFail++;
       }
       ```
6. Summary log: `[Watchdog] tick: scanned=X stale=Y reconciled=Y ok=... fail=... (Xms)`

**start() Method:**
- Run immediately on start
- Then run every 30 seconds
- Use `setInterval(() => { void this.tick(); }, 30000)`

**stop() Method:**
- Clear interval if exists
- Log stop message

**Critical:** Watchdog job does NOT update `updated_at` itself. It only triggers reconcile; reconcile may update `updated_at`.

### Step 3: Wire Worker in server.ts

**File:** `src/server.ts`

**Changes:**
1. Import:
   ```typescript
   import { MatchWatchdogWorker } from './jobs/matchWatchdog.job';
   ```

2. Declare variable (near other workers):
   ```typescript
   let matchWatchdogWorker: MatchWatchdogWorker | null = null;
   ```

3. On startup (after MatchMinuteWorker):
   ```typescript
   matchWatchdogWorker = new MatchWatchdogWorker(matchDetailLiveService);
   matchWatchdogWorker.start();
   ```

4. On shutdown (in shutdown function):
   ```typescript
   try { matchWatchdogWorker?.stop(); } catch (e: any) { logger.error('Failed to stop MatchWatchdogWorker:', e); }
   ```

**Note:** Need to ensure `matchDetailLiveService` is available in server.ts scope. Check existing pattern for service instantiation.

### Step 4: Create Deterministic Test

**File:** `src/scripts/test-phase3b-watchdog.ts` (NEW)

**Test Approach:**
- Test ONLY the selection logic of `findStaleLiveMatches()`
- DO NOT call reconcile in this test
- Use deterministic test matches with known timestamps

**Test Steps:**
1. Insert 3 test matches:
   - `phase3b_test_watchdog_stale_1`:
     - `status_id = 2`
     - `match_time = nowTs - 3600`
     - `last_event_ts = nowTs - 1000` (stale)
     - `provider_update_time = nowTs - 1000` (stale)
     - `updated_at = NOW() - INTERVAL '1000 seconds'`
   - `phase3b_test_watchdog_fresh_1`:
     - `status_id = 2`
     - `last_event_ts = nowTs - 30` (fresh)
     - `provider_update_time = nowTs - 30` (fresh)
   - `phase3b_test_watchdog_notlive_1`:
     - `status_id = 1` (NOT_STARTED, should NOT be selected)
     - `last_event_ts = nowTs - 1000` (stale but wrong status)

2. Run:
   ```typescript
   const stales = await service.findStaleLiveMatches(nowTs, 120, 50);
   ```

3. Assertions:
   - `stales` contains `phase3b_test_watchdog_stale_1` ✅
   - `stales` does NOT contain `phase3b_test_watchdog_fresh_1` ✅
   - `stales` does NOT contain `phase3b_test_watchdog_notlive_1` ✅

4. Print:
   ```
   ✅ DETERMINISTIC TEST PASSED: Watchdog selection verified
   ```

5. Cleanup: Delete all 3 test rows

**Package.json Script:**
```json
"test:phase3b-watchdog": "tsx src/scripts/test-phase3b-watchdog.ts"
```

### Step 5: Update PHASE3B_PLAN.md

**File:** `PHASE3B_PLAN.md`

**Changes:**
1. Find Madde 5 (Watchdog) section
2. Mark as ✅ COMPLETED (only after test passes)
3. Add proof output snippet (real output from test run)
4. Update status header: (5/8 completed - Madde 1–5 ✅ COMPLETE)

### Step 6: Optional Proof Document

**File:** `PHASE3B_MADDE5_PROOF.md` (OPTIONAL)

**Content:**
- Goal and invariant reminders
- Test command and real output
- Summary of implementation

## Files to Create

1. `src/services/thesports/match/matchWatchdog.service.ts` (NEW)
2. `src/jobs/matchWatchdog.job.ts` (NEW)
3. `src/scripts/test-phase3b-watchdog.ts` (NEW)
4. `PHASE3B_MADDE5_PROOF.md` (OPTIONAL)

## Files to Modify

1. `src/server.ts` - Register MatchWatchdogWorker
2. `package.json` - Add `test:phase3b-watchdog` script
3. `PHASE3B_PLAN.md` - Mark Madde 5 complete, add proof

## Acceptance Criteria

1. ✅ `npm run test:phase3b-watchdog` exits with code 0 and prints success line
2. ✅ Watchdog job exists, starts/stops cleanly, logs tick summary
3. ✅ Watchdog service selects stale live matches correctly
4. ✅ No code in watchdog updates `updated_at` directly
5. ✅ No API fallback selection introduced
6. ✅ Server boots successfully with watchdog worker
7. ✅ Watchdog logs appear (even if 0 stale matches)

## Implementation Notes

- Use existing DB pool import: `import { pool } from '../database/connection'`
- Use existing logger: `import { logger } from '../utils/logger'`
- Follow MatchMinuteWorker conventions (isRunning guard, interval stop, batch limit)
- If `updated_at` filter is tricky, prioritize `last_event_ts` and `provider_update_time` for determinism
- No schema changes needed (Phase 3A already added `provider_update_time` and `last_event_ts` columns)
- Watchdog constructor needs `MatchDetailLiveService` instance - check how it's instantiated in server.ts

## Testing

After implementation:
1. Run `npm run test:phase3b-watchdog` - must pass
2. Start server - verify watchdog logs appear
3. Check logs for `[Watchdog] tick: ...` messages

## Important Clarification

**Note on Status 3 (HALF_TIME):** We still include `status_id=3` in the watchdog scan, but we use a relaxed stale threshold (`halfTimeStaleSeconds=900`) so HT matches are not falsely treated as stale during the normal 15-minute break.






