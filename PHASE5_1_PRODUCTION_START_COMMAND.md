# Phase 5-1: Production Start Command Standardization

**Date:** 2025-12-23  
**Phase:** 5-1 (Production Parity)  
**Status:** ✅ **DOCUMENTED + OPERATIONALLY VERIFIED (commands included)**

---

## Standard Production Start Command

### Recommended Command

**Linux/macOS:**
```bash
export NODE_ENV=production
npm run start
```

**Windows PowerShell:**
```powershell
$env:NODE_ENV="production"
npm run start
```

**Breakdown:**
- `NODE_ENV=production`: Sets Node.js environment to production mode
- `npm run start`: Executes the start script defined in `package.json` (currently: `tsx src/server.ts`)

---

## Current Start Script

**From `package.json`:**
```json
{
  "scripts": {
    "start": "tsx src/server.ts"
  }
}
```

### ⚠️ Production note about tsx

- If `tsx` is in `devDependencies` and your production installs use `npm ci --omit=dev`, then `npm run start` will fail because `tsx` is not installed.
- Two acceptable paths:
  A) Keep runtime TypeScript execution: move `tsx` to `dependencies` **OR** ensure production installs include it (e.g., do not omit dev dependencies).
  B) Preferred long-term: add a build step (e.g., `tsc` compiling to `dist/`) and run `node dist/server.js` in production.

---

## Process Manager Options

### Option 1: PM2 (Recommended for Node.js applications)

**Installation:**
```bash
npm install -g pm2
```

**Start Command:**
```bash
pm2 start npm --name "goalgpt-server" -- start
```

**Or with environment:**
```bash
export NODE_ENV=production
pm2 start npm --name "goalgpt-server" -- start
```

**Benefits:**
- Process monitoring and auto-restart
- Log management
- Zero-downtime reloads
- Process clustering (optional)

**Configuration File (optional):**
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'goalgpt-server',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

Then start with:
```bash
pm2 start ecosystem.config.js --env production
```

### Option 2: systemd (Linux system service)

**Service File:** `/etc/systemd/system/goalgpt-server.service`
```ini
[Unit]
Description=GoalGPT Server
After=network.target

[Service]
Type=simple
User=goalgpt
WorkingDirectory=/opt/goalgpt
Environment=NODE_ENV=production
EnvironmentFile=/opt/goalgpt/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
KillSignal=SIGTERM
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Commands:**
```bash
# Reload systemd
sudo systemctl daemon-reload

# Start service
sudo systemctl start goalgpt-server

# Enable on boot
sudo systemctl enable goalgpt-server

# Check status
sudo systemctl status goalgpt-server
```

### Option 3: Direct Execution (Development/Testing)

**Command:**
```bash
export NODE_ENV=production
npm run start
```

**Use Case:** Development, testing, or simple deployments without process manager.

---

## Environment Variable Export Process

### Method 1: `.env.production` File

**Location:** `.env.production` (in project root, **NOT committed to git**)

**Warning:** Never commit `.env.production`. Ensure it is listed in `.gitignore`.

**Content Example:**
```bash
NODE_ENV=production
THESPORTS_API_SECRET=sk_live_...
THESPORTS_API_USER=goalgpt
DB_HOST=db.production.internal
DB_PORT=5432
DB_NAME=goalgpt_prod
DB_USER=goalgpt_user
DB_PASSWORD=...
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
ALLOWED_ORIGINS=https://app.goalgpt.com
```

**Loading environment variables:**

- `dotenv` loads what your code tells it to load; Node.js does **not** auto-load `.env.production` by itself.
- Expected behavior for this repo:
  - If `src/server.ts` (or config loader) explicitly loads `.env.${NODE_ENV}`, then `.env.production` will be loaded when `NODE_ENV=production`.
  - If it loads only `.env`, then use `dotenv -e .env.production -- ...` or configure your process manager with `EnvironmentFile` to load `.env.production`.

**Verification:**

To confirm which environment file is being used, run:
```bash
NODE_ENV=production npm run start
# In another terminal:
curl -s http://localhost:3000/health | head
# Or print environment variables by adding a temporary endpoint or console.log:
# e.g., console.log(process.env.NODE_ENV, process.env.PORT, process.env.LOG_LEVEL)
```

---

### Method 2: Secret Manager (Recommended for Production)

**Options:**
- GitHub Secrets (for CI/CD)
- AWS Secrets Manager
- HashiCorp Vault
- Environment variables set by process manager/systemd

**Example for PM2:**

- Prefer using PM2's `--env production` option with an ecosystem file that specifies `env_production` environment variables.
- Alternatively, use systemd's `EnvironmentFile=` directive.
- If loading secrets from a file, ensure the file has strict permissions (`chmod 600`) to avoid leaking secrets.
- Avoid commands like `export $(cat /opt/goalgpt/.env.production | xargs)` because they can leak secrets via process listings and may fail with spaces or special characters.

---

## Graceful Shutdown Verification

**Current Implementation:** ✅ Already implemented in Phase 4-5 WS4

**Verification:**
- Server listens for `SIGTERM` and `SIGINT` signals
- Graceful shutdown sequence:
  1. Stop accepting new requests
  2. Stop background workers
  3. Disconnect WebSocket/MQTT
  4. Close database connection pool
  5. Close HTTP server
  6. Log `shutdown.done` event
  7. Exit with code 0

**Test Command:**
```bash
# Start server
export NODE_ENV=production
npm run start &
SERVER_PID=$!

# Send SIGTERM
kill -TERM $SERVER_PID

# Verify shutdown logs (choose one):

# For systemd:
journalctl -u goalgpt-server -f | grep -E "shutdown\.(start|done)"

# For PM2:
pm2 logs goalgpt-server --lines 200 | grep -E "shutdown\.(start|done)"
```

**Expected Logs:**
- `shutdown.start` event (structured log)
- `Shutting down gracefully...`
- `✅ Database pool closed`
- `✅ HTTP server closed`
- `shutdown.done` event (structured log)
- `✅ Shutdown complete`

---

## Smoke Test (5 commands)

1. Start server (choose PM2 or direct execution):

```bash
# Using PM2:
pm2 start ecosystem.config.js --env production

# Or direct:
export NODE_ENV=production
npm run start &
```

2. Check health endpoint:

```bash
curl -s -i http://localhost:3000/health | head
```

3. Check readiness endpoint:

```bash
curl -s -i http://localhost:3000/ready | head
```

4. Check live matches API data integrity:

```bash
curl -s http://localhost:3000/api/matches/live | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); const r=d?.data?.results||[]; const bad=r.filter(m=>!m.minute_text); console.log('live=',r.length,'missingMinuteText=',bad.length); process.exit(bad.length?1:0);"
```

5. Graceful shutdown (send SIGTERM):

```bash
# Find PID (if direct start):
ps aux | grep server.ts

# Or if PM2:
pm2 stop goalgpt-server

# Or send SIGTERM manually:
kill -TERM <PID>
```

---

## Production Deployment Checklist

- [ ] `.nvmrc` file exists (Node.js 22.11.0)
- [ ] Production environment variables set (via secret manager or `.env.production`)
- [ ] Process manager configured (PM2 or systemd)
- [ ] Graceful shutdown verified
- [ ] Health endpoint (`/health`) accessible
- [ ] Readiness endpoint (`/ready`) returns 200 OK
- [ ] Logs visible in process manager / stdout (journalctl or pm2 logs)
- [ ] Port 3000 (or configured PORT) accessible

---

## Notes

- **No build step required:** Current setup uses `tsx` to run TypeScript directly
- **TypeScript compilation:** Not needed for runtime (handled by `tsx`)
- **Future consideration:** If build step is added, update start command to use compiled output

---

**End of Production Start Command Documentation**



