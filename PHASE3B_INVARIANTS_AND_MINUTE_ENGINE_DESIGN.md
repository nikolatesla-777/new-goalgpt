# Phase 3B Invariants & Minute Engine Design Documentation

## Goal
Before implementing Madde 4 (Minute Engine), document all critical invariants that must hold and create a clear Minute Engine Design section in PHASE3B_PLAN.md.

## Phase 3B Minute Engine Kilit Invariant Seti

### Time & Timezone Invariants
- **DB Time Reference:** `match_time` is stored as Unix seconds (UTC reference)
- **No TSİ Offset in DB:** TSİ offset is NEVER written to DB
- **Timezone Conversion:** Timezone conversion happens ONLY in response/UI layer
- **Minute Engine Authority:** Minute engine writes "calculated minute" to DB; UI does NOT calculate minute (Phase 3C: UI only reads DB minute)

### Minute Engine Reference Sources (Locked)
Minute engine's ONLY authoritative references:
1. `status_id` - Match status
2. Kickoff timestamps (write-once): `first_half_kickoff_ts`, `second_half_kickoff_ts`, `overtime_kickoff_ts`
3. `provider_update_time` / `last_event_ts` - For optimistic locking

### Write-Once Kickoff Rules (Locked)
- **first_half_kickoff_ts:** Set ONLY once when match first goes live:
  - Trigger: Status 2 (FIRST_HALF) OR provider minute >= 1 detected
  - Write-once: Never overwritten once set
- **second_half_kickoff_ts:** Set ONLY once on first transition to status 4 (SECOND_HALF)
  - Write-once: Never overwritten once set
- **overtime_kickoff_ts:** Set ONLY once on first transition to status 5 (OVERTIME)
  - Write-once: Never overwritten once set
- **No Single-Field Solution:** `live_kickoff_time` (legacy) does NOT solve all phases; each phase has its own kickoff timestamp

### Optimistic Locking Rule (Locked)
- **DB Update Condition:** Update applied ONLY if `incoming_provider_time > provider_update_time`
- **Stale Update Skip:** If `incoming_provider_time <= provider_update_time`, skip update (rowCount=0)
- **Equal Time Handling:** Equal times are considered stale (skip)

### Minute Calculation Rules (Locked)
- **Status 2 (FIRST_HALF):**
  - Formula: `minute = floor((now_ts - first_half_kickoff_ts) / 60) + 1`
  - Clamp: Maximum 45 (never exceeds 45)
  - Requires: `first_half_kickoff_ts IS NOT NULL`
- **Status 4 (SECOND_HALF):**
  - Formula: `minute = 45 + floor((now_ts - second_half_kickoff_ts) / 60) + 1`
  - Clamp: Minimum 46 (never below 46)
  - Requires: `second_half_kickoff_ts IS NOT NULL`
- **Status 5 (OVERTIME):**
  - Formula: `minute = 90 + floor((now_ts - overtime_kickoff_ts) / 60) + 1` OR separate OT minute display
  - DB Behavior: Minute retains "last known" value (UI shows OT label separately)
  - Requires: `overtime_kickoff_ts IS NOT NULL`

### Freeze Rules (Locked)
Minute is NEVER set to NULL for these statuses; last computed value is retained:
- **Status 3 (HALF_TIME):** `minute = 45` (frozen at 45)
- **Status 7 (PENALTY):** `minute = existing_minute` (retain last computed value)
- **Status 8 (END):** `minute = existing_minute` (retain last computed value)
- **Status 9 (DELAY):** `minute = existing_minute` (retain last computed value)
- **Status 10 (INTERRUPT):** `minute = existing_minute` (retain last computed value)
- **Critical:** None of these statuses set minute to NULL

### Update Threshold Rule (Locked)
- **Minute DB Write Condition:** Minute is written to DB ONLY when value changes (`new_minute !== existing_minute`)
- **Spam Prevention:** If `new_minute === existing_minute`, skip update (no DB write)
- **No Time-Based Thresholds:** Minute Engine does NOT use time-based thresholds (30s, 120s, etc.). Time-based thresholds belong to Watchdog only.

### Watchdog Rule (Locked)
- **Stale Match Detection:** Matches with status live (2/4/5/7) AND `now - updated_at > 120s` are queued for reconcile
- **Reconcile Sources:** `data/update` + `detail_live` endpoints
- **Optimistic Locking Still Applies:** Even in watchdog reconcile, stale updates are skipped (incoming_provider_time <= provider_update_time)

### Provider Selection Rule (Locked)
- **detail_live Parsing:** If `match_id` not found in response array, return NULL
- **No Fallback:** NEVER use "first element fallback" (e.g., `r[0]` or `v[0]`)
- **Critical Bug Prevention:** Writing to wrong match is a fatal bug

## Changes to PHASE3B_PLAN.md

### 1. Add "Invariants Checklist" Section (After Phase 3B Öncelik Kararı)

Insert a new section after line 20 with explicit invariant documentation:

**Location:** After "## Phase 3B Öncelik Kararı" section

**Content:**
- **Invariant 1: Kickoff Timestamps (first_half_kickoff_ts, second_half_kickoff_ts, overtime_kickoff_ts)**
  - Write-once: Never overwritten once set
  - Set only on correct status transitions:
    - `first_half_kickoff_ts`: Status 1→2 (NOT_STARTED → FIRST_HALF) OR provider minute >= 1 detected
    - `second_half_kickoff_ts`: Status 3→4 (HALF_TIME → SECOND_HALF) - first transition only
    - `overtime_kickoff_ts`: Status 4→5 (SECOND_HALF → OVERTIME) - first transition only
  - Source priority: `liveKickoffTime` from provider (if available) else `nowTs` (server time)
  - No single-field solution: `live_kickoff_time` (legacy) does NOT solve all phases; each phase has its own kickoff timestamp
  - Implementation proof: `matchDetailLive.service.ts` and `websocket.service.ts` check `existing.kickoff_ts === null` before setting

- **Invariant 2: Timestamp Monotonicity & Optimistic Locking (provider_update_time, last_event_ts)**
  - `provider_update_time`: Monotonic (never goes backwards) via `GREATEST(COALESCE(provider_update_time, 0), incoming)`
  - `last_event_ts`: Always set to ingestion timestamp (monotonic by definition)
  - **Optimistic Locking Rule (Locked):** DB update applied ONLY if `incoming_provider_time > provider_update_time`
  - **Stale Update Skip:** If `incoming_provider_time <= provider_update_time`, skip update (rowCount=0)
  - **Equal Time Handling:** Equal times are considered stale (skip)
  - Optimistic locking applies to ALL updates: reconcile, watchdog, websocket
  - Implementation proof: `matchDetailLive.service.ts` line 333 uses `GREATEST` for monotonicity, lines 288-304 check freshness

- **Invariant 3: detail_live Match Selection**
  - ID-based only: `extractLiveFields()` finds match by `match_id` in response array
  - No fallback: Returns `null` if match_id not found (no `r[0]` or `v[0]` fallback)
  - Proven by deterministic test: `npm run test:phase3b` (Madde 2 test)
  - Implementation proof: `matchDetailLive.service.ts` lines 74-79, 88-93, 100-106

- **Invariant 4: Controllers Remain DB-Only**
  - No API fallback: Controllers query database ONLY
  - `getMatchDiary`: DB-only mode (comment at line 120: "CRITICAL: DB-only mode")
  - `getLiveMatches`: DB-only (queries `matchDatabaseService.getLiveMatches()`)
  - Minute engine must NOT call APIs: All minute calculations must be derived from DB data only
  - UI does NOT calculate minute: UI only reads DB minute (Phase 3C)

- **Invariant 5: Watchdog Rule (Stale Match Recovery)**
  - Stale match detection: Status live (2/4/5/7) AND `now - updated_at > 120s`
  - Reconcile queue: Queued matches are reconciled via `data/update` + `detail_live`
  - Optimistic locking still applies: Even in watchdog reconcile, stale updates are skipped
  - Implementation proof: Watchdog service (to be implemented in Madde 6)

### 2. Update "Minute Engine Design" Section (Replace existing Madde 4 content)

**Location:** Replace section starting at line 293 "### 4) Dakika Motoru (Backend Minute Authoritative)"

**New Content:**

#### Minute Engine Design

**File:** `src/services/thesports/match/matchMinute.service.ts` (NEW)

**Inputs:**
- `status_id`: Match status (1=NOT_STARTED, 2=FIRST_HALF, 3=HALF_TIME, 4=SECOND_HALF, 5=OVERTIME, 7=PENALTY, 8=END, 9=DELAY, 10=INTERRUPT)
- `first_half_kickoff_ts`: Unix seconds timestamp (write-once, set on status 1→2 transition)
- `second_half_kickoff_ts`: Unix seconds timestamp (write-once, set on status 3→4 transition)
- `overtime_kickoff_ts`: Unix seconds timestamp (write-once, set on status 4→5 transition)
- `current_time`: Server time (Unix seconds) - `Math.floor(Date.now() / 1000)`
- `existing_minute`: Current minute value in DB (for change detection)
- `last_minute_update_ts`: Last time minute was updated (for tracking only, NOT used for time-based thresholds)

**Outputs:**
- `minute`: Calculated minute value (INTEGER, nullable)
- `last_minute_update_ts`: Unix seconds timestamp of last update

**Calculation Rules (Status-Specific):**

1. **Status 2 (FIRST_HALF):**
   - Formula: `minute = floor((now_ts - first_half_kickoff_ts) / 60) + 1`
   - Requires: `first_half_kickoff_ts IS NOT NULL`
   - Clamp: Maximum 45 (never exceeds 45)

2. **Status 3 (HALF_TIME):**
   - Formula: `minute = 45` (frozen)
   - Always: 45 (no calculation needed)
   - Freeze rule: Minute is NEVER NULL for this status

3. **Status 4 (SECOND_HALF):**
   - Formula: `minute = 45 + floor((now_ts - second_half_kickoff_ts) / 60) + 1`
   - Requires: `second_half_kickoff_ts IS NOT NULL`
   - Clamp: Minimum 46 (never below 46)

4. **Status 5 (OVERTIME):**
   - Formula: `minute = 90 + floor((now_ts - overtime_kickoff_ts) / 60) + 1` OR separate OT minute display
   - Requires: `overtime_kickoff_ts IS NOT NULL`
   - DB Behavior: Minute retains "last known" value (UI shows OT label separately)
   - Note: UI may display OT minute separately; DB minute is for sorting/filtering

5. **Status 7 (PENALTY):**
   - Formula: `minute = existing_minute` (retain last computed value)
   - UI shows "PEN" label, but minute value remains for sorting/filtering
   - Freeze rule: Minute is NEVER NULL for this status

6. **Status 8 (END), 9 (DELAY), 10 (INTERRUPT):**
   - Formula: `minute = existing_minute` (retain last computed value)
   - END: Final minute value (retained)
   - DELAY: Last minute before delay (retained)
   - INTERRUPT: Last minute before interrupt (retained)
   - Freeze rule: Minute is NEVER NULL for any of these statuses

**Update Conditions (Locked):**
- **Only update if:** `new_minute !== existing_minute` (minute value changed)
- **Skip update if:** `new_minute === existing_minute` (no change - prevents DB spam)
- **Status filter:** Only process matches with `status_id IN (2, 3, 4, 5, 7)`
- **Missing kickoff_ts:** If required kickoff_ts is NULL, skip calculation (log warning, do NOT set minute to NULL)
- **Freeze statuses:** Status 3/7/8/9/10 retain existing minute (never set to NULL)
- **No Time-Based Thresholds:** Minute Engine writes minute ONLY when minute value changes. No time-based write thresholds (30s, 120s, etc.) are used. Time-based thresholds belong to Watchdog only.

**Worker Implementation:**
- **File:** `src/jobs/matchMinute.job.ts` (NEW)
- **Schedule:** Every 30 seconds
- **Batch size:** 100 matches per tick
- **Query:** `SELECT external_id, status_id, first_half_kickoff_ts, second_half_kickoff_ts, overtime_kickoff_ts, minute FROM ts_matches WHERE status_id IN (2,3,4,5,7) AND minute IS NULL ORDER BY updated_at DESC LIMIT 100`
- **Update Rule (Locked):** Minute Engine writes minute ONLY when minute value changes (`new_minute !== existing_minute`). No time-based write thresholds are used. Time-based thresholds belong to Watchdog only.

**No API Calls (Locked):**
- Minute engine must NOT call TheSports API
- All calculations derived from DB data only (kickoff_ts + current time)
- No "magic numbers" or frontend-style recalculation
- UI does NOT calculate minute: UI only reads DB minute (Phase 3C implementation)

**Time & Timezone (Locked):**
- DB time reference: `match_time` is Unix seconds (UTC reference)
- No TSİ offset in DB: TSİ offset is NEVER written to DB
- Timezone conversion: Happens ONLY in response/UI layer

### 3. Verify Header Status

**Location:** Line 4

**Current:** `**Status:** 🚧 IN PROGRESS (3/8 completed - Madde 1, 2, 3 ✅ COMPLETE)`

**Action:** Verify this is correct (should already be updated from previous work)

## Files to Modify

1. **PHASE3B_PLAN.md**
   - Add "Invariants Checklist" section after Phase 3B Öncelik Kararı
   - Replace "### 4) Dakika Motoru" section with detailed Minute Engine Design
   - Verify header status is correct

## Acceptance Criteria

- All 4 invariants explicitly documented with implementation proof references
- Minute Engine Design section includes:
  - Clear inputs/outputs
  - Status-specific calculation rules
  - Update conditions (threshold: >= 1 minute change)
  - Worker implementation details
  - Explicit "No API Calls" rule
- Header status shows 3/8 completed
- No code changes (documentation only)

