# Phase 4 — Production Hardening

**Status:** Planning  
**Prerequisites:** Phase 3C CLOSED  
**Goal:** Harden the system for production deployment without breaking existing invariants

---

## Goals

- Establish comprehensive observability (structured logging, worker health visibility)
- Implement provider resilience patterns (timeouts, retries, graceful degradation)
- Enforce SLA guarantees (stale detection, freeze detection, action ladder)
- Add UI failsafe mechanisms (no client-side logic, graceful degradation)
- Verify restart safety and idempotency (no duplicate writes, concurrent safety)
- Create production readiness checklist (go/no-go decision framework)

---

## Non-Goals

- No new product features (this is hardening only)
- No changes to Phase 3C frozen logic (minute calculation, optimistic locking, kickoff_ts write-once)
- No breaking API contract changes
- No database schema migrations unless explicitly called out in a sub-phase and justified with proof (default: no migrations)
- No heavy load testing infrastructure (lightweight script-based only)
- No deployment automation (out of scope for Phase 4)

---

## Definition of Done

**Phase 4 is complete when:**
- All 6 sub-phases (4-0 through 4-6) have proof artifacts
- All workers log structured INFO-level "started" messages
- Provider resilience patterns are implemented and tested
- SLA watchdog detects and escalates stale matches
- UI failsafe renders gracefully when data is stale
- Restart safety verified (no duplicate writes, idempotent operations)
- Production readiness checklist completed with all required artifacts
- Zero Phase 3C invariants violated

---

## Do Not Break Invariants

**Critical invariants that MUST remain intact:**

1. **DB Time Storage:** `match_time` stored as Unix seconds (UTC reference). No TSİ offset stored in DB.
2. **Minute Engine Isolation:** Minute Engine must NOT touch `updated_at` (only updates `minute` + `last_minute_update_ts`).
3. **Optimistic Locking:** Provider writes must be monotonic (`provider_update_time` only increases, stale writes rejected).
4. **Controller DB-Only:** Controllers read from DB only (no API fallback in production paths).
5. **UI Rendering Only:** UI never computes minutes; UI renders backend `minute_text` directly.
6. **Live Endpoint Semantics:** `/api/matches/live` is time-window endpoint (includes `status_id=1` if `match_time` passed).
7. **Watchdog Non-Intrusive:** Watchdog never overwrites newer provider state (reconcile respects optimistic locking).
8. **Kickoff Write-Once:** `first_half_kickoff_ts`, `second_half_kickoff_ts`, `overtime_kickoff_ts` are write-once (never overwritten).
9. **Minute Update Condition:** Minute Engine only updates when `new_minute !== existing_minute`.
10. **Freeze Status Handling:** Status 3/7/8/9/10 preserve existing minute (no NULL assignment).
11. **Provider Update Time Source:** `provider_update_time` comes from provider payloads (data_update, detail_live, MQTT).
12. **Last Event TS:** `last_event_ts` is ingestion timestamp (server time when event processed).
13. **No Fallback Match Selection:** No `r[0]` or `v[0]` fallbacks in match selection logic.
14. **DB-Only Mode:** Daily diary sync is the only source filling DB; controllers never call API.
15. **Status Transition Rules:** Kickoff timestamps set only on specific status transitions (2→first, 3→4→second, 4→5→overtime).

---

## Phase 4-0: Preflight Audit (Read-only)

**Objective:** Establish baseline metrics and inventory all workers, endpoints, and write surfaces before making changes.

**Files to Review:**
- `src/server.ts` (worker startup/shutdown)
- `src/jobs/*.job.ts` (all worker implementations)
- `src/controllers/match.controller.ts` (endpoint handlers)
- `src/services/thesports/**/*.service.ts` (provider clients)

**Implementation Steps:**

1. **Worker Inventory**
   - List all workers with their start/stop methods
   - Document tick intervals and cron schedules
   - Identify DB write surfaces per worker

2. **Endpoint Baseline**
   - Measure `/api/matches/diary?date=YYYY-MM-DD` latency (p50, p95, p99)
   - Measure `/api/matches/live` latency (p50, p95, p99)
   - Document current response sizes

3. **DB Write Surface Audit**
   - Map each worker to tables it writes to
   - Identify write frequency and batch sizes
   - Document any existing idempotency mechanisms

4. **Logging Baseline**
   - Inventory current log levels per worker
   - Document log format (structured vs unstructured)
   - Identify missing "started" logs

**Proof Commands:**

```bash
# Worker inventory
grep -r "class.*Worker" src/jobs/ | wc -l
grep -r "\.start()" src/server.ts | grep -i worker

# Endpoint latency baseline (quick sample)
# Requires: bash + curl
# Produces a sorted list of timings you can eyeball for p50/p95/p99.
for i in {1..50}; do
  /usr/bin/time -p curl -s "http://localhost:3000/api/matches/diary?date=2025-12-22" > /dev/null
done 2>&1 | awk '/real/{print $2}' | sort -n | tee /tmp/diary_times.txt

for i in {1..50}; do
  /usr/bin/time -p curl -s "http://localhost:3000/api/matches/live" > /dev/null
done 2>&1 | awk '/real/{print $2}' | sort -n | tee /tmp/live_times.txt

echo "p50=$(awk 'NR==int(0.50*NR+0.5){print $0}' /tmp/diary_times.txt)  p95=$(awk 'NR==int(0.95*NR+0.5){print $0}' /tmp/diary_times.txt)  p99=$(tail -n 1 /tmp/diary_times.txt)"
echo "p50=$(awk 'NR==int(0.50*NR+0.5){print $0}' /tmp/live_times.txt)   p95=$(awk 'NR==int(0.95*NR+0.5){print $0}' /tmp/live_times.txt)   p99=$(tail -n 1 /tmp/live_times.txt)"

# Log format check
tail -100 /tmp/goalgpt-server.log | grep -E "\[info\]|\[error\]" | head -10
```

**Acceptance Criteria:**
- [ ] All workers documented with intervals/schedules
- [ ] Endpoint latency baselines recorded (p50, p95, p99)
- [ ] DB write surfaces mapped to workers
- [ ] Log format inventory completed
- [ ] Output file: `PHASE4_PREFLIGHT_AUDIT.md` created

---

## Phase 4-1: Observability Contract

**Objective:** Define and implement canonical log format with required fields. Ensure all workers log structured INFO-level "started" messages.

**Files to Modify:**
- `src/utils/logger.ts` (if structured logging helper needed)
- `src/jobs/*.job.ts` (add "started" logs)
- `src/server.ts` (worker startup logging)

**Implementation Steps:**

1. **Define Log Contract**
   - Standardize log format: `[timestamp] [level] [service] message {structured_fields}`
   - Required fields: `service`, `worker` (if applicable), `match_id` (if applicable)
   - Define log levels: ERROR, WARN, INFO, DEBUG

2. **Worker "Started" Logs**
   - Add INFO-level "started" log to each worker's `start()` method
   - Include: worker name, interval/schedule, batch size (if applicable)

3. **Critical Action Logging**
   - Add structured logs for: reconcile start/end, minute update, watchdog trigger
   - Include: `match_id`, `status_id`, `provider_update_time` (if applicable)

4. **Log Format Helper (if needed)**
   - Create helper function for structured logging
   - Ensure consistent field names across services

**Proof Commands:**

```bash
# Verify all workers log "started"
grep -E "started|Worker started" /tmp/goalgpt-server.log | grep -iE "DataUpdate|MatchMinute|MatchWatchdog|DailyDiary" | head -10

# Verify structured format
tail -200 /tmp/goalgpt-server.log | grep -E "\[info\].*match_id" | head -5

# Verify critical actions logged
grep -E "reconcile|minute update|watchdog.*stale" /tmp/goalgpt-server.log | head -10
```

**Acceptance Criteria:**
- [ ] All workers log INFO "started" message on startup
- [ ] Structured log format defined and documented
- [ ] Critical actions (reconcile, minute update, watchdog) include structured fields
- [ ] Log format helper created (if needed)
- [ ] Output file: `PHASE4_OBSERVABILITY_CONTRACT.md` created

---

## Phase 4-2: Provider Resilience ✅ COMPLETE

**Objective:** Implement timeouts, retries, and graceful degradation for TheSports API calls. Add MQTT connectivity proof logging.

**Status:** ✅ **COMPLETE** - See `PHASE4_2_PROVIDER_RESILIENCE_REPORT.md` for proof artifacts.

**Files Modified:**
- `src/utils/providerResilience.ts` (NEW) - HTTP retry logic
- `src/utils/circuitBreaker.ts` (NEW) - Circuit breaker pattern
- `src/services/thesports/client/thesports-client.ts` - Timeout + retry + circuit breaker integration
- `src/services/thesports/dataUpdate/dataUpdate.service.ts` - Circuit breaker protection
- `src/services/thesports/match/matchDetailLive.service.ts` - Circuit breaker protection
- `src/services/thesports/websocket/websocket.client.ts` - MQTT message rate logging

**Implementation Summary:**

1. **API Client Timeouts** ✅
   - Timeout: 5s (default)
   - Retry logic: max 2 retries, exponential backoff (500ms → 1000ms)
   - Retry only on: network errors, timeouts, 5xx (NOT 4xx)
   - Logs: `provider.http.retry` (WARN), `provider.http.fail` (ERROR)

2. **Circuit Breaker** ✅
   - Window: 60 seconds
   - Failure threshold: 5 consecutive failures
   - Open duration: 120 seconds
   - Half-open: 1 test request
   - Logs: `provider.circuit.opened` (WARN), `provider.circuit.half_open` (INFO), `provider.circuit.closed` (INFO)

3. **MQTT Message Rate Visibility** ✅
   - Logs `websocket.msg.rate` every 100 messages OR 30 seconds
   - Aggregated logging only (no per-message INFO logs)
   - Fields: `messages_since_last`, `window_sec`, `topics`, `connection_id`

**Proof Artifacts:**
- ✅ `PHASE4_2_PROVIDER_RESILIENCE_REPORT.md` created
- ✅ All proofs include real command outputs
- ✅ Invariants verified (minute engine, updated_at, optimistic locking untouched)

**Acceptance Criteria:**
- [x] API client has configurable timeout (5s)
- [x] Retry logic implemented (max 2 retries, exponential backoff)
- [x] Circuit breaker tracks consecutive failures (5 failures threshold)
- [x] MQTT message rate visible without spam (every 100 messages OR 30s)
- [x] No new INFO logs per message (aggregated only)
- [x] No changes to Phase 3 / 4-1 invariants
- [x] Proof report created and consistent

---

## Phase 4-3: SLA + Freeze Detection

**Objective:** Implement stale detection rules using `last_event_ts` and status-based live set. Create action ladder: log → forced reconcile → mark stale reason.

**Files to Modify:**
- `src/services/thesports/match/matchWatchdog.service.ts` (stale detection rules)
- `src/jobs/matchWatchdog.job.ts` (action ladder)
- `src/services/thesports/match/matchMinute.service.ts` (document locking with watchdog)

**Implementation Steps:**

1. **Stale Detection Rules**
   - Use `last_event_ts` + status_id live set (2,3,4,5,7) for staleness
   - Status-specific thresholds: 120s for live, 900s for HALF_TIME
   - Do NOT add schema in Phase 4 by default.
   - Stale reason is emitted via structured logs (and optional in-memory counters), not persisted.

2. **Action Ladder**
   - Level 1: Log WARN with stale reason
   - Level 2: Trigger forced reconcile (if not already triggered)
   - Level 3: Emit structured ERROR log with stale reason + last_event_ts + provider_update_time (no DB writes beyond existing reconcile paths)

3. **Watchdog + Minute Engine Coordination**
   - Document that watchdog and minute engine don't conflict:
     - Watchdog triggers reconcile (may update `updated_at`)
     - Minute Engine updates `minute` (does NOT update `updated_at`)
     - No shared locks needed (different columns)

4. **Freeze Detection**
   - Detect matches stuck in HALF_TIME > 30 minutes
   - Log ERROR with match_id and duration
   - Trigger reconcile for freeze cases

**Proof Commands:**

```bash
# Verify watchdog logs (stale/freeze) exist
grep -E "stale.*match_id|watchdog.*stale|freeze" /tmp/goalgpt-server.log | tail -n 20

# Verify minute engine still does NOT update updated_at (static proof)
grep -n "UPDATE ts_matches" -n src/services/thesports/match/matchMinute.service.ts | head -n 20
grep -n "updated_at" src/services/thesports/match/matchMinute.service.ts || echo "OK: matchMinute.service.ts does not touch updated_at"
```

**Acceptance Criteria:**
- [ ] Stale detection uses `last_event_ts` + status-based thresholds
- [ ] Action ladder implemented (log → reconcile → mark)
- [ ] Watchdog + Minute Engine coordination documented
- [ ] Freeze detection logs ERROR for matches stuck > 30min in HALF_TIME
- [ ] Output file: `PHASE4_SLA_WATCHDOG_PROOF.md` created

---

## Phase 4-4: UI Failsafe (No Logic, Only Rendering)

**Objective:** Ensure UI gracefully handles stale data and never computes minutes client-side. Verify `minute_text` presence contract.

**Files to Review/Modify:**
- `frontend/src/components/MatchCard.tsx` (rendering logic)
- `frontend/src/utils/matchStatus.ts` (no calculation functions)
- `frontend/src/api/matches.ts` (API response types)

**Implementation Steps:**

1. **Stale Data Indicator**
   - If `stale_reason` exists in match object, show "Data delayed" label
   - Never compute minute from `match_time` or `live_kickoff_time`
   - Always render `minute_text` if present, otherwise show nothing

2. **Minute Text Presence Contract**
   - Verify TypeScript interfaces require `minute_text?: string | null`
   - Add runtime check: if `minute_text` is undefined, log WARN and show fallback
   - Fallback: show status label only (HT, FT, etc.) if available

3. **No Client-Side Calculation Proof**
   - Grep for `Date.now()`, `new Date()`, `getTime()` in frontend match components
   - Verify no `setInterval` for minute calculation
   - Verify `calculateMatchMinute` function is removed

4. **Graceful Degradation**
   - If API returns error, show "Unable to load match data"
   - If `minute_text` is null, show nothing (no placeholder)
   - If status is unknown, show status_id as fallback

**Proof Commands:**

```bash
# Verify no client-side calculation
grep -r "Date.now()\|new Date()\|getTime()" frontend/src/components/MatchCard.tsx
grep -r "calculateMatchMinute\|setInterval.*minute" frontend/src/

# Verify minute_text contract
grep -r "minute_text" frontend/src/api/matches.ts
grep -r "minute_text" frontend/src/components/MatchCard.tsx

# Verify stale indicator (if implemented)
grep -r "stale\|delayed" frontend/src/components/MatchCard.tsx
```

**Acceptance Criteria:**
- [ ] No client-side minute calculation (grep proof)
- [ ] `minute_text` presence contract verified (TypeScript + runtime)
- [ ] Stale data indicator shows "Data delayed" (if stale_reason exists)
- [ ] Graceful degradation for API errors
- [ ] Output file: `PHASE4_UI_FAILSAFE_PROOF.md` created

---

## Phase 4-5: Restart + Idempotency + Load Safety

**Objective:** Verify restart safety (workers come back, no duplicate writes), prove idempotent upserts, and test concurrent tick safety.

**Files to Test:**
- `src/jobs/dailyMatchSync.job.ts` (idempotent upserts)
- `src/jobs/dataUpdate.job.ts` (concurrent tick safety)
- `src/jobs/matchMinute.job.ts` (concurrent tick safety)
- `src/server.ts` (restart logic)

**Implementation Steps:**

1. **Restart Safety Test**
   - Stop server, verify all workers stop gracefully
   - Start server, verify all workers start and log "started"
   - Verify no duplicate writes during restart window

2. **Idempotent Upsert Proof**
   - Run `npm run sync:diary` twice
   - Verify DB record count doesn't increase (upsert, not insert)
   - Verify `updated_at` changes only if data actually changed

3. **Concurrent Tick Safety**
   - Verify `isRunning` flag prevents concurrent ticks
   - Test rapid API calls to trigger multiple reconcile attempts
   - Verify optimistic locking prevents duplicate updates

4. **Lightweight Load Test**
   - Script: 100 concurrent requests to `/api/matches/diary`
   - Script: 100 concurrent requests to `/api/matches/live`
   - Verify no errors, response times acceptable (< 2s p95)

**Proof Commands:**

```bash
# Restart safety
npm run start &
sleep 5
pkill -f "tsx.*server"
sleep 2
npm run start &
sleep 5
grep "started" /tmp/goalgpt-server.log | tail -10

# Idempotent upsert proof (runs diary sync twice, then checks row count)
npm run sync:diary
npm run sync:diary

npx tsx -e "
import { pool } from './src/database/connection';
(async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS c FROM ts_matches');
    console.log('ts_matches_count=' + rows[0].c);
  } finally {
    client.release();
    await pool.end();
  }
})();
"

# Concurrent tick safety
for i in {1..10}; do
  curl -s "http://localhost:3000/api/matches/live" > /dev/null &
done
wait
grep -E "isRunning|concurrent" /tmp/goalgpt-server.log | head -5

# Lightweight load test
for i in {1..100}; do
  time curl -s "http://localhost:3000/api/matches/diary?date=2025-12-22" > /dev/null &
done
wait
# Check for errors in logs
grep -E "error|Error" /tmp/goalgpt-server.log | tail -10
```

**Acceptance Criteria:**
- [ ] Restart safety verified (workers start/stop gracefully)
- [ ] Idempotent upserts proven (diary sync doesn't duplicate records)
- [ ] Concurrent tick safety verified (isRunning flag works)
- [ ] Lightweight load test passed (100 concurrent requests, < 2s p95)
- [ ] Output file: `PHASE4_RESTART_LOAD_PROOF.md` created

---

## Phase 4-6: Production Readiness Checklist

**Objective:** Create one-page "go/no-go" checklist with required proof artifacts.

**Files to Create:**
- `PHASE4_PRODUCTION_READINESS.md`

**Implementation Steps:**

1. **Checklist Categories**
   - Observability (logs, metrics, health checks)
   - Resilience (timeouts, retries, circuit breakers)
   - SLA (stale detection, freeze detection)
   - UI (failsafe, no client-side logic)
   - Safety (restart, idempotency, concurrency)
   - Invariants (Phase 3C frozen logic intact)

2. **Required Proof Artifacts**
   - List all proof files under `/proof/phase4_*/`
   - Include: preflight audit, observability contract, provider resilience, SLA watchdog, UI failsafe, restart/load proof

3. **Go/No-Go Criteria**
   - All sub-phases complete (4-0 through 4-5)
   - All proof artifacts present
   - Zero Phase 3C invariants violated
   - All acceptance criteria met

**Proof Commands:**

```bash
# Verify all proof artifacts exist
ls -la proof/phase4_*/
ls -la PHASE4_*.md

# Verify no invariant violations
grep -r "updated_at.*minute\|minute.*updated_at" src/services/thesports/match/matchMinute.service.ts
grep -r "calculateMatchMinute\|Date.now()" frontend/src/components/MatchCard.tsx
```

**Acceptance Criteria:**
- [ ] Production readiness checklist created
- [ ] All proof artifacts listed with paths
- [ ] Go/no-go criteria defined
- [ ] Output file: `PHASE4_PRODUCTION_READINESS.md` created

---

## Execution Order

**Recommended sequence:**

1. **Phase 4-0: Preflight Audit** (Risk: Low)
   - Read-only, establishes baseline
   - Stop condition: If critical gaps found, document and proceed

2. **Phase 4-1: Observability Contract** (Risk: Low)
   - Adds logging only, no behavior changes
   - Stop condition: If log format breaks existing tools, adjust

3. **Phase 4-2: Provider Resilience** ✅ COMPLETE (Risk: Medium) - See `PHASE4_2_PROVIDER_RESILIENCE_REPORT.md`
   - Adds timeouts/retries, may affect API call behavior
   - Stop condition: If timeouts too aggressive, adjust thresholds

4. **Phase 4-3: SLA + Freeze Detection** (Risk: Medium)
   - Enhances watchdog, may increase reconcile frequency
   - Stop condition: If watchdog triggers too often, adjust thresholds

5. **Phase 4-4: UI Failsafe** (Risk: Low)
   - Frontend changes only, no backend impact
   - Stop condition: If UI breaks, revert frontend changes

6. **Phase 4-5: Restart + Idempotency** (Risk: High)
   - Tests system behavior under stress
   - Stop condition: If idempotency broken, fix before proceeding

7. **Phase 4-6: Production Readiness** (Risk: Low)
   - Documentation only, final checklist
   - Stop condition: If criteria not met, address gaps

**Estimated Timeline:**
- Phase 4-0: 1 day
- Phase 4-1: 1 day
- Phase 4-2: 2 days
- Phase 4-3: 2 days
- Phase 4-4: 1 day
- Phase 4-5: 2 days
- Phase 4-6: 1 day
- **Total: ~10 days**

---

## Stop Conditions

**Halt and investigate if:**
- Any Phase 3C invariant is violated
- Workers fail to start after changes
- API endpoints return errors after changes
- DB write counts increase unexpectedly (duplicate writes)
- UI breaks or shows incorrect data
- Log format breaks existing monitoring tools
- Timeout/retry logic causes excessive API calls

---

**Next Step:** Proceed with Phase 4-0 Preflight Audit

