# 🔄 Maç Canlıya Alma ve Sonuçlandırma - Adım Adım Workflow

**Tarih:** 2025-12-24  
**Sistem:** GoalGPT Backend - DigitalOcean + Supabase

---

## 📋 ADIM 1: Maçlar Database'e Yüklenir

### 1.1 Bootstrap Service (Server Başlangıcında)
```
Endpoint: GET /match/diary?date=YYYYMMDD
Servis: MatchDiaryService.getMatchDiary()
Worker: BootstrapService.init()
```

**Ne Yapıyor:**
- Bugünkü maçları `/match/diary` endpoint'inden çeker
- Database'e `ts_matches` tablosuna kaydeder
- **Başlangıç Durumu:**
  - `status_id = 1` (NOT_STARTED)
  - `match_time = 1774544400` (Unix timestamp)
  - `minute = NULL`
  - `first_half_kickoff_ts = NULL`
  - `second_half_kickoff_ts = NULL`

**Database Sonucu:**
```sql
INSERT INTO ts_matches (
  external_id,
  status_id,
  match_time,
  home_team_id,
  away_team_id,
  competition_id
) VALUES (
  'match123',
  1,  -- NOT_STARTED
  1774544400,
  'team1',
  'team2',
  'comp1'
);
```

---

## 📋 ADIM 2: Maç Canlıya Geçiş (NOT_STARTED → FIRST_HALF)

### 2.1 MatchWatchdogWorker (Her 20 Saniyede)
```
Servis: MatchWatchdogService.findShouldBeLiveMatches()
Worker: MatchWatchdogWorker.tick() (her 20s)
```

**Ne Yapıyor:**
- Database'de `status_id=1` ve `match_time <= now` olan maçları bulur
- Bu maçlar "should-be-live" (canlı olmalı)

**Kod:**
```typescript
// src/jobs/matchWatchdog.job.ts:85
const shouldBeLive = await this.matchWatchdogService.findShouldBeLiveMatches(nowTs, 1440, 100);
```

### 2.2 Recent/List Kontrolü
```
Endpoint: GET /match/recent/list?page=1&limit=500
Servis: MatchRecentService.getMatchRecentList()
Worker: MatchWatchdogWorker.tick()
```

**Ne Yapıyor:**
- Maçın `/match/recent/list`'te olup olmadığını kontrol eder
- Eğer maç listede ve `status_id IN (2,3,4,5,7)` ise → **LIVE**

**Kod:**
```typescript
// src/jobs/matchWatchdog.job.ts:54
const recentListResponse = await this.matchRecentService.getMatchRecentList({ page: 1, limit: 500 }, true);
const recentListMatch = recentListAllMatches.get(match.matchId);

if (recentListMatch && [2,3,4,5,7].includes(recentListMatch.statusId)) {
  // Status güncelle: 1 → 2 (FIRST_HALF)
}
```

### 2.3 Status Güncelleme (Optimistic Locking)
```
Servis: MatchWatchdogWorker (direct SQL update)
Worker: MatchWatchdogWorker.tick()
```

**Ne Yapıyor:**
- Database'de `status_id`'yi günceller: `1 → 2` (FIRST_HALF)
- `provider_update_time` kaydeder

**Kod:**
```typescript
// src/jobs/matchWatchdog.job.ts:482-508
await client.query(
  `UPDATE ts_matches 
   SET status_id = $1,
       provider_update_time = $2,
       updated_at = NOW()
   WHERE external_id = $3 
     AND status_id = 1`,  -- Optimistic locking: sadece status=1 ise güncelle
  [recentListMatch.statusId, recentListMatch.updateTime, matchId]
);
```

### 2.4 Detail_Live Çek (Detaylı Bilgi)
```
Endpoint: GET /match/detail_live?match_id=xxx
Servis: MatchDetailLiveService.reconcileMatchToDatabase()
Worker: MatchWatchdogWorker.tick()
```

**Ne Yapıyor:**
- Maçın detaylı bilgilerini çeker (score, minute, events)
- Database'i günceller

**Kod:**
```typescript
// src/jobs/matchWatchdog.job.ts:515
const reconcileResult = await this.matchDetailLiveService.reconcileMatchToDatabase(
  match.matchId,
  recentListMatch.updateTime
);
```

### 2.5 First Half Kickoff Time Set
```
Servis: MatchDetailLiveService.reconcileMatchToDatabase()
```

**Ne Yapıyor:**
- `first_half_kickoff_ts` set eder (maç başlama zamanı)
- Bu timestamp dakika hesaplama için kullanılacak

**Kod:**
```typescript
// src/services/thesports/match/matchDetailLive.service.ts:400-412
if ((live.statusId === 2 || live.statusId === 3 || live.statusId === 4 || live.statusId === 5 || live.statusId === 7) 
    && existing.first_half_kickoff_ts === null) {
  setParts.push(`first_half_kickoff_ts = $${i++}`);
  values.push(finalKickoffTime);
}
```

**Database Sonucu:**
```sql
UPDATE ts_matches
SET status_id = 2,  -- FIRST_HALF
    first_half_kickoff_ts = 1774545000,
    provider_update_time = 1774545000,
    updated_at = NOW()
WHERE external_id = 'match123';
```

---

## 📋 ADIM 3: Dakika İlerlemesi (FIRST_HALF)

### 3.1 MatchMinuteWorker (Her 30 Saniyede)
```
Servis: MatchMinuteService.calculateMinute()
Worker: MatchMinuteWorker.tick() (her 30s)
```

**Ne Yapıyor:**
- Tüm canlı maçlar için dakika hesaplar
- Database'e `minute` field'ını yazar

**Kod:**
```typescript
// src/services/thesports/match/matchMinute.service.ts:35-42
if (statusId === 2) {  // FIRST_HALF
  if (firstHalfKickoffTs === null) return null;
  const calculated = Math.floor((nowTs - firstHalfKickoffTs) / 60) + 1;
  return Math.min(calculated, 45); // Clamp max 45
}
```

**Hesaplama Formülü:**
```
minute = floor((now_ts - first_half_kickoff_ts) / 60) + 1
Örnek: (1774545300 - 1774545000) / 60 + 1 = 6. dakika
```

**Database Güncelleme:**
```sql
UPDATE ts_matches
SET minute = 6,
    last_minute_update_ts = 1774545300
WHERE external_id = 'match123'
  AND minute IS DISTINCT FROM 6;  -- Sadece değiştiyse güncelle
```

### 3.2 Real-Time Güncellemeler (DataUpdateWorker - Her 20s)
```
Endpoint: GET /data/update?time=xxx
Servis: DataUpdateService.checkUpdates()
Worker: DataUpdateWorker.checkUpdates() (her 20s)
```

**Ne Yapıyor:**
- Değişen maçları listeler (`changed_matches` array)
- Her değişen maç için `detail_live` çeker
- Skor, dakika, status günceller

**Kod:**
```typescript
// src/jobs/dataUpdate.job.ts:187-214
for (const matchId of changedMatchIds) {
  const result = await this.matchDetailLiveService.reconcileMatchToDatabase(
    matchIdStr,
    updateTime
  );
}
```

### 3.3 WebSocket Güncellemeleri (Real-Time)
```
Endpoint: wss://api.thesports.com/v1/football/ws
Servis: WebSocketService.handleMessage()
Worker: WebSocketService (sürekli MQTT)
```

**Ne Yapıyor:**
- MQTT'den `score` mesajları alır
- Skor günceller
- Status günceller (eğer değiştiyse)

**Kod:**
```typescript
// src/services/thesports/websocket/websocket.service.ts:98-244
if (this.validator.isScoreMessage(message)) {
  const parsedScore = this.parseScoreMessage(message);
  await this.updateMatchScoreInDatabase(
    parsedScore.matchId,
    parsedScore.homeScore,
    parsedScore.awayScore,
    providerUpdateTime
  );
}
```

---

## 📋 ADIM 4: Devre Arasına Alma (FIRST_HALF → HALF_TIME)

### 4.1 WebSocket Tlive Mesajı (En Hızlı Yöntem)
```
Endpoint: wss://api.thesports.com/v1/football/ws
Mesaj Tipi: tlive (timeline)
Servis: WebSocketService.inferStatusFromTlive()
```

**Ne Yapıyor:**
- MQTT'den `tlive` mesajı alır
- Mesaj içinde "HT", "Half Time", "Devre Arası" kelimelerini arar
- Status'u `3` (HALF_TIME) olarak günceller

**Kod:**
```typescript
// src/services/thesports/websocket/websocket.service.ts:303-308
if (recent.some((e) => {
  const dataStr = getDataStr(e);
  return dataStr.includes('half time') || dataStr.includes('ht') || dataStr.includes('devre arası');
})) {
  return MatchState.HALF_TIME; // 3
}
```

**Database Güncelleme:**
```sql
UPDATE ts_matches
SET status_id = 3,  -- HALF_TIME
    updated_at = NOW(),
    provider_update_time = 1774548000,
    last_event_ts = 1774548000
WHERE external_id = 'match123';
```

### 4.2 Detail_Live Fallback (WebSocket Çalışmazsa)
```
Endpoint: GET /match/detail_live?match_id=xxx
Servis: MatchDetailLiveService.reconcileMatchToDatabase()
Worker: MatchWatchdogWorker (stale match recovery)
```

**Ne Yapıyor:**
- Stale match tespit edilirse (120s güncellenmemiş)
- `detail_live` çeker
- Eğer `status_id=3` ise → HALF_TIME'a geçirir

**Kod:**
```typescript
// src/services/thesports/match/matchDetailLive.service.ts:388-391
if (hasLiveData && live.statusId !== null) {
  setParts.push(`status_id = $${i++}`);
  values.push(live.statusId); // 3 = HALF_TIME
}
```

### 4.3 Dakika Dondurulur (HALF_TIME)
```
Servis: MatchMinuteService.calculateMinute()
Worker: MatchMinuteWorker.tick() (her 30s)
```

**Ne Yapıyor:**
- HALF_TIME durumunda dakika **her zaman 45** olur
- Dakika ilerlemez (frozen)

**Kod:**
```typescript
// src/services/thesports/match/matchMinute.service.ts:45-48
if (statusId === 3) {  // HALF_TIME
  return 45; // Always 45, never NULL
}
```

**Database Güncelleme:**
```sql
UPDATE ts_matches
SET minute = 45,  -- Frozen at 45
    last_minute_update_ts = 1774548000
WHERE external_id = 'match123'
  AND status_id = 3;
```

---

## 📋 ADIM 5: İkinci Yarı Başlatma (HALF_TIME → SECOND_HALF)

### 5.1 WebSocket Tlive Mesajı (En Hızlı Yöntem)
```
Endpoint: wss://api.thesports.com/v1/football/ws
Mesaj Tipi: tlive (timeline)
Servis: WebSocketService.inferStatusFromTlive()
```

**Ne Yapıyor:**
- MQTT'den `tlive` mesajı alır
- Mesaj içinde "2H", "Second Half", "İkinci Yarı" kelimelerini arar
- Status'u `4` (SECOND_HALF) olarak günceller

**Kod:**
```typescript
// src/services/thesports/websocket/websocket.service.ts:310-315
if (recent.some((e) => {
  const dataStr = getDataStr(e);
  return dataStr.includes('second half') || dataStr.includes('2h') || dataStr.includes('ikinci yarı');
})) {
  return MatchState.SECOND_HALF; // 4
}
```

### 5.2 Second Half Kickoff Time Set
```
Servis: MatchDetailLiveService.reconcileMatchToDatabase()
```

**Ne Yapıyor:**
- `second_half_kickoff_ts` set eder (ikinci yarı başlama zamanı)
- Bu timestamp dakika hesaplama için kullanılacak

**Kod:**
```typescript
// src/services/thesports/match/matchDetailLive.service.ts:422-428
if (live.statusId === 4 && existingStatusId === 3) {  // HALF_TIME → SECOND_HALF
  if (existing.second_half_kickoff_ts === null) {
    setParts.push(`second_half_kickoff_ts = $${i++}`);
    values.push(kickoffTimeToUse);
  }
}
```

**Database Güncelleme:**
```sql
UPDATE ts_matches
SET status_id = 4,  -- SECOND_HALF
    second_half_kickoff_ts = 1774551000,  -- İkinci yarı başlama zamanı
    updated_at = NOW(),
    provider_update_time = 1774551000
WHERE external_id = 'match123'
  AND status_id = 3;  -- Optimistic locking: sadece HALF_TIME ise güncelle
```

### 5.3 Detail_Live Fallback (WebSocket Çalışmazsa)
```
Endpoint: GET /match/detail_live?match_id=xxx
Servis: MatchDetailLiveService.reconcileMatchToDatabase()
Worker: MatchWatchdogWorker (stale match recovery)
```

**Ne Yapıyor:**
- Stale match tespit edilirse (900s güncellenmemiş - HALF_TIME için 15 dk)
- `detail_live` çeker
- Eğer `status_id=4` ise → SECOND_HALF'a geçirir

---

## 📋 ADIM 6: İkinci Yarı Dakika İlerlemesi (SECOND_HALF)

### 6.1 MatchMinuteWorker (Her 30 Saniyede)
```
Servis: MatchMinuteService.calculateMinute()
Worker: MatchMinuteWorker.tick() (her 30s)
```

**Ne Yapıyor:**
- İkinci yarı için dakika hesaplar
- `second_half_kickoff_ts` kullanarak hesaplar

**Kod:**
```typescript
// src/services/thesports/match/matchMinute.service.ts:50-58
if (statusId === 4) {  // SECOND_HALF
  if (secondHalfKickoffTs === null) return null;
  const calculated = 45 + Math.floor((nowTs - secondHalfKickoffTs) / 60) + 1;
  return Math.max(calculated, 46); // Clamp min 46
}
```

**Hesaplama Formülü:**
```
minute = 45 + floor((now_ts - second_half_kickoff_ts) / 60) + 1
Örnek: 45 + (1774551300 - 1774551000) / 60 + 1 = 46. dakika
```

**Database Güncelleme:**
```sql
UPDATE ts_matches
SET minute = 46,
    last_minute_update_ts = 1774551300
WHERE external_id = 'match123'
  AND minute IS DISTINCT FROM 46;
```

### 6.2 Real-Time Güncellemeler
- **DataUpdateWorker** (her 20s): `/data/update` → `detail_live` → skor/dakika güncelle
- **WebSocket** (sürekli): MQTT `score` mesajları → skor güncelle

---

## 📋 ADIM 7: Maç Bitirme (SECOND_HALF → END)

### 7.1 WebSocket Tlive Mesajı (En Hızlı Yöntem)
```
Endpoint: wss://api.thesports.com/v1/football/ws
Mesaj Tipi: tlive (timeline)
Servis: WebSocketService.inferStatusFromTlive()
```

**Ne Yapıyor:**
- MQTT'den `tlive` mesajı alır
- Mesaj içinde "FT", "Full Time", "Bitti" kelimelerini arar
- Status'u `8` (END) olarak günceller

**Kod:**
```typescript
// src/services/thesports/websocket/websocket.service.ts:317-322
if (recent.some((e) => {
  const dataStr = getDataStr(e);
  return dataStr.includes('full time') || dataStr.includes('ft') || dataStr.includes('bitti');
})) {
  return MatchState.END; // 8
}
```

### 7.2 Watchdog Recent/List Kontrolü (Fallback)
```
Endpoint: GET /match/recent/list?page=1&limit=500
Servis: MatchRecentService.getMatchRecentList()
Worker: MatchWatchdogWorker.tick() (her 20s)
```

**Ne Yapıyor:**
- Stale match tespit edilirse (120s güncellenmemiş)
- `/match/recent/list`'te maçı kontrol eder
- Eğer maç listede **yoksa** veya `status_id=8` ise → END'e geçirir

**Kod:**
```typescript
// src/jobs/matchWatchdog.job.ts:128-150
if (!recentListMatch) {
  // Match not in recent/list - likely finished, transition to END
  await client.query(
    `UPDATE ts_matches 
     SET status_id = 8, updated_at = NOW(), last_event_ts = $1::BIGINT
     WHERE external_id = $2 AND status_id IN (2, 3, 4, 5, 7)`,
    [Math.floor(Date.now() / 1000), stale.matchId]
  );
}
```

### 7.3 Detail_Live Fallback
```
Endpoint: GET /match/detail_live?match_id=xxx
Servis: MatchDetailLiveService.reconcileMatchToDatabase()
Worker: MatchWatchdogWorker (stale match recovery)
```

**Ne Yapıyor:**
- `detail_live` çeker
- Eğer `status_id=8` ise → END'e geçirir

**Database Güncelleme:**
```sql
UPDATE ts_matches
SET status_id = 8,  -- END
    updated_at = NOW(),
    provider_update_time = 1774554000,
    last_event_ts = 1774554000
WHERE external_id = 'match123'
  AND status_id IN (2, 3, 4, 5, 7);  -- Optimistic locking
```

### 7.4 Dakika Dondurulur (END)
```
Servis: MatchMinuteService.calculateMinute()
Worker: MatchMinuteWorker.tick() (her 30s)
```

**Ne Yapıyor:**
- END durumunda dakika **mevcut değeri korunur** (frozen)
- Dakika ilerlemez

**Kod:**
```typescript
// src/services/thesports/match/matchMinute.service.ts:74-77
if (statusId === 8 || statusId === 9 || statusId === 10) {  // END, DELAY, INTERRUPT
  return existingMinute; // Retain last computed value, never NULL
}
```

---

## 📊 Özet: Tüm Adımlar ve Servisler

| Adım | Durum Geçişi | Endpoint/Servis | Worker | Sıklık |
|------|--------------|-----------------|--------|--------|
| **1. Maç Yükleme** | - | `/match/diary` | BootstrapService | 1x (başlangıç) |
| **2. Canlıya Geçiş** | 1 → 2 | `/match/recent/list` → `/match/detail_live` | MatchWatchdogWorker | Her 20s |
| **3. Dakika İlerleme** | 2 (FIRST_HALF) | - | MatchMinuteWorker | Her 30s |
| **4. Devre Arası** | 2 → 3 | WebSocket `tlive` veya `/match/detail_live` | WebSocketService / MatchWatchdogWorker | Sürekli / Her 20s |
| **5. İkinci Yarı** | 3 → 4 | WebSocket `tlive` veya `/match/detail_live` | WebSocketService / MatchWatchdogWorker | Sürekli / Her 20s |
| **6. İkinci Yarı Dakika** | 4 (SECOND_HALF) | - | MatchMinuteWorker | Her 30s |
| **7. Maç Bitirme** | 4 → 8 | WebSocket `tlive` veya `/match/recent/list` | WebSocketService / MatchWatchdogWorker | Sürekli / Her 20s |

---

## 🔄 Real-Time Güncelleme Kaynakları

### 1. WebSocket (En Hızlı - Öncelikli)
- **Mesaj Tipi:** `score`, `tlive`, `events`
- **Güncelleme:** Anında (MQTT push)
- **Kullanım:** Skor, status, dakika güncellemeleri

### 2. DataUpdateWorker (Her 20s)
- **Endpoint:** `/data/update` → `/match/detail_live`
- **Güncelleme:** 20 saniyede bir
- **Kullanım:** Değişen maçları tespit edip güncelle

### 3. MatchWatchdogWorker (Her 20s)
- **Endpoint:** `/match/recent/list` → `/match/detail_live`
- **Güncelleme:** 20 saniyede bir
- **Kullanım:** Stale ve should-be-live maçları kurtar

### 4. ProactiveMatchStatusCheckWorker (Her 20s)
- **Endpoint:** `/match/detail_live` → `/match/diary` (fallback)
- **Güncelleme:** 20 saniyede bir
- **Kullanım:** NOT_STARTED → LIVE geçişi

### 5. MatchMinuteWorker (Her 30s)
- **Servis:** MatchMinuteService.calculateMinute()
- **Güncelleme:** 30 saniyede bir
- **Kullanım:** Dakika hesaplama ve database'e yazma

---

## 🎯 Örnek: Bir Maçın Tam Döngüsü

### T=0:00 - Maç Database'e Yüklendi
```
status_id: 1 (NOT_STARTED)
match_time: 1774544400 (20:00:00)
minute: NULL
```

### T=0:10 - Maç Başladı (Watchdog Tespit Etti)
```
1. MatchWatchdogWorker → findShouldBeLiveMatches()
2. GET /match/recent/list → match_id var, status_id=2
3. UPDATE status_id = 2 (FIRST_HALF)
4. GET /match/detail_live → first_half_kickoff_ts = 1774545000
5. Database: status_id=2, first_half_kickoff_ts=1774545000
```

### T=0:15 - Dakika Hesaplandı
```
1. MatchMinuteWorker → calculateMinute()
2. Formula: floor((1774545900 - 1774545000) / 60) + 1 = 16
3. UPDATE minute = 16
```

### T=0:45 - Devre Arası (WebSocket Tlive)
```
1. WebSocket → tlive mesajı: "Half Time"
2. inferStatusFromTlive() → status_id = 3
3. UPDATE status_id = 3 (HALF_TIME)
4. MatchMinuteWorker → minute = 45 (frozen)
```

### T=1:00 - İkinci Yarı Başladı (WebSocket Tlive)
```
1. WebSocket → tlive mesajı: "Second Half"
2. inferStatusFromTlive() → status_id = 4
3. UPDATE status_id = 4, second_half_kickoff_ts = 1774551000
4. MatchMinuteWorker → minute = 46 (45 + 1)
```

### T=1:30 - Dakika İlerliyor
```
1. MatchMinuteWorker → calculateMinute()
2. Formula: 45 + floor((1774552800 - 1774551000) / 60) + 1 = 76
3. UPDATE minute = 76
```

### T=1:45 - Maç Bitti (WebSocket Tlive)
```
1. WebSocket → tlive mesajı: "Full Time"
2. inferStatusFromTlive() → status_id = 8
3. UPDATE status_id = 8 (END)
4. MatchMinuteWorker → minute = 90 (frozen, last value)
```

---

## 🔍 Servis Detayları

### MatchDetailLiveService.reconcileMatchToDatabase()
**Endpoint:** `GET /match/detail_live?match_id=xxx`

**Ne Yapıyor:**
1. TheSports API'den maç detayını çeker
2. Status, score, minute, events çıkarır
3. Optimistic locking kontrolü yapar
4. Database'i günceller:
   - `status_id`
   - `home_score_regular`, `away_score_regular`
   - `minute` (provider'dan)
   - `first_half_kickoff_ts` (status 2,3,4,5,7 için)
   - `second_half_kickoff_ts` (status 4 için, 3'ten geçiş)
   - `provider_update_time`
   - `last_event_ts`

**Kod Dosyası:** `src/services/thesports/match/matchDetailLive.service.ts:279-571`

---

### MatchMinuteService.calculateMinute()
**Servis:** Backend dakika hesaplama motoru

**Ne Yapıyor:**
1. Status'a göre dakika hesaplar:
   - **Status 2 (FIRST_HALF):** `floor((now - first_half_kickoff_ts) / 60) + 1` (max 45)
   - **Status 3 (HALF_TIME):** `45` (frozen)
   - **Status 4 (SECOND_HALF):** `45 + floor((now - second_half_kickoff_ts) / 60) + 1` (min 46)
   - **Status 5 (OVERTIME):** `90 + floor((now - overtime_kickoff_ts) / 60) + 1`
   - **Status 7 (PENALTY):** `existingMinute` (frozen)
   - **Status 8 (END):** `existingMinute` (frozen)

2. Database'e yazar (sadece değiştiyse)

**Kod Dosyası:** `src/services/thesports/match/matchMinute.service.ts:27-81`

---

### WebSocketService.inferStatusFromTlive()
**Servis:** MQTT tlive mesajlarından status çıkarımı

**Ne Yapıyor:**
1. `tlive` array'ini tarar
2. Keyword'lere göre status belirler:
   - "HT", "Half Time" → `3` (HALF_TIME)
   - "2H", "Second Half" → `4` (SECOND_HALF)
   - "FT", "Full Time" → `8` (END)
   - "Kick Off", "First Half" → `2` (FIRST_HALF)

3. Database'de status'u günceller

**Kod Dosyası:** `src/services/thesports/websocket/websocket.service.ts:294-332`

---

## ✅ Test Endpoint'leri

### Maç Detayı Kontrol
```
GET http://142.93.103.128:3000/api/matches/{match_id}/detail-live
```

### Canlı Maçlar
```
GET http://142.93.103.128:3000/api/matches/live
```

### Should-Be-Live Maçlar
```
GET http://142.93.103.128:3000/api/matches/should-be-live
```

---

**Son Güncelleme:** 2025-12-24  
**Versiyon:** 1.0



