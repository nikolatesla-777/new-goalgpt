# Phase 5-S: Staging Cutover & 24h Observation Plan

**Date:** 2025-12-23  
**Phase:** 5-S (Staging Deploy + 24h Observation)  
**Status:** 📋 **PLAN** — Ready for Execution

## Execution Variables (fill once, then do NOT change)

- `STAGING_HOST=` (SSH host/IP)
- `STAGING_DIR=/opt/goalgpt`
- `STAGING_HTTP_BASE=` (example: `http://staging.goalgpt.local:3000` or `https://staging.goalgpt.com`)
- `STAGING_PORT=` (default `3000` if not behind a reverse proxy)
- `LOG_PATH=` (example: `/var/log/goalgpt/server.log` or `journalctl -u goalgpt-server`)
- `PROCESS_MANAGER=` (`pm2` or `systemd`)
- `DB_NAME=` (MUST be staging DB, never prod)
- `RC_TAG=rc1` (or `v5.0.0-rc1` — pick one and keep consistent)

---

## Objective

Deploy RC1 to staging environment, observe system behavior for 24 hours under real-world conditions, and verify:
- No minute calculation regressions
- No status transition bugs
- Watchdog behaves correctly (no false positives)
- System stability (no crashes, memory leaks)
- Contract compliance (minute_text always present)

**Success Criteria:** 24-hour observation window completes with zero critical issues → **GO** for production cutover.

**Failure Criteria:** Any critical regression, freeze, or watchdog false positive → **NO-GO**, investigation required.

---

## Preconditions Checklist

Before starting Phase 5-S, verify:

- [ ] **RC1 tag exists** (`git tag --list | grep rc1`)
- [ ] **Staging environment provisioned** (server, database, network)
- [ ] **Staging URL known** (e.g., `https://staging.goalgpt.com`)
- [ ] **Staging environment variables set** (all required vars from `PHASE5_0_PRODUCTION_ENV_CHECKLIST.md`)
- [ ] **Database accessible** (staging DB, non-production data)
- [ ] **Process manager configured** (PM2 or systemd)
- [ ] **Log path configured** (e.g., `/var/log/goalgpt/server.log` or `logs/combined.log`)
- [ ] **Node.js 22.11.0 installed** on staging host (per `.nvmrc`)
- [ ] **Network access** to TheSports API (from staging host)
- [ ] **Monitoring/alerting** ready (if available)

### Hard Safety Checks (must pass)

- [ ] **You are NOT on prod DB**: `DB_NAME` is staging, and `DB_HOST` is not production
- [ ] **Only one server instance** will be started for staging (avoid duplicate listeners)
- [ ] **Proof files path chosen** (local or repo): we will write real outputs into:
  - `PHASE5_S_STAGING_DEPLOY_PROOF.md`
  - `PHASE5_S_24H_OBSERVATION_LOG.md`
  - `PHASE5_S_ACCEPTANCE.md`

### Blockers (if any, stop here)

- If `RC_TAG` does not exist, do **Phase 5-0/5-2 unblock** first (repo init + tag).

---

## Deployment Steps (Ordered)

### Step 1: Verify RC Tag (must exist)

```bash
git tag --list | grep -E "rc1|v5\.0\.0-rc1"
git show "${RC_TAG:-rc1}" --no-patch --decorate
```

**Expected:** `${RC_TAG}` exists and points to the intended commit.

**If BLOCKED (no repo / no tag):** do **not** continue with staging deploy. Unblock first:

```bash
# Only if this is a fresh local folder without git history
git init
git add -A
git commit -m "chore: initial commit"
git tag rc1
git show rc1 --no-patch --decorate
```

---

### Step 2: Checkout RC Tag on Staging Host

```bash
cd "${STAGING_DIR:-/opt/goalgpt}"
git fetch --tags origin
git checkout "tags/${RC_TAG:-rc1}" -B "${RC_TAG:-rc1}"
```

**Verification:**
```bash
git rev-parse HEAD
git describe --tags --always
```

---

### Step 3: Install Dependencies

```bash
npm ci
```

**Verification:**
```bash
npm list --depth=0 | head -20
```

---

### Step 4: Configure Environment Variables (staging)

Preferred: use **systemd EnvironmentFile** or a **.env.staging** file loaded by the process manager.

**Option A — systemd EnvironmentFile (recommended):**
- Ensure your unit file contains `EnvironmentFile=/opt/goalgpt/.env.staging`
- Verify:
```bash
sudo systemctl cat goalgpt-server | sed -n '1,160p'
sudo test -f /opt/goalgpt/.env.staging && echo "OK: .env.staging exists"
```

**Option B — PM2 ecosystem file:**
- Ensure `ecosystem.config.js` sets `env_staging` and does not print secrets.

**Verification (non-secret only):**
```bash
node -e "console.log({NODE_ENV:process.env.NODE_ENV, PORT:process.env.PORT, DB_HOST:process.env.DB_HOST, DB_NAME:process.env.DB_NAME})"
```

**Expected:** `NODE_ENV=staging` (or `production` for staging parity), and `DB_NAME` is staging.

---

### Step 5: Start Server (choose ONE)

#### Option A — PM2 (PROCESS_MANAGER=pm2)

```bash
cd "${STAGING_DIR:-/opt/goalgpt}"
pm2 start ecosystem.config.js --env staging
pm2 status
pm2 logs goalgpt-server --lines 80
```

#### Option B — systemd (PROCESS_MANAGER=systemd)

```bash
sudo systemctl start goalgpt-server
sudo systemctl status goalgpt-server --no-pager
journalctl -u goalgpt-server -n 120 --no-pager
```

#### Port / Process Hygiene (required)

```bash
# Show who is listening
lsof -i :"${STAGING_PORT:-3000}" | head -20

# There must be exactly ONE node process for goalgpt on the port
```

**Expected:** startup logs include `server.listening` and workers `worker.started`. No crash loop.

---

### Step 6: Health & Readiness Proof

```bash
# Health endpoint
curl -i "${STAGING_HTTP_BASE}/health"

# Readiness endpoint
curl -i "${STAGING_HTTP_BASE}/ready"
```

**Expected:**
- `/health`: 200 OK, `ok: true`
- `/ready`: 200 OK, `ok: true`, `db.ok: true`, `thesports.ok: true`

---

### Step 7: Live Contract Proof

```bash
curl -s "${STAGING_HTTP_BASE}/api/matches/live" | node -e "
const d=JSON.parse(require('fs').readFileSync(0));
const results = d?.data?.results || d?.results || [];
const missing = results.filter(m => !m.minute_text || m.minute_text === null);
console.log('Total matches:', results.length);
console.log('Missing minute_text:', missing.length);
if (missing.length > 0) {
  console.error('FAIL: Some matches missing minute_text');
  process.exit(1);
}
console.log('PASS: All matches have minute_text');
"
```

**Expected:** `missing minute_text: 0`

---

### Step 8: Write Proof Outputs (no placeholders)

Immediately after Step 6 and Step 7, append the real outputs into:

- `PHASE5_S_STAGING_DEPLOY_PROOF.md`:
  - RC tag proof (`git show ...`)
  - start proof (`server.listening`, `worker.started`)
  - `/health` and `/ready` raw HTTP response headers + body
  - live contract proof output (total matches + PASS line)

Tip (copy/paste): keep each proof under a dated heading, e.g. `## 2025-12-23T...`

---

## Rollback Plan

### Trigger Conditions

Rollback immediately if:
- `/ready` endpoint returns 503
- Server crashes within first 5 minutes
- `minute_text` contract broken (any match missing `minute_text`)
- Critical error in startup logs

### Rollback Steps

1. **Stop current deployment:**
   ```bash
   # PM2
   pm2 stop goalgpt-server
   
   # systemd
   sudo systemctl stop goalgpt-server
   ```

2. **Revert to previous version** (if applicable):
   ```bash
   git checkout "<previous-tag-or-commit-or-tag>"
   npm ci
   # Restart with previous version
   ```

3. **Verify rollback:**
   ```bash
   curl -i "${STAGING_HTTP_BASE}/ready"
   ```

4. **Document incident:**
   - Log error messages
   - Capture logs
   - Update `PHASE5_S_STAGING_DEPLOY_PROOF.md` with rollback reason

---

## Observation Checklist (24h Window)

### T+0h (Deployment Time)

- [ ] Server started successfully
- [ ] Health endpoint OK
- [ ] Readiness endpoint OK
- [ ] Live endpoint contract verified (minute_text present)
- [ ] Initial live matches count recorded
- [ ] Process PID recorded
- [ ] Port recorded

```bash
curl -s "${STAGING_HTTP_BASE}/ready"
curl -s "${STAGING_HTTP_BASE}/api/matches/live" | head -c 300
lsof -i :"${STAGING_PORT:-3000}" | head -10
```

### T+6h (Mid-day Check)

- [ ] Server still running (no crashes)
- [ ] Live matches count (compare to T+0h)
- [ ] Sample match minute progression checked
- [ ] Watchdog events reviewed (if any)
- [ ] Error logs reviewed (should be NONE or non-critical)

```bash
# Replace LOG_PATH handling based on process manager
# systemd:
journalctl -u goalgpt-server -n 120 --no-pager | tail -40
# pm2:
pm2 logs goalgpt-server --lines 120 | tail -40
```

### T+12h (Halfway Check)

- [ ] Server still running
- [ ] Live matches count
- [ ] Status transitions observed (2→3→4→8, plus 5/7 where applicable)
- [ ] HALF_TIME matches freeze at 45 (verify)
- [ ] Watchdog events reviewed
- [ ] Memory usage stable (if monitoring available)

```bash
# Replace LOG_PATH handling based on process manager
# systemd:
journalctl -u goalgpt-server -n 120 --no-pager | tail -40
# pm2:
pm2 logs goalgpt-server --lines 120 | tail -40
```

### T+24h (Final Check)

- [ ] Server still running (no restarts)
- [ ] Final live matches count
- [ ] Minute progression verified (monotonic increase)
- [ ] Status transitions verified (legal transitions only)
- [ ] Watchdog events reviewed (no false positives)
- [ ] Error logs reviewed (NONE or documented)
- [ ] Memory usage stable

```bash
# Replace LOG_PATH handling based on process manager
# systemd:
journalctl -u goalgpt-server -n 120 --no-pager | tail -40
# pm2:
pm2 logs goalgpt-server --lines 120 | tail -40
```

---

## Exit Criteria (Go/No-Go)

### ✅ GO Criteria (All Must Be True)

1. **Deployment successful:** Server running, health/ready OK
2. **Contract compliance:** All matches have `minute_text` throughout 24h
3. **Minute progression:** Minutes increase monotonically, no regressions
4. **Status transitions:** Legal transitions only (2→3→4→8, plus 5/7 where applicable)
5. **HALF_TIME freeze:** Matches in HALF_TIME (status 3) freeze at 45
6. **Watchdog behavior:** No false positives, no watchdog loops
7. **System stability:** No crashes, no memory leaks, no restarts
8. **Logs readable:** Structured logs present, no corruption

### ❌ NO-GO Criteria (Any One Triggers)

1. **Minute goes backwards** (regression)
2. **Minute freezes incorrectly** (e.g., LIVE match stuck at same minute for >5 minutes)
3. **Status jumps illegally** (e.g., 2→8 without 3/4 when it should exist)
4. **Watchdog loops** (repeated reconcile attempts for same match)
5. **Server crashes** (any crash during 24h window)
6. **Contract broken** (any match missing `minute_text`)
7. **Memory leak** (continuous memory growth >1GB over 24h)

---

## Documentation Requirements

All observations must be documented in:
- `PHASE5_S_STAGING_DEPLOY_PROOF.md` — Deployment proof
- `PHASE5_S_24H_OBSERVATION_LOG.md` — 24h observation log
- `PHASE5_S_ACCEPTANCE.md` — Final acceptance checklist

**No placeholders allowed.** All outputs must be real command outputs.

---

## Next Steps After Phase 5-S

**If GO:**
- Proceed to Phase 5-3 (Production Blue-Green Cutover)

**If NO-GO:**
- Document root cause
- Fix issues (may require code changes, which breaks Phase 5-S freeze)
- Re-run Phase 5-S after fixes

---

## Phase 5-S Output Artifacts (must be produced)

- `PHASE5_S_STAGING_DEPLOY_PROOF.md` — deploy proofs (real outputs)
- `PHASE5_S_24H_OBSERVATION_LOG.md` — T+0/T+6/T+12/T+24 snapshots
- `PHASE5_S_ACCEPTANCE.md` — GO/NO-GO checklist + decision

---

**End of Staging Cutover Plan**


