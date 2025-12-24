# Phase 5-2: CI Pipeline Local Proof

**Date:** 2025-12-23  
**Phase:** 5-2 (CI / Release Pipeline Minimum)  
**Status:** ✅ **COMPLETE** — All local tests PASS

---

## Preconditions / Scope

This document proves **local** CI-equivalent checks on a developer machine.

**Assumptions**
- Repo is at the intended release commit (RC) and working tree is clean (`git status` shows no changes).
- `.env` is present for local scripts that require DB connectivity (tests create and delete temporary test rows).
- Database connection points to a **non-production** environment.

**Notes**
- Output blocks below are copied verbatim from the terminal. Do not edit them; update proofs by re-running commands.
- If CI runs in a different Node/npm version, pinning parity is handled in Phase 5-1 docs.

---

## npm ci (Clean Install)

**Why this matters:** `npm ci` enforces a clean, lockfile-faithful install—matching how CI installs dependencies.

**Command:**
```bash
npm ci
```

**Output:**
```
added 213 packages, and audited 214 packages in 2s

24 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**Analysis:** ✅ Clean install successful, 0 vulnerabilities.

---

## Deterministic Tests

These tests are designed to be deterministic (they create their own fixtures and clean up after themselves).

### test:phase3a (Optimistic Locking)

**Command:**
```bash
npm run test:phase3a
```

**Output (excerpt):**
```
> goalgpt-database@1.0.0 test:phase3a
> tsx src/scripts/test-phase3a-live-optimistic-locking.ts

[dotenv@17.2.3] injecting env (20) from .env
2025-12-23 11:10:36 [info]: 🧪 Testing Phase 3A Optimistic Locking with Live Match...
2025-12-23 11:10:36 [info]: NO LIVE MATCH FOUND, running deterministic optimistic locking proof...

🧪 DETERMINISTIC TEST: No live matches found, running DB-based optimistic locking proof...
2025-12-23 11:10:36 [info]: Created test match: phase3a_test_match_1
✅ DETERMINISTIC TEST: first update applied rowCount=1
2025-12-23 11:10:36 [info]: After first update: provider_update_time=1766477436, last_event_ts=1766477436
✅ DETERMINISTIC TEST: second update skipped rowCount=0 (provider time: 1766477435 <= 1766477436)
2025-12-23 11:10:36 [info]: Cleaned up test match: phase3a_test_match_1

✅ DETERMINISTIC TEST PASSED: Optimistic locking verified
2025-12-23 11:10:36 [info]: ✅ Deterministic optimistic locking test PASSED
```

**Exit Code:** 0  
**Analysis:** ✅ PASS — Optimistic locking verified.

---

### test:phase3b-minute (Minute Engine)

**Command:**
```bash
npm run test:phase3b-minute
```

**Output (excerpt):**
```
> goalgpt-database@1.0.0 test:phase3b-minute
> tsx src/scripts/test-phase3b-minute.ts

🧪 TEST 1: Minute Updates Only When Changed
======================================================================
Created test match: phase3b_test_match_minute_1 (status=2, first_half_kickoff_ts=1766477407, minute=NULL)
Calculated minute: 1 (expected: 1)
2025-12-23 11:10:37 [info]: minute.update {...}
First update: updated=true, rowCount=1
After first update: minute=1, last_minute_update_ts=1766477437
Second update (same minute): updated=false, rowCount=0
✅ DETERMINISTIC TEST: first update applied rowCount=1
✅ DETERMINISTIC TEST: second update skipped rowCount=0
✅ DETERMINISTIC TEST: updated_at NOT changed by Minute Engine

🧪 TEST 2: Freeze Status Never Sets Minute to NULL
======================================================================
Created test match: phase3b_test_match_minute_2 (status=3, minute=45)
Calculated minute for status 3: 45 (expected: 45)
Update result: updated=false, rowCount=0
Final minute: 45 (expected: 45, not NULL)
✅ DETERMINISTIC TEST: freeze status (HALF_TIME) minute remains 45, never NULL

🧪 TEST 3: Status-Specific Calculations
======================================================================
Status 2: calculated=21, expected=21
Status 3: calculated=45, expected=45
Status 4: calculated=51, expected=51
Status 5: calculated=92, expected=92
Status 7: calculated=75, expected=75 (retain existing)
✅ DETERMINISTIC TEST: all status-specific calculations correct

======================================================================
✅ DETERMINISTIC TEST PASSED: Minute engine verified
======================================================================
```

**Exit Code:** 0  
**Analysis:** ✅ PASS — Minute engine verified (updated_at not changed, status-specific calculations correct).

---

### test:phase3b-watchdog (Watchdog Selection)

**Command:**
```bash
npm run test:phase3b-watchdog
```

**Output (excerpt):**
```
> goalgpt-database@1.0.0 test:phase3b-watchdog
> tsx src/scripts/test-phase3b-watchdog.ts

🧪 TEST: Watchdog Selection Logic
======================================================================
✅ Created stale match: phase3b_test_watchdog_stale_1 (status=2, last_event_ts=1766476438, stale)
✅ Created fresh match: phase3b_test_watchdog_fresh_1 (status=2, last_event_ts=1766477408, fresh)
✅ Created not-live match: phase3b_test_watchdog_notlive_1 (status=1, should NOT be selected)

🔍 Running findStaleLiveMatches(nowTs=1766477438, staleSeconds=120, halfTimeStaleSeconds=900, limit=50)...

📊 Results: Found 1 total stale match(es) (1 test matches)
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

**Exit Code:** 0  
**Analysis:** ✅ PASS — Watchdog selection logic verified.

---

## Smoke Test Script

**Command:**
```bash
./.github/scripts/smoke-test.sh
```

**Output:**
```
🚀 Starting server on port 3999...
⏳ Waiting for server to start (PID: 53862)...
✅ Server is ready
🔍 Testing /ready endpoint...
✅ /ready endpoint OK
🔍 Testing /api/matches/live contract (minute_text)...
✅ PASS: 8 matches, all have minute_text
✅ All smoke tests passed
🛑 Stopping server (PID: 53862)...
```

**Exit Code:** 0  
**Analysis:** ✅ PASS — Smoke test successful:
- Server started on port 3999
- `/ready` endpoint returned `ok: true`
- `/api/matches/live` contract verified (8 matches, all have `minute_text`)
- Server stopped gracefully

**Script Location:** `.github/scripts/smoke-test.sh`

**Script Behavior:**
1. Starts server on port 3999 (background)
2. Waits for `/ready` endpoint (max 60s)
3. Verifies `/ready` returns `ok: true`
4. Verifies `/api/matches/live` contract (all matches have `minute_text`)
5. Stops server gracefully

**Portability / Port Conflicts**
- The smoke test uses port **3999** to avoid colliding with local dev (often 3000).
- If port 3999 is occupied, stop the conflicting process or adjust the script to choose an available port.

**CI Integration:** Script is executable and will run in GitHub Actions workflow.

---

## Summary

| Test                      | Status | Exit Code | Notes                              |
|---------------------------|--------|-----------|----------------------------------|
| `npm ci`                  | ✅ PASS | 0         | lockfile-faithful install         |
| `npm run test:phase3a`     | ✅ PASS | 0         | deterministic optimistic locking proof |
| `npm run test:phase3b-minute` | ✅ PASS | 0         | minute engine invariant proof     |
| `npm run test:phase3b-watchdog` | ✅ PASS | 0         | watchdog selection proof          |
| `smoke-test.sh`           | ✅ PASS | 0         | .github/scripts/smoke-test.sh (port 3999) |

**Overall Status:** ✅ **COMPLETE** — All tests PASS locally, including smoke test.

---

**End of CI Local Proof**

## Re-run Checklist (copy/paste)

```bash
npm ci
npm run test:phase3a
npm run test:phase3b-minute
npm run test:phase3b-watchdog
./.github/scripts/smoke-test.sh
```
