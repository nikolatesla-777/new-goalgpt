# Phase 5-S: Staging Acceptance Checklist

## Global Variables (Single Source of Truth)
```
STAGING_URL=http://<STAGING_HOST>:3000
API_BASE=$STAGING_URL/api
OBS_LOG_PATH=/var/log/goalgpt/server.log
```

**Date:** 2025-12-23  
**Phase:** 5-S (Staging Deploy + 24h Observation)  
**Status:** ⚠️ **PENDING** — Requires staging deployment and 24h observation

---

## Deployment Verification

- [ ] **RC1 deployed to staging**
  - Tag verified: `git show rc1 --no-patch`
  - Commit SHA: $(git rev-parse rc1)
  - Deployment time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

- [ ] **Health endpoint OK**
  - Command: 
  ```
  curl -s $STAGING_URL/health | jq .
  ```
  - Status: 200 OK
  - Response: `ok: true`
  - Proof: See `PHASE5_S_STAGING_DEPLOY_PROOF.md`

- [ ] **Readiness endpoint OK**
  - Command: 
  ```
  curl -s $STAGING_URL/ready | jq .
  ```
  - Status: 200 OK
  - Response: `ok: true`, `db.ok: true`, `thesports.ok: true`
  - Proof: See `PHASE5_S_STAGING_DEPLOY_PROOF.md`

---

## Contract Compliance

- [ ] **Live minute_text contract verified**
  - Command: 
  ```
  curl -s $API_BASE/matches/live | node -e "
  const r=JSON.parse(require('fs').readFileSync(0));
  const miss=r.results.filter(m=>!m.minute_text);
  console.log('missing minute_text:', miss.length);
  process.exit(miss.length===0?0:1);
  "
  ```
  - Result: `missing minute_text: 0`
  - Proof: See `PHASE5_S_STAGING_DEPLOY_PROOF.md`

- [ ] **minute_text present throughout 24h**
  - Verified at T+0h, T+6h, T+12h, T+24h
  - No matches missing `minute_text` at any snapshot
  - Proof: See `PHASE5_S_24H_OBSERVATION_LOG.md`

---

## Minute Progression Verification

- [ ] **Live minute progression verified**
  - Minutes increase monotonically (no backwards movement)
  - Status-specific behavior holds (HALF_TIME at 45, END frozen)
  - Proof: See `PHASE5_S_24H_OBSERVATION_LOG.md` snapshots

- [ ] **No minute freeze**
  - LIVE matches (status 2,4,5,7) show minute progression
  - HALF_TIME matches (status 3) correctly frozen at 45
  - END matches (status 8) frozen at last minute
  - Proof: See `PHASE5_S_24H_OBSERVATION_LOG.md`

---

## Status Transition Verification

- [ ] **No status regression**
  - Legal transitions only (1→2→3→4→8)
  - No illegal jumps (e.g., 1→8, 4→2)
  - Proof: See `PHASE5_S_24H_OBSERVATION_LOG.md` status transitions

---

## Watchdog Behavior Verification

- [ ] **Watchdog behaved correctly**
  - No false positives (watchdog does not trigger for healthy matches)
  - No watchdog loops (repeated reconcile attempts for same match)
  - Watchdog events are logged correctly (if any)
  - Proof: See `PHASE5_S_24H_OBSERVATION_LOG.md` watchdog events

---

## System Stability Verification

- [ ] **Logs readable & structured**
  - Structured logs present (JSON format)
  - No log corruption
  - All events logged correctly
  - Proof: See `PHASE5_S_24H_OBSERVATION_LOG.md`

- [ ] **No crashes during 24h window**
  - Server running continuously for 24 hours
  - No unexpected restarts
  - Process PID stable
  - Proof: See `PHASE5_S_24H_OBSERVATION_LOG.md` server status

- [ ] **Memory usage stable** (if monitoring available)
  - No continuous memory growth
  - No memory leaks detected
  - Proof: See `PHASE5_S_24H_OBSERVATION_LOG.md` memory usage

---

## Phase 3/4 Invariants Verification

- [ ] **updated_at NOT touched by minute engine**
  - Minute engine updates only `minute` and `last_minute_update_ts`
  - `updated_at` remains unchanged by minute engine
  - Proof: 
  ```
  SQL Proof:
  SELECT COUNT(*) FROM ts_matches
  WHERE updated_at != last_minute_update_ts
  AND last_minute_update_ts IS NOT NULL;
  -- expected: 0
  ```

- [ ] **Optimistic locking preserved**
  - `provider_update_time` and `last_event_ts` used correctly
  - No race conditions observed
  - Proof: Log analysis (if applicable)

---

## Execution Status

**Current Status:** ⚠️ **PENDING** — Requires staging deployment and 24-hour observation completion

**Note:** This checklist can only be completed after:
1. Staging deployment is successful (see `PHASE5_S_STAGING_DEPLOY_PROOF.md`)
2. 24-hour observation window is completed (see `PHASE5_S_24H_OBSERVATION_LOG.md`)
3. All verifications are performed with real data

**All `<FILL>` placeholders must be replaced with real values before final decision.**

---

## Final Decision

**All checklist items must be checked (✅) for GO decision.**

### ✅ STAGING ACCEPTED — READY FOR PRODUCTION

**Criteria:**
- All deployment verifications PASS
- All contract compliance checks PASS
- All minute progression verifications PASS
- All status transition verifications PASS
- All watchdog behavior verifications PASS
- All system stability verifications PASS
- 24-hour observation window completed with zero critical issues

**Next Step:** Proceed to Phase 5-3 (Production Blue-Green Cutover)

---

### ❌ STAGING FAILED — INVESTIGATION REQUIRED

**Criteria:**
- Any deployment verification FAIL
- Any contract compliance check FAIL
- Any minute progression verification FAIL
- Any status regression observed
- Any watchdog false positive or loop
- Any server crash or memory leak
- Any critical issue during 24h window

**Next Step:**
1. Document root cause in `PHASE5_S_24H_OBSERVATION_LOG.md` → Incident Log
2. Fix issues (may require code changes, which breaks Phase 5-S freeze)
3. Re-run Phase 5-S after fixes

---

## Acceptance Sign-off

**Release Manager:** Bekir Şahiner  
**Date:** $(date -u +"%Y-%m-%d")  
**Decision:** GO / NO-GO (circle one)

---

**End of Staging Acceptance Checklist**
