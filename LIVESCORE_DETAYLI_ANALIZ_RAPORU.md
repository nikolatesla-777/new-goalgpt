# 🎯 LIVESCORE SAYFASI - DETAYLI KOD MİMARİSİ ANALİZ RAPORU

**Tarih:** 2025-01-XX  
**Analiz Kapsamı:** Livescore sayfası, maç çekme mekanizmaları, canlı güncellemeler, workflow'lar

---

## 📋 İÇİNDEKİLER

1. [Frontend Mimarisi](#1-frontend-mimarisi)
2. [Backend Endpoint'leri](#2-backend-endpointleri)
3. [Maç Çekme Mekanizmaları](#3-maç-çekme-mekanizmaları)
4. [Canlıya Geçiş Workflow'u](#4-canlıya-geçiş-workflowu)
5. [Anlık Güncellemeler (Dakika, Skor, Eventler)](#5-anlık-güncellemeler)
6. [Maç Bitirme İşlemi](#6-maç-bitirme-işlemi)
7. [Mantık Hataları ve Sorunlar](#7-mantık-hataları-ve-sorunlar)
8. [Scriptlerin Durumu](#8-scriptlerin-durumu)
9. [Öneriler ve İyileştirmeler](#9-öneriler-ve-iyileştirmeler)

---

## 1. FRONTEND MİMARİSİ

### 1.1 Komponent: `MatchList.tsx`

**Dosya:** `frontend/src/components/MatchList.tsx`

**Ana Özellikler:**
- `view` prop'una göre farklı maç listeleri gösterir: `'diary' | 'live' | 'finished' | 'not_started'`
- `sortBy` prop'u ile lig veya zaman bazlı sıralama yapar

**Veri Çekme Mekanizması:**
```typescript
// Satır 29-101: fetchMatches()
if (view === 'live') {
  response = await getLiveMatches(); // GET /api/matches/live
} else {
  response = await getMatchDiary(dateStr); // GET /api/matches/diary?date=YYYYMMDD
}
```

**Polling Mekanizması:**
```typescript
// Satır 215-229: useEffect ile polling
const pollInterval = error && error.includes('502') ? 3000 : 3000; // ⚠️ HATA: Her zaman 3 saniye
const interval = setInterval(() => {
  fetchMatches();
}, pollInterval);
```

**⚠️ KRİTİK HATA #1:** Polling interval her zaman 3 saniye olarak ayarlanmış. Yorum satırında "10 saniye" yazıyor ama kod 3 saniye kullanıyor. Bu çok agresif bir polling ve backend'e gereksiz yük bindiriyor.

**WebSocket Entegrasyonu:**
```typescript
// Satır 162-213: WebSocket bağlantısı
ws = new WebSocket(`${wsProtocol}//${wsHost}/ws`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'GOAL' || message.type === 'SCORE_CHANGE') {
    fetchRef.current(); // Sadece GOAL/SCORE_CHANGE'de refresh
  }
};
```

**⚠️ KRİTİK HATA #2:** WebSocket sadece `GOAL` ve `SCORE_CHANGE` eventlerinde refresh yapıyor. `MATCH_STATE_CHANGE` (status değişiklikleri: HT, 2H, FT) eventlerinde refresh yapmıyor. Bu yüzden maç durumu değişiklikleri (devre arası, ikinci yarı, maç bitişi) frontend'de gecikmeli görünüyor.

---

## 2. BACKEND ENDPOINT'LERİ

### 2.1 `/api/matches/live` Endpoint

**Controller:** `src/controllers/match.controller.ts` (satır 652-709)  
**Service:** `src/services/thesports/match/matchDatabase.service.ts` (satır 203-364)

**Ne Yapıyor:**
- Database'den sadece `status_id IN (2, 3, 4, 5, 7)` olan maçları çekiyor
- Cache kullanmıyor (live data için uygun)
- `minute` ve `minute_text` field'larını generate ediyor

**SQL Sorgusu:**
```sql
SELECT ... FROM ts_matches m
WHERE m.status_id IN (2, 3, 4, 5, 7)  -- Strictly playing
   OR (m.status_id IN (9, 10, 13) AND m.match_time >= ${now - 24 * 3600}) -- Recently finished/interrupted
ORDER BY m.match_time DESC, c.name ASC
```

**⚠️ KRİTİK HATA #3:** Endpoint sadece `status_id IN (2,3,4,5,7)` olan maçları döndürüyor. `status_id = 1` (NOT_STARTED) ama `match_time` geçmiş maçları döndürmüyor. Bu maçlar "should-be-live" olarak ayrı bir endpoint'te (`/api/matches/should-be-live`) expose ediliyor ama frontend bunu kullanmıyor.

### 2.2 `/api/matches/diary` Endpoint

**Controller:** `src/controllers/match.controller.ts` (satır 155-235)  
**Service:** `src/services/thesports/match/matchDatabase.service.ts` (satır 30-187)

**Ne Yapıyor:**
- Belirli bir tarih için database'den maçları çekiyor
- **DB-only mode:** API fallback yok, sadece database'den okuyor
- Tarih formatı: `YYYY-MM-DD` veya `YYYYMMDD`

**⚠️ NOT:** Bu endpoint artık API'ye gitmiyor, sadece database'den okuyor. Maçlar `DailyMatchSyncWorker` tarafından önceden sync edilmiş olmalı.

---

## 3. MAÇ ÇEKME MEKANİZMALARI

### 3.1 DailyMatchSyncWorker

**Dosya:** `src/jobs/dailyMatchSync.job.ts`

**Çalışma Sıklığı:**
- **Ana Sync:** Her gün 00:05 TSİ (cron: `5 0 * * *`)
- **Repair Window:** 00:10-06:00 TSİ arası her 30 dakikada bir

**Ne Yapıyor:**
- `/match/diary` endpoint'ini çağırarak bugünkü maçları çekiyor
- Maçları database'e kaydediyor (`ts_matches` tablosuna)
- Takım ve lig bilgilerini de sync ediyor

**Kod:**
```typescript
// Satır 213-484: syncDateDiary()
const diaryResponse = await this.matchDiaryService.getMatchDiary({ date: dateStr });
// Maçları database'e kaydet
await this.matchSyncService.saveMatchesToDatabase(matches);
```

**⚠️ SORUN:** Eğer DailyMatchSyncWorker çalışmazsa veya hata verirse, o günün maçları database'de olmayacak ve frontend boş liste gösterecek.

### 3.2 MatchSyncWorker

**Dosya:** `src/jobs/matchSync.job.ts`

**Çalışma Sıklığı:**
- **Incremental Sync:** Her 1 dakikada bir (cron: `*/1 * * * *`)
- **Live Reconcile:** Her 3 saniyede bir (canlı maçlar için)
- **First Half Reconcile:** Her 20 saniyede bir (HALF_TIME transition için)
- **Second Half Reconcile:** Her 15 saniyede bir (END transition için)
- **Half Time Reconcile:** Her 30 saniyede bir (SECOND_HALF transition için)

**Ne Yapıyor:**
- `/match/recent/list?time=<timestamp>` endpoint'ini çağırarak değişen maçları çekiyor
- Değişen maçları database'e güncelliyor
- Canlı maçları `reconcileMatchToDatabase()` ile güncelliyor

**Kod:**
```typescript
// Satır 64-85: syncMatches()
const result = await this.recentSyncService.syncIncremental();
// Sonra canlı maçları reconcile et
await this.reconcileLiveMatches();
```

**⚠️ KRİTİK HATA #4:** `reconcileLiveMatches()` her 3 saniyede bir çalışıyor ve 500 maça kadar queue'ya ekliyor. Bu çok agresif ve API rate limit'lerini aşabilir.

### 3.3 DataUpdateWorker

**Dosya:** `src/jobs/dataUpdate.job.ts`

**Çalışma Sıklığı:** Her 20 saniyede bir

**Ne Yapıyor:**
- `/data/update` endpoint'ini çağırarak değişen maç ID'lerini alıyor
- Her değişen maç için `/match/detail_live` çağırıyor
- Maç verilerini database'e güncelliyor

**Kod:**
```typescript
// Satır 133-275: checkUpdates()
const payload = await this.dataUpdateService.checkUpdates();
const { matchIds } = this.normalizeChangedMatches(payload);

for (const matchId of changedMatchIds) {
  await this.matchDetailLiveService.reconcileMatchToDatabase(matchId, updateTime);
}
```

**⚠️ NOT:** Bu worker maç bitişinde (status=8) final stats ve trend'i database'e kaydediyor (satır 233-259). Bu iyi bir özellik.

### 3.4 MatchWatchdogWorker

**Dosya:** `src/jobs/matchWatchdog.job.ts`

**Durum:** ⚠️ **DISABLED** (satır 820-827)

**Neden Disabled:**
- `/data/update` → `/match/detail_live` workflow'u tüm status transition'ları handle ediyor
- Watchdog gereksiz duplicate işlemler yapıyordu
- Yanlış END transition'larına neden oluyordu

**⚠️ KRİTİK HATA #5:** Watchdog disabled ama kod hala orada. Bu kafa karıştırıcı ve gelecekte tekrar enable edilirse sorunlara neden olabilir.

---

## 4. CANLIYA GEÇİŞ WORKFLOW'U

### 4.1 Maç Başlama Senaryosu

**Adım 1: Maç Database'e Yüklenir**
```
DailyMatchSyncWorker → /match/diary → Database
status_id: 1 (NOT_STARTED)
match_time: 1774544400 (20:00:00)
```

**Adım 2: Maç Başlama Zamanı Geçer**
```
match_time: 1774544400
now: 1774545000 (20:10:00)
status_id: hala 1 (NOT_STARTED)
```

**Adım 3: Canlıya Geçiş Tetikleyicileri**

**A) WebSocket (En Hızlı - ~1-2 saniye):**
```
WebSocketService.handleMessage() → score mesajı geldi
→ status_id: 1 → 2 (FIRST_HALF)
→ updateMatchStatusInDatabase()
→ Database güncellendi
```

**B) DataUpdateWorker (Her 20 saniye):**
```
DataUpdateWorker.checkUpdates() → /data/update
→ changed_matches array'inde match_id var
→ reconcileMatchToDatabase()
→ status_id: 1 → 2
→ Database güncellendi
```

**C) MatchSyncWorker (Her 1 dakika + 3 saniye reconcile):**
```
MatchSyncWorker.syncMatches() → /match/recent/list
→ match_id recent/list'te var, status_id=2
→ reconcileMatchToDatabase()
→ status_id: 1 → 2
→ Database güncellendi
```

**⚠️ KRİTİK HATA #6:** Watchdog disabled olduğu için "should-be-live" maçlar (status=1 ama match_time geçmiş) otomatik olarak canlıya geçmiyor. Sadece WebSocket veya DataUpdateWorker tetiklenirse geçiyor. Eğer bu mekanizmalar çalışmazsa, maç saatlerce NOT_STARTED olarak kalabilir.

### 4.2 Status Transition'ları

**FIRST_HALF → HALF_TIME (status 2 → 3):**
- **WebSocket:** `tlive` mesajı "HT" veya "Half Time"
- **DataUpdateWorker:** `/match/detail_live`'da status_id=3
- **MatchSyncWorker:** First Half reconcile (her 20s)

**HALF_TIME → SECOND_HALF (status 3 → 4):**
- **WebSocket:** `tlive` mesajı "2H" veya "Second Half"
- **DataUpdateWorker:** `/match/detail_live`'da status_id=4
- **MatchSyncWorker:** Half Time reconcile (her 30s)

**SECOND_HALF → END (status 4 → 8):**
- **WebSocket:** `tlive` mesajı "FT" veya "Full Time"
- **DataUpdateWorker:** `/match/detail_live`'da status_id=8
- **MatchSyncWorker:** Second Half reconcile (her 15s)

**⚠️ NOT:** Tüm transition'lar WebSocket'e bağımlı. Eğer WebSocket bağlantısı kopmuşsa, sadece DataUpdateWorker ve MatchSyncWorker fallback olarak çalışıyor (daha yavaş).

---

## 5. ANLIK GÜNCELLEMELER

### 5.1 Dakika İlerlemesi

**MatchMinuteWorker:**
- **Dosya:** `src/jobs/matchMinute.job.ts`
- **Sıklık:** Her 30 saniyede bir
- **Ne Yapıyor:** Canlı maçlar için dakika hesaplıyor ve database'e yazıyor

**Hesaplama Formülü:**
```typescript
// Status 2 (FIRST_HALF)
minute = floor((now_ts - first_half_kickoff_ts) / 60) + 1
clamp max 45

// Status 4 (SECOND_HALF)
minute = 45 + floor((now_ts - second_half_kickoff_ts) / 60) + 1
clamp min 46
```

**⚠️ KRİTİK HATA #7:** Dakika hesaplama `first_half_kickoff_ts` ve `second_half_kickoff_ts` field'larına bağımlı. Eğer bu field'lar NULL ise, dakika hesaplanamıyor. Fallback olarak `live_kickoff_time` veya `match_time` kullanılıyor ama bu her zaman doğru olmayabilir.

**⚠️ KRİTİK HATA #8:** Dakika güncellemesi `updated_at` field'ını güncellemiyor (sadece `minute` ve `last_minute_update_ts`). Bu, watchdog'un stale match detection'ını etkileyebilir.

### 5.2 Skor Güncellemeleri

**Kaynaklar:**
1. **WebSocket (Real-time):** `score` mesajları → `updateMatchInDatabase()`
2. **DataUpdateWorker (Her 20s):** `/match/detail_live` → `reconcileMatchToDatabase()`
3. **MatchSyncWorker (Her 3s):** Live reconcile → `reconcileMatchToDatabase()`

**⚠️ NOT:** Skor güncellemeleri genellikle WebSocket üzerinden geliyor ve çok hızlı (1-2 saniye). Fallback mekanizmalar sadece WebSocket çalışmazsa devreye giriyor.

### 5.3 Event Bilgileri (Goller, Kartlar, Değişiklikler)

**Kaynak:** WebSocket `incidents` mesajları

**Kod:**
```typescript
// websocket.service.ts satır 160-200
if (this.validator.isIncidentsMessage(message)) {
  const incidentsArr = Array.isArray((incidentsMsg as any).incidents) ? ... : [];
  await this.updateMatchIncidentsInDatabase(matchId, incidentsArr);
  
  // Goal detection
  const goalEvent = this.eventDetector.detectGoalFromIncident(matchId, parsedIncident);
  if (goalEvent) {
    this.emitEvent(goalEvent); // Frontend'e gönder
  }
}
```

**⚠️ KRİTİK HATA #9:** Event'ler sadece WebSocket üzerinden geliyor. Eğer WebSocket bağlantısı kopmuşsa, event'ler kaybolabilir. DataUpdateWorker ve MatchSyncWorker event'leri güncellemiyor (sadece skor ve status).

---

## 6. MAÇ BİTİRME İŞLEMİ

### 6.1 Status Transition: SECOND_HALF → END

**Tetikleyiciler:**
1. **WebSocket:** `tlive` mesajı "FT" veya "Full Time"
2. **DataUpdateWorker:** `/match/detail_live`'da status_id=8
3. **MatchSyncWorker:** Second Half reconcile (her 15s)

**Kod:**
```typescript
// matchDetailLive.service.ts satır 504-1008
async reconcileMatchToDatabase(match_id, providerUpdateTimeOverride) {
  // Status 8 (END) tespit edildi
  if (live.statusId === 8) {
    // Database'e status_id=8 yaz
    // minute field'ını NULL yap (frozen)
  }
}
```

### 6.2 Post-Match Data Persistence

**⚠️ KRİTİK HATA #10:** `PostMatchPersistenceService` dosyası silinmiş görünüyor (deleted_files listesinde). Maç bitişinde final stats, trend, incidents, player stats database'e kaydedilmiyor olabilir.

**Mevcut Durum:**
- `DataUpdateWorker` maç bitişinde (status=8) final stats ve trend'i kaydediyor (satır 233-259)
- Ama bu sadece DataUpdateWorker tetiklenirse çalışıyor
- Eğer maç WebSocket üzerinden biterse, DataUpdateWorker tetiklenmeyebilir

**⚠️ ÖNERİ:** Post-match persistence'ı `reconcileMatchToDatabase()` içine entegre etmek gerekiyor. Maç status=8 olduğunda otomatik olarak tüm verileri kaydetmeli.

---

## 7. MANTIK HATALARI VE SORUNLAR

### 7.1 Frontend Hataları

**HATA #1: Polling Interval Yanlış**
- **Dosya:** `MatchList.tsx` satır 221
- **Sorun:** Yorum "10 saniye" diyor ama kod 3 saniye kullanıyor
- **Etki:** Gereksiz backend yükü, rate limit riski

**HATA #2: WebSocket Event Handling Eksik**
- **Dosya:** `MatchList.tsx` satır 177-190
- **Sorun:** Sadece `GOAL` ve `SCORE_CHANGE` eventlerinde refresh yapıyor
- **Etki:** Status değişiklikleri (HT, 2H, FT) gecikmeli görünüyor

### 7.2 Backend Hataları

**HATA #3: Should-Be-Live Maçlar İşlenmiyor**
- **Sorun:** Watchdog disabled, should-be-live maçlar otomatik canlıya geçmiyor
- **Etki:** Maçlar saatlerce NOT_STARTED olarak kalabilir

**HATA #4: Agresif Reconcile**
- **Dosya:** `matchSync.job.ts` satır 187-189
- **Sorun:** Her 3 saniyede bir 500 maça kadar reconcile queue'ya ekleniyor
- **Etki:** API rate limit riski, gereksiz yük

**HATA #5: Dakika Hesaplama Bağımlılığı**
- **Sorun:** `first_half_kickoff_ts` ve `second_half_kickoff_ts` NULL ise dakika hesaplanamıyor
- **Etki:** Bazı maçlarda dakika gösterilmiyor

**HATA #6: Post-Match Persistence Eksik**
- **Sorun:** `PostMatchPersistenceService` silinmiş, maç bitişinde tüm veriler kaydedilmiyor
- **Etki:** Biten maçların detaylı verileri kaybolabilir

### 7.3 Workflow Hataları

**HATA #7: WebSocket Bağımlılığı**
- **Sorun:** Tüm real-time güncellemeler WebSocket'e bağımlı
- **Etki:** WebSocket koparsa, güncellemeler yavaş veya eksik olabilir

**HATA #8: Event'ler Sadece WebSocket'ten**
- **Sorun:** Event'ler (goller, kartlar) sadece WebSocket üzerinden geliyor
- **Etki:** WebSocket koparsa, event'ler kaybolabilir

---

## 8. SCRIPTLERİN DURUMU

### 8.1 Mevcut Scriptler

**Dosya:** `src/scripts/` klasörü

**Scriptler:**
- `check-all-matches-status.ts` - Maç status'larını kontrol eder
- `clean-sync-date.ts` - Belirli bir tarihin sync'ini temizler
- `sync-date.ts` - Belirli bir tarihi sync eder
- `run-daily-diary-sync.ts` - Günlük diary sync'ini çalıştırır
- `fix-*.ts` - Çeşitli fix scriptleri (kickoff time, second half, vb.)

**⚠️ NOT:** Scriptler genellikle one-off işlemler için kullanılıyor. Production'da düzenli çalışan worker'lar var, scriptler sadece manuel müdahale için.

### 8.2 Silinmiş Scriptler

**Deleted Files Listesinde:**
- `overnight-full-sync.ts` - Gece tam sync scripti (silinmiş)
- `backfill-finished-matches.ts` - Biten maçları backfill eden script (silinmiş)

**⚠️ KRİTİK:** Bu scriptler silinmiş ama işlevsellikleri worker'lara entegre edilmiş olabilir. Kontrol edilmeli.

---

## 9. ÖNERİLER VE İYİLEŞTİRMELER

### 9.1 Acil Düzeltmeler

1. **Frontend Polling Interval Düzelt:**
   ```typescript
   // MatchList.tsx satır 221
   const pollInterval = error && error.includes('502') ? 3000 : 10000; // 10 saniye normal, 3 saniye 502 hatası
   ```

2. **WebSocket Event Handling Genişlet:**
   ```typescript
   // MatchList.tsx satır 177-190
   if (message.type === 'GOAL' || message.type === 'SCORE_CHANGE' || message.type === 'MATCH_STATE_CHANGE') {
     fetchRef.current();
   }
   ```

3. **Post-Match Persistence Entegre Et:**
   ```typescript
   // matchDetailLive.service.ts reconcileMatchToDatabase() içine
   if (live.statusId === 8 && existingStatusId !== 8) {
     // Maç bitti, tüm verileri kaydet
     await this.persistAllMatchData(match_id);
   }
   ```

### 9.2 Orta Vadeli İyileştirmeler

1. **Watchdog'u Yeniden Aktif Et (Düzeltilmiş Versiyon):**
   - Should-be-live maçları tespit et
   - Ama yanlış END transition'larına neden olmadan

2. **Reconcile Rate Limiting:**
   - 3 saniyede bir 500 maç yerine, daha akıllı bir rate limiting
   - Öncelik sistemi: LIVE maçlar önce, diğerleri sonra

3. **Event Fallback Mekanizması:**
   - WebSocket koparsa, `/match/detail_live`'dan incidents çek
   - DataUpdateWorker'a event sync ekle

### 9.3 Uzun Vadeli İyileştirmeler

1. **WebSocket Reconnection Strategy:**
   - Exponential backoff
   - Connection health monitoring
   - Automatic re-subscription

2. **Database Indexing:**
   - `status_id`, `match_time`, `last_event_ts` field'larına index
   - Query performance iyileştirmesi

3. **Monitoring ve Alerting:**
   - Worker health monitoring
   - Stale match detection alerts
   - API rate limit monitoring

---

## 📊 ÖZET TABLO: WORKFLOW'LAR VE SIKLIKLAR

| Worker/Service | Sıklık | Endpoint | Amaç | Durum |
|----------------|--------|----------|------|-------|
| **DailyMatchSyncWorker** | 00:05 TSİ + 30dk repair | `/match/diary` | Günlük maçları sync | ✅ Aktif |
| **MatchSyncWorker** | 1 dk (cron) + 3s (live) | `/match/recent/list` | Değişen maçları sync | ✅ Aktif |
| **DataUpdateWorker** | 20 saniye | `/data/update` → `/match/detail_live` | Real-time güncellemeler | ✅ Aktif |
| **MatchMinuteWorker** | 30 saniye | - | Dakika hesapla | ✅ Aktif |
| **MatchWatchdogWorker** | - | - | Should-be-live tespit | ❌ Disabled |
| **WebSocketService** | Sürekli | MQTT | Real-time mesajlar | ✅ Aktif |
| **Frontend Polling** | 3 saniye | `/api/matches/live` | Maç listesi refresh | ⚠️ Çok sık |

---

## 🎯 SONUÇ

Livescore sayfası genel olarak çalışıyor ama birkaç kritik sorun var:

1. **Frontend polling çok agresif** (3 saniye) - Backend yükü artırıyor
2. **WebSocket event handling eksik** - Status değişiklikleri gecikmeli görünüyor
3. **Should-be-live maçlar işlenmiyor** - Watchdog disabled
4. **Post-match persistence eksik** - Biten maçların verileri kaybolabilir
5. **Event'ler sadece WebSocket'ten** - Fallback mekanizması yok

Bu sorunlar düzeltilirse, sistem daha güvenilir ve performanslı olacaktır.

---

**Rapor Hazırlayan:** AI Assistant  
**Son Güncelleme:** 2025-01-XX

