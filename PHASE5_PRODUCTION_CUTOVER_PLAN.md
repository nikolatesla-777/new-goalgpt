# Phase 5: Production Cutover & Stabilization Plan

**Date:** 2025-12-23  
**Phase:** 5 (Production Cutover & Stabilization)  
**Status:** 📋 **PLAN** — Ready for Execution

---

## Executive Summary

Phase 5, sistemin **önce Staging** ortamında doğrulanıp (24 saat gözlem), ardından **Production** ortamına kontrollü şekilde cutover edilmesini ve ilk stabilizasyon dönemini kapsar.

**High-level akış (Staging-first):**
1) 5-0 RC Freeze → 2) 5-1 Runtime Parity → 3) 5-2 CI Minimum Gates → 4) 5-S Staging Deploy + 24h Observation → 5) 5-3 Production Blue-Green Cutover → 6) 5-4 Monitoring/Alerting Hardening

**Glossary (kısa):**
- **Staging:** Prod ile aynı config/infra prensipleriyle çalışan, güvenli test ortamı.
- **Blue-Green:** Yeni sürümü (green) ayağa kaldır → health/smoke doğrula → trafiği green’e al → eski sürümü (blue) geri çek.
- **Cutover:** Trafiğin yeni sürüme geçirilmesi.

**Scope:**
- Release Candidate freeze (code + config)
- Runtime parity (Node.js LTS pinning, start command standardization)
- CI/CD minimum gates (GitHub Actions)
- Staging deploy + 24h gözlem (golden-day proof)
- Controlled blue-green production deployment
- Post-deploy monitoring & alerting (Prometheus + Grafana)

**Non-goals (Phase 5 boyunca yapılmayacaklar):**
- Yeni feature development (sadece prod-bug fixes)
- Database schema changes (acil durum harici; acilde ayrı change window)
- Major refactoring

---

## 5-0: Release Candidate Freeze

### Goal
Code ve config freeze ile RC1 tag'ini oluştur. Bundan sonra sadece prod-bug fixes kabul edilir.

### Deliverables

#### 5-0.1: Code Freeze
- **Action:** `main` branch'inde code freeze ilanı
- **Rule:** Yeni feature PR'ları reddedilir, sadece prod-bug fix PR'ları kabul edilir
- **Documentation:** `PHASE5_0_CODE_FREEZE.md` oluştur (freeze date, exception process)

#### 5-0.2: Config Freeze
- **Action:** WS3'te kanıtlanan tüm environment variables'ı tek bir checklist'e sabitle
- **File:** `PHASE5_0_PRODUCTION_ENV_CHECKLIST.md` oluştur
- **Content:**
  - Required variables (WS3'ten: THESPORTS_API_SECRET, THESPORTS_API_USER, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
  - Optional variables (PORT, HOST, LOG_LEVEL, ALLOWED_ORIGINS, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  - Her variable için: description, example value, production value (masked), change process (PR required)
- **Rule:** Config değişikliği için PR + approval şart

#### 5-0.3: RC1 Tag Creation
- **Action:** `git tag -a v5.0.0-rc1 -m "Phase 5 Release Candidate 1"` (veya semantic versioning'e uygun)
- **Prerequisites:**
  - WS5 Release Gate PASS
  - Code freeze ilan edildi
  - Config checklist oluşturuldu
- **Proof:** Tag oluşturuldu, GitHub'da görünüyor

### Acceptance Criteria
- [ ] Code freeze dokümante edildi (`PHASE5_0_CODE_FREEZE.md`)
- [ ] Production env checklist oluşturuldu (`PHASE5_0_PRODUCTION_ENV_CHECKLIST.md`)
- [ ] RC1 tag oluşturuldu ve GitHub'da görünüyor
- [ ] Exception process tanımlı (prod-bug fix için PR approval süreci)

### Files to Create
- `PHASE5_0_CODE_FREEZE.md`
- `PHASE5_0_PRODUCTION_ENV_CHECKLIST.md`

---

## 5-1: Production Parity (Kritik)

### Goal
Production runtime environment'ı local/development ile parity sağla. Node.js LTS pinning ve start command standardization.

### Deliverables

#### 5-1.1: Node.js Version Pinning
- **Action:** `.nvmrc` dosyası oluştur
- **Content:** LTS version (20.x veya 22.x - kullanıcı seçimi)
- **Current:** v24.11.1 (non-LTS)
- **Target:** v20.18.0 (LTS) veya v22.11.0 (LTS)
- **File:** `.nvmrc` (tek satır: `20.18.0` veya `22.11.0`)
- **Verification:** `nvm use` komutu ile version switch test edilir

#### 5-1.2: Docker Image Pinning (if applicable)
- **Action:** Eğer Docker kullanılıyorsa, Dockerfile'da Node.js base image pin
- **File:** `Dockerfile` (eğer yoksa oluşturulacak)
- **Content:** `FROM node:20.18.0-alpine` (veya seçilen LTS version)
- **Note:** Docker kullanılmıyorsa bu adım skip edilir

#### 5-1.3: Start Command Standardization
- **Action:** WS4 runbook'taki start command'ı standardize et
- **Current:** `npm run start` (tsx src/server.ts)
- **Production Command:** `NODE_ENV=production npm run start` (veya PM2/systemd script)
- **File:** `PHASE5_1_PRODUCTION_START_COMMAND.md` oluştur
- **Content:**
  - Standard start command
  - Environment variable export process (`.env.production` veya secret manager)
  - Process manager recommendation (PM2, systemd, vs.)
  - Graceful shutdown verification

### Acceptance Criteria
- [ ] `.nvmrc` dosyası oluşturuldu ve LTS version pinlendi
- [ ] `nvm use` komutu ile version switch test edildi
- [ ] Production start command dokümante edildi
- [ ] Local Node.js version ile production version match ediyor (parity)

### Files to Create/Modify
- `.nvmrc` (NEW)
- `Dockerfile` (if applicable, NEW or MODIFY)
- `PHASE5_1_PRODUCTION_START_COMMAND.md` (NEW)

---

## 5-2: CI / Release Pipeline Minimum (1 gün)

### Goal
GitHub Actions workflow oluştur. Minimum gates: npm ci, typecheck (touched files clean), deterministic tests, smoke tests.

### Deliverables

#### 5-2.1: GitHub Actions Workflow
- **File:** `.github/workflows/ci-release.yml` (NEW)
- **Structure:**
  ```yaml
  name: CI / Release Pipeline
  
  on:
    pull_request:
      branches: [main]
    push:
      branches: [main]
      tags: ['v*']
  
  jobs:
    test:
      - npm ci
      - npm run typecheck (touched files clean check)
      - npm run test:phase3a
      - npm run test:phase3b-minute
      - npm run test:phase3b-watchdog
      - Smoke: /ready + /api/matches/live contract check
  ```

#### 5-2.2: Typecheck Touched Files Clean Check
- **Action:** Phase 3/4/5 touched files için typecheck clean kontrolü
- **Script:** `.github/scripts/check-touched-files-typecheck.sh` (NEW)
- **Logic:**
  - `git diff main...HEAD --name-only` ile changed files bul
  - Phase 3/4/5 files filter et (matchMinute, matchWatchdog, matchFreezeDetection, health, server.ts shutdown)
  - Bu files için `tsc --noEmit` çalıştır
  - Exit code 0 olmalı (touched files clean)

#### 5-2.3: Smoke Test in CI
- **Action:** CI'da server başlat, smoke test çalıştır
- **Script:** `.github/scripts/smoke-test.sh` (NEW)
- **Content:**
  - Server start (background)
  - Wait for `/ready` endpoint (200 OK)
  - `/api/matches/live` contract check (minute_text present)
  - Server stop
- **Not:** CI smoke test runner içinde local server ayağa kalktığı için burada `127.0.0.1` kullanımı normaldir; Prod/Staging proof’larında **asla localhost referansı bırakılmayacak**.

### Acceptance Criteria
- [ ] GitHub Actions workflow oluşturuldu (`.github/workflows/ci-release.yml`)
- [ ] Typecheck touched files clean check çalışıyor
- [ ] Deterministic tests (phase3a, phase3b-minute, phase3b-watchdog) CI'da PASS
- [ ] Smoke test CI'da PASS
- [ ] PR merge edilebilmesi için minimum gates çalışıyor

### Files to Create
- `.github/workflows/ci-release.yml` (NEW)
- `.github/scripts/check-touched-files-typecheck.sh` (NEW)
- `.github/scripts/smoke-test.sh` (NEW)

---

## 5-S: Staging Deploy + 24h Observation (Tavsiye edilen, zorunlu adım)

### Goal
Production cutover’dan önce staging ortamında **aynı runtime + aynı config prensipleri** ile deploy edip 24 saat gözlem yapmak.

### Hard Rules (değişmez)
- Staging’de kullanılan env değişken seti, **prod checklist ile aynı anahtarları** içerir (değerler farklı olabilir).
- Staging ve Prod’da **aynı Node LTS** çalışır.
- Staging’de `/ready`, `/health`, `/api/matches/live` contract proof **PASS** olmadan prod’a geçilmez.

### Deliverables

#### 5-S.1: Staging Environment Definition
- **File:** `PHASE5_S_STAGING_ENV.md` (NEW)
- İçerik:
  - Staging URL/Domain
  - Log erişim yöntemi (örn: `/tmp/goalgpt-server.log` veya `logs/combined.log`)
  - Process manager (PM2 / systemd) seçimi
  - Secrets/ENV yönetimi (GitHub Secrets, secret manager)

#### 5-S.2: Staging Deploy Runbook
- **File:** `PHASE5_S_STAGING_DEPLOY_RUNBOOK.md` (NEW)
- İçerik:
  - Deploy komutu
  - Smoke test komutları
  - Rollback komutu

#### 5-S.3: 24h Observation Checklist (Golden-Day Proof)
- **File:** `PHASE5_S_24H_OBSERVATION.md` (NEW)
- Minimum kanıtlar:
  - Gün boyunca belirli aralıklarla `/api/matches/live` → `minute_text` contract PASS
  - `websocket.connected/subscribed` event’leri görülüyor
  - `dataupdate.changed` akışı görülüyor
  - `watchdog` olayları (varsa) deterministik ve güvenli

### Acceptance Criteria
- [ ] Staging deploy tamamlandı
- [ ] Staging `/ready` 200 ve “DB + TheSports config OK”
- [ ] `minute_text` contract PASS (en az 3 ayrı zaman diliminde kanıt)
- [ ] 24 saat boyunca kritik error rate anomali yok
- [ ] Rollback prosedürü staging’de denenip kanıtlandı

### Files to Create
- `PHASE5_S_STAGING_ENV.md`
- `PHASE5_S_STAGING_DEPLOY_RUNBOOK.md`
- `PHASE5_S_24H_OBSERVATION.md`

---

## 5-3: Production Deploy (Controlled Rollout)

### Goal
Blue-green deployment ile production'a deploy. İlk 15 dakika monitoring, ilk 1 saat golden-day proof.

### Deliverables

#### 5-3.1: Blue-Green Deployment Script
- **File:** `scripts/deploy-blue-green.sh` (NEW)
- **Logic:**
  1. Green environment'ı deploy et (yeni version)
  2. Health check: `/ready` endpoint (200 OK)
  3. Smoke test: `/api/matches/live` contract check
  4. Traffic switch (blue → green)
  5. Blue environment'ı stop (eski version)

#### 5-3.2: First 15 Minutes Monitoring Checklist
- **File:** `PHASE5_3_FIRST_15_MIN_MONITORING.md` (NEW)
- **Checks:**
  - `/ready` endpoint: 200 OK (every 30s)
  - `websocket.connected` event: logs'da görünüyor mu
  - `websocket.subscribed` event: logs'da görünüyor mu
  - `dataupdate.changed` event: logs'da görünüyor mu
  - `watchdog.reconcile.done` event: logs'da görünüyor mu
  - Error rate: < 0.1% (5xx errors)
- **Proof Commands:**
  ```bash
  # Every 30s
  curl -s ${PROD_BASE_URL}/ready | jq .ok
  tail -100 ${LOG_PATH} | grep -E "websocket.connected|websocket.subscribed|dataupdate.changed|watchdog.reconcile.done"
  ```

#### 5-3.3: First 1 Hour Golden-Day Proof
- **File:** `PHASE5_3_FIRST_HOUR_GOLDEN_DAY.md` (NEW)
- **Goal:** Canlı gün akışıyla DB → API → UI chain proof
- **Checks:**
  - Live matches: DB'de var, API'de var, minute_text present
  - Diary matches: DB'de var, API'de var, minute_text present
  - Watchdog recovery: Stale match detection çalışıyor mu
  - Minute engine: Minute calculation çalışıyor mu
- **Proof Commands:**
  ```bash
  # Live endpoint contract
  curl -s ${PROD_BASE_URL}/api/matches/live | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const m=(j.data?.results)||(j.results)||[]; const bad=m.filter(x=>!x.minute_text); if(bad.length){console.error('FAIL',bad.length);process.exit(1);} console.log('PASS',m.length);"
  
  # Watchdog events
  tail -1000 ${LOG_PATH} | grep -E "watchdog.stale_detected|watchdog.reconcile.enqueued"
  ```

#### 5-3.4: Rollback Plan
- **File:** `PHASE5_3_ROLLBACK_PLAN.md` (NEW)
- **Trigger Conditions:**
  - `/ready` endpoint fails (503)
  - Error rate > 1%
  - `minute_text` contract broken
  - Critical bug (data corruption)
- **Rollback Steps:**
  1. Traffic switch (green → blue)
  2. Green environment stop
  3. Verification: Blue environment `/ready` OK
  4. Root cause analysis (RCA)

### Acceptance Criteria
- [ ] Blue-green deployment script oluşturuldu
- [ ] First 15 minutes monitoring checklist hazır
- [ ] First 1 hour golden-day proof planı hazır
- [ ] Rollback plan dokümante edildi
- [ ] Production deploy başarılı (GO decision)

### Files to Create
- `scripts/deploy-blue-green.sh` (NEW)
- `PHASE5_3_FIRST_15_MIN_MONITORING.md` (NEW)
- `PHASE5_3_FIRST_HOUR_GOLDEN_DAY.md` (NEW)
- `PHASE5_3_ROLLBACK_PLAN.md` (NEW)

---

## 5-4: Post-Deploy Monitoring & Alerting

### Goal
Observability contract (Phase 4-1) üzerinden Prometheus-based alerting kur. Critical events için alarm threshold'ları tanımla.

### Deliverables

#### 5-4.1: Prometheus Metrics Export
- **Action:** Fastify'da Prometheus metrics endpoint ekle
- **File:** `src/routes/metrics.routes.ts` (NEW)
- **Metrics:**
  - `http_requests_total` (counter)
  - `http_request_duration_seconds` (histogram)
  - `db_connections_active` (gauge)
  - `websocket_connected` (gauge: 0 or 1)
  - `watchdog_stale_detected_total` (counter)
  - `dataupdate_changed_total` (counter)
- **Package:** `prom-client` (npm install)

#### 5-4.2: Alert Rules Definition
- **File:** `PHASE5_4_PROMETHEUS_ALERT_RULES.yml` (NEW)
- **Alerts:**
  - `MatchStaleMarkedHigh`: `rate(match_stale_marked_total[5m]) > 0.1` (5 dakikada 1'den fazla stale match marked)
  - `WebSocketDisconnectedLong`: `websocket_connected == 0` for 5 minutes
  - `DataUpdateStalled`: `rate(dataupdate_changed_total[10m]) == 0` (10 dakika boyunca dataupdate.changed yok)
  - `DBLatencyHigh`: `histogram_quantile(0.95, http_request_duration_seconds{endpoint="/api/matches/live"}) > 1` (p95 latency > 1s)
  - `ErrorRateHigh`: `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01` (error rate > 1%)

#### 5-4.3: On-Call Checklist
- **File:** `PHASE5_4_ON_CALL_CHECKLIST.md` (NEW)
- **Content:**
  - Alert received → immediate actions
  - Log investigation commands
  - Rollback decision criteria
  - Escalation process

### Acceptance Criteria
- [ ] Prometheus metrics endpoint oluşturuldu (`/metrics`)
- [ ] Alert rules tanımlandı (`PHASE5_4_PROMETHEUS_ALERT_RULES.yml`)
- [ ] Prometheus scraping çalışıyor (test edildi)
- [ ] Alert rules Prometheus'da aktif
- [ ] On-call checklist hazır

### Files to Create
- `src/routes/metrics.routes.ts` (NEW)
- `src/controllers/metrics.controller.ts` (NEW)
- `PHASE5_4_PROMETHEUS_ALERT_RULES.yml` (NEW)
- `PHASE5_4_ON_CALL_CHECKLIST.md` (NEW)

---

## Dependencies & Prerequisites

### Configuration Inputs (Phase 5 başlamadan kilitlenecek)
- **CI/CD:** GitHub Actions (seçildi)
- **Monitoring/Alerting:** Prometheus + Grafana (seçildi)
- **Deploy strategy (Prod):** Blue-Green (seçildi)
- **Staging URL:** <FILL>
- **Prod URL:** <FILL>
- **LOG_PATH (staging/prod):** <FILL> (örn: `/tmp/goalgpt-server.log` veya `logs/combined.log`)
- **Process manager:** <FILL> (PM2 veya systemd)

### Phase 5-0 Prerequisites
- WS5 Release Gate PASS
- All Phase 4-5 workstreams complete

### Phase 5-1 Prerequisites
- Phase 5-0 complete (RC1 tag)
- Node.js LTS version seçimi (20.x veya 22.x)

### Phase 5-2 Prerequisites
- Phase 5-1 complete (Node.js pinned)
- GitHub Actions access
- Repository'de `.github/workflows/` directory oluşturulabilir

### Phase 5-3 Prerequisites
- Phase 5-2 complete (CI pipeline PASS)
- Blue-green deployment infrastructure hazır
- Production environment access

### Phase 5-4 Prerequisites
- Phase 5-3 complete (Production deploy successful)
- Prometheus + Grafana infrastructure hazır
- Alertmanager configured

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Node.js version mismatch (local vs prod) | High | Phase 5-1: `.nvmrc` pinning + verification |
| CI pipeline fails on PR | Medium | Phase 5-2: Minimum gates, touched files clean check |
| Blue-green deployment failure | High | Phase 5-3: Rollback plan + monitoring |
| Missing alerts (critical events) | Medium | Phase 5-4: Alert rules definition + on-call checklist |
| Production config drift | Medium | Phase 5-0: Config freeze + PR process |

---

## Proof Commands Summary

### 5-0: RC Freeze
```bash
# RC1 tag creation
git tag -a v5.0.0-rc1 -m "Phase 5 Release Candidate 1"
git push origin v5.0.0-rc1
```

### 5-1: Production Parity
```bash
# Node.js version pinning
echo "20.18.0" > .nvmrc
nvm use
node -v  # Should show v20.18.0
```

### 5-2: CI Pipeline
```bash
# Local CI test
npm ci
npm run typecheck
npm run test:phase3a
npm run test:phase3b-minute
npm run test:phase3b-watchdog
# Smoke test (server must be running)
curl -s http://localhost:3000/ready | jq .ok
curl -s http://localhost:3000/api/matches/live | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const m=(j.data?.results)||(j.results)||[]; const bad=m.filter(x=>!x.minute_text); if(bad.length){console.error('FAIL',bad.length);process.exit(1);} console.log('PASS',m.length);"
```

> ⚠️ Prod proof komutlarında base URL **localhost olmayacak**. `${PROD_BASE_URL}` kullanın.

### 5-3: Production Deploy
```bash
# Blue-green deployment
./scripts/deploy-blue-green.sh

# First 15 min monitoring
watch -n 30 'curl -s ${PROD_BASE_URL}/ready | jq .ok'
tail -f ${LOG_PATH} | grep -E "websocket.connected|dataupdate.changed"
```

### 5-4: Monitoring
```bash
# Prometheus metrics
curl -s http://localhost:3000/metrics | grep -E "http_requests_total|websocket_connected"
```

---

## Acceptance Criteria (Overall Phase 5)

- [ ] Phase 5-0: RC1 tag oluşturuldu, code + config freeze
- [ ] Phase 5-1: Node.js LTS pinned, production parity
- [ ] Phase 5-2: CI pipeline minimum gates PASS
- [ ] Phase 5-3: Production deploy successful, first 15 min + 1 hour monitoring PASS
- [ ] Phase 5-4: Prometheus alerting active, on-call checklist ready

---

**End of Phase 5 Production Cutover & Stabilization Plan**

