# Phase 5-S: Staging Deployment Proof

**Date:** 2025-12-23  
**Phase:** 5-S (Staging Deploy + 24h Observation)  
**Status:** ⏳ **PENDING RUN** (This is a proof log. Every section MUST contain raw command output from the staging host. No placeholders allowed at acceptance.)

---

## Variables (single source of truth)

Set these once per run and use them everywhere in commands below.

- `STAGING_SSH_HOST` — staging SSH host (e.g. `goalgpt-staging-01`)
- `STAGING_DEPLOY_DIR` — code directory on staging (e.g. `/opt/goalgpt`)
- `STAGING_HTTP_BASE` — base URL for HTTP checks (e.g. `https://staging.goalgpt.com` or `http://127.0.0.1:3000` if checking locally on host)
- `STAGING_PORT` — listen port (default `3000`)
- `RELEASE_REF` — **either** RC tag (preferred) or exact commit SHA (fallback), e.g. `v5.0.0-rc1` or `a1b2c3d4`

**Set once (example):**
```bash
export STAGING_SSH_HOST="goalgpt-staging-01"
export STAGING_DEPLOY_DIR="/opt/goalgpt"
export STAGING_HTTP_BASE="https://staging.goalgpt.com"   # or http://127.0.0.1:3000 if checking locally on host
export STAGING_PORT="3000"
export RELEASE_REF="v5.0.0-rc1"   # preferred tag; commit SHA allowed
```

---

## Pre-Deployment Verification

## Quick Check: Is staging already running?

Run these on the **staging host** (SSH). This answers the question “is anything listening and returning health?”.

**Command:**
```bash
# 1) Listener on port
lsof -nP -iTCP:"$STAGING_PORT" -sTCP:LISTEN || true

# 2) If the app exposes health locally
curl -sS -i "http://127.0.0.1:$STAGING_PORT/health" || true
curl -sS -i "http://127.0.0.1:$STAGING_PORT/ready" || true

# 3) If using public base URL
curl -sS -i "$STAGING_HTTP_BASE/health" || true
curl -sS -i "$STAGING_HTTP_BASE/ready" || true
```

**Output:**
```
<FILL STAGING OUTPUT>
```

**Analysis:** PASS if a single listener exists and /health returns HTTP 200. If not, proceed with full deploy steps below.

### Release Ref Verification (RC tag or commit SHA)

#### STAGING: verify RELEASE_REF exists in repo

**Command (run on staging host in the deploy repo):**  
```bash
cd "$STAGING_DEPLOY_DIR"
git rev-parse --is-inside-work-tree
git remote -v
git fetch --tags origin
git show -s --format="%H %D" "$RELEASE_REF" || true
```

**Output:**  
```
<FILL STAGING OUTPUT>
```

**Analysis:** <FILL PASS/FAIL — must print a commit hash for RELEASE_REF>

#### If RELEASE_REF is missing (UNBLOCK on LOCAL machine, not staging)

- Create the tag in the canonical repo (CI/local): `git tag -a v5.0.0-rc1 -m "RC1" && git push origin --tags`
- Or choose a commit SHA and set `RELEASE_REF` to that SHA

---

### Repository Status (STAGING proof)

**Command:**  
```bash
cd "$STAGING_DEPLOY_DIR"
git rev-parse --is-inside-work-tree
git status --porcelain
git log --oneline -1
git describe --tags --always
```

**Output:**  
```
<FILL STAGING OUTPUT>
```

**Analysis:** <FILL PASS/FAIL — must be a clean working tree; RELEASE_REF reachable; repo has origin remote>

---

## Deployment (STAGING)

Deploy by checking out RELEASE_REF (RC tag preferred, commit SHA allowed).

### Step 1: Checkout RELEASE_REF

```bash
cd "$STAGING_DEPLOY_DIR"
git fetch --tags origin
# Prefer detached checkout for deployments
git checkout --detach "$RELEASE_REF"
git rev-parse HEAD

git describe --tags --always
```

**Output:**
```
<FILL STAGING OUTPUT>
```

**Analysis:** <FILL PASS/FAIL — must show HEAD SHA and describe/tag>

### Step 2: Install Dependencies

```bash
npm ci
```

**Output:**
```
<FILL STAGING OUTPUT>
```

**Analysis:** <FILL PASS/FAIL — install succeeds with exit code 0>

(If this is a monorepo or uses pnpm/yarn, replace accordingly, but keep raw output in this file.)

### Step 3: Environment / Config Proof (staging)

**Command:**  
```bash
node -v
npm -v
cat .nvmrc || true
printenv | egrep '^(NODE_ENV|PORT|TZ|LOG_PATH|DATABASE_URL|THESPORTS_|MQTT_|APP_)' || true
```

**Output:**  
```
<FILL STAGING OUTPUT>
```

**Analysis:** <FILL PASS/FAIL — Node version must match .nvmrc; required env vars present>

### Step 4: Start Server

Choose ONE process manager path (PM2 or systemd). Capture outputs.

**Using PM2:**  
```bash
export NODE_ENV=staging
pm2 start ecosystem.config.js --env staging
pm2 logs goalgpt-server --lines 80
```

**Output (PM2):**
```
<FILL STAGING OUTPUT>
```

**Analysis (PM2):** <FILL PASS/FAIL — service is online and logs show server.listening + worker.started>

**Using systemd:**  
```bash
sudo systemctl start goalgpt-server
sudo systemctl status goalgpt-server
journalctl -u goalgpt-server -n 80 --no-pager
```

**Output (systemd):**
```
<FILL STAGING OUTPUT>
```

**Analysis (systemd):** <FILL PASS/FAIL — unit is active/running and logs show server.listening + worker.started>

---

## Health Endpoint Proof

**Command:**  
```bash
curl -i "$STAGING_HTTP_BASE/health"
```

**Output:**  
```
<FILL STAGING OUTPUT>
```

**Analysis:** PASS if HTTP 200 and body is valid JSON and indicates OK (e.g., {"ok":true} or {"success":true}).

---

## Readiness Endpoint Proof

**Command:**  
```bash
curl -i "$STAGING_HTTP_BASE/ready"
```

**Output:**  
```
<FILL STAGING OUTPUT>
```

**Analysis:** PASS if HTTP 200 and readiness JSON shows DB ok + config ok + websocket state reported (if applicable).

---

## Live Endpoint Contract Proof

**Command:**  
```bash
curl -s "$STAGING_HTTP_BASE/api/matches/live" | node -e "
let raw='';
process.stdin.on('data', c => raw+=c);
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(raw);
    const results = d?.data?.results || d?.results || [];
    const missing = results.filter(m => !m?.minute_text);
    console.log('Total matches:', results.length);
    console.log('Missing minute_text:', missing.length);
    if (missing.length > 0) process.exit(1);
  } catch (e) {
    console.error('FAIL: Response is not valid JSON');
    console.error(raw.slice(0, 400));
    process.exit(2);
  }
});
"
```

**Output:**  
```
<FILL STAGING OUTPUT>
```

**Analysis:** PASS if Missing minute_text: 0.

---

## Port/Process Verification

**Command:**  
```bash
# Verify listener on port
lsof -nP -iTCP:"$STAGING_PORT" -sTCP:LISTEN || true

# If using PM2
pm2 ls || true
pm2 pid goalgpt-server || true

# If using systemd
sudo systemctl status goalgpt-server --no-pager || true

# If LOG_PATH is known, tail it explicitly (paste the exact command you ran):
```
```bash
# Example (replace with real path):
# tail -n 50 /var/log/goalgpt/server.log
```

**Output:**  
```
<FILL STAGING OUTPUT>
```

**Analysis:** PASS if exactly one listener on STAGING_PORT and process manager shows running service.

---

## Deployment Metadata (fill after deploy)

```
STAGING_SSH_HOST: <FILL>
STAGING_DEPLOY_DIR: <FILL>
STAGING_HTTP_BASE: <FILL>
STAGING_PORT: <FILL>
RELEASE_REF: <FILL>
GIT_SHA: <FILL>
DEPLOY_TIME_TSI: <FILL>
PROCESS_MANAGER: <FILL: pm2|systemd>
NODE_VERSION: <FILL>
PID: <FILL>
LOG_PATH: <FILL>
```

---

## Execution Status

**Current Status:** ⏳ PENDING RUN — fill variables, SSH to staging, then execute Proof Run Order top-to-bottom and paste raw outputs.

Note: This file is a proof log; do not embed build or feature changes here.

### Ready-to-run Checklist (must be TRUE before running proofs)  
- [ ] You can SSH to `$STAGING_SSH_HOST`  
- [ ] `$STAGING_DEPLOY_DIR` exists and is a git repo  
- [ ] `DATABASE_URL` is configured on staging  
- [ ] TheSports API creds present (`THESPORTS_*`)  
- [ ] MQTT/WebSocket creds present if used (`MQTT_*`)  
- [ ] You know whether process manager is PM2 or systemd  
- [ ] You know the staging domain (if using HTTPS) and it resolves (DNS OK)  
- [ ] You know whether the service binds to 127.0.0.1 only or 0.0.0.0 (affects external checks)

### Proof Run Order (after deploy)  
1) Release Ref Verification  
2) Repository Status  
3) Checkout RELEASE_REF  
4) Install + Env/Config Proof  
5) Start Server  
6) /health  
7) /ready  
8) /api/matches/live minute_text contract  
9) Port/Process Verification

---

## Acceptance
This proof is ✅ COMPLETE only when:
- All <FILL STAGING OUTPUT> placeholders are replaced with real outputs, and
- Every section has a PASS/FAIL Analysis, and
- /health, /ready, and /api/matches/live minute_text checks PASS, and
- Port/process verification shows exactly one running instance.

---

**End of Staging Deployment Proof**
