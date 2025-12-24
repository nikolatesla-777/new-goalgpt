# Phase 5-0: Production Environment Variables Checklist

**Date:** 2025-12-23  
**Phase:** 5-0 (Release Candidate Freeze)  
**Status:** ✅ **LOCKED** — Variables documented & frozen. **Production MUST explicitly set all PRODUCTION-REQUIRED vars** (do not rely on dev defaults).

---

## Overview

This checklist documents all environment variables used in production. All variables are **frozen** as of Phase 5-0. Any changes require a PR with approval.

### Production Invariants (Non-negotiable)

- No implicit defaults in production (dev defaults are allowed only for local development).  
- Timezone: store timestamps as UTC epoch seconds; render timezone only at response/UI.  
- Secrets never logged; only masked identifiers may appear in logs.  
- All config changes require: PR label config-change + approval + staging verification.

---

## Required Variables

These variables **MUST** be set in production. The server should fail-fast at startup if any are missing/invalid (see `src/server.ts` + `src/config/index.ts`).

### THESPORTS_API_SECRET

- **Description:** TheSports API secret key for authentication
- **Example Value:** `sk_live_abc123xyz789`
- **Production Value Format:** `sk_live_****************` (masked)
- **Change Process:** PR required + approval + secret manager update
- **Validation:** Non-empty string required
- **Location:** `src/server.ts` (startup validation), `src/config/index.ts`

### THESPORTS_API_USER

- **Description:** TheSports API user identifier
- **Example Value:** `goalgpt`
- **Production Value Format:** `goalgpt` (or production user ID)
- **Change Process:** PR required + approval
- **Production Rule:** Must be explicitly set in production (no fallback).
- **Location:** `src/config/index.ts`

### DB_HOST

- **Description:** PostgreSQL database host
- **Example Value:** `localhost` (development), `db.production.internal` (production)
- **Production Value Format:** `db.production.internal` (masked hostname)
- **Change Process:** PR required + approval + infrastructure change
- **Production Rule:** Must be explicitly set; `localhost` is **dev-only**.
- **Location:** `src/config/index.ts`, `src/server.ts` (startup validation)

### DB_PORT

- **Description:** PostgreSQL database port
- **Example Value:** `5432`
- **Production Value Format:** `5432` (standard PostgreSQL port)
- **Change Process:** PR required + approval
- **Production Rule:** Must be explicitly set (even if `5432`).
- **Location:** `src/config/index.ts`, `src/server.ts` (startup validation)

### DB_NAME

- **Description:** PostgreSQL database name
- **Example Value:** `goalgpt`
- **Production Value Format:** `goalgpt_prod` (or production DB name)
- **Change Process:** PR required + approval + database migration
- **Production Rule:** Must be explicitly set (prod DB name).
- **Location:** `src/config/index.ts`, `src/server.ts` (startup validation)

### DB_USER

- **Description:** PostgreSQL database user
- **Example Value:** `postgres`
- **Production Value Format:** `goalgpt_user` (or production DB user)
- **Change Process:** PR required + approval + database user creation
- **Production Rule:** Must be explicitly set (least-privilege DB user).
- **Location:** `src/config/index.ts`, `src/server.ts` (startup validation)

### DB_PASSWORD

- **Description:** PostgreSQL database password
- **Example Value:** `my_secure_password_123`
- **Production Value Format:** `****************` (fully masked, never logged)
- **Change Process:** PR required + approval + secret manager update
- **Alternative Keys:** `DB_PASS`, `POSTGRES_PASSWORD` (any of these accepted)
- **Location:** `src/config/index.ts`, `src/server.ts` (startup validation)

---

## Optional Variables

## Production-Required (Operational)

### NODE_ENV
- **Description:** Runtime mode
- **Production Value:** `production`
- **Change Process:** PR required + approval
- **Validation:** Must equal `production` in staging/prod
- **Location:** runtime environment

### LOG_PATH
- **Description:** Where server logs are written (if file-based logging is enabled)
- **Production Value:** e.g. `/var/log/goalgpt/server.log`
- **Change Process:** PR required + approval
- **Validation:** Writable path; must exist in deployment
- **Location:** ops/runbook + process manager config

### TZ
- **Description:** Process timezone (should not affect stored timestamps)
- **Production Value:** `UTC`
- **Change Process:** PR required + approval
- **Validation:** Recommended `UTC` for consistency
- **Location:** deployment manifest

### PORT

- **Description:** HTTP server port
- **Example Value:** `3000`
- **Production Value Format:** `3000` (or production port, e.g., `8080`)
- **Change Process:** PR required + approval + load balancer config update
- **Default (dev-only):** `3000` (local).
- **Production Rule:** Must match infra (LB/Ingress) port mapping.
- **Location:** `src/server.ts`

### HOST

- **Description:** HTTP server bind address
- **Example Value:** `0.0.0.0` (bind to all interfaces)
- **Production Value Format:** `0.0.0.0` (standard for production)
- **Change Process:** PR required + approval
- **Default (dev-only):** `0.0.0.0` (local).
- **Production Rule:** Typically `0.0.0.0` (container/VM); must be explicit in prod manifests.
- **Location:** `src/server.ts`

### LOG_LEVEL

- **Description:** Winston logging level
- **Example Value:** `info`, `warn`, `error`, `debug`
- **Production Value Format:** `info` (recommended for production)
- **Change Process:** PR required + approval
- **Default:** `info` (if not set)
- **Location:** `src/config/index.ts`

### ALLOWED_ORIGINS

- **Description:** CORS allowed origins (comma-separated)
- **Example Value:** `http://localhost:5173` (development), `https://app.goalgpt.com,https://admin.goalgpt.com` (production)
- **Production Value Format:** `https://app.goalgpt.com,https://admin.goalgpt.com` (production domains)
- **Change Process:** PR required + approval
- **Default (dev-only):** `http://localhost:5173`
- **Production Rule:** Must be explicitly set to production domains; never rely on dev default.
- **Location:** `src/server.ts` (CORS configuration)

### RATE_LIMIT_MAX

- **Description:** Maximum requests per time window for rate limiting
- **Example Value:** `120`
- **Production Value Format:** `120` (or production-tuned value)
- **Change Process:** PR required + approval
- **Default:** `120` (if not set)
- **Location:** `src/server.ts` (rate limiting configuration)
- **Note:** Requires `@fastify/rate-limit` package (optional in Phase 4-5 WS3)

### RATE_LIMIT_WINDOW_MS

- **Description:** Rate limit time window in milliseconds
- **Example Value:** `60000` (1 minute)
- **Production Value Format:** `60000` (1 minute, standard)
- **Change Process:** PR required + approval
- **Default:** `60000` (if not set)
- **Location:** `src/server.ts` (rate limiting configuration)
- **Note:** Requires `@fastify/rate-limit` package (optional in Phase 4-5 WS3)

---

## Additional Variables (Not in WS3, but used in code)

> Note: Treat these as production-required if the code path is enabled in your deployment.

### DB_MAX_CONNECTIONS

- **Description:** Maximum database connection pool size
- **Example Value:** `20`
- **Production Value Format:** `20` (or production-tuned value)
- **Change Process:** PR required + approval
- **Default:** `20` (if not set)
- **Location:** `src/config/index.ts`

### THESPORTS_API_BASE_URL

- **Description:** TheSports API base URL
- **Example Value:** `https://api.thesports.com/v1/football`
- **Production Value Format:** `https://api.thesports.com/v1/football` (production API URL)
- **Change Process:** PR required + approval
- **Default:** Hardcoded in `src/config/api-endpoints.ts` (if not set)
- **Production Rule:** Must match provider account/region; do not change without provider confirmation + staging validation.
- **Location:** `src/config/index.ts`

### THESPORTS_WEBSOCKET_URL

- **Description:** TheSports WebSocket URL
- **Example Value:** `wss://api.thesports.com/v1/football/ws`
- **Production Value Format:** `wss://api.thesports.com/v1/football/ws` (production WebSocket URL)
- **Change Process:** PR required + approval
- **Default:** Hardcoded in `src/config/api-endpoints.ts` (if not set)
- **Production Rule:** Must match provider account/region; do not change without provider confirmation + staging validation.
- **Location:** `src/config/index.ts`

### THESPORTS_MQTT_HOST

- **Description:** TheSports MQTT host
- **Example Value:** `mqtt.thesports.com`
- **Production Value Format:** `mqtt.thesports.com` (production MQTT host)
- **Change Process:** PR required + approval
- **Default:** Hardcoded in `src/config/api-endpoints.ts` (if not set)
- **Production Rule:** Must match provider account/region; do not change without provider confirmation + staging validation.
- **Location:** `src/config/index.ts`

### THESPORTS_MQTT_TOPIC

- **Description:** TheSports MQTT topic
- **Example Value:** `football/live`
- **Production Value Format:** `football/live` (production MQTT topic)
- **Change Process:** PR required + approval
- **Default:** Hardcoded in `src/config/api-endpoints.ts` (if not set)
- **Production Rule:** Must match provider account/region; do not change without provider confirmation + staging validation.
- **Location:** `src/config/index.ts`

---

## Change Process

### For Required Variables

1. Create PR with label `config-change`
2. Update this checklist document
3. Update secret manager (if applicable)
4. Require approval from senior engineer or release manager
5. Test in staging before production

### For Optional Variables

1. Create PR with label `config-change`
2. Update this checklist document
3. Require approval from senior engineer or release manager
4. Test in staging before production

---

## Security Notes

- **Never commit real production values** to git
- **Always mask production values** in documentation
- **Use secret manager** for production secrets (GitHub Secrets, AWS Secrets Manager, etc.)
- **Rotate secrets regularly** (document rotation schedule separately)
- **Do not leak provider keys in client-side code** (frontend must never receive secrets).

---

**End of Production Environment Variables Checklist**



