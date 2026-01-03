# 🔍 Canlı Maç Sekmesi - Detaylı Analiz Raporu

**Tarih:** 3 Ocak 2026  
**Sekme:** "Canlı Maçlar" (Live Matches)  
**Sorun:** Maç sayılarında tutarsızlık

---

## 📊 GENEL AKIŞ DİYAGRAMI

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (MatchList.tsx)                     │
│                                                                 │
│  1. view === 'live' → getLiveMatches() çağrılıyor              │
│  2. Backend'den gelen sonuçlar isLiveMatch() ile filtreleniyor │
│  3. Her 10 saniyede bir polling yapılıyor                      │
│  4. WebSocket ile anlık güncellemeler alınıyor                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND (/api/matches/live endpoint)                │
│                                                                 │
│  matchDatabaseService.getLiveMatches() çağrılıyor              │
│  → Database query: WHERE status_id IN (2,3,4,5,7)             │
│  → Cache YOK, her zaman fresh data                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                        │
│                                                                 │
│  ts_matches tablosu:                                            │
│  - status_id IN (2,3,4,5,7) olan maçlar döndürülüyor          │
│  - JOIN ile teams ve competitions bilgileri alınıyor          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 DETAYLI AKIŞ ADIMLARI

### 1. FRONTEND - MatchList.tsx

**Dosya:** `frontend/src/components/MatchList.tsx`

#### 1.1 İlk Yükleme ve Polling

```typescript
// Line 43-45: view === 'live' olduğunda
if (view === 'live') {
  response = await getLiveMatches(); // GET /api/matches/live
}

// Line 106-110: Backend'den gelen sonuçlar TEKRAR filtreleniyor
if (view === 'live') {
  filteredResults = results.filter((match: Match) => {
    const status = match.status ?? 0;
    return isLiveMatch(status); // status >= 2 && status <= 7
  });
}

// Line 291-305: Her 10 saniyede bir polling
useEffect(() => {
  fetchMatches();
  const pollInterval = error && error.includes('502') ? 3000 : 10000;
  const interval = setInterval(() => {
    fetchMatches();
  }, pollInterval);
  return () => clearInterval(interval);
}, [fetchMatches, error]);
```

**⚠️ SORUN #1: ÇİFT FİLTRELEME**
- Backend zaten sadece canlı maçları (status 2,3,4,5,7) döndürüyor
- Frontend tekrar `isLiveMatch()` ile filtreliyor
- Bu gereksiz ama zararsız (sadece performans kaybı)

#### 1.2 WebSocket Güncellemeleri

```typescript
// Line 228-289: WebSocket bağlantısı
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  // GOAL, SCORE_CHANGE, MATCH_STATE_CHANGE event'leri geldiğinde
  if (
    message.type === 'GOAL' ||
    message.type === 'SCORE_CHANGE' ||
    message.type === 'MATCH_STATE_CHANGE'
  ) {
    fetchRef.current(); // Tüm maç listesi tekrar çekiliyor
  }
};
```

**⚠️ SORUN #2: WEB SOCKET + POLLING ÇAKIŞMASI**
- WebSocket event geldiğinde `fetchMatches()` çağrılıyor
- Aynı anda polling de çalışıyor (her 10 saniyede bir)
- Bu iki mekanizma aynı anda çalıştığında race condition oluşabilir

---

### 2. BACKEND - match.controller.ts

**Dosya:** `src/controllers/match.controller.ts`

```typescript
// Line 758-815: GET /api/matches/live endpoint
export const getLiveMatches = async (request, reply) => {
  const dbResult = await matchDatabaseService.getLiveMatches();
  const normalized = dbResult.results.map(normalizeDbMatch);
  
  reply.send({
    success: true,
    data: {
      ...dbResult,
      results: normalized,
    },
  });
};
```

**✅ DOĞRU:** Endpoint sadece database'den okuyor, API'ye gitmiyor.

---

### 3. DATABASE SERVICE - matchDatabase.service.ts

**Dosya:** `src/services/thesports/match/matchDatabase.service.ts`

#### 3.1 Database Query

```sql
-- Line 220-268: getLiveMatches() query
SELECT
  m.external_id as id,
  m.status_id as status_id,
  m.minute,
  m.home_score_regular as home_score,
  m.away_score_regular as away_score,
  -- ... diğer alanlar
FROM ts_matches m
LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
WHERE m.status_id IN (2, 3, 4, 5, 7)  -- Sadece canlı maçlar
ORDER BY m.match_time DESC, c.name ASC
```

**✅ DOĞRU:** Query sadece canlı maçları (status 2,3,4,5,7) döndürüyor.

**✅ DÜZELTME YAPILDI:** Bitmiş maçlar (status 9,10,13) query'den kaldırıldı.

---

## 🔄 DATABASE GÜNCELLEMELERİ (Status Değişiklikleri)

### 4.1 Status Güncelleme Mekanizmaları

**A) WebSocket Service (Anlık):**
```
WebSocket → TLIVE mesajı geldi
→ updateMatchStatusInDatabase()
→ status_id güncellendi
→ Database'de değişiklik
```

**B) DataUpdateWorker (Her 20 saniye):**
```
DataUpdateWorker.checkUpdates() → /data/update
→ changed_matches array'inde match_id var
→ reconcileMatchToDatabase()
→ status_id güncellendi
→ Database'de değişiklik
```

**C) MatchWatchdogWorker (Her 60 saniye):**
```
MatchWatchdogWorker.tick()
→ findStaleLiveMatches()
→ "should-be-live" maçları bulur (status=1 ama match_time geçmiş)
→ reconcileMatchToDatabase()
→ status_id: 1 → 2 (FIRST_HALF)
→ Database'de değişiklik
```

**D) MatchSyncWorker (Her 1 dakika):**
```
MatchSyncWorker.syncMatches() → /match/recent/list
→ match_id recent/list'te var, status_id=2
→ reconcileMatchToDatabase()
→ status_id güncellendi
→ Database'de değişiklik
```

**⚠️ SORUN #3: RACE CONDITION**
- 4 farklı worker aynı anda status güncelleyebilir
- WebSocket anlık güncelleme yaparken, DataUpdateWorker 20 saniye sonra güncelleyebilir
- Bu durumda frontend polling sırasında farklı sayıda maç görebilir

---

## 🐛 TUTARSIZLIK NEDENLERİ

### 5.1 Olası Sorunlar

**1. Status Geçişleri Sırasında:**
```
T0: Maç status_id = 2 (FIRST_HALF) → Query'de görünüyor (69 maç)
T1: Maç status_id = 8 (END) oldu → Query'den çıktı (68 maç)
T2: Yeni maç status_id = 2 oldu → Query'ye girdi (69 maç)
```
**Sonuç:** Polling sırasında sayı değişebilir (normal davranış)

**2. WebSocket + Polling Çakışması:**
```
T0: Polling başladı → fetchMatches() çağrıldı
T1: WebSocket event geldi → fetchMatches() tekrar çağrıldı
T2: İki istek aynı anda çalışıyor → Race condition
```
**Sonuç:** Frontend'de sayı tutarsız görünebilir

**3. Database Güncelleme Gecikmesi:**
```
T0: WebSocket status güncelledi (status_id: 2 → 8)
T1: Frontend polling yaptı (henüz database'de güncellenmemiş)
T2: Database güncellendi
T3: Frontend tekrar polling yaptı (artık güncel)
```
**Sonuç:** İlk polling'de eski sayı, ikinci polling'de yeni sayı

**4. Worker'ların Farklı Hızları:**
```
T0: MatchWatchdogWorker maçı status 1 → 2 yaptı
T1: Frontend polling yaptı (69 maç)
T2: DataUpdateWorker başka bir maçı status 2 → 8 yaptı
T3: Frontend polling yaptı (68 maç)
```
**Sonuç:** Her polling'de farklı sayı

---

## ✅ ÇÖZÜM ÖNERİLERİ

### 6.1 Frontend Optimizasyonu

**1. Çift Filtrelemeyi Kaldır:**
```typescript
// ŞU ANKİ (GEREKSIZ):
if (view === 'live') {
  filteredResults = results.filter((match: Match) => {
    return isLiveMatch(status);
  });
}

// ÖNERİLEN:
if (view === 'live') {
  // Backend zaten sadece canlı maçları döndürüyor, filtreleme gereksiz
  filteredResults = results;
}
```

**2. Polling ve WebSocket Koordinasyonu:**
```typescript
// ŞU ANKİ:
// WebSocket event → fetchMatches()
// Polling → fetchMatches()
// İkisi aynı anda çalışabilir

// ÖNERİLEN:
// WebSocket event → fetchMatches() (debounce ile)
// Polling → fetchMatches() (sadece WebSocket yoksa)
```

**3. Debounce Mekanizması:**
```typescript
const debouncedFetch = useMemo(
  () => debounce(fetchMatches, 1000),
  [fetchMatches]
);

// WebSocket event geldiğinde:
ws.onmessage = (event) => {
  debouncedFetch(); // 1 saniye içinde birden fazla event gelirse sadece 1 kez çağrılır
};
```

### 6.2 Backend Optimizasyonu

**1. Database Query Optimizasyonu:**
```sql
-- ŞU ANKİ:
WHERE m.status_id IN (2, 3, 4, 5, 7)

-- ÖNERİLEN (Index kullanımı):
WHERE m.status_id IN (2, 3, 4, 5, 7)
  AND m.updated_at >= NOW() - INTERVAL '24 hours'  -- Son 24 saatte güncellenmiş
```

**2. Cache Mekanizması (Kısa Süreli):**
```typescript
// 2 saniye cache (WebSocket + Polling çakışmasını önler)
const cacheKey = 'live_matches';
const cached = cache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < 2000) {
  return cached.data;
}
```

### 6.3 Database Güncelleme Koordinasyonu

**1. Optimistic Locking:**
```typescript
// ŞU ANKİ: Her worker ayrı ayrı güncelliyor
// ÖNERİLEN: Optimistic locking ile race condition önlenir
UPDATE ts_matches
SET status_id = $1
WHERE external_id = $2
  AND status_id < $1  -- Sadece ileriye doğru geçişlere izin ver
```

---

## 📊 MEVCUT DURUM ÖZETİ

### ✅ DOĞRU ÇALIŞANLAR:
1. Backend query sadece canlı maçları (status 2,3,4,5,7) döndürüyor
2. Bitmiş maçlar (status 9,10,13) query'den kaldırıldı
3. Database'den direkt okuma yapılıyor (API fallback yok)

### ⚠️ SORUNLAR:
1. **Çift Filtreleme:** Frontend'de gereksiz `isLiveMatch()` filtresi
2. **WebSocket + Polling Çakışması:** İki mekanizma aynı anda çalışıyor
3. **Race Condition:** 4 farklı worker aynı anda status güncelleyebilir
4. **Polling Sırasında Status Değişiklikleri:** Normal davranış ama sayı değişiyor

### 🎯 ÖNERİLER:
1. Frontend'de çift filtrelemeyi kaldır
2. WebSocket ve polling'i koordine et (debounce)
3. Database query'ye zaman filtresi ekle (son 24 saat)
4. Optimistic locking ile race condition önle

---

## 🔍 TEST SENARYOLARI

### Senaryo 1: Normal Durum
```
1. Frontend polling yaptı → 69 maç geldi
2. 10 saniye sonra tekrar polling yaptı → 69 maç geldi
3. ✅ TUTARLI
```

### Senaryo 2: Maç Başladı
```
1. Frontend polling yaptı → 69 maç geldi
2. Yeni maç başladı (status 1 → 2)
3. Frontend polling yaptı → 70 maç geldi
4. ✅ TUTARLI (sayı artması normal)
```

### Senaryo 3: Maç Bitti
```
1. Frontend polling yaptı → 69 maç geldi
2. Maç bitti (status 2 → 8)
3. Frontend polling yaptı → 68 maç geldi
4. ✅ TUTARLI (sayı azalması normal)
```

### Senaryo 4: WebSocket + Polling Çakışması
```
1. Frontend polling başladı → fetchMatches() çağrıldı
2. WebSocket event geldi → fetchMatches() tekrar çağrıldı
3. İki istek aynı anda çalışıyor → Race condition
4. ❌ TUTARSIZ (farklı sayılar görünebilir)
```

---

## 🐛 MAÇLARIN SÜREKLI YER DEĞİŞTİRMESİ SORUNU

### 7.1 Sorun Tespiti

**Kullanıcı Şikayeti:** Canlı maçlar sürekli yer değiştiriyor (78' üstte, sonra 74' üstte, sonra tekrar 78' üstte).

**Kök Neden:**
1. **Backend Sorting:** `ORDER BY m.match_time DESC, c.name ASC`
   - Maçlar `match_time`'a göre sıralanıyor
   - Aynı `match_time`'a sahip maçlar için `c.name` (competition name) kullanılıyor
   - **SORUN:** `minute` (dakika) hiç kullanılmıyor!

2. **Frontend Sorting (League Mode):**
   - Maçlar competition'lara göre gruplanıyor
   - **SORUN:** Her competition içindeki maçlar sıralanmıyor!
   - Maçlar backend'den geldiği sırayla gösteriliyor

3. **Polling Sırasında:**
   - Her 10 saniyede bir polling yapılıyor
   - Backend'den maçlar her seferinde aynı sırada gelmeyebilir (database query sonuçları sırası değişebilir)
   - Frontend'de sıralama yok → maçlar yer değiştiriyor

### 7.2 Çözüm

**1. Backend Query Düzeltmesi:**
```sql
-- ŞU ANKİ (YANLIŞ):
ORDER BY m.match_time DESC, c.name ASC

-- ÖNERİLEN (DOĞRU):
ORDER BY 
  CASE WHEN m.status_id IN (2,3,4,5,7) THEN 0 ELSE 1 END,  -- Canlı maçlar önce
  CASE WHEN m.status_id IN (2,3,4,5,7) THEN m.minute ELSE NULL END DESC,  -- Canlı maçlar için minute DESC
  m.match_time DESC,  -- Diğerleri için match_time DESC
  c.name ASC  -- Son olarak competition name
```

**2. Frontend League Mode Düzeltmesi:**
```typescript
// ŞU ANKİ (YANLIŞ):
grouped.get(compId)!.matches.push(match);  // Sıralama yok

// ÖNERİLEN (DOĞRU):
grouped.get(compId)!.matches.push(match);
// Her competition içindeki maçları sırala
grouped.get(compId)!.matches.sort((a, b) => {
  const statusA = a.status_id ?? a.status ?? 0;
  const statusB = b.status_id ?? b.status ?? 0;
  const isLiveA = [2, 3, 4, 5, 7].includes(statusA);
  const isLiveB = [2, 3, 4, 5, 7].includes(statusB);
  
  // Canlı maçlar için minute'a göre sırala (descending)
  if (isLiveA && isLiveB) {
    return (b.minute ?? 0) - (a.minute ?? 0);
  }
  
  // Canlı maçlar önce
  if (isLiveA && !isLiveB) return -1;
  if (!isLiveA && isLiveB) return 1;
  
  // Diğerleri için match_time'a göre sırala
  return (a.match_time || 0) - (b.match_time || 0);
});
```

---

## 🐛 BAŞLAMA SAATİ GEÇMİŞ MAÇLAR CANLIYA GEÇMİYOR

### 8.1 Sorun Tespiti

**Kullanıcı Şikayeti:** Maçların başlama saati gelmiş ama başlatılmamış (17:30'da başlaması gereken maçlar hala "Başlamadı").

**Mevcut Mekanizma:**
1. **MatchWatchdogWorker:** Her 30 saniyede bir çalışıyor
2. **findShouldBeLiveMatches():** Status=1 ama `match_time` geçmiş maçları buluyor
3. **reconcileMatchToDatabase():** Bu maçları canlıya geçirmeye çalışıyor

**Olası Sorunlar:**
1. **Limit Çok Düşük:** `findShouldBeLiveMatches(nowTs, 1440, 100)` - Sadece 100 maç işleniyor
2. **Watchdog Yavaş:** Her 30 saniyede bir çalışıyor, maç başladıktan sonra 30 saniye gecikme olabilir
3. **reconcileMatchToDatabase Başarısız:** API'den veri gelmiyorsa maç canlıya geçmiyor
4. **Race Condition:** WebSocket ve Watchdog aynı anda çalışıyor, çakışma olabilir

### 8.2 Çözüm Önerileri

**1. ProactiveMatchStatusCheckWorker Kullanımı:**
- Bu worker zaten var ve "should-be-live" maçları kontrol ediyor
- Daha sık çalıştırılabilir (her 10-15 saniyede bir)

**2. Limit Artırma:**
```typescript
// ŞU ANKİ:
const shouldBeLive = await this.matchWatchdogService.findShouldBeLiveMatches(nowTs, 1440, 100);

// ÖNERİLEN:
const shouldBeLive = await this.matchWatchdogService.findShouldBeLiveMatches(nowTs, 1440, 500);  // 500 maç
```

**3. Watchdog Frequency Artırma:**
```typescript
// ŞU ANKİ: Her 30 saniyede bir
cron.schedule('*/30 * * * * *', ...)

// ÖNERİLEN: Her 15 saniyede bir (should-be-live için)
cron.schedule('*/15 * * * * *', ...)
```

**4. getMatchById'de Proaktif Kontrol:**
- `getMatchById` çağrıldığında, eğer maç status=1 ama `match_time` geçmişse
- Direkt `reconcileMatchToDatabase()` çağrılabilir (zaten yapılıyor)

---

## 📝 SONUÇ

**Canlı maç sekmesi database ile yönetiliyor.** Backend query'si direkt database'den okuyor ve sadece canlı maçları (status 2,3,4,5,7) döndürüyor.

**Tutarsızlık nedenleri:**
1. Status geçişleri sırasında sayı değişmesi (normal)
2. WebSocket + Polling çakışması (sorun)
3. Race condition (sorun)
4. Çift filtreleme (performans kaybı)
5. **Maçların sürekli yer değiştirmesi (sıralama sorunu)**
6. **Başlama saati geçmiş maçlar canlıya geçmiyor (watchdog gecikmesi)**

**Önerilen çözümler:**
1. Frontend'de çift filtrelemeyi kaldır
2. WebSocket ve polling'i koordine et
3. Debounce mekanizması ekle
4. Database query'ye zaman filtresi ekle
5. **Backend query'de minute'a göre sıralama ekle**
6. **Frontend'de her competition içindeki maçları sırala**
7. **Watchdog frequency artır (15 saniye)**
8. **Should-be-live limit artır (500 maç)**

