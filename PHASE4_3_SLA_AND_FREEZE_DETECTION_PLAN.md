# Phase 4-3: SLA and Freeze Detection Plan

**Status:** ✅ **COMPLETE** - See `PHASE4_3_SLA_AND_FREEZE_DETECTION_REPORT.md` for implementation proof  
**Prerequisites:** Phase 4-2 CLOSED  
**Goal:** Detect and escalate matches that are "stuck" (no provider events) while still LIVE, with observability and controlled recovery, without corrupting minute engine or optimistic locking.

---

## 1. GOAL

**Primary Objective:**
Detect matches that are "stuck" in LIVE states (status 2, 4, 5, 7) with no provider events, providing:
- **Observability:** Structured logging for stale detection
- **Controlled Recovery:** Forced reconcile attempts via existing `detail_live` endpoint
- **Safety:** Zero mutation of minute engine or optimistic locking invariants

**Non-Goals:**
- Auto-finish matches
- Auto-status changes
- UI behavior modifications
- Cron tuning
- Provider assumptions

---

## 2. CORE SIGNALS (READ-ONLY)

**Existing DB Fields Used for Detection (READ-ONLY):**

1. **`last_event_ts`** (BIGINT, epoch seconds)
   - Last timestamp from provider events (MQTT/WebSocket)
   - NULL if no events received
   - Used to detect stale live matches

2. **`provider_update_time`** (BIGINT, epoch seconds)
   - Last provider timestamp from `/data/update` or `detail_live`
   - NULL if never updated
   - Used as secondary staleness signal

3. **`minute`** (INTEGER)
   - Current match minute (calculated by Minute Engine)
   - NULL if not calculable
   - READ-ONLY for Phase 4-3 (never updated by stale detection)

4. **`status_id`** (INTEGER)
   - Current match status (1=NOT_STARTED, 2=FIRST_HALF, 3=HALF_TIME, 4=SECOND_HALF, 5=OVERTIME, 7=EXTRA_TIME, 8=END)
   - Used to filter LIVE matches (2, 4, 5, 7)
   - READ-ONLY for Phase 4-3 (never changed by stale detection)

5. **`updated_at`** (TIMESTAMP)
   - Last database update timestamp
   - READ-ONLY for Phase 4-3 (never written by stale detection)
   - Used only for informational logging

**Critical Constraint:**
Phase 4-3 detection logic is **READ-ONLY** on these fields. No mutations allowed except:
- `stale_reason` (new field, design only in this plan)
- Triggering existing `reconcileMatchToDatabase()` function (which may update `updated_at`, `provider_update_time`, `last_event_ts` via existing paths)

---

## 3. STALE DEFINITIONS

**Deterministic Rules (No Time-Based Guesses):**

### Rule 1: LIVE Match Stale (Status 2, 4, 5, 7)
A match is considered **stale** if:
- `status_id IN (2, 4, 5, 7)` (explicitly LIVE)
- AND `match_time <= nowTs + 3600` (within 1 hour of scheduled time)
- AND **ANY** of:
  - `last_event_ts IS NULL` (no events ever received)
  - `last_event_ts <= nowTs - 120` (no events in last 120 seconds)
  - `provider_update_time IS NULL` (never updated via data_update)
  - `provider_update_time <= nowTs - 120` (no updates in last 120 seconds)

**Threshold:** 120 seconds (2 minutes) for LIVE matches

### Rule 2: HALF_TIME Stuck (Status 3)
A match is considered **stuck in HALF_TIME** if:
- `status_id = 3` (HALF_TIME)
- AND `match_time <= nowTs + 3600` (within 1 hour of scheduled time)
- AND **ANY** of:
  - `last_event_ts IS NULL`
  - `last_event_ts <= nowTs - 900` (no events in last 15 minutes)
  - `provider_update_time IS NULL`
  - `provider_update_time <= nowTs - 900` (no updates in last 15 minutes)

**Threshold:** 900 seconds (15 minutes) for HALF_TIME

### Rule 3: SECOND_HALF No Progress (Status 4)
A match is considered **stuck in SECOND_HALF** if:
- `status_id = 4` (SECOND_HALF)
- AND `match_time <= nowTs + 3600`
- AND `minute IS NOT NULL` (minute engine has calculated a value)
- AND `minute >= 45` (second half started)
- AND **ANY** of:
  - `last_event_ts IS NULL`
  - `last_event_ts <= nowTs - 180` (no events in last 3 minutes)
  - `provider_update_time IS NULL`
  - `provider_update_time <= nowTs - 180` (no updates in last 3 minutes)

**Threshold:** 180 seconds (3 minutes) for SECOND_HALF with progress

**Important:** These rules are **deterministic** and **time-based only on existing timestamps**. No business logic assumptions about match duration or expected progress.

---

## 4. ACTION LADDER (STRICT ORDER)

**Actions must be executed in this exact order, with explicit STOP conditions:**

### Level 1: Log-Only Detection (No Mutation)
- **Action:** Emit structured log event `match.stale.detected`
- **Fields:** `match_id`, `status_id`, `age_sec` (time since last event/update), `reason` (which rule triggered)
- **Mutation:** NONE
- **Next:** Proceed to Level 2 if match is still stale after detection

### Level 2: Forced Reconcile Attempt
- **Action:** Call existing `matchDetailLiveService.reconcileMatchToDatabase(match_id, null)`
- **Mutation:** Only via existing reconcile paths (may update `provider_update_time`, `last_event_ts`, `updated_at`)
- **Log:** Emit `match.stale.reconcile_attempt` event
- **Fields:** `match_id`, `status_id`, `reconcile_result` (success/fail), `duration_ms`
- **Next:** Proceed to Level 3 if reconcile fails or match remains stale

### Level 3: Mark Stale Reason (Design Only)
- **Action:** Store `stale_reason` enum/string in DB (new field, design only)
- **Possible Values:**
  - `NO_EVENTS` (last_event_ts is NULL)
  - `EVENTS_STALE` (last_event_ts > threshold)
  - `NO_PROVIDER_UPDATE` (provider_update_time is NULL)
  - `PROVIDER_UPDATE_STALE` (provider_update_time > threshold)
  - `RECONCILE_FAILED` (forced reconcile returned no data)
- **Mutation:** Only `stale_reason` field (if schema allows)
- **Log:** Emit `match.stale.unresolved` event
- **Fields:** `match_id`, `status_id`, `stale_reason`, `age_sec`, `reconcile_attempts`
- **STOP:** No further actions after Level 3

### STOP Conditions
- **Explicit STOP after Level 3:** No loops, no retries beyond Level 3
- **Deduplication:** Same match cannot trigger action ladder more than once per detection window
- **Success Path:** If reconcile succeeds and match is no longer stale, STOP and log success

---

## 5. HARD INVARIANTS (MUST LIST)

**Phase 4-3 MUST NOT:**

1. **Update `minute`**
   - Minute Engine is the sole authority for minute calculation
   - Phase 4-3 detection logic is READ-ONLY on `minute`

2. **Update `updated_at`**
   - Phase 4-3 detection logic does NOT write `updated_at`
   - Only existing reconcile paths (triggered by Phase 4-3) may update `updated_at`

3. **Override `provider_update_time`**
   - Phase 4-3 does NOT inject or override `provider_update_time`
   - Only existing reconcile paths (triggered by Phase 4-3) may update `provider_update_time`

4. **Change Match Status**
   - Phase 4-3 does NOT change `status_id`
   - Status changes only via existing MQTT/WebSocket or reconcile paths

5. **Trigger Watchdog Repeatedly**
   - Same match cannot trigger action ladder more than once per detection window
   - Deduplication required: track which matches have been processed in current window

6. **Conflict with Minute Engine**
   - Phase 4-3 runs independently of Minute Engine
   - No shared locks or coordination needed (different columns, different purposes)

---

## 6. OBSERVABILITY

**Structured Events (using `logEvent()`):**

### Event 1: `match.stale.detected`
- **Level:** WARN
- **Mandatory Fields:**
  - `match_id` (string)
  - `status_id` (number)
  - `age_sec` (number) - time since last event/update
  - `reason` (string) - which rule triggered (e.g., "EVENTS_STALE", "NO_PROVIDER_UPDATE")
  - `last_event_ts` (number | null)
  - `provider_update_time` (number | null)
- **Optional Fields:**
  - `minute` (number | null) - for informational purposes only

### Event 2: `match.stale.reconcile_attempt`
- **Level:** INFO
- **Mandatory Fields:**
  - `match_id` (string)
  - `status_id` (number)
  - `reconcile_result` (string) - "success" | "no_data" | "error"
  - `duration_ms` (number)
  - `rowCount` (number) - from reconcile result
- **Optional Fields:**
  - `error` (string) - if reconcile failed

### Event 3: `match.stale.unresolved`
- **Level:** ERROR
- **Mandatory Fields:**
  - `match_id` (string)
  - `status_id` (number)
  - `stale_reason` (string) - enum value (NO_EVENTS, EVENTS_STALE, etc.)
  - `age_sec` (number)
  - `reconcile_attempts` (number) - count of reconcile attempts
- **Optional Fields:**
  - `last_event_ts` (number | null)
  - `provider_update_time` (number | null)

---

## 7. SAFETY GUARANTEES

### Infinite Loop Prevention
- **Deduplication:** Track processed matches in current detection window (in-memory set, cleared on window reset)
- **Action Ladder:** Strict order with explicit STOP after Level 3
- **No Retries:** Same match cannot trigger action ladder again until next detection window

### Repeated Stale Detection Deduplication
- **Window-Based:** Detection runs every 30 seconds (same as existing Watchdog)
- **In-Memory Tracking:** Maintain set of `match_id`s processed in current window
- **Reset:** Clear tracking set at start of each detection window
- **Skip Logic:** If `match_id` already in tracking set, skip (log DEBUG, no action)

### Conflict Prevention with Minute Engine
- **Different Columns:** Minute Engine updates `minute` + `last_minute_update_ts`; Phase 4-3 is READ-ONLY on `minute`
- **Different Purposes:** Minute Engine calculates time-based minute; Phase 4-3 detects staleness
- **No Shared Locks:** No coordination needed (different update paths)
- **No Overlap:** Phase 4-3 never touches `minute` or `last_minute_update_ts`

---

## 8. ACCEPTANCE CRITERIA

### Detection Accuracy
- [ ] Deterministic detection: Same match state always produces same detection result
- [ ] Rule 1 (LIVE stale): Correctly identifies matches with no events/updates in 120s
- [ ] Rule 2 (HALF_TIME stuck): Correctly identifies matches stuck in HALF_TIME > 15min
- [ ] Rule 3 (SECOND_HALF no progress): Correctly identifies matches with no progress in 3min

### Zero Unauthorized DB Mutation
- [ ] No `minute` updates by Phase 4-3 code
- [ ] No `updated_at` updates by Phase 4-3 code (only via existing reconcile paths)
- [ ] No `provider_update_time` overrides by Phase 4-3 code
- [ ] No `status_id` changes by Phase 4-3 code

### Observability
- [ ] `match.stale.detected` events logged for all detected stale matches
- [ ] `match.stale.reconcile_attempt` events logged for all reconcile attempts
- [ ] `match.stale.unresolved` events logged for matches that remain stale after Level 3
- [ ] All events include mandatory fields

### Proof Requirements
- [ ] SQL proof: Query stale matches using detection rules (no false positives)
- [ ] Log proof: Structured events captured in `/tmp/goalgpt-server.log`
- [ ] Deduplication proof: Same match not processed twice in same window
- [ ] Invariant proof: No `minute` or `updated_at` mutations by Phase 4-3 code

### Dry-Run Mode
- [ ] Can run in dry-run mode (detection + logging only, no reconcile calls)
- [ ] Dry-run mode clearly marked in logs
- [ ] Dry-run mode does not affect production behavior

---

## 9. OUT OF SCOPE

**Explicitly NOT in Phase 4-3:**

1. **Auto-Finish Matches**
   - Phase 4-3 does NOT automatically change status to END (8)
   - Matches remain in their current status

2. **Auto-Status Changes**
   - Phase 4-3 does NOT change `status_id`
   - Status changes only via existing MQTT/WebSocket or reconcile paths

3. **UI Behavior**
   - Phase 4-3 does NOT modify frontend behavior
   - UI continues to read from DB (no changes)

4. **Cron Tuning**
   - Phase 4-3 does NOT modify existing worker schedules
   - Detection runs on existing Watchdog schedule (30s interval)

5. **Provider Assumptions**
   - Phase 4-3 does NOT assume provider behavior
   - Detection is based on existing timestamps only (no business logic assumptions)

---

## 10. IMPLEMENTATION APPROACH

### Service: `MatchStaleDetectionService`
- **File:** `src/services/thesports/match/matchStaleDetection.service.ts` (NEW)
- **Methods:**
  - `detectStaleMatches(nowTs: number, limit: number): Promise<StaleMatch[]>`
  - `processStaleMatch(match: StaleMatch, dryRun: boolean): Promise<void>`
  - `executeActionLadder(match: StaleMatch, dryRun: boolean): Promise<void>`

### Worker: `MatchStaleDetectionWorker`
- **File:** `src/jobs/matchStaleDetection.job.ts` (NEW)
- **Schedule:** Every 30 seconds (same as existing Watchdog)
- **Batch Limit:** 50 matches per tick
- **Deduplication:** In-memory set of processed `match_id`s

### Database Schema (Design Only)
- **New Field:** `stale_reason` (VARCHAR(50) | NULL)
- **Index:** `CREATE INDEX IF NOT EXISTS idx_ts_matches_stale_reason ON ts_matches(stale_reason) WHERE stale_reason IS NOT NULL`
- **Note:** Schema change is design-only in this plan. Implementation will decide if field is needed.

### Integration Points
- **Existing Service:** `MatchDetailLiveService.reconcileMatchToDatabase()` (called at Level 2)
- **Existing Worker:** `MatchWatchdogWorker` (may be extended or replaced by Phase 4-3 worker)
- **Existing DB Fields:** `last_event_ts`, `provider_update_time`, `minute`, `status_id`, `updated_at` (all READ-ONLY)

---

## 11. RISK MITIGATION

### Risk 1: False Positives
- **Mitigation:** Deterministic rules based on timestamps only (no business logic)
- **Proof:** SQL queries can verify detection accuracy

### Risk 2: Performance Impact
- **Mitigation:** Batch limit (50 matches per tick), indexed queries
- **Proof:** Query execution time < 100ms for 50 matches

### Risk 3: Conflict with Minute Engine
- **Mitigation:** Different columns, different purposes, no shared locks
- **Proof:** Static code analysis (no `minute` updates in Phase 4-3 code)

### Risk 4: Infinite Loops
- **Mitigation:** Deduplication, explicit STOP after Level 3, window-based reset
- **Proof:** In-memory tracking set size never exceeds batch limit

---

## 12. EXECUTION ORDER

1. **Design Review:** Review this plan and approve detection rules
2. **Schema Decision:** Decide if `stale_reason` field is needed (or use structured logs only)
3. **Service Implementation:** Implement `MatchStaleDetectionService` (detection logic only)
4. **Worker Implementation:** Implement `MatchStaleDetectionWorker` (action ladder)
5. **Integration:** Wire worker into `server.ts` startup
6. **Testing:** Run deterministic tests with SQL proofs
7. **Dry-Run Mode:** Test with dry-run enabled
8. **Production Deployment:** Enable with dry-run first, then full mode

---

## 13. SUCCESS METRICS

- **Detection Rate:** Number of stale matches detected per hour
- **Recovery Rate:** Percentage of stale matches recovered via reconcile
- **False Positive Rate:** Zero false positives (deterministic rules)
- **Performance:** Detection tick duration < 200ms (50 matches)
- **Observability:** All structured events logged correctly

---

**End of Phase 4-3 Plan**

**Next Step:** Design review and approval before implementation begins.

