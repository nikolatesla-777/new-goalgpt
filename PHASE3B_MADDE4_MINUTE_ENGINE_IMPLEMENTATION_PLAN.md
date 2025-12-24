# Phase 3B - Madde 4: Minute Engine Implementation

## Goal
Implement Minute Engine that calculates match minutes from kickoff timestamps stored in DB. Minute Engine is backend-authoritative: UI will read from DB (Phase 3C), but Madde 4 must enforce backend authority.

## Critical Invariants (MUST NOT VIOLATE)

### Absolute "DO NOT" List
1. **DO NOT write TSİ (+3) offset into database** - DB stores Unix seconds (UTC reference)
2. **DO NOT calculate minute in frontend** - Backend authoritative, UI only reads (Phase 3C)
3. **DO NOT set minute to NULL for freeze statuses** - Status 3/7/8/9/10 retain existing minute
4. **DO NOT overwrite kickoff timestamps** - Write-once only (first_half_kickoff_ts, second_half_kickoff_ts, overtime_kickoff_ts)
5. **DO NOT add fallback match selection** - No r[0]/v[0] fallbacks anywhere

### Required Implementation Rules
- **No API Calls:** Minute Engine reads DB fields + server time only
- **Write-Only-When-Changed:** `new_minute !== existing_minute` (no time-based thresholds)
- **Watchdog Separation:** Time-based thresholds (120s) belong to Watchdog only
- **DO NOT touch updated_at from Minute Engine:** `updated_at` only changes on provider-sourced updates (DetailLive/WebSocket/DataUpdate). Minute Engine writes only `minute` and `last_minute_update_ts`. Otherwise watchdog/reconcile "stale match" detection breaks.

## Implementation Steps

### Step 1: Create MatchMinuteService

**File:** `src/services/thesports/match/matchMinute.service.ts` (NEW)

**Class Structure:**
```typescript
export class MatchMinuteService {
  /**
   * Calculate minute for a match based on status and kickoff timestamps
   * @param statusId - Match status (2=FIRST_HALF, 3=HALF_TIME, 4=SECOND_HALF, 5=OVERTIME, 7=PENALTY)
   * @param firstHalfKickoffTs - Unix seconds timestamp (nullable)
   * @param secondHalfKickoffTs - Unix seconds timestamp (nullable)
   * @param overtimeKickoffTs - Unix seconds timestamp (nullable)
   * @param existingMinute - Current minute value in DB (for freeze statuses)
   * @param nowTs - Current server time (Unix seconds)
   * @returns Calculated minute value (INTEGER, nullable) or null if cannot calculate
   */
  calculateMinute(
    statusId: number,
    firstHalfKickoffTs: number | null,
    secondHalfKickoffTs: number | null,
    overtimeKickoffTs: number | null,
    existingMinute: number | null,
    nowTs: number
  ): number | null {
    // Implementation per status-specific rules
  }
  
  /**
   * Update minute for a single match in DB
   * Only updates if minute value changed (new_minute !== existing_minute)
   * @param matchId - External match ID
   * @param newMinute - Calculated minute value
   * @param existingMinute - Current minute in DB
   * @returns { updated: boolean, rowCount: number }
   */
  async updateMatchMinute(
    matchId: string,
    newMinute: number | null,
    existingMinute: number | null
  ): Promise<{ updated: boolean; rowCount: number }> {
    // Only update if changed
  }
}
```

**Calculation Logic (Status-Specific):**

1. **Status 2 (FIRST_HALF):**
   - Formula: `minute = Math.floor((nowTs - firstHalfKickoffTs) / 60) + 1`
   - Clamp: `Math.min(calculated, 45)` (max 45)
   - Requires: `firstHalfKickoffTs !== null`
   - If missing: return `null` (log warning)

2. **Status 3 (HALF_TIME):**
   - Formula: `minute = 45` (frozen)
   - Always: 45 (no calculation needed)
   - Never NULL

3. **Status 4 (SECOND_HALF):**
   - Formula: `minute = 45 + Math.floor((nowTs - secondHalfKickoffTs) / 60) + 1`
   - Clamp: `Math.max(calculated, 46)` (min 46)
   - Requires: `secondHalfKickoffTs !== null`
   - If missing: return `null` (log warning)

4. **Status 5 (OVERTIME):**
   - Formula: `minute = 90 + Math.floor((nowTs - overtimeKickoffTs) / 60) + 1`
   - Requires: `overtimeKickoffTs !== null`
   - If missing: return `null` (log warning)
   - Note: UI may display OT separately; DB minute for sorting/filtering

5. **Status 7 (PENALTY):**
   - Formula: `minute = existingMinute` (retain last computed value)
   - If `existingMinute === null`: return `null` (should not happen, but safe)
   - Never set to NULL if existing value exists

6. **Status 8 (END), 9 (DELAY), 10 (INTERRUPT):**
   - Formula: `minute = existingMinute` (retain last computed value)
   - Never set to NULL if existing value exists

**Update Logic:**
- Only update if `newMinute !== existingMinute`
- If `newMinute === null` and `existingMinute !== null`: Do NOT update (preserve existing)
- If `newMinute !== null` and `existingMinute === null`: Update (first time setting)
- If both null: Skip (no change)

**SQL Update Query:**
```sql
UPDATE ts_matches
SET 
  minute = $1,
  last_minute_update_ts = $2
WHERE external_id = $3
  AND (minute IS DISTINCT FROM $1);
```

**Note:** Minute Engine never updates `updated_at`. Only `minute` and `last_minute_update_ts` are written.

### Step 2: Create MatchMinuteWorker

**File:** `src/jobs/matchMinute.job.ts` (NEW)

**Class Structure:**
```typescript
export class MatchMinuteWorker {
  private matchMinuteService: MatchMinuteService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  constructor() {
    this.matchMinuteService = new MatchMinuteService();
  }
  
  /**
   * Process a batch of matches and update their minutes
   * @param batchSize - Maximum number of matches to process (default: 100)
   */
  async tick(batchSize: number = 100): Promise<void> {
    // Query matches with status IN (2,3,4,5,7) where minute needs calculation
    // Process each match:
    //   1. Calculate new minute
    //   2. Update only if changed (new_minute !== existing_minute)
    //   3. Log results
  }
  
  start(): void {
    // Run every 30 seconds
  }
  
  stop(): void {
    // Clear interval
  }
}
```

**Query (NO time-based threshold):**
```sql
SELECT 
  external_id,
  status_id,
  first_half_kickoff_ts,
  second_half_kickoff_ts,
  overtime_kickoff_ts,
  minute
FROM ts_matches
WHERE status_id IN (2, 3, 4, 5, 7)
ORDER BY match_time DESC
LIMIT $1;
```

**Note:** 
- Minute Engine does NOT use time-based thresholds (no `last_minute_update_ts < NOW() - INTERVAL '30 seconds'`).
- Minute Engine processes matches with status 2/4/5 every tick; "write-only-when-changed" prevents unnecessary updates.
- `minute IS NULL` filter is NOT used (minute can progress after initial calculation).

**Processing Logic:**
1. Fetch batch of matches
2. For each match:
   - Calculate new minute using `MatchMinuteService.calculateMinute()`
   - Apply update rules:
     - `newMinute === existingMinute` → skip (no change)
     - `newMinute === null && existingMinute !== null` → skip (preserve existing)
     - `newMinute !== null && existingMinute === null` → update (first time setting)
     - `newMinute !== existingMinute` → update (minute changed)
     - Freeze status (3/7/8/9/10) → existingMinute retained, never set to NULL
   - If `newMinute === null` (missing kickoff_ts): Log warning, skip
3. Log summary: `[MinuteEngine] tick: processed N matches, updated M, skipped K`

**Logging (INFO level):**
- `[MinuteEngine] tick: processed N matches, updated M, skipped K`
- `[MinuteEngine] updated match_id=X minute=Y`
- `[MinuteEngine] skipped match_id=X reason=missing kickoff_ts / unchanged minute`
- `[MinuteEngine] NOTE: does NOT update updated_at; only minute + last_minute_update_ts`

### Step 3: Register Worker in Server

**File:** `src/server.ts`

**Changes:**
- Import `MatchMinuteWorker`
- Create instance: `const matchMinuteWorker = new MatchMinuteWorker()`
- Start worker: `matchMinuteWorker.start()`
- Register in cleanup: `matchMinuteWorker.stop()`

**Location:** Find where other workers are registered (e.g., `DataUpdateWorker`, `DailyMatchSyncWorker`)

### Step 4: Create Deterministic Test Script

**File:** `src/scripts/test-phase3b-minute.ts` (NEW)

**Test Cases:**
1. **Minute updates only when changed:**
   - Create test match with status 2, first_half_kickoff_ts set
   - Calculate minute twice within same second
   - Verify: First update writes, second update skips (rowCount=0)

2. **No NULL minute on freeze statuses:**
   - Create test match with status 3 (HALF_TIME), existing minute=45
   - Run minute calculation
   - Verify: Minute remains 45 (not NULL)

3. **No kickoff overwrite:**
   - Create test match with first_half_kickoff_ts already set
   - Attempt to set it again (should not happen in Minute Engine, but test service method)
   - Verify: Kickoff timestamp unchanged

4. **Status-specific calculations:**
   - Test Status 2: Formula + clamp max 45
   - Test Status 3: Always 45
   - Test Status 4: Formula + clamp min 46
   - Test Status 5: OT formula
   - Test Status 7/8/9/10: Retain existing minute

**Package.json Script:**
```json
"test:phase3b-minute": "tsx src/scripts/test-phase3b-minute.ts"
```

### Step 5: Update PHASE3B_PLAN.md

**File:** `PHASE3B_PLAN.md`

**Changes:**
- Mark Madde 4 as ✅ COMPLETED
- Add proof test instructions
- Update status header: `(4/8 completed - Madde 1, 2, 3, 4 ✅ COMPLETE)`

## Files to Create

1. `src/services/thesports/match/matchMinute.service.ts` (NEW)
2. `src/jobs/matchMinute.job.ts` (NEW)
3. `src/scripts/test-phase3b-minute.ts` (NEW)

## Files to Modify

1. `src/server.ts` - Register MatchMinuteWorker
2. `package.json` - Add `test:phase3b-minute` script
3. `PHASE3B_PLAN.md` - Mark Madde 4 complete, add proof

## Acceptance Criteria

- ✅ Minute Engine service calculates minutes correctly for all statuses
- ✅ Minute Engine worker runs every 30 seconds, processes 100 matches per tick
- ✅ Minute updates ONLY when `new_minute !== existing_minute`
- ✅ No time-based thresholds in Minute Engine
- ✅ Freeze statuses (3/7/8/9/10) never set minute to NULL
- ✅ Missing kickoff_ts logs warning and skips (does not set minute to NULL)
- ✅ No API calls from Minute Engine
- ✅ Deterministic test passes: minute updates only when changed, no NULL on freeze, no kickoff overwrite
- ✅ Logs at INFO level: tick summary, updates, skips
- ✅ Worker registered in server and starts automatically
- ✅ Minute Engine never updates `updated_at` (watchdog/reconcile stale detection preserved)

## Implementation Order

1. Create `MatchMinuteService` with calculation logic
2. Create `MatchMinuteWorker` with tick logic
3. Register worker in server
4. Create test script
5. Update PHASE3B_PLAN.md
6. Run test script to verify

---

## Delta / What Changed

- **Removed `minute IS NULL` gating from worker query:** Minute Engine now processes all live matches (status 2/3/4/5/7) every tick, allowing minute to progress after initial calculation. "Write-only-when-changed" prevents unnecessary updates.
- **Removed `updated_at` writes from minute updates:** Minute Engine only writes `minute` and `last_minute_update_ts`. `updated_at` remains unchanged to preserve watchdog/reconcile stale match detection (`updated_at < now - 120s`).

