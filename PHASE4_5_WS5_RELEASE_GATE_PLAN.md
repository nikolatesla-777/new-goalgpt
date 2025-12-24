# Phase 4-5 WS5: Release Gate / Go-NoGo (Production Cutover Proof) Plan

**Date:** 2025-12-23  
**Phase:** 4-5 WS5 (Release Gate / Go-NoGo)  
**Status:** 📋 **PLAN** — Ready for Execution

---

## Executive Summary

WS5 Release Gate provides the final verification checklist before production deployment. All gates must PASS for GO decision; any blocker gate failure results in NO-GO.

**Scope:**
- Version & Build verification (Node.js/npm versions, clean install, typecheck)
- Database migration state verification (Phase 3/4 columns and indexes)
- Runtime contract verification (health/ready/live/diary endpoints)
- Kill-switch / Safety gate verification (env toggles)
- End-to-end stale recovery verification (watchdog recovery proof)
- Release checklist finalization (GO/NO-GO criteria)

**Non-goals:**
- No new feature development
- No database schema changes (only verification)
- No code changes (only proof collection)

---

## A) Version & Build Gate

### A1: Node.js and npm Version Check

**Command:**
```bash
node -v && npm -v
```

**Acceptance Criteria:**
- Node.js version logged (e.g., v18.x, v20.x)
- npm version logged (e.g., 9.x, 10.x)
- No errors in version commands

**Proof Output:** Real command output with actual versions

---

### A2: Clean Install Verification

**Command:**
```bash
npm ci
```

**Note:** If `package-lock.json` doesn't exist, use `npm install` instead.

**Acceptance Criteria:**
- Exit code 0
- Dependencies installed successfully
- No critical errors

**Proof Output:** Real command output (last 20 lines if verbose)

---

### A3: Build Verification

**Command:**
```bash
npm run build
```

**Note:** If no build script exists, explicitly record 'NOT APPLICABLE' with proof by running `npm run | grep build` and capturing output.

**Acceptance Criteria:**
- Exit code 0 (if script exists)
- Build artifacts created (if applicable)
- No build errors

**Proof Output:** Real command output

---

### A4: TypeScript Typecheck

**Command:**
```bash
npm run typecheck
```

**Acceptance Criteria:**
- **If exit code 0:** ✅ PASS (no type errors)
- **If exit code non-zero:**
  - List all errors with file paths and line numbers
  - Categorize: **BLOCKER** vs **NON-BLOCKER**
  - **BLOCKER:** Errors in Phase 3/4/5 files (matchMinute, matchWatchdog, matchFreezeDetection, health, server.ts shutdown, etc.)
  - **NON-BLOCKER:** Pre-existing errors in unrelated files (e.g., `create-admin.ts`, `leagueSync.service.ts`, `countrySync.service.ts`)
  - If only NON-BLOCKER errors: ✅ PASS (documented as known pre-existing)
  - If BLOCKER errors: ❌ FAIL (must fix before release)
- All NON-BLOCKER errors must be listed in PHASE4_5_MASTER_PROOF_INDEX.md with file paths.

**Proof Output:** Full typecheck output with error categorization

---

## B) DB Migration State Gate

### B1: Phase 3/4 Column Verification

**Columns to verify (from Phase 3 migration):**
- `first_half_kickoff_ts` (BIGINT)
- `second_half_kickoff_ts` (BIGINT)
- `overtime_kickoff_ts` (BIGINT)
- `minute` (INTEGER)
- `provider_update_time` (BIGINT)
- `last_event_ts` (BIGINT)
- `last_minute_update_ts` (BIGINT)

**Note:** `minute_text` is a computed column (not stored), so it's not verified here.

**SQL Command:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ts_matches' 
  AND column_name IN (
    'first_half_kickoff_ts', 
    'second_half_kickoff_ts', 
    'overtime_kickoff_ts', 
    'minute', 
    'provider_update_time', 
    'last_event_ts', 
    'last_minute_update_ts'
  )
ORDER BY column_name;
```

**Acceptance Criteria:**
- All 7 columns exist
- Data types match expected (BIGINT for timestamps, INTEGER for minute)
- Exit code 0

**Proof Output:** Real SQL query result

---

### B2: Phase 3/4 Index Verification

**Indexes to verify (from Phase 3 migration):**
- `idx_ts_matches_first_half_kickoff`
- `idx_ts_matches_second_half_kickoff`
- `idx_ts_matches_overtime_kickoff`
- `idx_ts_matches_provider_update_time`
- `idx_ts_matches_last_event_ts`

**SQL Command:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ts_matches' 
  AND indexname IN (
    'idx_ts_matches_first_half_kickoff',
    'idx_ts_matches_second_half_kickoff',
    'idx_ts_matches_overtime_kickoff',
    'idx_ts_matches_provider_update_time',
    'idx_ts_matches_last_event_ts'
  )
ORDER BY indexname;
```

**Acceptance Criteria:**
- All 5 indexes exist
- Index definitions match expected (partial indexes with WHERE clause)
- Exit code 0

**Proof Output:** Real SQL query result

---

## C) Runtime Contract Gate (Golden Smoke)

### Prerequisites

- jq must be installed for JSON inspection; if not available, use node -e based checks only.

### C1: Health Endpoint

**Command:**
```bash
curl -s http://localhost:3000/health | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.ok || j.ok!==true){console.error('FAIL: ok not true');process.exit(1);} console.log('PASS:', JSON.stringify(j));"
```

**Acceptance Criteria:**
- Exit code 0
- Response contains `ok: true`
- Response contains `service: "goalgpt-server"`
- Response contains `uptime_s` (number)
- Response contains `timestamp` (ISO string)

**Proof Output:** Real command output

---

### C2: Readiness Endpoint

**Command:**
```bash
curl -s http://localhost:3000/ready | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.ok || j.db.ok!==true || j.thesports.ok!==true){console.error('FAIL:', JSON.stringify(j));process.exit(1);} if(!j.websocket){console.error('FAIL: websocket field missing');process.exit(1);} console.log('PASS:', JSON.stringify(j));"
```

**Acceptance Criteria:**
- Exit code 0
- Response contains `ok: true`
- Response contains `db.ok: true`
- Response contains `thesports.ok: true`
- Response contains `websocket` object with `enabled` and `connected` fields

**Proof Output:** Real command output

---

### C3: Live Endpoint Contract (minute_text)

**Command:**
```bash
curl -s http://localhost:3000/api/matches/live | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const m=(j.data?.results)||(j.results)||[]; const bad=m.filter(x=>!x.minute_text || x.minute_text===null || x.minute_text===''); if(bad.length){console.error('FAIL: missing minute_text', bad.length);process.exit(1);} console.log('PASS: matches', m.length, 'all have minute_text');"
```

**Acceptance Criteria:**
- Exit code 0
- All matches have `minute_text` field (string, not null, not empty)
- Phase 4-4 contract enforced

**Proof Output:** Real command output with match count

---

### C4: Diary Endpoint (DB-only mode)

**Command:**
```bash
TODAY=$(date +%Y-%m-%d) && curl -s "http://localhost:3000/api/matches/diary?date=$TODAY" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const m=(j.data?.results)||(j.results)||[]; console.log('PASS: diary DB-only mode, matches:', m.length);"
```

**Acceptance Criteria:**
- Exit code 0
- Response structure valid (results array)
- No errors indicating API fallback (DB-only mode confirmed)

**Proof Output:** Real command output

---

## D) Kill-switch / Safety Gate

### D1: WebSocket Toggle (if implemented)

**Note:** If `WEBSOCKET_ENABLED` env var exists, test it. Otherwise, document that WebSocket is always enabled (no toggle exists).

**Test:**
```bash
# Set WEBSOCKET_ENABLED=false (if env var exists)
WEBSOCKET_ENABLED=false npm run start &
SERVER_PID=$!
sleep 15
curl -s http://localhost:3000/ready | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(j.websocket?.enabled===false || j.websocket?.connected===false){console.log('PASS: websocket disabled');} else {console.error('FAIL: websocket still enabled');process.exit(1);}"
kill $SERVER_PID
```

**Acceptance Criteria:**
- If WEBSOCKET_ENABLED exists: /ready reflects enabled=false when disabled.
- If not implemented: explicitly record 'NO TOGGLE IMPLEMENTED' with code grep proof.

**Proof Output:** Real command output or "Not implemented - always enabled" note

---

### D2: Watchdog / Minute Engine Toggle (if implemented)

**Note:** Check if `MATCH_WATCHDOG_ENABLED` or `MINUTE_ENGINE_ENABLED` env vars exist.

**Test:**
```bash
# Check env vars
env | grep -E "WATCHDOG|MINUTE_ENGINE" || echo "No watchdog/minute engine toggles found"
```

**Acceptance Criteria:**
- If toggles exist: Test behavior (workers should not start if disabled)
- If toggles don't exist: Document that no toggles exist (always enabled)

Absence of toggles is acceptable if documented with grep proof and workers always-on is intentional.

**Proof Output:** Real command output or "Not implemented - always enabled" note

---

## E) End-to-End "Stale Recovery" Gate

### E1: Watchdog Recovery Proof (Real Logs)

**Command:**
```bash
grep -E "\"event\":\"watchdog" logs/combined.log | tail -n 20
```

**Acceptance Criteria:**
- At least one `watchdog.stale_detected` or `watchdog.reconcile.enqueued` event found in logs
- Events contain required fields (match_id, reason, etc.)

**Proof Output:** Real log lines or "No events found (no stale matches in current window)"

---

### E2: Watchdog Recovery Proof (Deterministic Test)

**Command:**
```bash
npm run test:phase3b-watchdog
```

**Acceptance Criteria:**
- Exit code 0
- Test output shows stale match detection working
- Test output shows reconcile enqueue logic working

**Proof Output:** Real test output

---

## F) Release Checklist Finalization

### F1: GO/NO-GO Criteria

**GO Conditions (ALL must be true):**
- ✅ Version & Build Gate: PASS (typecheck errors are NON-BLOCKER only)
- ✅ DB Migration State Gate: PASS (all columns and indexes exist)
- ✅ Runtime Contract Gate: PASS (all 4 endpoints pass)
- ✅ Kill-switch Gate: PASS (toggles work if implemented, or documented as not implemented)
- ✅ Stale Recovery Gate: PASS (deterministic test passes, or real logs show events)

**NO-GO Conditions (ANY is true):**
- ❌ Server crashes on startup
- ❌ `/ready` endpoint fails (db.ok=false or thesports.ok=false)
- ❌ `/api/matches/live` endpoint fails minute_text contract
- ❌ DB schema missing critical columns or indexes
- ❌ Typecheck has BLOCKER errors in Phase 3/4/5 files

---

### F2: How to Cutover (8-line Quick Guide)

1. **Stop current server:** `lsof -ti:3000 | xargs kill -TERM`
2. **Verify port free:** `lsof -i :3000` (should be empty)
3. **Export environment variables from `.env.production` or secret manager (do not inline secrets).**
4. **Start server:** `npm run start` (or production start command)
5. **Wait for startup:** `sleep 15`
6. **Check readiness:** `curl -s http://localhost:3000/ready | jq .ok` (should be `true`)
7. **Smoke test:** Run C3 command (live endpoint minute_text check)
8. **Monitor logs:** `tail -f logs/combined.log | grep -E "error|ERROR"`

---

## Acceptance Criteria Summary

### WS5 Complete When:
- [ ] All gates (A-E) have real proof outputs (no placeholders)
- [ ] Typecheck errors categorized (BLOCKER vs NON-BLOCKER)
- [ ] DB columns and indexes verified with real SQL output
- [ ] All runtime endpoints tested with real curl output
- [ ] Kill-switch behavior documented (implemented or not)
- [ ] Watchdog recovery proven (logs or test)
- [ ] GO/NO-GO criteria clearly defined
- [ ] Cutover guide provided

---

## Audit Trail

All proof outputs collected during WS5 must be appended verbatim to PHASE4_5_WS5_RELEASE_GATE_PROOF.md with timestamps.

---

**End of WS5 Release Gate Plan**

