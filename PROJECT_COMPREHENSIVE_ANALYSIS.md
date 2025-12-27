# 🎯 GoalGPT Proje Analiz Raporu

**Tarih:** 2025-12-25  
**Hazırlayan:** AI Assistant  
**Amaç:** Projenin mimari yapısı, TheSports API entegrasyonu, data flow ve mevcut durumun kapsamlı analizi

---

## 📋 1. PROJE AMACI VE GENEL BAKIŞ

### 1.1 Proje Tanımı

**GoalGPT**, canlı futbol maçları için anlık tahminler sunan bir sistemdir. TheSports.com API'den maç verilerini alır, AI tahmin API'si ile eşleştirir ve kullanıcılara gerçek zamanlı güncellemeler sağlar.

### 1.2 Temel Özellikler

- ✅ **Canlı maç takibi** (WebSocket + HTTP polling fallback)
- ✅ **TheSports.com API entegrasyonu** (30+ endpoint)
- ✅ **AI tahmin eşleştirme** (fuzzy matching - gelecek özellik)
- ✅ **Gerçek zamanlı bildirimler** (gol, kart, değişiklik)
- ✅ **Modüler ve ölçeklenebilir mimari**
- ✅ **Yüksek performans** (Fastify framework)

### 1.3 Teknoloji Stack

**Backend:**
- **Framework:** Fastify (Express yerine yüksek performans için)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL (Supabase)
- **Cache:** Redis (in-memory fallback mevcut)
- **WebSocket:** MQTT (TheSports WebSocket API)
- **Scheduling:** node-cron (background workers)
- **Validation:** Joi
- **Logging:** Winston

**Frontend:**
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Inline styles
- **State Management:** React Hooks (useState, useEffect)

**DevOps:**
- **VPS:** DigitalOcean Droplet
- **Process Manager:** PM2
- **CI/CD:** GitHub Actions
- **Deployment:** Otomatik deploy (main branch push → VPS)

---

## 🏗️ 2. MİMARİ YAPI

### 2.1 Layered Architecture (Katmanlı Mimari)

```
Request Flow:
  Client (Frontend)
    ↓
  Route (routes/*.ts) - Fastify plugin
    ↓
  Controller (controllers/*.ts) - HTTP handling ONLY
    ↓
  Service (services/*.ts) - Business logic
    ↓
  Repository (repositories/*.ts) - Data access (kısmen kullanılıyor)
    ↓
  Database/External API
```

**Kurallar:**
- ❌ Controller'dan direkt database/API çağrısı YAPILMAZ
- ❌ Service'de HTTP request/response handling YAPILMAZ
- ✅ Her katman sadece kendi sorumluluğunu yerine getirir

### 2.2 Proje Yapısı

```
project/
├── src/
│   ├── config/              # Konfigürasyon (env, Redis, TheSports)
│   ├── controllers/         # HTTP request/response handlers (NO business logic)
│   ├── services/            # Business logic & external API integration
│   │   └── thesports/       # TheSports API services
│   │       ├── client/      # API client (retry, circuit breaker, rate limiter)
│   │       ├── match/       # Match-related services (20+ dosya)
│   │       ├── team/        # Team services (data, logos)
│   │       ├── competition/ # Competition services
│   │       ├── websocket/   # WebSocket service (real-time updates)
│   │       └── ...          # Diğer servisler
│   ├── routes/              # Fastify route definitions
│   ├── repositories/        # Data access layer (Repository Pattern - kısmen)
│   ├── jobs/                # Background workers (20+ worker)
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Helper functions (logger, cache, validators)
│   ├── database/            # Database utilities (migration, import)
│   └── server.ts            # Fastify server entry point
│
├── frontend/
│   ├── src/
│   │   ├── api/             # API client (matches.ts)
│   │   ├── components/      # React components
│   │   │   ├── MatchList.tsx
│   │   │   ├── MatchCard.tsx
│   │   │   └── ...
│   │   ├── utils/           # Frontend utilities
│   │   ├── App.tsx          # Main React component
│   │   └── main.tsx         # React entry point
│   └── package.json
│
├── .github/workflows/       # CI/CD (GitHub Actions)
│   └── ci-release.yml       # Otomatik deploy pipeline
├── package.json
└── README.md
```

### 2.3 Mimari Prensipler

1. **Single Responsibility Principle:** Her dosya tek bir sorumluluğa sahip
2. **No Magic Strings/Numbers:** Enum ve constant kullanımı zorunlu
3. **Function Length Constraint:** Fonksiyonlar 20-30 satırı geçmemeli
4. **Service Layer Pattern:** Controller → Service → Repository/API
5. **Database-First Approach:** Frontend API'ye direkt bağlanmaz, backend üzerinden database'den veri çeker

---

## 🔌 3. THESPORTS API ENTEGRASYONU

### 3.1 API Client Yapısı

**Dosya:** `src/services/thesports/client/thesports-client.ts`

**Özellikler:**
- ✅ **Retry Logic** (Exponential Backoff) - Transient hatalar için
- ✅ **Circuit Breaker Pattern** - API down olduğunda koruma
- ✅ **Rate Limiting** - 120 request/dakika limiti
- ✅ **Error Handling & Logging** - Merkezi hata yönetimi
- ✅ **IP Whitelisting Support** - TheSports API gereksinimi

**Authentication:**
```typescript
// Query parameters ile authentication
const queryParams = new URLSearchParams({
  user: config.thesports.user,    // "goalgpt"
  secret: config.thesports.secret, // API secret
  ...params
});
```

### 3.2 Kullanılan Endpoint'ler

#### A. Basic Info Endpoints (11 endpoint)

| Endpoint | Service | Frequency | Sync Method | Durum |
|----------|---------|-----------|-------------|-------|
| `/category/list` | `categorySync.service.ts` | 1 gün/1 kez | Static | ✅ |
| `/country/list` | `countrySync.service.ts` | 1 gün/1 kez | Static | ✅ |
| `/competition/additional/list` | `leagueSync.service.ts` | 1 dk/1 kez | Incremental | ✅ |
| `/team/additional/list` | `teamSync.service.ts` | 1 dk/1 kez | Incremental | ✅ |
| `/player/with_stat/list` | `playerSync.service.ts` | 1 dk/1 kez | Incremental | ✅ |
| `/coach/list` | `coachSync.service.ts` | 1 dk/1 kez | Incremental | ✅ |
| `/referee/list` | `refereeSync.service.ts` | 1 dk/1 kez | Full | ✅ |
| `/venue/list` | `venueSync.service.ts` | 1 dk/1 kez | Full | ✅ |
| `/season/list` | `seasonSync.service.ts` | 1 dk/1 kez | Full | ✅ |
| `/stage/list` | `stageSync.service.ts` | 1 dk/1 kez | Full | ✅ |
| `/data/update` | `dataUpdate.service.ts` | 20 saniye/1 kez | Real-time | ⚠️ IP Whitelist |

#### B. Match Data Endpoints (15+ endpoint)

| Endpoint | Service | Frequency | Amaç | Durum |
|----------|---------|-----------|------|-------|
| `/match/recent/list` | `recentSync.service.ts` | 1 dk/1 kez | Incremental sync | ⚠️ IP Whitelist |
| `/match/diary` | `matchDiary.service.ts` | 10 dk/1 kez | Günlük bülten | ✅ |
| `/match/detail_live` | `matchDetailLive.service.ts` | 2 sn/1 kez | Canlı maç detayı | ⚠️ IP Whitelist |
| `/match/lineup/detail` | `matchLineup.service.ts` | On-demand | Kadro bilgisi | ✅ |
| `/match/team_stats/list` | `matchTeamStats.service.ts` | On-demand | Takım istatistikleri | ✅ |
| `/match/player_stats/list` | `matchPlayerStats.service.ts` | On-demand | Oyuncu istatistikleri | ✅ |
| `/match/season/recent` | `matchSeasonRecent.service.ts` | 1 saat/1 kez | Sezon maçları | ✅ |
| `/match/analysis` | `matchAnalysis.service.ts` | On-demand | Maç analizi | ✅ |
| `/match/trend/detail` | `matchTrend.service.ts` | On-demand | Trend verisi | ✅ |
| `/match/half/team_stats/detail` | `matchHalfStats.service.ts` | On-demand | Devre arası istatistikleri | ✅ |
| `/match/compensation/list` | `compensation.service.ts` | On-demand | Kompanse verileri | ✅ |
| `/table/live` | `tableLive.service.ts` | 1 saat/1 kez | Canlı puan durumu | ✅ |
| `/standings` | `standings.service.ts` | 1 saat/1 kez | Puan durumu | ✅ |

#### C. WebSocket/MQTT

| Endpoint | Service | Amaç | Durum |
|----------|---------|------|-------|
| `mqtt://mq.thesports.com` | `websocket.service.ts` | Real-time updates | ✅ |

**Topic:** `thesports/football/match/v1`

### 3.3 IP Whitelist Durumu

**Kritik Sorun:** TheSports API bazı endpoint'ler için IP whitelist zorunlu tutuyor.

**Not:** Kod tabanında herhangi bir IP adresi hardcode edilmemiştir. TheSports API'ye yapılan tüm istekler, backend'in çalıştığı sunucunun outbound IP'si ile otomatik olarak yapılır.

**IP Belirleme:**
- `TheSportsClient` axios instance kullanır
- Axios otomatik olarak sunucunun network interface'inden outbound IP'yi alır
- Herhangi bir özel IP konfigürasyonu yoktur

**VPS IP:** `142.93.103.128` (DigitalOcean Droplet - GitHub Actions deploy config'den)

**Erişim Durumu:** ✅ Erişim sorunu yok (kullanıcı onayladı)

---

## 🔄 4. DATA FLOW: API → DATABASE → FRONTEND

### 4.1 Genel Data Flow

```
┌─────────────────┐
│  TheSports API  │
│  (30+ endpoint) │
└────────┬────────┘
         │
         │ HTTP Request (TheSportsClient)
         │
         ▼
┌─────────────────┐
│   Services      │
│  (matchSync,    │
│   matchDetail)  │
└────────┬────────┘
         │
         │ Database Query
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   (Supabase)    │
│  - ts_matches   │
│  - ts_teams     │
│  - ...          │
└────────┬────────┘
         │
         │ SELECT Query
         │
         ▼
┌─────────────────┐
│  Controllers    │
│ (match.controller│
└────────┬────────┘
         │
         │ HTTP Response
         │
         ▼
┌─────────────────┐
│    Frontend     │
│   (React App)   │
└─────────────────┘
```

### 4.2 Match Data Flow Detayı

#### Adım 1: Data Ingestion (Veri Alımı)

**Workers:**
1. **DailyMatchSyncWorker** - Günlük maç listesi (`/match/diary`)
2. **MatchSyncWorker** - Incremental sync (`/match/recent/list`)
3. **DataUpdateWorker** - Real-time updates (`/data/update`)
4. **ProactiveMatchStatusCheckWorker** - Proaktif status kontrolü
5. **WebSocketService** - Real-time MQTT updates

**Database'e Yazma:**
```typescript
// services/thesports/match/matchSync.service.ts
await pool.query(`
  INSERT INTO ts_matches (external_id, status_id, match_time, ...)
  VALUES ($1, $2, $3, ...)
  ON CONFLICT (external_id) DO UPDATE SET ...
`);
```

#### Adım 2: Data Storage (Veri Saklama)

**Ana Tablo: `ts_matches`**

**Önemli Kolonlar:**
- `external_id` - TheSports API'den gelen maç ID'si (UNIQUE)
- `status_id` - Maç durumu (1=NOT_STARTED, 2=FIRST_HALF, 3=HALF_TIME, 4=SECOND_HALF, 5=OVERTIME, 7=PENALTY, 8=END)
- `match_time` - Maç zamanı (Unix timestamp)
- `first_half_kickoff_ts` - İlk yarı başlangıç zamanı (dakika hesaplama için)
- `second_half_kickoff_ts` - İkinci yarı başlangıç zamanı
- `minute` - Hesaplanan dakika
- `provider_update_time` - Provider'dan gelen son güncelleme zamanı (optimistic locking)
- `last_event_ts` - Son event zamanı
- `home_score_display`, `away_score_display` - Skorlar
- `statistics` (JSONB) - İstatistikler
- `incidents` (JSONB) - Olaylar (gol, kart, değişiklik)

#### Adım 3: Data Retrieval (Veri Çekme)

**Frontend API Endpoint'leri:**

1. **`GET /api/matches/live`** - Canlı maçlar
   - Controller: `match.controller.ts`
   - Service: `matchDatabase.service.ts`
   - Query: `SELECT * FROM ts_matches WHERE status_id IN (2,3,4,5,7)`

2. **`GET /api/matches/diary?date=YYYYMMDD`** - Günlük maç listesi
   - Controller: `match.controller.ts`
   - Service: `matchDatabase.service.ts`
   - Query: `SELECT * FROM ts_matches WHERE match_time >= $1 AND match_time < $2`

3. **`GET /api/matches/recent`** - Son maçlar
   - Controller: `match.controller.ts`
   - Service: `matchDatabase.service.ts`
   - Query: `SELECT * FROM ts_matches ORDER BY match_time DESC LIMIT 100`

**Data Enrichment:**
```typescript
// matchDatabase.service.ts
const transformedMatches = matches.map(match => ({
  ...match,
  minute_text: generateMinuteText(match.minute, match.status_id),
  home_team_name: match.home_team?.name,
  away_team_name: match.away_team?.name,
  competition_name: match.competition?.name,
  // ...
}));
```

#### Adım 4: Frontend Display

**React Components:**
- `MatchList.tsx` - Maç listesi
- `MatchCard.tsx` - Tek maç kartı
- `MatchDetailPage.tsx` - Maç detay sayfası

**Data Fetching:**
```typescript
// frontend/src/api/matches.ts
export async function getLiveMatches(): Promise<Match[]> {
  const response = await fetch(`${API_BASE_URL}/matches/live`);
  const data = await response.json();
  return data.data.results;
}
```

**Minute Display:**
```typescript
// Frontend artık minute_text'i direkt kullanıyor
// Backend'den gelen minute_text: "45'", "HT", "FT", vb.
{minuteText && minuteText !== "—" && <span>{minuteText}</span>}
```

---

## 🔄 5. WORKER MEKANİZMALARI

### 5.1 Background Workers Listesi

| Worker | Frequency | Amaç | Dosya |
|--------|-----------|------|-------|
| **DataUpdateWorker** | 20 saniye | `/data/update` endpoint'i ile değişen maçları tespit et | `dataUpdate.job.ts` |
| **ProactiveMatchStatusCheckWorker** | 20 saniye | `match_time` geçmiş ama hala `NOT_STARTED` olan maçları kontrol et | `proactiveMatchStatusCheck.job.ts` |
| **MatchSyncWorker** | 1 dakika | Incremental sync (`/match/recent/list`) | `matchSync.job.ts` |
| **DailyMatchSyncWorker** | 10 dakika | Günlük maç listesi (`/match/diary`) | `dailyMatchSync.job.ts` |
| **MatchWatchdogWorker** | 30 saniye | Stale matches'leri tespit et | `matchWatchdog.job.ts` |
| **MatchFreezeDetectionWorker** | 1 dakika | Donmuş maçları tespit et | `matchFreezeDetection.job.ts` |
| **MatchMinuteWorker** | 30 saniye | Dakika hesaplama | `matchMinute.job.ts` |
| **TeamDataSyncWorker** | 1 saat | Takım verilerini sync et | `teamDataSync.job.ts` |
| **TeamLogoSyncWorker** | 2 saat | Takım logolarını sync et | `teamLogoSync.job.ts` |
| **CompetitionSyncWorker** | 1 dakika | Lig verilerini sync et | `competitionSync.job.ts` |
| **CategorySyncWorker** | 1 gün | Kategori verilerini sync et | `categorySync.job.ts` |
| **CountrySyncWorker** | 1 gün | Ülke verilerini sync et | `countrySync.job.ts` |
| **TeamSyncWorker** | 1 dakika | Takım listesini sync et | `teamSync.job.ts` |
| **PlayerSyncWorker** | 1 dakika | Oyuncu verilerini sync et | `playerSync.job.ts` |
| **CoachSyncWorker** | 1 dakika | Teknik direktör verilerini sync et | `coachSync.job.ts` |
| **RefereeSyncWorker** | 1 dakika | Hakem verilerini sync et | `refereeSync.job.ts` |
| **VenueSyncWorker** | 1 dakika | Stadyum verilerini sync et | `venueSync.job.ts` |
| **SeasonSyncWorker** | 1 dakika | Sezon verilerini sync et | `seasonSync.job.ts` |
| **StageSyncWorker** | 1 dakika | Aşama verilerini sync et | `stageSync.job.ts` |

### 5.2 Kritik Workers Detayı

#### A. DataUpdateWorker

**Amaç:** TheSports API'nin `/data/update` endpoint'i ile son 120 saniyede değişen maçları tespit etmek.

**Çalışma Mantığı:**
```typescript
// 1. /data/update endpoint'ini çağır
const data = await dataUpdateService.checkUpdates();
// Response: { results: { "1": [{ match_id: "xyz123" }] } }

// 2. Değişen maç ID'lerini çıkar
const matchIds = extractChangedMatches(data);

// 3. Her maç için /match/detail_live çağır
for (const matchId of matchIds) {
  await matchDetailLiveService.reconcileMatchToDatabase(matchId);
}
```

**Sorun:** IP whitelist hatası nedeniyle çalışmıyor.

#### B. ProactiveMatchStatusCheckWorker

**Amaç:** Normal akış çalışmadığında proaktif olarak maç başlangıçlarını tespit etmek.

**Çalışma Mantığı:**
```typescript
// 1. Bugünkü maçları sorgula
const query = `
  SELECT external_id, match_time, status_id
  FROM ts_matches
  WHERE match_time <= NOW()  -- Saat geçmiş
    AND status_id = 1        -- Ama hala NOT_STARTED
    AND match_time >= todayStartTSI
`;

// 2. Bulunan maçlar için /match/detail_live çağır
for (const match of matches) {
  await matchDetailLiveService.reconcileMatchToDatabase(match.external_id);
  
  // Eğer detail_live başarısız olursa, /match/diary fallback kullan
  if (reconcileResult.rowCount === 0) {
    const diaryResponse = await diaryService.getMatchDiary({ date: dateStr });
    // Diary'den status çıkar ve güncelle
  }
}
```

#### C. MatchSyncWorker

**Amaç:** Incremental sync ile maç verilerini güncellemek.

**Çalışma Mantığı:**
```typescript
// 1. Son sync zamanını al
const lastSync = await getLastSyncTimestamp();

// 2. /match/recent/list ile incremental sync yap
const response = await client.get('/match/recent/list', {
  time: lastSync,
  page: 1,
  limit: 50
});

// 3. Değişen maçları database'e yaz
for (const match of response.results) {
  await matchSyncService.upsertMatch(match);
}

// 4. Canlı maçları reconcile queue'ya ekle
await this.reconcileLiveMatches();
```

**Reconcile Queue:**
- FIRST_HALF (status 2) maçları → Her 20 saniyede reconcile
- HALF_TIME (status 3) maçları → Her 30 saniyede reconcile
- SECOND_HALF (status 4) maçları → Her 15 saniyede reconcile
- LIVE (status 2,4,5) maçları → Her 30 saniyede reconcile

---

## 📊 6. STATUS TRANSITION MANTIĞI

### 6.1 Maç Durumları (Status ID)

| Status ID | Durum | Açıklama |
|-----------|-------|----------|
| 1 | NOT_STARTED | Maç başlamadı |
| 2 | FIRST_HALF | İlk yarı |
| 3 | HALF_TIME | Devre arası |
| 4 | SECOND_HALF | İkinci yarı |
| 5 | OVERTIME | Uzatma |
| 7 | PENALTY_SHOOTOUT | Penaltılar |
| 8 | END | Maç bitti |
| 9 | DELAY | Ertelendi |
| 10 | INTERRUPT | Kesintiye uğradı |

### 6.2 Status Transition Workflow

**Maç Başlama Senaryosu:**

```
1. Database: status_id = 1 (NOT_STARTED), match_time = 21:00
2. Saat 21:00 geçti
3. ProactiveMatchStatusCheckWorker çalışır (20 saniyede bir)
   → match_time <= NOW() AND status_id = 1 olan maçları bulur
   → /match/detail_live endpoint'ini çağırır
4. Provider'dan status_id = 2 (FIRST_HALF) gelir
5. reconcileMatchToDatabase() çalışır:
   → Critical transition (1 → 2) tespit edilir
   → Optimistic locking bypass edilir
   → first_half_kickoff_ts set edilir (ingestionTs veya match_time)
   → Database güncellenir: status_id = 2, first_half_kickoff_ts = NOW()
6. Frontend'de maç canlı olarak görünür
```

**Devre Arası Senaryosu:**

```
1. Database: status_id = 2 (FIRST_HALF)
2. MatchSyncWorker FIRST_HALF maçları her 20 saniyede reconcile eder
3. Provider'dan status_id = 3 (HALF_TIME) gelir
4. reconcileMatchToDatabase() çalışır:
   → Critical transition (2 → 3) tespit edilir
   → Database güncellenir: status_id = 3
5. Frontend'de "HT" görünür
```

**İkinci Yarı Senaryosu:**

```
1. Database: status_id = 3 (HALF_TIME)
2. MatchSyncWorker HALF_TIME maçları her 30 saniyede reconcile eder
3. Provider'dan status_id = 4 (SECOND_HALF) gelir
4. reconcileMatchToDatabase() çalışır:
   → Critical transition (3 → 4) tespit edilir
   → second_half_kickoff_ts set edilir
   → Database güncellenir: status_id = 4, second_half_kickoff_ts = NOW()
5. Frontend'de dakika 46' dan başlar
```

**Maç Bitiş Senaryosu:**

```
1. Database: status_id = 4 (SECOND_HALF)
2. MatchSyncWorker SECOND_HALF maçları her 15 saniyede reconcile eder
3. Provider'dan status_id = 8 (END) gelir
4. reconcileMatchToDatabase() çalışır:
   → Critical transition (4 → 8) tespit edilir
   → Database güncellenir: status_id = 8
5. Frontend'de "FT" görünür
```

### 6.3 Critical Transitions (Kritik Geçişler)

**Optimistic Locking Bypass:**
```typescript
const isCriticalTransition = 
  (existingStatusId === 1 && live.statusId === 2) || // NOT_STARTED → FIRST_HALF
  (existingStatusId === 2 && live.statusId === 3) || // FIRST_HALF → HALF_TIME
  (existingStatusId === 3 && live.statusId === 4) || // HALF_TIME → SECOND_HALF
  (existingStatusId === 4 && live.statusId === 8);   // SECOND_HALF → END

if (isCriticalTransition) {
  // Optimistic locking bypass - direkt update yap
}
```

**Amaç:** Kritik geçişlerde timestamp kontrolünü atlayarak hızlı güncelleme sağlamak.

---

## ⏱️ 7. MINUTE CALCULATION (DAKİKA HESAPLAMA)

### 7.1 Minute Calculation Mantığı

**Dosya:** `src/services/thesports/match/matchDetailLive.service.ts`

**Fonksiyon:** `calculateMinuteFromKickoffs()`

**Çalışma Prensibi:**
```typescript
// 1. Provider'dan minute gelirse, onu kullan
if (live.minute !== null) {
  return live.minute;
}

// 2. Provider minute göndermiyorsa, kickoff timestamps'lerden hesapla
const nowTs = Math.floor(Date.now() / 1000);

if (statusId === 2) { // FIRST_HALF
  if (firstHalfKickoffTs) {
    const elapsed = nowTs - firstHalfKickoffTs;
    return Math.floor(elapsed / 60) + 1; // +1 çünkü 1. dakikadan başlar
  }
  // Fallback: ingestionTs kullan (maç zaten başlamış)
  return Math.floor((nowTs - ingestionTs) / 60) + 1;
}

if (statusId === 4) { // SECOND_HALF
  if (secondHalfKickoffTs) {
    const elapsed = nowTs - secondHalfKickoffTs;
    return 45 + Math.floor(elapsed / 60) + 1; // 46. dakikadan başlar
  }
  // Fallback: first_half_kickoff_ts + 60 dakika (45+15) kullan
  if (firstHalfKickoffTs) {
    const estimatedSecondHalfKickoff = firstHalfKickoffTs + 3600;
    const elapsed = nowTs - estimatedSecondHalfKickoff;
    return 45 + Math.floor(elapsed / 60) + 1;
  }
}
```

### 7.2 Minute Text Generation

**Dosya:** `src/utils/matchMinuteText.ts`

**Fonksiyon:** `generateMinuteText(minute, statusId)`

**Kurallar:**
```typescript
// Status-specific labels (minute'a bakılmaksızın)
if (statusId === 3) return 'HT';   // HALF_TIME
if (statusId === 8) return 'FT';   // END
if (statusId === 5) return 'ET';   // OVERTIME
if (statusId === 7) return 'PEN';  // PENALTY_SHOOTOUT

// Injury time indicators
if (statusId === 2 && minute > 45) return '45+'; // FIRST_HALF
if (statusId === 4 && minute > 90) return '90+'; // SECOND_HALF

// Default: minute + apostrophe
if (minute === null) return '—'; // Contract: never null, use "—" instead
return `${minute}'`;
```

**Contract:** `minute_text` her zaman string döner, asla `null` değil.

### 7.3 Minute Storage

**Database Kolonu:** `ts_matches.minute` (INTEGER, nullable)

**Update Logic:**
```typescript
// reconcileMatchToDatabase() içinde
const calculatedMinute = calculateMinuteFromKickoffs(
  live.statusId,
  firstHalfKickoffTs,
  secondHalfKickoffTs,
  overtimeKickoffTs,
  existing.minute,
  nowTs
);

await pool.query(`
  UPDATE ts_matches
  SET minute = $1
  WHERE external_id = $2
`, [calculatedMinute, matchId]);
```

---

## 🗄️ 8. DATABASE SCHEMA

### 8.1 Ana Tablolar

#### ts_matches (Ana Maç Tablosu)

**Kolonlar:**
```sql
id UUID PRIMARY KEY
external_id VARCHAR(255) UNIQUE NOT NULL  -- TheSports API match ID
status_id INTEGER                          -- 1=NOT_STARTED, 2=FIRST_HALF, ...
match_time BIGINT                          -- Unix timestamp
first_half_kickoff_ts BIGINT               -- İlk yarı başlangıç zamanı
second_half_kickoff_ts BIGINT              -- İkinci yarı başlangıç zamanı
overtime_kickoff_ts BIGINT                 -- Uzatma başlangıç zamanı
minute INTEGER                             -- Hesaplanan dakika
provider_update_time BIGINT                -- Provider'dan gelen son güncelleme zamanı
last_event_ts BIGINT                       -- Son event zamanı
home_score_display INTEGER                 -- Ev sahibi skor
away_score_display INTEGER                 -- Deplasman skor
statistics JSONB                           -- İstatistikler
incidents JSONB                            -- Olaylar (gol, kart, değişiklik)
home_team_id VARCHAR(255)
away_team_id VARCHAR(255)
competition_id VARCHAR(255)
season_id VARCHAR(255)
-- ... diğer kolonlar
```

**Indexler:**
- `idx_ts_matches_external_id` - UNIQUE
- `idx_ts_matches_match_time` - Date queries için
- `idx_ts_matches_status_id` - Status queries için

#### ts_teams (Takım Tablosu)

**Kolonlar:**
```sql
id UUID PRIMARY KEY
external_id VARCHAR(255) UNIQUE NOT NULL
name VARCHAR(255)
short_name VARCHAR(100)
logo_url VARCHAR(500)
country_id VARCHAR(255)
competition_id VARCHAR(255)
-- ...
```

#### ts_competitions (Lig Tablosu)

**Kolonlar:**
```sql
id UUID PRIMARY KEY
external_id VARCHAR(255) UNIQUE NOT NULL
name VARCHAR(255)
short_name VARCHAR(255)
logo_url VARCHAR(500)
category_id VARCHAR(255)
country_id VARCHAR(255)
-- ...
```

### 8.2 Optimistic Locking

**Amaç:** Stale update'leri önlemek.

**Mekanizma:**
```typescript
// Update sırasında provider_update_time kontrol edilir
if (existing.provider_update_time && 
    live.updateTime && 
    live.updateTime < existing.provider_update_time) {
  // Provider'dan gelen update eski, skip et
  return { rowCount: 0 };
}
```

**Exception:** Critical transitions (1→2, 2→3, 3→4, 4→8) optimistic locking'i bypass eder.

---

## 🚨 9. MEVCUT SORUNLAR VE ÇÖZÜMLER

### 9.1 IP Whitelist Durumu

**Durum:** ✅ Erişim sorunu yok (kullanıcı onayladı)

**Açıklama:**
- Kod tabanında IP adresi hardcode edilmemiştir.
- TheSports API'ye yapılan tüm istekler backend sunucusunun outbound IP'si ile otomatik olarak yapılır.
- `TheSportsClient` axios instance kullanır ve sistem otomatik olarak doğru IP'yi kullanır.

**VPS IP:** `142.93.103.128` (DigitalOcean Droplet)

### 9.2 Maç Başlamama Sorunu

**Sorun:**
- Bazı maçlar `match_time` geçmiş olmasına rağmen `NOT_STARTED` (status 1) kalıyor.
- Frontend'de canlı maçlar görünmüyor.

**Not:** Erişim sorunu olmadığı için IP whitelist kaynaklı değil. Diğer olası nedenler:
- Provider'ın `/data/update` endpoint'ine bazı maçları eklememesi
- Rate limiting veya timing sorunları
- `ProactiveMatchStatusCheckWorker`'ın diary fallback mantığının güçlendirilmesi gerekebilir

### 9.3 Dakika Bilgisi Sorunu

**Sorun:**
- Bazı maçlarda dakika bilgisi NULL veya yanlış hesaplanıyor.
- Frontend'de "—" görünüyor veya yanlış dakika gösteriliyor.

**Neden:**
- `first_half_kickoff_ts` veya `second_half_kickoff_ts` NULL olabilir.
- Provider'dan minute gelmiyorsa ve kickoff timestamps yoksa hesaplama yapılamıyor.

**Çözüm:**
- `reconcileMatchToDatabase()` içinde fallback mantığı güçlendirildi:
  - `first_half_kickoff_ts` NULL ise `ingestionTs` kullanılır.
  - `second_half_kickoff_ts` NULL ise `first_half_kickoff_ts + 3600` (60 dakika) kullanılır.

### 9.4 Status Transition Gecikmeleri

**Sorun:**
- Maç başlangıcı, devre arası, ikinci yarı, maç bitişi gibi geçişler gecikmeli algılanıyor.

**Neden:**
- Worker'ların çalışma sıklığı yeterli olmayabilir.
- Provider'ın bazı endpoint'leri düzenli güncellememesi.

**Çözüm:**
- Worker sıklıkları optimize edildi:
  - FIRST_HALF maçları: Her 20 saniyede reconcile
  - HALF_TIME maçları: Her 30 saniyede reconcile
  - SECOND_HALF maçları: Her 15 saniyede reconcile

---

## 📈 10. PERFORMANS VE ÖLÇEKLENEBİLİRLİK

### 10.1 Caching Strategy

**Redis Cache:**
- Match recent: 5 dakika TTL
- Match diary: 1 gün TTL
- Team data: 1 gün TTL
- Competition data: 1 gün TTL

**Cache-First Strategy:**
```typescript
1. Check Cache → Redis (in-memory fallback)
2. If miss → Fetch from API/Database
3. Update Cache → Store in Redis
4. Return → Cached or fresh data
```

### 10.2 Rate Limiting

**TheSports API Rate Limit:**
- Window: 1 dakika
- Max Requests: 120 request/dakika
- Implementation: `src/services/thesports/client/rate-limiter.ts`

**Circuit Breaker:**
- API down olduğunda koruma sağlar
- Implementation: `src/utils/circuitBreaker.ts`

### 10.3 Database Optimization

**Indexler:**
- `external_id` - UNIQUE index (upsert operations için)
- `match_time` - Date queries için
- `status_id` - Status queries için

**Query Optimization:**
- Batch operations (bulk insert/update)
- Connection pooling (PostgreSQL pool)

---

## 🎯 11. SONUÇ VE ÖNERİLER

### 11.1 Güçlü Yanlar

1. ✅ **Modüler Mimari:** Clean Code, SOLID principles uygulanmış
2. ✅ **Kapsamlı Worker Sistemi:** 20+ worker ile otomatik sync
3. ✅ **Fallback Mekanizmaları:** WebSocket → HTTP polling → Diary fallback
4. ✅ **Error Handling:** Retry logic, circuit breaker, rate limiting
5. ✅ **Database-First Approach:** Frontend API'ye direkt bağlanmıyor
6. ✅ **Type Safety:** TypeScript strict mode

### 11.2 İyileştirme Önerileri

1. **IP Whitelist:** ✅ Erişim sorunu yok (kullanıcı onayladı)
2. **Monitoring:** Prometheus + Grafana ile monitoring eklenmeli
3. **Alerting:** Kritik hatalar için alerting mekanizması kurulmalı
4. **Testing:** Unit testler ve integration testler eklenmeli
5. **Documentation:** API documentation (Swagger/OpenAPI) eklenmeli
6. **Performance:** Database query optimization, caching improvements

### 11.3 Kısa Vadeli Öncelikler

1. ✅ **IP Whitelist:** Erişim sorunu yok
2. **Worker Logging İyileştirmeleri** (Debugging için)
3. **Status Transition Testleri** (Manuel test senaryoları)
4. **Minute Calculation Validation** (Gerçek maç verileriyle test)

---

## 📚 12. REFERANSLAR

### 12.1 Önemli Dosyalar

- `src/server.ts` - Fastify server entry point
- `src/services/thesports/client/thesports-client.ts` - API client
- `src/services/thesports/match/matchDetailLive.service.ts` - Canlı maç servisi
- `src/jobs/proactiveMatchStatusCheck.job.ts` - Proaktif status kontrol worker
- `src/jobs/dataUpdate.job.ts` - Data update worker
- `src/jobs/matchSync.job.ts` - Match sync worker
- `src/utils/matchMinuteText.ts` - Dakika text generator
- `src/services/thesports/websocket/websocket.service.ts` - WebSocket service

### 12.2 Dokümantasyon Dosyaları

- `README.md` - Proje genel bakış
- `ARCHITECTURE.md` - Mimari prensipler
- `MATCH_START_WORKFLOW.md` - Maç başlama workflow'u
- `HOW_MATCH_START_DETECTION_WORKS.md` - Maç başlama tespiti
- `IP_WHITELIST_BILGI.md` - IP whitelist bilgisi
- `DATABASE_SCHEMA.md` - Database schema

---

**Rapor Sonu**  
*Bu rapor, GoalGPT projesinin kapsamlı bir analizini sunmaktadır. Sorular veya eklemeler için lütfen iletişime geçin.*

