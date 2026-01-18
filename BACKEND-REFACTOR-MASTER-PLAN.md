# 🏗️ GOALGPT BACKEND - MASTER REFACTOR PLAN
**AiScore Production-Grade Architecture**

**Tarih:** 17 Ocak 2026
**Hedef:** Işık hızında livescore + AI tahmin sistemi
**Prensip:** Basit, Hızlı, Güvenilir

---

## 📊 PHASE 1: MEVCUT DURUM ANALİZİ

### 1.1 WORKER ENVANTERI (33 WORKER!)

#### ❌ SİLİNECEK MATCH WORKERS (7/10):
1. **matchMinute.job.ts** (222 satır) → Dakika hesaplama MQTT'den gelecek
2. **matchFreezeDetection.job.ts** (291 satır) → Watchdog'a merge
3. **proactiveMatchStatusCheck.job.ts** (232 satır) → Watchdog'a merge
4. **matchDataSync.job.ts** (387 satır) → dataUpdate.job'a merge
5. **postMatchProcessor.job.ts** → Gereksiz, settlement auto
6. **lineupRefresh.job.ts** (216 satır) → On-demand API call
7. **dailyMatchSync.job.ts** (710 satır) → Basitleştirilecek

#### ✅ KALACAK MATCH WORKERS (3/10):
1. **matchSync.job.ts** → Basitleştirilecek (daily fixture sync)
2. **dataUpdate.job.ts** → MQTT fallback (20s)
3. **matchWatchdog.job.ts** → Emergency finish (100+ min stuck)

#### ❌ SİLİNECEK SYNC WORKERS (12):
- categorySync, coachSync, competitionSync, countrySync, playerSync, refereeSync, seasonSync, stageSync, teamSync, venueSync, teamDataSync, teamLogoSync
- **Sebep:** Batch sync 1x daily yeterli, 12 ayrı worker gereksiz
- **Çözüm:** Tek unified sync job

#### ✅ KALACAK OTHER WORKERS (11):
Gamification + Maintenance (değişmeyecek)

#### 📊 SONUÇ:
**ÖNCESİ:** 33 worker
**SONRASI:** 15 worker (54% azalma!)

---

### 1.2 SERVİS ENVANTERI

#### ❌ SİLİNECEK SERVİSLER:
1. **MatchWriteQueue** → Batching gereksiz
2. **LiveMatchOrchestrator** → Over-engineered conflict resolution
3. **matchEnricher.service.ts** → Gereksiz transformation
4. **liveMatchCache.service.ts** → Database-level cache yeterli
5. **matchDatabase.service.ts** → Direkt pool.query kullan

#### ✅ YENİDEN YAZILACAK SERVİSLER:
1. **websocket.service.ts** → MQTT direkt write
2. **matchDetailLive.service.ts** → Basitleştirilecek
3. **predictionSettlement.service.ts** → Match events'e entegre

---

### 1.3 DATABASE ŞEMASI (TheSports Uyumlu)

#### ts_matches (MEVCUT):
```sql
CREATE TABLE ts_matches (
  external_id VARCHAR(100) PRIMARY KEY,  -- TheSports match_id
  competition_id VARCHAR(100),
  season_id VARCHAR(100),
  home_team_id VARCHAR(100),
  away_team_id VARCHAR(100),

  -- Status & Timing
  status_id INTEGER DEFAULT 1,
  match_time BIGINT NOT NULL,           -- Scheduled kickoff
  kickoff_ts BIGINT,                    -- Actual 1st half start
  second_half_kickoff_ts BIGINT,
  overtime_kickoff_ts BIGINT,

  -- Scores (TheSports Array[7])
  home_scores JSONB DEFAULT '[0,0,0,0,0,0,0]',
  away_scores JSONB DEFAULT '[0,0,0,0,0,0,0]',
  home_score_display INTEGER DEFAULT 0,
  away_score_display INTEGER DEFAULT 0,

  -- Live Data
  minute INTEGER,
  ended BOOLEAN DEFAULT false,

  -- Metadata
  last_updated_by VARCHAR(20),  -- 'mqtt' | 'api' | 'watchdog'
  last_updated_at BIGINT,       -- Unix timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_status ON ts_matches(status_id) WHERE status_id IN (2,3,4,5,7);
CREATE INDEX idx_matches_updated ON ts_matches(updated_at DESC);
```

#### ai_predictions (MEVCUT):
```sql
-- No changes needed, already good
-- Settlement will hook into match events
```

---

## 🎯 PHASE 2: YENİ MİMARİ TASARIMI

### 2.1 DATA FLOW (3-Layer Architecture)

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: PRIMARY - MQTT Real-time Stream               │
│ • Priority: HIGHEST                                     │
│ • Latency: <100ms                                       │
│ • Flow: MQTT → Parse → DB Write → Broadcast            │
│ • Data: Scores, Status, Minute, Incidents              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (fallback if no MQTT update 30s)
┌─────────────────────────────────────────────────────────┐
│ LAYER 2: FALLBACK - API Polling (dataUpdate.job)       │
│ • Priority: MEDIUM                                      │
│ • Interval: 20s                                         │
│ • Endpoint: /data/update → /match/detail_live          │
│ • Flow: API → Parse → Check MQTT freshness → DB Write  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (emergency if stuck 100+ min)
┌─────────────────────────────────────────────────────────┐
│ LAYER 3: EMERGENCY - Watchdog Force Finish             │
│ • Priority: OVERRIDE                                    │
│ • Interval: 2 min                                       │
│ • Logic: If LIVE >100min → Force status=8              │
│ • Flow: Direct UPDATE (no conflict check)              │
└─────────────────────────────────────────────────────────┘
```

### 2.2 MQTT SERVICE (websocket.service.ts) - YENİ YAKLAŞIM

```typescript
class WebSocketService {
  async handleScoreUpdate(parsedScore: ParsedScore) {
    const nowTs = Math.floor(Date.now() / 1000);

    // ✅ DIREKT DATABASE WRITE - NO QUEUE, NO ORCHESTRATOR!
    const result = await pool.query(`
      UPDATE ts_matches
      SET
        home_score_display = $1,
        away_score_display = $2,
        status_id = $3,
        minute = $4,
        home_scores = jsonb_set(home_scores, '{0}', $5::text::jsonb),
        away_scores = jsonb_set(away_scores, '{0}', $6::text::jsonb),
        last_updated_by = 'mqtt',
        last_updated_at = $7,
        updated_at = NOW()
      WHERE external_id = $8
        AND (last_updated_at IS NULL OR last_updated_at < $9)  -- Only if fresher
      RETURNING *
    `, [
      parsedScore.home.score,
      parsedScore.away.score,
      parsedScore.statusId,
      parsedScore.minute,
      parsedScore.home.score,  -- Array[0] = display score
      parsedScore.away.score,
      nowTs,
      parsedScore.matchId,
      nowTs - 1  // Accept if older than 1s
    ]);

    if (result.rowCount > 0) {
      // ✅ IŞIK HIZI - Broadcast to frontend
      this.broadcast({
        type: 'SCORE_UPDATE',
        match: result.rows[0]
      });

      // ✅ AI Settlement hook
      await predictionSettlement.onScoreChange({
        matchId: parsedScore.matchId,
        homeScore: parsedScore.home.score,
        awayScore: parsedScore.away.score,
        statusId: parsedScore.statusId,
        minute: parsedScore.minute
      });
    }
  }
}
```

**KRİTİK:**
- ❌ Queue YOK
- ❌ Orchestrator YOK
- ✅ Direkt write
- ✅ Optimistic locking (last_updated_at check)
- ✅ < 100ms latency

---

### 2.3 API FALLBACK (dataUpdate.job.ts) - REVIZE

```typescript
// Her 20 saniyede çalışır
async function dataUpdateJob() {
  // 1. TheSports /data/update'den değişen match ID'leri al
  const changedMatches = await getChangedMatches();

  for (const matchId of changedMatches) {
    // 2. MQTT freshness check
    const match = await pool.query(`
      SELECT last_updated_by, last_updated_at
      FROM ts_matches
      WHERE external_id = $1
    `, [matchId]);

    const lastUpdate = match.rows[0];
    const now = Math.floor(Date.now() / 1000);

    // 3. MQTT 30s içinde update yaptıysa SKIP
    if (lastUpdate.last_updated_by === 'mqtt' && (now - lastUpdate.last_updated_at) < 30) {
      continue;  // MQTT fresh, API gereksiz
    }

    // 4. API'den çek
    const liveData = await matchDetailLive.get(matchId);

    // 5. Database write (last_updated_by = 'api')
    await updateMatch(matchId, liveData, 'api', now);
  }
}
```

**AKILLI:** MQTT varsa API gereksiz → %90 API call reduction!

---

### 2.4 WATCHDOG (matchWatchdog.job.ts) - BASITLEŞTIRILMIŞ

```typescript
// Her 2 dakikada çalışır
async function watchdogJob() {
  const now = Math.floor(Date.now() / 1000);

  // 1. STUCK MATCHES BUL (>100 dakika LIVE)
  const stuckMatches = await pool.query(`
    SELECT external_id, match_time, status_id, minute
    FROM ts_matches
    WHERE status_id IN (2, 3, 4, 5, 7)
      AND $1 - match_time > 6000  -- >100 dakika
    LIMIT 100
  `, [now]);

  // 2. FORCE FINISH (no conflict check!)
  for (const match of stuckMatches.rows) {
    await pool.query(`
      UPDATE ts_matches
      SET
        status_id = 8,
        ended = true,
        minute = NULL,
        last_updated_by = 'watchdog',
        last_updated_at = $1
      WHERE external_id = $2
    `, [now, match.external_id]);

    logger.warn(`[Watchdog] Force finished stuck match: ${match.external_id}`);
  }
}
```

**BASIT:**
- Conflict check YOK
- Orchestrator YOK
- Direkt UPDATE
- Sadece emergency için

---

### 2.5 AI PREDICTIONS ENTEGRASYONU

#### Mevcut Sistem:
- predictionSettlement.service.ts - Ayrı çalışıyor
- Event-driven değil, polling bazlı

#### Yeni Sistem:
```typescript
// websocket.service.ts içinde
async handleScoreUpdate(parsedScore) {
  // 1. Database update
  const updated = await updateDatabase(...);

  // 2. AI settlement trigger (instant!)
  if (updated) {
    await predictionSettlement.onScoreChange({
      matchId: parsedScore.matchId,
      homeScore: parsedScore.home.score,
      awayScore: parsedScore.away.score,
      statusId: parsedScore.statusId,
      minute: parsedScore.minute,
      timestamp: Math.floor(Date.now() / 1000)
    });
  }
}
```

**ENTEGRE:** Skor değişir → Anında settlement check!

---

## 🔧 PHASE 3: UYGULAMA ADIM ADIM

### STEP 1: MQTT Direkt Write (2 saat)
**Dosyalar:**
- `src/services/thesports/websocket/websocket.service.ts`
- `src/services/thesports/websocket/websocket.parser.ts`

**Değişiklikler:**
1. ❌ MatchWriteQueue çağrısını kaldır
2. ✅ Direkt `pool.query()` ekle
3. ✅ Optimistic locking (`last_updated_at` check)
4. ✅ AI settlement hook ekle

---

### STEP 2: API Fallback MQTT Freshness Check (1 saat)
**Dosya:** `src/jobs/dataUpdate.job.ts`

**Değişiklikler:**
1. ✅ MQTT freshness check ekle
2. ✅ 30s içinde MQTT update varsa SKIP
3. ✅ `last_updated_by = 'api'` set et

---

### STEP 3: Watchdog Basitleştirme (1 saat)
**Dosya:** `src/jobs/matchWatchdog.job.ts`

**Değişiklikler:**
1. ❌ LiveMatchOrchestrator çağrısını kaldır
2. ✅ Direkt UPDATE query
3. ✅ Sadece >100 dakika stuck için
4. ❌ Proactive finish logic'i kaldır (MQTT/API halleder)

---

### STEP 4: Gereksiz Worker'ları Sil (30 dk)
**Silinecekler:**
- matchMinute.job.ts
- matchFreezeDetection.job.ts
- proactiveMatchStatusCheck.job.ts
- matchDataSync.job.ts
- postMatchProcessor.job.ts
- lineupRefresh.job.ts

**jobManager.ts'den kaldır**

---

### STEP 5: Orchestrator & Queue Cleanup (1 saat)
**Dosyalar:**
- `src/services/orchestration/LiveMatchOrchestrator.ts`
- `src/services/orchestration/MatchWriteQueue.ts`

**Seçenekler:**
- Option A: Tamamen sil
- Option B: Deprecate (logging için tut)

**Karar:** Option B (güvenli geçiş)

---

### STEP 6: AI Settlement Entegrasyonu (1 saat)
**Dosya:** `src/services/ai/predictionSettlement.service.ts`

**Değişiklikler:**
1. ✅ `onScoreChange()` method ekle
2. ✅ WebSocket service'den çağrılsın
3. ✅ Real-time settlement

---

### STEP 7: Database Migration (30 dk)
**Değişiklikler:**
```sql
-- Add new columns
ALTER TABLE ts_matches
  ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(20),
  ADD COLUMN IF NOT EXISTS last_updated_at BIGINT;

-- Backfill existing data
UPDATE ts_matches
SET last_updated_by = 'api',
    last_updated_at = EXTRACT(EPOCH FROM updated_at)::BIGINT
WHERE last_updated_by IS NULL;
```

---

### STEP 8: Test & Deploy (2 saat)
1. Local test
2. VPS deploy
3. Monitor logs
4. Verify latency <100ms

---

## 📋 PHASE 4: DEPLOYMENT PLAN

### Pre-deployment Checklist:
- [ ] All tests pass
- [ ] Database migration ready
- [ ] PM2 config updated
- [ ] Rollback plan prepared

### Deployment Steps:
```bash
# 1. Backup database
pg_dump > backup.sql

# 2. Stop PM2
pm2 stop goalgpt-backend

# 3. Git pull
git pull origin main

# 4. Run migration
npm run migrate

# 5. Rebuild
npm run build

# 6. Start PM2
pm2 start goalgpt-backend

# 7. Monitor logs
pm2 logs goalgpt-backend --lines 100 | grep -E "MQTT|score|settlement"
```

---

## 🎯 PHASE 5: SUCCESS METRICS

### Performance:
- ✅ MQTT → Database latency: **<100ms** (was: 5-7 min!)
- ✅ Frontend score update: **<200ms**
- ✅ API fallback latency: **<30s**
- ✅ Watchdog emergency: **<2 min**

### Reliability:
- ✅ MQTT fail → API fallback works
- ✅ API fail → Watchdog emergency works
- ✅ No stuck matches >2 min
- ✅ No NULL scores
- ✅ No score conflicts

### Code Quality:
- ✅ Workers: 33 → 15 (54% reduction)
- ✅ Code complexity: -40%
- ✅ Lines of code: -3000+

---

## ❓ KULLANICI SORULARI

### SORU 1: Sync Workers
**Q:** 12 sync worker'ı (category, coach, competition, etc.) nasıl birleştiriyoruz?

**Seçenekler:**
- A) Unified sync job (1 worker, sequential sync)
- B) Grouped sync (3 worker: entities, matches, stats)
- C) Keep as-is (12 worker)

**Öneriniz:**

---

### SORU 2: LiveMatchOrchestrator
**Q:** Tamamen silelim mi yoksa deprecate edelim mi?

**Seçenekler:**
- A) Tamamen sil (temiz mimari)
- B) Deprecate (logging için tut, yeni yazma yok)

**Öneriniz:**

---

### SORU 3: MatchWriteQueue
**Q:** Batch writing'den tamamen vazgeçiyoruz?

**Seçenekler:**
- A) EVET - Direkt write, queue YOK
- B) HAYIR - Queue tut ama conflict check'siz

**Öneriniz:**

---

### SORU 4: Rollback Plan
**Q:** Deployment başarısız olursa?

**Plan:**
- Backup DB restore
- Git revert
- PM2 restart old version

**Yeterli mi?**

---

### SORU 5: AI Predictions Settlement
**Q:** Settlement ne zaman tetiklensin?

**Seçenekler:**
- A) Her skor değişiminde (MQTT/API update)
- B) Sadece gol event'inde
- C) Polling (her 30s)

**Öneriniz:**

---

## 📊 ÖZET

### ÖNCESİ:
- 33 worker
- MQTT → Queue (100ms) → Orchestrator → Conflict! → REJECT
- Skorlar 5-7 dakika gecikmeli
- Stuck maçlar 28+ dakika

### SONRASI:
- 15 worker (54% azalma)
- MQTT → Database (<100ms) → Broadcast
- Real-time skorlar
- Stuck maçlar <2 dakika

### TOPLAM SÜRE: ~10 saat
### RİSK: DÜŞÜK (rollback planı var)
### ETKİ: DEVASA

---

**ONAY BEKLİYOR - SORULARI CEVAP VERİN!** ✅
