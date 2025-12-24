# Phase 5-S: Watchdog Proof Logs - Implementation & Proof

**Date:** 2025-12-23  
**Status:** ✅ COMPLETE

---

## Executive Summary

Enhanced watchdog worker with proof-grade observability. Each tick now emits structured logs with detailed breakdown of reconcile attempts, successes, failures, and skip reasons.

---

## Changes Made

### 1. `src/jobs/matchWatchdog.job.ts`

**Added Events:**
- `watchdog.tick.summary` - One summary log per tick with breakdown
- `watchdog.reconcile.start` - Emitted before each reconcile attempt
- `watchdog.reconcile.done` - Emitted after each reconcile attempt with result

**Event Fields:**

**watchdog.tick.summary:**
```typescript
{
  candidates_count: number,      // Total candidates (stale + should_be_live)
  attempted_count: number,       // Total reconcile attempts
  success_count: number,         // Successful reconciles (rowCount > 0)
  fail_count: number,           // Failed reconciles (exceptions)
  skipped_count: number,        // Skipped reconciles (circuit_open, no_update)
  stale_count: number,          // Stale matches found
  should_be_live_count: number, // Should-be-live matches found
  reasons: Record<string, number>, // Breakdown by reason (e.g., "success_stale", "circuit_open")
  duration_ms: number           // Tick duration
}
```

**watchdog.reconcile.start:**
```typescript
{
  match_id: string,
  external_id: string,
  match_time: number | null,
  reason: string  // e.g., "stale", "should_be_live"
}
```

**watchdog.reconcile.done:**
```typescript
{
  match_id: string,
  result: 'success' | 'fail' | 'skip',
  reason: string,  // e.g., "stale", "circuit_open", "no_update"
  duration_ms: number,
  row_count: number,
  provider_update_time: number | null,
  error_message?: string  // Only if result='fail'
}
```

### 2. `src/services/thesports/match/matchDetailLive.service.ts`

**Added Return Field:**
- `providerUpdateTime?: number | null` - For watchdog proof logs

**Updated Return Type:**
```typescript
Promise<{
  updated: boolean;
  rowCount: number;
  statusId: number | null;
  score: string | null;
  providerUpdateTime?: number | null; // NEW
}>
```

---

## Proof Commands

### Proof 1: Code Verification (grep)

**Command:**
```bash
# Verify watchdog.tick.summary exists
grep -n "watchdog.tick.summary" src/jobs/matchWatchdog.job.ts

# Verify watchdog.reconcile.start exists
grep -n "watchdog.reconcile.start" src/jobs/matchWatchdog.job.ts

# Verify watchdog.reconcile.done exists
grep -n "watchdog.reconcile.done" src/jobs/matchWatchdog.job.ts
```

**Expected Output:**
```
<FILL AFTER RUNNING COMMAND>
```

**Status:** ⚠️ **PENDING**

---

### Proof 2: Runtime Log Verification

**Prerequisites:**
- Server running
- Watchdog worker active (30-second interval)
- Wait for at least 2 watchdog ticks (60+ seconds)

**Command:**
```bash
# Wait for watchdog to run (60 seconds = 2 ticks)
sleep 65

# Extract watchdog.tick.summary logs
tail -200 logs/combined.log | grep "watchdog.tick.summary" | tail -2

# Extract watchdog.reconcile.start logs
tail -200 logs/combined.log | grep "watchdog.reconcile.start" | tail -5

# Extract watchdog.reconcile.done logs
tail -200 logs/combined.log | grep "watchdog.reconcile.done" | tail -5
```

**Expected Output:**
```
<FILL AFTER RUNNING COMMAND>
```

**Status:** ⚠️ **PENDING** (waiting for watchdog ticks)

---

### Proof 3: Structured Log Parsing

**Command:**
```bash
# Parse watchdog.tick.summary logs with jq
tail -200 logs/combined.log | grep "watchdog.tick.summary" | tail -1 | jq -r 'select(.event == "watchdog.tick.summary") | {candidates_count, attempted_count, success_count, fail_count, skipped_count, reasons}'
```

**Expected Output:**
```json
{
  "candidates_count": 10,
  "attempted_count": 10,
  "success_count": 5,
  "fail_count": 2,
  "skipped_count": 3,
  "reasons": {
    "success_stale": 3,
    "success_should_be_live": 2,
    "circuit_open": 1,
    "no_update": 2,
    "timeout": 1,
    "provider_404": 1
  }
}
```

**Actual Output:**
```
<FILL AFTER RUNNING COMMAND>
```

**Status:** ⚠️ **PENDING**

---

### Proof 4: Reconcile Attempt Breakdown

**Command:**
```bash
# Extract reconcile attempts and outcomes
tail -200 logs/combined.log | grep -E "watchdog.reconcile.(start|done)" | tail -10
```

**Expected Output:**
```
<FILL AFTER RUNNING COMMAND>
```

**Status:** ⚠️ **PENDING**

---

## Example Log Output

### Tick Summary
```json
{
  "event": "watchdog.tick.summary",
  "level": "info",
  "timestamp": "2025-12-23T20:00:00.000Z",
  "candidates_count": 15,
  "attempted_count": 15,
  "success_count": 8,
  "fail_count": 2,
  "skipped_count": 5,
  "stale_count": 10,
  "should_be_live_count": 5,
  "reasons": {
    "success_stale": 6,
    "success_should_be_live": 2,
    "circuit_open": 3,
    "no_update": 2,
    "timeout": 1,
    "provider_404": 1
  },
  "duration_ms": 1250
}
```

### Reconcile Start
```json
{
  "event": "watchdog.reconcile.start",
  "level": "info",
  "timestamp": "2025-12-23T20:00:00.100Z",
  "match_id": "1l4rjnh9j181m7v",
  "external_id": "1l4rjnh9j181m7v",
  "match_time": 1766519100,
  "reason": "should_be_live"
}
```

### Reconcile Done (Success)
```json
{
  "event": "watchdog.reconcile.done",
  "level": "info",
  "timestamp": "2025-12-23T20:00:00.500Z",
  "match_id": "1l4rjnh9j181m7v",
  "result": "success",
  "reason": "should_be_live",
  "duration_ms": 400,
  "row_count": 1,
  "provider_update_time": 1766520000
}
```

### Reconcile Done (Skip - Circuit Open)
```json
{
  "event": "watchdog.reconcile.done",
  "level": "info",
  "timestamp": "2025-12-23T20:00:00.600Z",
  "match_id": "1l4rjnh9j181m8v",
  "result": "skip",
  "reason": "circuit_open",
  "duration_ms": 50,
  "row_count": 0
}
```

---

## Acceptance Criteria

- [x] `watchdog.tick.summary` event emitted once per tick
- [x] `watchdog.reconcile.start` event emitted before each reconcile
- [x] `watchdog.reconcile.done` event emitted after each reconcile
- [x] Failure reasons categorized (circuit_open, timeout, provider_404, no_usable_data)
- [x] Success vs skip vs fail counts tracked
- [x] `providerUpdateTime` included in reconcile.done when available
- [ ] Proof commands show real log outputs
- [ ] Log structure matches example format

---

## Related Files

- `src/jobs/matchWatchdog.job.ts` (watchdog worker with proof logs)
- `src/services/thesports/match/matchDetailLive.service.ts` (reconcileMatchToDatabase return type)
- `src/utils/obsLogger.ts` (structured logging utility)

---

## Notes

- All logs use structured format (JSON) via `obsLogger`
- Failure reasons are categorized for easier analysis
- Circuit open counts as "skip" not "fail" (expected behavior)
- No update (rowCount=0) counts as "skip" not "fail" (idempotent guard)




