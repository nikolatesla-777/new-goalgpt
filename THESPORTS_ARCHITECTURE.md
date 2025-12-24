# TheSports API Mimari Stratejisi

## 🔍 TheSports API Mantığı

### 1. `/match/recent/list` Endpoint'i

**Parametreler:**
- `page` + `limit`: Pagination (tüm maçları sayfa sayfa çeker)
- `time`: Unix timestamp - **Incremental fetch için** (son 30 gün sınırı)
- ❌ `date` parametresi **YOK** - Bu endpoint date parametresini desteklemiyor!

**Kullanım Senaryoları:**
1. **İlk Sync:** Tüm maçları sayfa sayfa çekip database'e kaydet
2. **Incremental Sync:** `time` parametresi ile son sync'ten sonraki değişiklikleri çek

### 2. `/match/diary` Endpoint'i

**Parametreler:**
- `date`: `yyyyMMdd` formatında (örn: `20251219`)
- ✅ Belirli bir günün maçlarını getirir
- ❌ **İzin gerektirir** - "Beyond the scope of account permissions" hatası veriyor

**Kullanım Senaryosu:**
- Eğer izin varsa, belirli bir günün maçlarını direkt çekebilirsin
- Şu anki API key'de izin yok, bu yüzden kullanılamıyor

---

## 🏗️ Doğru Mimari Stratejisi

### Strateji 1: Database-First Approach (ÖNERİLEN)

**Mantık:**
1. **Backend Worker:** Tüm maçları `/match/recent/list` ile sayfa sayfa çekip **database'e kaydet**
2. **Backend API:** Frontend'den gelen tarih bazlı istekleri **database'den** karşıla
3. **Frontend:** Backend API'den tarih bazlı query yap

**Avantajlar:**
- ✅ API rate limit'inden etkilenmez
- ✅ Hızlı query (database index ile)
- ✅ Offline çalışabilir (cache ile)
- ✅ Tarih bazlı filtreleme kolay

**Dezavantajlar:**
- ❌ İlk sync uzun sürebilir
- ❌ Database storage gerektirir

### Strateji 2: Hybrid Approach

**Mantık:**
1. **Backend Worker:** Tüm maçları database'e kaydet (background)
2. **Backend API:** 
   - Önce database'den query yap
   - Eğer database'de yoksa, API'den çek ve database'e kaydet
3. **Frontend:** Backend API'den query yap

**Avantajlar:**
- ✅ Database'de varsa hızlı
- ✅ Database'de yoksa API'den çeker
- ✅ Progressive improvement

---

## 📋 Mevcut Durum ve Sorunlar

### ❌ Şu Anki Yaklaşım (YANLIŞ)

1. **Frontend:** Direkt API'den çekmeye çalışıyor
2. **Progressive Loading:** Sayfa sayfa çekip client-side filtreleme yapıyor
3. **Sorunlar:**
   - `/match/recent/list` date parametresini desteklemiyor
   - `/match/diary` izin gerektiriyor
   - Client-side filtreleme çok verimsiz
   - Rate limiting riski
   - Timeout riski

### ✅ Doğru Yaklaşım

1. **Backend Worker:** `DailyMatchSyncWorker` tüm maçları database'e kaydetmeli
2. **Backend Repository:** Database'den tarih bazlı query yapmalı
3. **Backend API:** `/api/matches/by-date?date=2025-12-19` endpoint'i oluştur
4. **Frontend:** Backend API'den tarih bazlı query yap

---

## 🔧 Uygulama Planı

### Adım 1: Database Schema

```sql
CREATE TABLE ts_matches (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE NOT NULL,
  season_id VARCHAR(255),
  competition_id VARCHAR(255),
  home_team_id VARCHAR(255),
  away_team_id VARCHAR(255),
  status_id INTEGER,
  match_time BIGINT, -- Unix timestamp
  venue_id VARCHAR(255),
  referee_id VARCHAR(255),
  neutral BOOLEAN,
  note TEXT,
  home_scores INTEGER[],
  away_scores INTEGER[],
  home_position INTEGER,
  away_position INTEGER,
  coverage_mlive INTEGER,
  coverage_lineup INTEGER,
  stage_id VARCHAR(255),
  round_num INTEGER,
  group_num INTEGER,
  related_id VARCHAR(255),
  agg_score INTEGER[],
  environment_weather INTEGER,
  environment_pressure VARCHAR(50),
  environment_temperature VARCHAR(50),
  environment_wind VARCHAR(50),
  environment_humidity VARCHAR(50),
  tbd BOOLEAN,
  has_ot BOOLEAN,
  ended BIGINT,
  team_reverse BOOLEAN,
  external_updated_at BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for date queries
CREATE INDEX idx_ts_matches_match_time ON ts_matches(match_time);
CREATE INDEX idx_ts_matches_external_id ON ts_matches(external_id);
```

### Adım 2: Match Repository

```typescript
// repositories/implementations/MatchRepository.ts
export class MatchRepository {
  async findByDateRange(startDate: Date, endDate: Date): Promise<Match[]> {
    const startUnix = Math.floor(startDate.getTime() / 1000);
    const endUnix = Math.floor(endDate.getTime() / 1000);
    
    const query = `
      SELECT * FROM ts_matches
      WHERE match_time >= $1 AND match_time < $2
      ORDER BY match_time ASC
    `;
    
    return await db.query(query, [startUnix, endUnix]);
  }
  
  async upsertMany(matches: Match[]): Promise<void> {
    // Batch upsert with ON CONFLICT
  }
}
```

### Adım 3: Backend Service

```typescript
// services/match/matchByDate.service.ts
export class MatchByDateService {
  constructor(
    private matchRepository: MatchRepository,
    private matchEnricher: MatchEnricherService
  ) {}
  
  async getMatchesByDate(date: Date): Promise<EnrichedMatch[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const matches = await this.matchRepository.findByDateRange(startOfDay, endOfDay);
    return await this.matchEnricher.enrichMatches(matches);
  }
}
```

### Adım 4: Backend Controller & Route

```typescript
// controllers/match.controller.ts
export const getMatchesByDate = async (
  request: FastifyRequest<{ Querystring: { date: string } }>,
  reply: FastifyReply
): Promise<void> => {
  const date = new Date(request.query.date);
  const matches = await matchByDateService.getMatchesByDate(date);
  reply.send({ success: true, data: matches });
};

// routes/match.routes.ts
fastify.get('/matches/by-date', getMatchesByDate);
```

### Adım 5: DailyMatchSyncWorker Güncelleme

```typescript
// jobs/dailyMatchSync.job.ts
export class DailyMatchSyncWorker {
  async syncAllMatches(): Promise<void> {
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.matchRecentService.getMatchRecentList({
        page,
        limit: 50
      });
      
      // Save to database
      await this.matchRepository.upsertMany(response.results);
      
      if (response.results.length < 50) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }
}
```

### Adım 6: Frontend Güncelleme

```typescript
// frontend/src/api/matches.ts
export async function getMatchesByDate(date: string): Promise<Match[]> {
  const response = await fetch(`${API_BASE_URL}/matches/by-date?date=${date}`);
  const data = await response.json();
  return data.data;
}

// frontend/src/components/MatchList.tsx
const fetchMatches = async () => {
  if (view === 'diary') {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const matches = await getMatchesByDate(dateStr);
    setMatches(matches);
  }
};
```

---

## 🎯 Özet

**TheSports API'nin doğru kullanımı:**

1. ✅ **Backend Worker:** Tüm maçları `/match/recent/list` ile sayfa sayfa çekip database'e kaydet
2. ✅ **Backend API:** Database'den tarih bazlı query yap
3. ✅ **Frontend:** Backend API'den tarih bazlı query yap

**Yapılmaması gerekenler:**

1. ❌ Frontend'den direkt API'ye tarih bazlı istek atmak
2. ❌ Progressive loading ile sayfa sayfa çekip client-side filtreleme yapmak
3. ❌ `/match/recent/list` endpoint'ine `date` parametresi göndermek (desteklenmiyor)

---

## 📝 Sonraki Adımlar

1. ✅ Database schema oluştur
2. ✅ MatchRepository implementasyonu
3. ✅ MatchByDateService oluştur
4. ✅ Backend endpoint ekle (`/api/matches/by-date`)
5. ✅ DailyMatchSyncWorker'ı database'e kaydetmeye başlat
6. ✅ Frontend'i güncelle

