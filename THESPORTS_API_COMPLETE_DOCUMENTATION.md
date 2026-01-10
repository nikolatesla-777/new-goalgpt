# TheSports API - Kapsamlı Entegrasyon Dokümantasyonu

**Proje:** GoalGPT Backend  
**Versiyon:** 3.0  
**Tarih:** 9 Ocak 2026

---

## 1. GENEL BAKIŞ

GoalGPT, futbol maçları için AI destekli tahmin platformudur. TheSports API ile entegre çalışır.

### API Kimlik Bilgileri
```typescript
const API_CONFIG = {
  baseUrl: 'https://api.thesports.com/v1/football',
  user: '7M_test',
  secret: 'your_secret_key'
};
```

---

## 2. SCORE ARRAY FORMAT ⚠️ KRİTİK

API'den gelen skorlar Array[7] formatındadır:

```
Index 0: regular_score      - Normal süre skoru
Index 1: halftime_score     - İlk yarı skoru
Index 2: red_cards          - Kırmızı kart
Index 3: yellow_cards       - Sarı kart
Index 4: corners            - Korner
Index 5: overtime_score     - Uzatma skoru
Index 6: penalty_score      - Penaltı skoru
```

**Skor Hesaplama:**
```typescript
function calculateDisplayScore(scores: number[]): number {
  const regular = scores[0] || 0;
  const overtime = scores[5] || 0;
  const penalty = scores[6] || 0;
  
  return overtime > 0 ? overtime + penalty : regular + penalty;
}
```

---

## 3. MATCH STATUS ENUM

```typescript
enum MatchStatus {
  NOT_STARTED = 1,
  FIRST_HALF = 2,
  HALF_TIME = 3,
  SECOND_HALF = 4,
  OVERTIME = 5,
  PENALTY_SHOOTOUT = 7,
  ENDED = 8,
  POSTPONED = 9,
  CANCELLED = 10
}

// Canlı durumlar
const LIVE_STATUSES = [2, 3, 4, 5, 7];
```

---

## 4. API ENDPOINTS

### 4.1 Maç Listesi
**GET /match/recent/list**
```typescript
// Parametreler
{
  date?: string,           // YYYYMMDD
  competition_ids?: string, // Virgülle ayrılmış
  page?: number
}

// Yanıt
{
  id: string,
  competition_id: string,
  season_id: string,
  home_team_id: string,
  away_team_id: string,
  status_id: number,
  home_scores: number[],   // Array[7]
  away_scores: number[],   // Array[7]
  match_time: number,      // Unix timestamp
  kickoff_ts: number | null,
  venue_id: string,
  referee_id: string,
  round: number,
  neutral: number,
  coverage_mlive: number,
  coverage_lineup: number,
  environment: {
    weather?: number,      // 1-13
    temperature?: string,
    humidity?: string
  }
}
```

### 4.2 Günlük Maç Bülteni
**GET /match/diary**
```typescript
{
  date: string,    // YYYYMMDD
  timezone?: number // Türkiye = 3
}
```

### 4.3 Canlı Maç Detayı ⭐ EN ÖNEMLİ
**GET /match/detail_live**
```typescript
{
  id: string,
  status_id: number,
  home_scores: number[],
  away_scores: number[],
  kickoff_ts: number,
  second_half_kickoff_ts: number,
  overtime_kickoff_ts: number,
  stats: Array<{
    type: number,    // StatsType enum
    home: number,
    away: number
  }>,
  incidents: Array<{
    type: number,    // IncidentType enum
    time: number,
    addtime?: number, // 90+3 için 3
    position: number, // 1=home, 2=away
    player_id?: string
  }>,
  tlive: Array<{
    type: number,
    time: number,
    data: string
  }>
}
```

### 4.4 Real-time Updates ⭐ KRİTİK
**GET /data/update**
```typescript
// Her 20 saniyede çağrılır
{
  time?: number  // Son X saniye (default: 20)
}

// Yanıt
{
  match: Array<{id: string, update_time: number}>,
  team: Array<{id: string, update_time: number}>,
  competition: Array<...>,
  player: Array<...>
}
```

### 4.5 Kadro
**GET /match/lineup**
```typescript
{
  home: {
    formation: string,  // "4-3-3"
    lineup: Array<{
      id: string,
      shirt_number: number,
      position: number,
      x: number,
      y: number
    }>,
    subs: Array<...>
  },
  away: {...},
  confirmed: number
}
```

### 4.6 H2H
**GET /match/h2h**
```typescript
{
  h2h: MatchData[],      // Karşılaşma geçmişi
  home_last: MatchData[], // Ev sahibi son maçlar
  away_last: MatchData[]  // Deplasman son maçlar
}
```

### 4.7 Puan Durumu
**GET /season/standings**
```typescript
Array<{
  team_id: string,
  position: number,
  played: number,
  won: number,
  drawn: number,
  lost: number,
  goals_for: number,
  goals_against: number,
  points: number,
  recent_form: string  // "WWLDW"
}>
```

---

## 5. ENUM TANIMLARI

### IncidentType
```typescript
enum IncidentType {
  GOAL = 1,
  YELLOW_CARD = 2,
  RED_CARD = 3,
  SECOND_YELLOW = 4,
  SUBSTITUTION = 5,
  PENALTY_GOAL = 6,
  OWN_GOAL = 7,
  PENALTY_MISS = 8,
  VAR_GOAL = 9,
  VAR_NO_GOAL = 10,
  INJURY = 11
}
```

### StatsType
```typescript
enum StatsType {
  SHOTS = 1,
  SHOTS_ON_TARGET = 2,
  ATTACKS = 3,
  DANGEROUS_ATTACKS = 4,
  POSSESSION = 5,
  CORNERS = 6,
  YELLOW_CARDS = 7,
  RED_CARDS = 8,
  FOULS = 13,
  GOALKEEPER_SAVES = 12
}
```

### Weather
```typescript
enum Weather {
  SUNNY = 1,
  PARTLY_CLOUDY = 2,
  CLOUDY = 3,
  OVERCAST = 4,
  LIGHT_RAIN = 5,
  RAIN = 6,
  HEAVY_RAIN = 7,
  THUNDERSTORM = 8,
  SNOW = 9,
  FOG = 11
}
```

---

## 6. DATABASE ŞEMASI

### ts_matches
```sql
CREATE TABLE ts_matches (
  id TEXT PRIMARY KEY,
  competition_id TEXT,
  season_id TEXT,
  home_team_id TEXT,
  away_team_id TEXT,
  status_id INTEGER DEFAULT 1,
  home_scores JSONB DEFAULT '[0,0,0,0,0,0,0]',
  away_scores JSONB DEFAULT '[0,0,0,0,0,0,0]',
  match_time BIGINT NOT NULL,
  kickoff_ts BIGINT,
  second_half_kickoff_ts BIGINT,
  round INTEGER,
  neutral INTEGER DEFAULT 0,
  venue_id TEXT,
  referee_id TEXT,
  environment JSONB,
  stats JSONB,
  incidents JSONB,
  tlive JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### ts_standings
```sql
CREATE TABLE ts_standings (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  position INTEGER,
  played INTEGER DEFAULT 0,
  won INTEGER DEFAULT 0,
  drawn INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  home_won INTEGER DEFAULT 0,
  home_drawn INTEGER DEFAULT 0,
  home_lost INTEGER DEFAULT 0,
  away_won INTEGER DEFAULT 0,
  away_drawn INTEGER DEFAULT 0,
  away_lost INTEGER DEFAULT 0,
  recent_form TEXT,
  UNIQUE(season_id, team_id)
);
```

---

## 7. WORKER YAPISI

### DailyMatchSyncWorker
- **Zamanlama:** 00:05 (Türkiye)
- **Endpoint:** /match/diary
- **İşlev:** Dün, bugün, yarın maçlarını sync

### DataUpdateWorker
- **Interval:** 20 saniye
- **Endpoint:** /data/update
- **İşlev:** Değişen maçları reconcile

### MatchWatchdogWorker
- **Interval:** 60 saniye
- **İşlev:** Stale maçları kontrol et

---

## 8. WEBSOCKET (MQTT)

```typescript
const MQTT = {
  host: 'mq.thesports.com',
  port: 1883,
  topics: {
    score: 'thesports/score/#',
    incident: 'thesports/incident/#',
    stats: 'thesports/stats/#'
  }
};
```

---

## 9. DEPLOYMENT

```bash
# VPS: 142.93.103.128
ssh root@142.93.103.128
cd /var/www/goalgpt
git pull && npm install && npm run build
pm2 restart goalgpt-backend
```

---

## 10. ÖNCELİKLİ GÖREVLER

1. **TheSportsAPIManager** singleton oluştur
2. **matchSync.service** - Ana sync servisi
3. **dataUpdate.service** - 20s polling
4. **websocket.service** - MQTT client
5. **Workers** - DailySync, DataUpdate, Watchdog

---

**Doküman Sonu**
