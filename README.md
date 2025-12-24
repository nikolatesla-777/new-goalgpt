# GoalGPT - Football Prediction System

## 📋 Proje Özeti

GoalGPT, canlı futbol maçları için anlık tahminler sunan bir sistemdir. TheSports.com API'den maç verilerini alır, AI tahmin API'si ile eşleştirir ve kullanıcılara gerçek zamanlı güncellemeler sağlar.

**Temel Özellikler:**
- Canlı maç takibi (WebSocket + HTTP polling fallback)
- TheSports.com API entegrasyonu
- AI tahmin eşleştirme (fuzzy matching)
- Gerçek zamanlı bildirimler (gol, kart, değişiklik)
- Modüler ve ölçeklenebilir mimari
- Yüksek performans (Fastify framework)

---

## 🏗️ Mimari Genel Bakış

### Teknoloji Stack

**Backend:**
- **Framework:** Fastify (yüksek performans için Express yerine)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL
- **Cache:** Redis (in-memory fallback mevcut)
- **WebSocket:** ws (TheSports WebSocket API)
- **Scheduling:** node-cron (background workers)
- **Validation:** Joi
- **Logging:** Winston

**Frontend:**
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Inline styles (Tailwind kaldırıldı - debug için)
- **State Management:** React Hooks (useState, useEffect)

**DevOps:**
- **Containerization:** Docker (PostgreSQL)
- **Process Manager:** tsx (development)

---

## 📁 Proje Yapısı

```
project/
├── src/
│   ├── config/              # Konfigürasyon (env, Redis, TheSports)
│   ├── controllers/         # HTTP request/response handlers (NO business logic)
│   ├── services/            # Business logic & external API integration
│   │   └── thesports/       # TheSports API services
│   │       ├── client/      # API client (retry, circuit breaker, rate limiter)
│   │       ├── match/       # Match-related services
│   │       ├── team/        # Team services (data, logos)
│   │       ├── competition/ # Competition services
│   │       └── websocket/   # WebSocket service (real-time updates)
│   ├── routes/              # Fastify route definitions
│   ├── repositories/        # Data access layer (Repository Pattern)
│   ├── jobs/                # Background workers (cron jobs)
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
│   │   │   └── LeagueSection.tsx
│   │   ├── utils/           # Frontend utilities
│   │   ├── App.tsx          # Main React component
│   │   └── main.tsx         # React entry point
│   └── package.json
│
├── docker-compose.yml       # PostgreSQL container
├── package.json
└── README.md                # Bu dosya
```

---

## 🎯 Mimari Prensipler

### 1. Layered Architecture (Katmanlı Mimari)

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
  Repository (repositories/*.ts) - Data access
    ↓
  Database/External API
```

**Kurallar:**
- ❌ Controller'dan direkt database/API çağrısı YAPILMAZ
- ❌ Service'de HTTP request/response handling YAPILMAZ
- ✅ Her katman sadece kendi sorumluluğunu yerine getirir

### 2. Service Layer Pattern

**Controller Örneği:**
```typescript
// controllers/match.controller.ts
export const getMatchRecentList = async (
  request: FastifyRequest<{ Querystring: MatchRecentParams }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const params: MatchRecentParams = { /* extract from query */ };
    const result = await matchRecentService.getMatchRecentList(params);
    reply.send({ success: true, data: result });
  } catch (error: any) {
    reply.status(500).send({ success: false, message: error.message });
  }
};
```

**Service Örneği:**
```typescript
// services/thesports/match/matchRecent.service.ts
export class MatchRecentService {
  async getMatchRecentList(params: MatchRecentParams): Promise<MatchRecentResponse> {
    // 1. Check cache
    // 2. Fetch from API
    // 3. Transform data
    // 4. Enrich with team/competition data
    // 5. Cache result
    // 6. Return
  }
}
```

### 3. Single Responsibility Principle

Her dosya **tek bir sorumluluğa** sahiptir:

- `matchRecent.service.ts` → Sadece `/match/recent/list` endpoint'i
- `matchDiary.service.ts` → Sadece `/match/diary` endpoint'i
- `teamData.service.ts` → Sadece takım verileri
- `matchEnricher.service.ts` → Sadece maç verilerini zenginleştirme

### 4. No Magic Strings/Numbers

❌ **Yanlış:**
```typescript
if (match.status === 1) { ... }
```

✅ **Doğru:**
```typescript
import { MatchState } from '../types/thesports/enums';
if (match.status === MatchState.NOT_STARTED) { ... }
```

### 5. Function Length Constraint

**Kural:** Fonksiyonlar 20-30 satırı geçmemeli. Geçerse refactor edilmeli.

---

## 🔧 TheSports API Entegrasyonu

### API Client (`TheSportsClient`)

**Özellikler:**
- ✅ Retry Logic (Exponential Backoff)
- ✅ Circuit Breaker Pattern
- ✅ Rate Limiting
- ✅ Error Handling & Logging
- ✅ IP Whitelisting (TheSports gereksinimi)

**Kullanım:**
```typescript
const client = new TheSportsClient();
const response = await client.get<MatchRecentResponse>('/match/recent/list', {
  page: 1,
  limit: 50
});
```

### Implemented Endpoints

**Match Services:**
- ✅ `/match/recent/list` - Son maçlar (MatchRecentService)
- ✅ `/match/diary` - Günlük maç listesi (MatchDiaryService)
- ✅ `/match/season/recent` - Sezon maçları (MatchSeasonRecentService)
- ✅ `/match/:id/detail-live` - Canlı maç detayı (MatchDetailLiveService)
- ✅ `/match/:id/lineup` - Kadro bilgisi (MatchLineupService)
- ✅ `/match/:id/team-stats` - Takım istatistikleri (MatchTeamStatsService)
- ✅ `/match/:id/player-stats` - Oyuncu istatistikleri (MatchPlayerStatsService)

**Team Services:**
- ✅ `/team/list` - Takım listesi (TeamDataService)
- ✅ `/team/detail` - Takım detayı (TeamDataService)
- ✅ Team logo fetching (TeamLogoService)

**Competition Services:**
- ✅ Competition data enrichment (CompetitionService)
- ✅ Competition logos

### Data Enrichment Strategy

**Match Enricher Service:**
```typescript
// services/thesports/match/matchEnricher.service.ts
export class MatchEnricherService {
  async enrichMatches(matches: MatchRecent[]): Promise<EnrichedMatch[]> {
    // 1. Collect unique team IDs and competition IDs
    // 2. Batch fetch team data (cache-first strategy)
    // 3. Batch fetch competition data
    // 4. Enrich each match with:
    //    - home_team (name, logo_url)
    //    - away_team (name, logo_url)
    //    - competition (name, logo_url)
    // 5. Return enriched matches
  }
}
```

**Cache-First Strategy:**
1. **Cache** → Redis (in-memory fallback)
2. **Database** → PostgreSQL (teams, competitions tables)
3. **API** → TheSports API (if not in cache/DB)

---

## 🔄 Background Workers

### 1. TeamDataSyncWorker
**Amaç:** Eksik takım verilerini TheSports API'den çekip database'e kaydetmek.

**Çalışma Sıklığı:** Her 1 saat
**Dosya:** `src/jobs/teamDataSync.job.ts`

### 2. TeamLogoSyncWorker
**Amaç:** Eksik takım logolarını çekip database'e kaydetmek.

**Çalışma Sıklığı:** Her 2 saat
**Dosya:** `src/jobs/teamLogoSync.job.ts`

### 3. MatchSyncWorker
**Amaç:** Maç verilerini incremental olarak güncellemek (sadece değişen maçlar).

**Çalışma Sıklığı:** Her 5 dakika
**Dosya:** `src/jobs/matchSync.job.ts`

**Incremental Update Logic:**
```typescript
// Sadece son sync'ten sonra değişen maçları çek
const lastSync = await getLastSyncTimestamp();
const recentMatches = await client.get('/match/recent/list', { limit: 100 });
const changedMatches = recentMatches.results.filter(match => 
  match.match_time > lastSync || match.status_changed
);
```

---

## 🌐 WebSocket Integration

### WebSocket Service

**Dosya:** `src/services/thesports/websocket/websocket.service.ts`

**Özellikler:**
- ✅ Auto-reconnect (exponential backoff)
- ✅ Ping/pong health checks
- ✅ Message parsing & validation
- ✅ Event detection (goals, cards, substitutions)
- ✅ Cache updates (immediate cache refresh)

**Event Types:**
- `goal` - Gol atıldı
- `card` - Kart gösterildi
- `substitution` - Oyuncu değişikliği
- `score_change` - Skor değişti
- `match_status_change` - Maç durumu değişti

**Kullanım:**
```typescript
const websocketService = new WebSocketService();
websocketService.onEvent((event) => {
  logger.info(`Event: ${event.type} for match ${event.matchId}`);
  // Update database, send notifications, etc.
});
await websocketService.connect();
```

**Fallback Strategy:**
- WebSocket bağlantısı başarısız olursa → HTTP polling devreye girer
- Background workers HTTP polling yapar (her 5 dakika)

---

## 💾 Database Architecture

### Tables

**Teams Table:**
```sql
CREATE TABLE ts_teams (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  short_name VARCHAR(100),
  logo_url TEXT,
  country_id VARCHAR(50),
  competition_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Competitions Table:**
```sql
CREATE TABLE ts_competitions (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Migration Strategy

**Stream-Based CSV Import:**
- ❌ `fs.readFileSync` (500MB+ dosyalar için OOM hatası)
- ✅ `fs.createReadStream` + `csv-parse` stream mode
- ✅ `stream.Transform` for data transformation
- ✅ `stream/promises.pipeline` for error handling

**Dosya:** `src/database/import-csv.ts`

---

## 🎨 Frontend Architecture

### Component Structure

**App.tsx:**
- Main layout
- View switching (recent/diary)
- Navigation tabs

**MatchList.tsx:**
- Data fetching (useEffect)
- Loading/error states
- Match grouping by competition
- Auto-refresh (30 seconds)

**LeagueSection.tsx:**
- Competition header (name, logo)
- Match list rendering

**MatchCard.tsx:**
- Individual match display
- Team logos & names
- Score display
- Live/finished indicators

### API Client

**Dosya:** `frontend/src/api/matches.ts`

**Functions:**
- `getRecentMatches(params)` - Son maçları çek
- `getMatchDiary(date)` - Günlük maç listesi

**Error Handling:**
- IP authorization errors (TheSports)
- Rate limiting errors (429)
- Network errors

---

## 🔐 Error Handling

### TheSports API Error Format

TheSports API iki farklı error formatı kullanır:

1. **`err` field:**
```json
{
  "results": [],
  "err": "IP is not authorized"
}
```

2. **`code` + `msg` fields:**
```json
{
  "code": 429,
  "msg": "Too Many Requests.",
  "results": []
}
```

**Backend'de her iki format kontrol edilir:**
```typescript
// Check for 'code' and 'msg' (primary)
if ((response as any)?.code && (response as any).code !== 200) {
  const errorMsg = (response as any).msg || 'TheSports API error';
  return { results: [], err: errorMsg };
}

// Check for 'err' field (backward compatibility)
if (response.err) {
  return { results: [], err: response.err };
}
```

### Centralized Error Handler

**Dosya:** `src/utils/thesports/error-handler.ts`

**Functions:**
- `formatTheSportsError(error)` - Error'u formatla
- `logTheSportsError(error, context)` - Error'u logla

---

## 📦 Caching Strategy

### Cache Service

**Dosya:** `src/utils/cache/cache.service.ts`

**Strategy:** Cache-First (Stale-While-Revalidate)

1. **Check Cache** → Redis (in-memory fallback)
2. **If miss** → Fetch from API/Database
3. **Update Cache** → Store in Redis
4. **Return** → Cached or fresh data

**Cache TTL:**
- Match recent: 5 minutes
- Match diary: 1 day
- Team data: 1 day
- Competition data: 1 day

**Cache Keys:**
```
thesports:match:recent:page:1:limit:50
thesports:match:diary:2024-12-18
thesports:team:12345
thesports:competition:67890
```

---

## 🚀 Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükle

```bash
# Backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Environment Variables

`.env` dosyası oluştur:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/goalgpt

# TheSports API
THESPORTS_API_BASE_URL=https://api.thesports.com/v1/football
THESPORTS_API_SECRET=your_secret
THESPORTS_API_USER=goalgpt
THESPORTS_WEBSOCKET_URL=wss://api.thesports.com/v1/football/ws

# Server
PORT=3000
HOST=0.0.0.0

# Redis (optional, in-memory fallback if not set)
REDIS_URL=redis://localhost:6379
```

### 3. Database Setup

```bash
# Docker ile PostgreSQL başlat
docker-compose up -d

# Database migration
npm run migrate

# CSV import (stream-based)
npm run import-csv
```

### 4. Backend'i Başlat

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Frontend'i Başlat

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:5173`
Backend API: `http://localhost:3000/api`

---

## 📡 API Endpoints

### Match Endpoints

**GET `/api/matches/recent`**
- Son maçları getir
- Query params: `page`, `limit`, `competition_id`, `season_id`, `date`

**GET `/api/matches/diary`**
- Günlük maç listesi
- Query params: `date` (YYYY-MM-DD)

**GET `/api/matches/season/recent`**
- Sezon maçları
- Query params: `season_id`, `page`, `limit`

**GET `/api/matches/:match_id/detail-live`**
- Canlı maç detayı

**GET `/api/matches/:match_id/lineup`**
- Kadro bilgisi

**GET `/api/matches/:match_id/team-stats`**
- Takım istatistikleri

**GET `/api/matches/:match_id/player-stats`**
- Oyuncu istatistikleri

### Health Check

**GET `/health`**
- Server durumu

---

## 🔍 Debugging

### Logging

**Backend Logging:**
- Winston logger (`src/utils/logger.ts`)
- Log files: `logs/combined.log`, `logs/error.log`
- Console output (development)

**Frontend Logging:**
- Browser console
- Network tab (DevTools)

### Common Issues

**1. IP Authorization Error:**
- **Problem:** TheSports API "IP is not authorized" hatası
- **Çözüm:** TheSports panel'den IP adresini whitelist'e ekle
- **IP Kontrolü:** `curl https://api.ipify.org?format=json`

**2. Rate Limiting (429):**
- **Problem:** "Too Many Requests" hatası
- **Çözüm:** Rate limiter ayarlarını kontrol et, birkaç dakika bekle

**3. WebSocket Connection Failed:**
- **Problem:** WebSocket bağlantısı kurulamıyor
- **Çözüm:** HTTP polling fallback devreye girer (otomatik)

**4. Frontend White Screen:**
- **Problem:** Frontend render olmuyor
- **Çözüm:** Browser console'u kontrol et, API endpoint'lerini kontrol et

---

## 🎯 Gelecek Geliştirmeler (TODO)

### Backend
- [ ] AI Predictions API entegrasyonu
- [ ] Fuzzy matching service (AI predictions ↔ TheSports matches)
- [ ] SignalR events (real-time notifications)
- [ ] User subscription management
- [ ] Authentication & Authorization (JWT)
- [ ] Rate limiting middleware
- [ ] API documentation (Swagger/OpenAPI)

### Frontend
- [ ] Date selector component
- [ ] Match detail page
- [ ] Live match updates (WebSocket)
- [ ] User authentication
- [ ] Subscription management
- [ ] Responsive design improvements

### Infrastructure
- [ ] Redis production setup
- [ ] Monitoring & Alerting (Prometheus, Grafana)
- [ ] CI/CD pipeline
- [ ] Load testing
- [ ] Database backup strategy

---

## 📚 Önemli Notlar

### IP Whitelisting

TheSports API IP whitelisting gerektirir. Production'da:
1. Server'ın public IP'sini al: `curl https://api.ipify.org?format=json`
2. TheSports panel'den IP'yi ekle
3. 2-3 dakika bekle (propagation)

### Rate Limiting

TheSports API rate limit:
- **Window:** 1 dakika
- **Max Requests:** 120 request/dakika
- **Implementation:** `src/services/thesports/client/rate-limiter.ts`

### Timestamp Conversion

TheSports API Unix timestamp kullanır (seconds). JavaScript Date'e çevirme:
```typescript
const date = new Date(timestamp * 1000); // Multiply by 1000 for milliseconds
```

### Database Idempotency

Upsert operations için `ON CONFLICT DO UPDATE` kullanılır:
```sql
INSERT INTO ts_teams (external_id, name, logo_url)
VALUES ($1, $2, $3)
ON CONFLICT (external_id) 
DO UPDATE SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url;
```

---

## 🤝 Katkıda Bulunma

### Code Review Checklist

- [ ] No function exceeds 30 lines
- [ ] No magic strings/numbers (use enums/constants)
- [ ] Controllers don't contain business logic
- [ ] Services don't directly query database
- [ ] Error handling uses centralized error handler
- [ ] Logging uses logger utility (not console.log)
- [ ] TypeScript types are properly defined
- [ ] Single Responsibility Principle is followed
- [ ] Code is modular and reusable
- [ ] **FASTIFY is used, NOT Express**

---

## 📝 License

[License bilgisi buraya]

---

## 👥 İletişim

[İletişim bilgileri buraya]

---

**Son Güncelleme:** 2024-12-18
**Versiyon:** 1.0.0
