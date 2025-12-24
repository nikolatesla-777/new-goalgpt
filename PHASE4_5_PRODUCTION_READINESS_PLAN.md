# Phase 4-5: Production Readiness Plan

**Date:** 2025-12-22  
**Phase:** 4-5 (Production Readiness)  
**Status:** 📋 **PLAN** — Implementation pending

---

## A) Scope & Non-goals

### Scope

Phase 4-5, sistemin production ortamına deploy edilmeden önce gerekli tüm hazırlık adımlarını kapsar:

- **Performance & Load Testing:** Endpoint latency, throughput, resource utilization
- **Reliability Verification:** Failure mode testing, circuit breaker, MQTT reconnection
- **Observability Setup:** Dashboard/alert tanımları, log query örnekleri
- **Data Integrity Checks:** DB health, index verification, constraint validation
- **Security Audit:** Secret leakage, env var audit
- **Operational Runbook:** Restart, validation, diagnosis prosedürleri
- **Release Gate:** Go/No-Go kriterleri ve final checklist

### Non-goals

- **UI minute calculation:** Phase 4-4'te kaldırıldı, tekrar eklenmeyecek
- **Yeni feature development:** Sadece production readiness, yeni özellik yok
- **Database schema changes:** Mevcut schema üzerinde çalışılacak
- **Provider API değişiklikleri:** TheSports API entegrasyonu Phase 4-2'de tamamlandı
- **Frontend değişiklikleri:** UI sadece renderer, Phase 4-4'te tamamlandı

### Architecture Constraints

- **DB-only controllers:** Tüm endpoint'ler DB'den okur, API fallback yok
- **Backend-minute-authoritative:** `minute_text` backend'den gelir, frontend hesaplamaz
- **Phase 4-3 SLA rules:** Stale detection kuralları değiştirilmeyecek
- **Phase 4-2 resilience:** Circuit breaker, retry, timeout mekanizmaları korunacak

---

## B) Preconditions

Phase 4-5'e başlamadan önce aşağıdakilerin tamamlanmış olması gerekir:

### Phase 4-4 Completion

- ✅ **Proof 5 PASS:** `/api/matches/live` endpoint'inde tüm maçlar `minute_text` içeriyor
  - **Proof:** `curl -s http://localhost:3000/api/matches/live | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf-8')); const m=(j.data?.results)||(j.results)||[]; const missing=m.filter(x=>!x.minute_text); if(missing.length){console.error('FAIL',missing.length);process.exit(1);} console.log('PASS',m.length);"`
  - **Expected:** `✅ PASS all matches minute_text present: X`

### Phase 4-3 Completion

- ✅ **Freeze Detection Active:** `MatchFreezeDetectionWorker` çalışıyor
  - **Proof:** `rg -n "match.stale.detected" src/jobs/matchFreezeDetection.job.ts`
  - **Expected:** Event logging kodunda mevcut

- ✅ **Watchdog Evidence:** Stale match recovery logları görülebiliyor
  - **Proof:** `rg -n "watchdog.*stale" src/jobs/matchWatchdog.job.ts`

### Phase 4-2 Completion

- ✅ **Circuit Breaker Active:** Provider resilience mekanizması çalışıyor
  - **Proof:** `rg -n "CircuitOpenError\|circuit.*open" src/services/thesports/client/`
  - **Expected:** Circuit breaker implementation mevcut

### Infrastructure

- ✅ **Database:** PostgreSQL bağlantısı çalışıyor
- ✅ **Redis (if used):** Cache servisi erişilebilir
- ✅ **MQTT:** WebSocket client bağlantısı aktif
- ✅ **Server:** `npm run dev` veya `npm start` ile başlatılabiliyor

---

## C) Workstreams

### 4.1 Performance & Load Testing

**Hedef:** Endpoint'lerin p95 latency ve throughput metriklerini ölçmek, resource utilization'ı izlemek.

#### Checklist Items

1. **Load testing tool kurulumu**
   - **Önerilen:** `npm install -D autocannon` (Node.js uyumlu, kolay kurulum)
   - **Opsiyonel:** k6 (binary olarak kurulur: `brew install k6` veya `sudo apt-get install k6` - npm ile kurulmaz)
   - Load test script'leri için dizin oluştur: `scripts/load-test/`

2. **Test senaryoları tanımla**
   - `/api/matches/live`: 50 concurrent, 30s duration
   - `/api/matches/diary?date=YYYYMMDD` veya `/api/matches/diary?date=YYYY-MM-DD`: 20 concurrent, 30s duration (her iki format denenecek)
   - `/api/matches/recent?page=1&limit=50`: 30 concurrent, 30s duration

3. **Hedef metrikler belirle**
   - p95 latency: `/api/matches/live` < 500ms, `/api/matches/diary` < 300ms, `/api/matches/recent` < 400ms
   - Error rate: < 0.1% (5xx errors)
   - Throughput: Minimum 100 req/s (live endpoint)

4. **Resource monitoring setup**
   - CPU/Memory tracking: `top -p $(pgrep -f "tsx.*server.ts")` veya `htop`
   - DB connection pool monitoring: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'goalgpt';`

5. **Baseline ölçümü al**
   - Boş sistemde (0 live match) endpoint latency'leri ölç
   - 100+ live match senaryosunda tekrar ölç

6. **Cache hit rate ölçümü**
   - Cache miss durumunda latency artışını ölç
   - Cache TTL'lerinin uygunluğunu doğrula

7. **Concurrent request handling test**
   - 100+ concurrent request ile server stability testi
   - Memory leak kontrolü (heap snapshot karşılaştırması)

8. **Database query performance**
   - Slow query log analizi: `SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;`
   - Index usage verification: `EXPLAIN ANALYZE` ile query plan kontrolü

#### Acceptance Criteria

- [ ] Tüm endpoint'ler p95 latency hedeflerini karşılıyor
- [ ] Error rate < 0.1% (5xx errors)
- [ ] CPU usage < 80% (sustained load altında)
- [ ] Memory usage stabil (memory leak yok)
- [ ] DB connection pool exhaustion yok

#### Proof Commands

```bash
# autocannon kullanımı (önerilen)
autocannon -c 50 -d 30 http://localhost:3000/api/matches/live

# autocannon ile diary endpoint (date format fallback: önce YYYY-MM-DD, sonra YYYYMMDD)
TODAY_DASH=$(date +%Y-%m-%d)
TODAY_NO_DASH=$(date +%Y%m%d)
autocannon -c 20 -d 30 "http://localhost:3000/api/matches/diary?date=$TODAY_DASH" || autocannon -c 20 -d 30 "http://localhost:3000/api/matches/diary?date=$TODAY_NO_DASH"

# autocannon ile recent endpoint
autocannon -c 30 -d 30 "http://localhost:3000/api/matches/recent?page=1&limit=50"

# k6 kullanımı (opsiyonel, binary kurulumu gerekir)
# k6 run scripts/load-test/live-endpoint.js

# CPU/Memory monitoring
top -p $(pgrep -f "tsx.*server.ts") -n 1 | grep -E "PID|%CPU|%MEM"

# DB connection count
psql -U postgres -d goalgpt -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'goalgpt';"
```

---

### 4.2 Reliability / Failure Modes

**Hedef:** Provider timeout/retry/circuit breaker, MQTT reconnect, stale match recovery davranışlarını doğrulamak.

#### Checklist Items

1. **Circuit Breaker verification**
   - Circuit open durumunda graceful degradation testi
   - Half-open state transition testi
   - Circuit breaker log event'lerini doğrula: `rg -n "circuit.*open\|CircuitOpenError" src/`

2. **Provider timeout/retry test**
   - HTTP timeout (5s) testi: TheSports API'ye yavaş response simüle et
   - Retry mekanizması testi: Network error simülasyonu
   - Exponential backoff doğrulama: Retry delay'lerini log'dan kontrol et

3. **MQTT reconnect behavior**
   - MQTT bağlantı kopması simülasyonu
   - Reconnect attempt log'larını doğrula: `rg -n "websocket.*reconnect\|mqtt.*reconnect" src/`
   - Message count logging: Her 100 mesaj veya 30s'de bir aggregated log

4. **Stale match recovery test**
   - `MatchFreezeDetectionWorker` cooldown davranışı
   - Reconcile skip durumları (circuit open, cooldown) log'larını doğrula
   - `match.stale.marked` event'inin doğru koşullarda atıldığını doğrula

5. **Watchdog behavior verification**
   - Stale live match'lerin otomatik reconcile edildiğini doğrula
   - HALF_TIME stuck detection (900s threshold) testi
   - SECOND_HALF no progress detection (180s threshold) testi

6. **Database connection failure handling**
   - DB bağlantı kopması simülasyonu
   - Connection pool recovery testi
   - Error response format doğrulama (500 vs 503)

7. **Concurrent request failure handling**
   - Aynı match için concurrent reconcile attempt'lerin deduplication'ı
   - Optimistic locking conflict handling

8. **Graceful shutdown**
   - SIGTERM/SIGINT handling: Worker'ların düzgün durması
   - In-flight request'lerin tamamlanması

#### Acceptance Criteria

- [ ] Circuit breaker open durumunda sistem crash etmiyor, graceful degradation var
- [ ] MQTT reconnect başarılı (max 3 attempt, exponential backoff)
- [ ] Stale match detection çalışıyor, cooldown mekanizması spam önlüyor
- [ ] Watchdog stale match'leri otomatik reconcile ediyor
- [ ] Provider timeout/retry mekanizması çalışıyor (max 2 retry, 5s timeout)

#### Proof Commands

```bash
# Circuit breaker event logs
rg -n "circuit.*open\|CircuitOpenError" src/ | head -5

# MQTT reconnect logs
rg -n "websocket.*reconnect\|mqtt.*reconnect" src/services/thesports/websocket/

# Stale detection events
rg -n "match.stale.detected\|match.stale.reconcile\|match.stale.marked" src/jobs/matchFreezeDetection.job.ts

# Forced failure simulation (manual test)
# 1. TheSports API'yi geçici olarak unreachable yap (iptables/firewall)
# 2. Circuit breaker'in open olduğunu log'dan doğrula
# 3. API'yi tekrar aç, half-open transition'ı gözle
```

---

### 4.3 Observability & Alerting

**Hedef:** obsLogger event'lerine dayalı dashboard/alert tanımları, log query örnekleri.

#### Checklist Items

1. **Event catalogue dokümantasyonu**
   - Tüm `logEvent()` çağrılarını liste: `rg -n "logEvent\(" src/ | wc -l`
   - Event isimlerini çıkar: `rg -o "logEvent\([^,]+,\s*['\"]([^'\"]+)" src/ | sort -u`

2. **Critical event'ler belirle**
   - `worker.started`: Her worker tick'inde
   - `dataupdate.changed`: Match data değişikliği
   - `dataupdate.reconcile.*`: Reconcile attempt/success/failure
   - `websocket.connected/subscribed`: MQTT bağlantı durumu
   - `watchdog.stale_detected`: Stale match tespiti
   - `minute_engine.tick`: Minute calculation tick

3. **Alert threshold'ları tanımla**
   - Reconcile error rate: > 10% (5 dakika window)
   - WebSocket disconnect: > 3 disconnect/hour
   - Stale match rate: > 5% of live matches (10 dakika window)
   - Worker tick failure: > 3 consecutive failures

4. **Log query örnekleri**
   - Structured log format: `{"service":"goalgpt-dashboard","component":"worker","event":"worker.started",...}`
   - Event bazlı filtreleme: `rg "event.*worker.started" logs/app.log`
   - Time range query: `rg "ts.*17[0-9]{8}" logs/app.log` (Unix timestamp)

5. **Dashboard metrikleri**
   - Request rate: `/api/matches/live`, `/api/matches/diary`, `/api/matches/recent`
   - Error rate: 4xx, 5xx response count
   - Worker health: `worker.started` event frequency
   - MQTT health: `websocket.connected` vs `websocket.disconnected` ratio

6. **Sample log lines dokümante et**
   - Her critical event için örnek JSON log satırı
   - Field açıklamaları (match_id, status_id, age_sec, vb.)

7. **Alerting rules yaz**
   - PagerDuty/Slack integration için alert format
   - Severity levels: critical, warning, info

#### Acceptance Criteria

- [ ] Tüm critical event'ler dokümante edildi
- [ ] Alert threshold'ları tanımlandı ve test edilebilir
- [ ] Log query örnekleri çalışıyor (ripgrep ile)
- [ ] Sample log lines dokümante edildi

#### Proof Commands

```bash
# Event catalogue
rg -o "logEvent\([^,]+,\s*['\"]([^'\"]+)" src/ | sort -u | head -20

# Critical events grep
rg -n "worker.started\|dataupdate.changed\|websocket.connected\|watchdog.stale_detected" src/

# Sample log query (structured JSON)
rg "event.*worker.started" logs/app.log | head -1 | jq .

# Event frequency (example)
rg "event.*dataupdate.reconcile" logs/app.log | wc -l
```

---

### 4.4 Data Integrity & DB Health

**Hedef:** Index verification, row growth, constraint validation, JSONB sanity checks.

#### Checklist Items

1. **Index verification**
   - Tüm critical index'lerin mevcut olduğunu doğrula: `\d+ ts_matches` (psql)
   - Index usage stats: `SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public' AND indexrelname LIKE '%ts_matches%';`
   - Missing index'leri tespit et: Slow query log analizi

2. **Row growth monitoring**
   - `ts_matches` tablo boyutu: `SELECT pg_size_pretty(pg_total_relation_size('ts_matches'));`
   - Günlük row growth rate: `SELECT DATE(created_at), COUNT(*) FROM ts_matches GROUP BY DATE(created_at) ORDER BY DATE DESC LIMIT 7;`
   - Archive strategy: Eski match'lerin (status=8, match_time < now - 90 days) silinmesi/archive edilmesi

3. **Constraint validation**
   - Foreign key constraints: `SELECT conname, conrelid::regclass, confrelid::regclass FROM pg_constraint WHERE contype = 'f' AND conrelid::regclass::text LIKE '%ts_%';`
   - NOT NULL constraints: `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'ts_matches' AND is_nullable = 'NO';`
   - Check constraints: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE contype = 'c' AND conrelid::regclass::text = 'ts_matches';`

4. **JSONB field sanity**
   - `home_scores`, `away_scores` JSONB field'lerinin valid JSON olduğunu doğrula
   - JSONB key'lerinin beklenen format'ta olduğunu kontrol et: `SELECT external_id, home_scores->>'0' as home_score FROM ts_matches WHERE home_scores IS NOT NULL LIMIT 10;`

5. **Required contract fields**
   - `minute_text` contract: Tüm live match'lerde `minute_text` null olmamalı (Phase 4-4)
   - `updated_at` field: Tüm match'lerde mevcut olmalı
   - `status_id` distribution: Beklenen status dağılımı (1=NOT_STARTED, 2=FIRST_HALF, 3=HALF_TIME, 4=SECOND_HALF, 8=END)

6. **Data consistency checks**
   - Orphaned records: `SELECT COUNT(*) FROM ts_matches m LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id WHERE m.home_team_id IS NOT NULL AND ht.external_id IS NULL;`
   - Duplicate external_id: `SELECT external_id, COUNT(*) FROM ts_matches GROUP BY external_id HAVING COUNT(*) > 1;`

7. **Vacuum/Analyze considerations**
   - Table bloat: `SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables WHERE tablename = 'ts_matches';`
   - Auto-vacuum settings: `SELECT * FROM pg_settings WHERE name LIKE 'autovacuum%';`

8. **Backup verification**
   - Backup dosyasının restore edilebilir olduğunu doğrula
   - Point-in-time recovery (PITR) testi (eğer aktifse)

#### Acceptance Criteria

- [ ] Tüm critical index'ler mevcut ve kullanılıyor
- [ ] Row growth rate makul (< 10K rows/day)
- [ ] Constraint violations yok
- [ ] JSONB field'ler valid
- [ ] Required contract fields (minute_text, updated_at) null değil
- [ ] Orphaned records yok (veya minimal, acceptable)

#### Proof Commands

```bash
# Index verification
psql -U postgres -d goalgpt -c "\d+ ts_matches" | grep -E "Index|idx_"

# Index usage stats
psql -U postgres -d goalgpt -c "SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes WHERE schemaname = 'public' AND indexrelname LIKE '%ts_matches%';"

# Table size
psql -U postgres -d goalgpt -c "SELECT pg_size_pretty(pg_total_relation_size('ts_matches'));"

# Row count by status
psql -U postgres -d goalgpt -c "SELECT status_id, COUNT(*) FROM ts_matches GROUP BY status_id ORDER BY status_id;"

# minute_text null check (should be 0 for live matches)
psql -U postgres -d goalgpt -c "SELECT COUNT(*) FROM ts_matches WHERE status_id IN (2,3,4,5,7) AND minute_text IS NULL;"

# JSONB sanity
psql -U postgres -d goalgpt -c "SELECT external_id, jsonb_typeof(home_scores) FROM ts_matches WHERE home_scores IS NOT NULL LIMIT 5;"
```

---

### 4.5 Security & Secrets

**Hedef:** Env var audit, secret leakage kontrolü, güvenlik best practices.

#### Checklist Items

1. **Env var audit**
   - Tüm env var'ları liste: `rg -o "process\.env\.[A-Z_]+" src/ | sort -u`
   - Required vs optional env var'ları dokümante et
   - `.env.example` dosyasının güncel olduğunu doğrula (sensitive değerler olmadan)

2. **Secret leakage check**
   - Hardcoded secrets: `rg -i "password|secret|api_key|token" src/ | grep -v "process.env" | grep -v "//.*example" | grep -v "\.env"`
   - Git history'de secret leakage: `git log --all --full-history --source -- "*.env" "*.key" "*.pem"`
   - `.env` dosyasının `.gitignore`'da olduğunu doğrula

3. **API key rotation planı**
   - TheSports API key rotation prosedürü
   - MQTT credentials rotation prosedürü
   - DB password rotation prosedürü

4. **CORS configuration**
   - CORS origin whitelist kontrolü: `rg -n "origin.*\*" src/server.ts` (production'da wildcard olmamalı)
   - Allowed methods/headers kontrolü

5. **Input validation**
   - SQL injection risk: Parameterized query kullanımı: `rg -n "pool\.query\([^,]+,\s*\[" src/ | wc -l`
   - XSS risk: Frontend'de user input sanitization (Phase 4-4'te frontend renderer-only, risk düşük)

6. **Dependency security audit**
   - `npm audit` çalıştır: `npm audit --production`
   - Critical/high severity vulnerability'leri liste
   - Outdated dependency'leri kontrol et: `npm outdated`

7. **Logging sensitive data**
   - Log'larda secret leakage: `rg -i "password|secret|api_key" logs/app.log` (eğer log dosyası varsa)
   - Error message'lerde stack trace'lerde sensitive data kontrolü

8. **HTTPS/TLS configuration**
   - Production'da HTTPS zorunluluğu (reverse proxy seviyesinde)
   - Certificate rotation planı

#### Acceptance Criteria

- [ ] Hardcoded secret yok
- [ ] `.env` dosyası `.gitignore`'da
- [ ] `npm audit` critical/high vulnerability yok (veya documented exception)
- [ ] CORS production'da wildcard değil
- [ ] Tüm SQL query'ler parameterized

#### Proof Commands

```bash
# Env var audit
rg -o "process\.env\.[A-Z_]+" src/ | sort -u

# Secret leakage check
rg -i "password|secret|api_key|token" src/ | grep -v "process.env" | grep -v "//.*example" | grep -v "\.env"

# .gitignore check
grep -E "\.env|\.key|\.pem" .gitignore

# SQL injection risk (parameterized queries)
rg -n "pool\.query\([^,]+,\s*\[" src/ | wc -l

# Dependency audit
npm audit --production

# CORS wildcard check
rg -n "origin.*\*" src/server.ts
```

---

### 4.6 Operational Runbook

**Hedef:** Restart, validation, diagnosis prosedürleri, exact commands ve "good" görünüm tanımları.

#### Checklist Items

1. **Server restart prosedürü**
   - Graceful shutdown: `kill -SIGTERM $(pgrep -f "tsx.*server.ts")`
   - Worker'ların düzgün durması: Log'da `worker.stopped` event'leri
   - Restart: `npm run start` veya `npm run dev`
   - Health check: `curl http://localhost:3000/api/matches/live` (200 OK)

2. **Live validation prosedürü**
   - Proof 5 çalıştır: `curl -s http://localhost:3000/api/matches/live | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf-8')); const m=(j.data?.results)||(j.results)||[]; const missing=m.filter(x=>!x.minute_text); if(missing.length){console.error('FAIL',missing.length);process.exit(1);} console.log('PASS',m.length);"`
   - Expected: `✅ PASS all matches minute_text present: X`
   - Live match count kontrolü: `psql -U postgres -d goalgpt -c "SELECT COUNT(*) FROM ts_matches WHERE status_id IN (2,3,4,5,7);"`

3. **Freeze diagnosis prosedürü**
   - Stale match tespiti: `rg "match.stale.detected" logs/app.log | tail -10`
   - Reconcile attempt log'ları: `rg "match.stale.reconcile" logs/app.log | tail -10`
   - Watchdog log'ları: `rg "watchdog.*stale" logs/app.log | tail -10`
   - Manual reconcile: `curl -X POST http://localhost:3000/api/matches/reconcile/{match_id}` (eğer endpoint varsa)

4. **Provider issue diagnosis**
   - Circuit breaker durumu: `rg "circuit.*open\|CircuitOpenError" logs/app.log | tail -5`
   - API error rate: `rg "dataupdate.*error\|reconcile.*error" logs/app.log | tail -10`
   - MQTT connection status: `rg "websocket.*connected\|websocket.*disconnected" logs/app.log | tail -5`

5. **Database health check**
   - Connection count: `psql -U postgres -d goalgpt -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'goalgpt';"`
   - Lock detection: `psql -U postgres -d goalgpt -c "SELECT * FROM pg_locks WHERE NOT granted;"`
   - Slow query detection: `psql -U postgres -d goalgpt -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5;"`

6. **Worker health check**
   - Worker start log'ları: `rg "worker.started" logs/app.log | tail -20`
   - Worker failure detection: `rg "worker.*error\|worker.*failed" logs/app.log | tail -10`
   - Worker tick frequency: Her worker için expected frequency vs actual

7. **Cache health check**
   - Cache hit rate: Redis stats (eğer kullanılıyorsa)
   - Cache invalidation: Manual cache clear prosedürü

8. **Rollback prosedürü**
   - Previous version'a dönüş: Git tag/commit ile rollback
   - Database migration rollback: `npm run migrate:rollback` (eğer varsa)
   - Verification: Proof 5 ve health check'ler

#### Acceptance Criteria

- [ ] Tüm prosedürler dokümante edildi
- [ ] Her prosedür için exact commands mevcut
- [ ] "Good" görünüm tanımları mevcut (expected output örnekleri)
- [ ] Rollback prosedürü test edildi

#### Proof Commands

```bash
# Server restart
kill -SIGTERM $(pgrep -f "tsx.*server.ts")
sleep 5
npm run start &
sleep 10
curl http://localhost:3000/api/matches/live

# Live validation (Proof 5)
curl -s http://localhost:3000/api/matches/live | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf-8')); const m=(j.data?.results)||(j.results)||[]; const missing=m.filter(x=>!x.minute_text); if(missing.length){console.error('FAIL',missing.length);process.exit(1);} console.log('PASS',m.length);"

# Freeze diagnosis
rg "match.stale.detected" logs/app.log | tail -10

# Provider issue
rg "circuit.*open" logs/app.log | tail -5

# DB health
psql -U postgres -d goalgpt -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'goalgpt';"
```

---

### 4.7 Release Gate (Go/No-Go) ✅ COMPLETE

**Hedef:** Production deploy öncesi final checklist, hard gates.

#### Checklist Items

1. **Phase 4-4 Proof 5 PASS**
   - `/api/matches/live` endpoint'inde tüm maçlar `minute_text` içeriyor
   - **Gate:** Proof 5 komutu PASS dönmeli

2. **Golden Day PASS**
   - December 22, 2025 (veya belirlenen test günü) için DB → API → UI chain doğrulandı
   - **Gate:** Golden Day test script'i PASS dönmeli

3. **Watchdog Evidence**
   - Stale match detection çalışıyor, log'larda `match.stale.detected` event'leri görülüyor
   - **Gate:** Son 24 saatte en az 1 stale detection event'i (veya 0 stale match varsa acceptable)

4. **Minute Engine Invariant**
   - Minute engine `updated_at` field'ını update etmiyor (Phase 3B invariant)
   - **Gate:** `rg -n "updated_at.*=" src/jobs/matchMinute.job.ts` (sadece read, write yok)

5. **Provider Resilience Evidence**
   - Circuit breaker çalışıyor, log'larda circuit open/close event'leri görülüyor
   - **Gate:** Circuit breaker implementation mevcut, test edildi

6. **Performance Gates**
   - p95 latency hedefleri karşılandı (4.1 workstream)
   - Error rate < 0.1%
   - **Gate:** Load test sonuçları hedefleri karşılıyor

7. **Data Integrity Gates**
   - `minute_text` null check: Live match'lerde null yok
   - Index'ler mevcut ve kullanılıyor
   - **Gate:** SQL proof komutları PASS

8. **Security Gates**
   - `npm audit` critical/high vulnerability yok
   - Hardcoded secret yok
   - **Gate:** Security audit PASS

9. **Observability Gates**
   - Critical event'ler log'lanıyor
   - Alert threshold'ları tanımlandı
   - **Gate:** Log query örnekleri çalışıyor

10. **Operational Readiness**
    - Runbook dokümante edildi
    - Rollback prosedürü test edildi
    - **Gate:** Runbook prosedürleri çalışıyor

#### Final Gate Checklist

```markdown
## Production Release Gate Checklist

### Hard Gates (Must Pass)
- [ ] **Proof 5 PASS:** `/api/matches/live` minute_text contract enforced
- [ ] **Golden Day PASS:** DB → API → UI chain verified
- [ ] **Watchdog Evidence:** Stale detection active
- [ ] **Minute Engine Invariant:** No updated_at mutations
- [ ] **Provider Resilience:** Circuit breaker active
- [ ] **Performance:** p95 latency targets met
- [ ] **Data Integrity:** minute_text null check PASS, indexes verified
- [ ] **Security:** npm audit PASS, no hardcoded secrets
- [ ] **Observability:** Critical events logging
- [ ] **Operational:** Runbook complete, rollback tested

### Soft Gates (Should Pass)
- [ ] Load test completed (100+ concurrent requests)
- [ ] MQTT reconnect tested
- [ ] Cache hit rate acceptable
- [ ] DB connection pool healthy

### Go/No-Go Decision
- **Go:** All hard gates PASS
- **No-Go:** Any hard gate FAIL → Fix and re-test
```

#### Acceptance Criteria

- [ ] Tüm hard gates PASS
- [ ] Final gate checklist dolduruldu
- [ ] Go/No-Go decision documented

---

## D) One-shot Local Verification

**Hedef:** Tek komutla tüm critical proof'ları çalıştıran bash script.

### Bash Script

```bash
#!/bin/bash
# Phase 4-5 One-shot Local Verification
# Usage: ./scripts/verify-production-readiness.sh

set -e

echo "🔍 Phase 4-5 Local Verification"
echo "================================"

# 1. Start server (if not running)
if ! curl -s http://localhost:3000/api/matches/live > /dev/null 2>&1; then
  echo "⚠️  Server not running, starting..."
  npm run start > /dev/null 2>&1 &
  SERVER_PID=$!
  sleep 10
  echo "✅ Server started (PID: $SERVER_PID)"
else
  echo "✅ Server already running"
fi

# 2. Proof 5: minute_text contract (live endpoint)
echo ""
echo "📋 Proof 5: minute_text contract (live)"
LIVE_RESULT=$(curl -s http://localhost:3000/api/matches/live | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf-8'));
const m=(j.data?.results)||(j.results)||[];
const missing=m.filter(x=>!x.minute_text);
if(missing.length){console.error('FAIL',missing.length);process.exit(1);}
console.log('PASS',m.length);
" 2>&1)
if [[ $LIVE_RESULT == *"PASS"* ]]; then
  echo "✅ $LIVE_RESULT"
else
  echo "❌ $LIVE_RESULT"
  exit 1
fi

# 3. Proof: minute_text contract (diary endpoint)
echo ""
echo "📋 Proof: minute_text contract (diary)"
TODAY_DASH=$(date +%Y-%m-%d)
TODAY_NO_DASH=$(date +%Y%m%d)
# Try YYYY-MM-DD first, fallback to YYYYMMDD if fails
DIARY_RESULT=$(curl -s "http://localhost:3000/api/matches/diary?date=$TODAY_DASH" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf-8'));
const m=(j.data?.results)||(j.results)||[];
const missing=m.filter(x=>!x.minute_text);
if(missing.length){console.error('FAIL',missing.length);process.exit(1);}
console.log('PASS',m.length);
" 2>&1)
if [[ $DIARY_RESULT != *"PASS"* ]]; then
  # Fallback to YYYYMMDD format
  DIARY_RESULT=$(curl -s "http://localhost:3000/api/matches/diary?date=$TODAY_NO_DASH" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf-8'));
const m=(j.data?.results)||(j.results)||[];
const missing=m.filter(x=>!x.minute_text);
if(missing.length){console.error('FAIL',missing.length);process.exit(1);}
console.log('PASS',m.length);
" 2>&1)
fi
if [[ $DIARY_RESULT == *"PASS"* ]]; then
  echo "✅ $DIARY_RESULT"
else
  echo "❌ $DIARY_RESULT"
  exit 1
fi

# 4. Proof: minute_text contract (recent endpoint)
echo ""
echo "📋 Proof: minute_text contract (recent)"
RECENT_RESULT=$(curl -s "http://localhost:3000/api/matches/recent?page=1&limit=50" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf-8'));
const m=(j.data?.results)||(j.results)||[];
const missing=m.filter(x=>!x.minute_text);
if(missing.length){console.error('FAIL',missing.length);process.exit(1);}
console.log('PASS',m.length);
" 2>&1)
if [[ $RECENT_RESULT == *"PASS"* ]]; then
  echo "✅ $RECENT_RESULT"
else
  echo "❌ $RECENT_RESULT"
  exit 1
fi

# 5. Proof: Critical observability events
echo ""
echo "📋 Proof: Critical observability events"
if [ -f "logs/app.log" ]; then
  WORKER_STARTED=$(rg -c "worker.started" logs/app.log 2>/dev/null || echo "0")
  DATAUPDATE_CHANGED=$(rg -c "dataupdate.changed" logs/app.log 2>/dev/null || echo "0")
  WEBSOCKET_CONNECTED=$(rg -c "websocket.connected" logs/app.log 2>/dev/null || echo "0")
  echo "  worker.started: $WORKER_STARTED"
  echo "  dataupdate.changed: $DATAUPDATE_CHANGED"
  echo "  websocket.connected: $WEBSOCKET_CONNECTED"
  if [ "$WORKER_STARTED" -gt "0" ] || [ "$DATAUPDATE_CHANGED" -gt "0" ] || [ "$WEBSOCKET_CONNECTED" -gt "0" ]; then
    echo "✅ Observability events found"
  else
    echo "⚠️  No observability events found (server may be newly started)"
  fi
else
  echo "⚠️  Log file not found (logs/app.log)"
fi

# 6. Proof: Circuit breaker implementation
echo ""
echo "📋 Proof: Circuit breaker implementation"
CIRCUIT_BREAKER=$(rg -c "CircuitOpenError\|circuit.*open" src/ 2>/dev/null || echo "0")
if [ "$CIRCUIT_BREAKER" -gt "0" ]; then
  echo "✅ Circuit breaker implementation found"
else
  echo "❌ Circuit breaker implementation not found"
  exit 1
fi

# 7. Proof: No hardcoded secrets
echo ""
echo "📋 Proof: No hardcoded secrets"
SECRETS=$(rg -i "password|secret|api_key|token" src/ | grep -v "process.env" | grep -v "//.*example" | grep -v "\.env" | wc -l)
if [ "$SECRETS" -eq "0" ]; then
  echo "✅ No hardcoded secrets found"
else
  echo "❌ Hardcoded secrets found: $SECRETS"
  exit 1
fi

echo ""
echo "✅ All proofs PASSED"
echo "================================"
echo "Phase 4-5 Local Verification: COMPLETE"
```

### Usage

```bash
# Make executable
chmod +x scripts/verify-production-readiness.sh

# Run verification
./scripts/verify-production-readiness.sh
```

### Expected Output

```
🔍 Phase 4-5 Local Verification
================================
✅ Server already running

📋 Proof 5: minute_text contract (live)
✅ PASS all matches minute_text present: 133

📋 Proof: minute_text contract (diary)
✅ PASS all matches minute_text present: 45

📋 Proof: minute_text contract (recent)
✅ PASS all matches minute_text present: 50

📋 Proof: Critical observability events
  worker.started: 15
  dataupdate.changed: 3
  websocket.connected: 1
✅ Observability events found

📋 Proof: Circuit breaker implementation
✅ Circuit breaker implementation found

📋 Proof: No hardcoded secrets
✅ No hardcoded secrets found

✅ All proofs PASSED
================================
Phase 4-5 Local Verification: COMPLETE
```

---

## E) Release/Rollback Checklist

### Pre-Release Checklist

- [ ] **Code freeze:** Tüm Phase 4-5 workstream'leri tamamlandı
- [ ] **Testing:** One-shot verification script PASS
- [ ] **Documentation:** Runbook, alert definitions, log queries dokümante edildi
- [ ] **Backup:** Database backup alındı
- [ ] **Release notes:** Değişiklikler dokümante edildi
- [ ] **Communication:** Team'e release planı bildirildi

### Release Steps

1. **Deploy to staging** (eğer varsa)
   - [ ] Staging environment'a deploy
   - [ ] Staging'de Proof 5 PASS
   - [ ] Staging'de load test PASS

2. **Production deploy**
   - [ ] Database migration (eğer varsa): `npm run migrate`
   - [ ] Code deploy: Git tag/commit deploy
   - [ ] Server restart: Graceful shutdown → Start
   - [ ] Health check: `curl http://localhost:3000/api/matches/live` (200 OK)

3. **Post-deploy verification**
   - [ ] Proof 5 PASS: `/api/matches/live` minute_text contract
   - [ ] Worker health: `rg "worker.started" logs/app.log | tail -5`
   - [ ] MQTT connection: `rg "websocket.connected" logs/app.log | tail -1`
   - [ ] Error rate: Log'larda 5xx error yok
   - [ ] Performance: p95 latency acceptable

### Rollback Checklist

**Trigger Conditions:**
- Proof 5 FAIL (minute_text contract broken)
- Error rate > 1%
- Critical bug (data corruption, security issue)

**Rollback Steps:**

1. **Immediate rollback**
   - [ ] Previous version'a git: `git checkout <previous-tag>`
   - [ ] Server restart: `kill -SIGTERM <pid>` → `npm run start`
   - [ ] Health check: `curl http://localhost:3000/api/matches/live`

2. **Database rollback** (eğer migration varsa)
   - [ ] Migration rollback: `npm run migrate:rollback` (eğer varsa)
   - [ ] Database integrity check: `psql -U postgres -d goalgpt -c "SELECT COUNT(*) FROM ts_matches;"`

3. **Verification**
   - [ ] Proof 5 PASS: minute_text contract
   - [ ] Error rate < 0.1%
   - [ ] Worker health: All workers started

4. **Post-rollback**
   - [ ] Root cause analysis (RCA) dokümante et
   - [ ] Fix plan oluştur
   - [ ] Re-test before re-deploy

---

## F) Risks & Mitigations

### Risk 1: Performance Degradation

**Risk:** Production load altında endpoint latency hedeflerini karşılayamama.

**Mitigation:**
- Load test staging'de çalıştır, production'a geçmeden önce doğrula
- Cache hit rate'i optimize et (TTL tuning)
- Database query optimization (index, EXPLAIN ANALYZE)
- Connection pool size tuning

**Detection:**
- p95 latency monitoring (alert threshold: > 500ms)
- Error rate monitoring (alert threshold: > 0.1%)

### Risk 2: Circuit Breaker False Positives

**Risk:** Circuit breaker gereksiz yere open olup sistemin degrade olması.

**Mitigation:**
- Circuit breaker threshold'larını conservative ayarla (5 consecutive failures, 60s window)
- Half-open state test request'i ile recovery'yi hızlandır
- Monitoring: Circuit open event'lerini alert et

**Detection:**
- `rg "circuit.*open" logs/app.log` frequency monitoring
- Alert: Circuit open > 3 times/hour

### Risk 3: Data Integrity Issues

**Risk:** `minute_text` null olması, orphaned records, constraint violations.

**Mitigation:**
- Proof 5 pre-deploy verification (hard gate)
- Database constraint'leri enforce et (NOT NULL, FOREIGN KEY)
- Regular data integrity checks (cron job)

**Detection:**
- Proof 5 script'i (her deploy öncesi)
- SQL integrity queries (daily cron)

### Risk 4: MQTT Connection Instability

**Risk:** MQTT bağlantısının sık kopması, real-time update'lerin kaçırılması.

**Mitigation:**
- Exponential backoff reconnect (max 3 attempts)
- Message queue buffering (eğer mümkünse)
- Fallback: Polling mechanism (eğer MQTT fail olursa)

**Detection:**
- `rg "websocket.disconnected" logs/app.log` frequency
- Alert: > 3 disconnects/hour

### Risk 5: Secret Leakage

**Risk:** Hardcoded secret'lar, `.env` dosyasının commit edilmesi.

**Mitigation:**
- Pre-commit hook: Secret pattern detection
- `.gitignore` enforcement
- Regular security audit (`npm audit`, secret scanning)

**Detection:**
- `rg -i "password|secret|api_key" src/` (pre-commit)
- Git history scan (quarterly)

### Risk 6: Rollback Complexity

**Risk:** Rollback sırasında database migration conflict, data loss.

**Mitigation:**
- Database migration'ları backward-compatible yap (ALTER TABLE ADD COLUMN, DROP COLUMN değil)
- Pre-deploy backup (mandatory)
- Rollback script test et (staging'de)

**Detection:**
- Rollback dry-run test (staging)
- Backup verification (restore test)

---

## Summary

Phase 4-5 Production Readiness planı, sistemin production'a deploy edilmeden önce gerekli tüm hazırlık adımlarını kapsar. 7 workstream (Performance, Reliability, Observability, Data Integrity, Security, Runbook, Release Gate) ile production readiness garantilenir. One-shot local verification script ile tek komutla tüm critical proof'lar çalıştırılabilir. Release/Rollback checklist'leri ile güvenli deploy prosedürleri tanımlanmıştır.

**Next Steps:**
1. Plan'ı review et
2. Workstream'leri sırayla implement et
3. One-shot verification script'i test et
4. Release gate checklist'i doldur
5. Production deploy

---

**End of Phase 4-5 Production Readiness Plan**

