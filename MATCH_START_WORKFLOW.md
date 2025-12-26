# Maç Başlama Workflow - Adım Adım

**Maç:** Pyramids FC vs Ismaily SC  
**Durum:** Database'de `status_id = 1` (NOT_STARTED), `match_time = 21:00 TSİ`

---

## 📋 Endpoint'ler ve Kullanımları

### 1. `/data/update` Endpoint
- **Service:** `DataUpdateService`
- **Sıklık:** Her 20 saniyede bir
- **Amaç:** Son 120 saniyede değişen maçları bulur
- **Worker:** `DataUpdateWorker` (her 20 saniyede çalışır)

### 2. `/match/detail_live` Endpoint
- **Service:** `MatchDetailLiveService`
- **Amaç:** Belirli bir maçın canlı detaylarını çeker (status, score, minute, events)
- **Kullanım:** `reconcileMatchToDatabase()` fonksiyonu içinde

### 3. `/match/diary` Endpoint
- **Service:** `MatchDiaryService`
- **Amaç:** Belirli bir tarihin tüm maçlarını çeker
- **Format:** `date=YYYYMMDD` (örn: `20251225`)

### 4. `/match/recent/list` Endpoint
- **Service:** `MatchRecentService`
- **Amaç:** Son maçları çeker (incremental sync için `time` parametresi ile)

---

## 🔄 Maç Canlıya Geçiş Workflow

### **ADIM 1: Maç Database'de NOT_STARTED (status_id=1)**

```
Database State:
- external_id: "xyz123"
- status_id: 1 (NOT_STARTED)
- match_time: 1766656800 (21:00 TSİ)
- first_half_kickoff_ts: NULL
- minute: NULL
```

---

### **ADIM 2: Saat 21:00 TSİ Geldi**

Maç saati geçti ama hala `status_id = 1`. Sistem bunu tespit etmeli.

---

### **ADIM 3: ProactiveMatchStatusCheckWorker (Her 20 Saniyede)**

**Dosya:** `src/jobs/proactiveMatchStatusCheck.job.ts`

**Ne Yapıyor:**
1. Bugünkü tüm maçları sorgular:
   ```sql
   SELECT external_id, match_time, status_id
   FROM ts_matches
   WHERE match_time >= todayStartTSI
     AND match_time < todayEndTSI
     AND status_id = 1  -- NOT_STARTED
     AND match_time <= NOW()  -- Saat geçmiş
   ```

2. Bulunan maçlar için **`/match/detail_live`** endpoint'ini çağırır:
   ```typescript
   await matchDetailLiveService.reconcileMatchToDatabase(match.external_id)
   ```

3. Eğer `detail_live` boş dönerse, **`/match/diary`** endpoint'ini fallback olarak kullanır:
   ```typescript
   const diaryService = new MatchDiaryService(client)
   const diaryResponse = await diaryService.getMatchDiary({ date: "20251225" })
   ```

---

### **ADIM 4: DataUpdateWorker (Her 20 Saniyede)**

**Dosya:** `src/jobs/dataUpdate.job.ts`

**Ne Yapıyor:**
1. **`/data/update`** endpoint'ini çağırır:
   ```typescript
   const payload = await dataUpdateService.checkUpdates()
   ```

2. Response'dan değişen maç ID'lerini çıkarır:
   ```typescript
   const { matchIds } = normalizeChangedMatches(payload)
   // Örnek: ["xyz123", "abc456", ...]
   ```

3. Her maç için **`/match/detail_live`** endpoint'ini çağırır:
   ```typescript
   await matchDetailLiveService.reconcileMatchToDatabase(matchId)
   ```

---

### **ADIM 5: MatchSyncWorker (Her 1 Dakikada)**

**Dosya:** `src/jobs/matchSync.job.ts`

**Ne Yapıyor:**
1. **`/match/recent/list`** endpoint'ini çağırır (incremental sync):
   ```typescript
   await recentSyncService.syncIncremental()
   ```

2. Son 1 dakikada değişen maçları çeker ve database'e yazar.

3. Canlı maçları (status 2, 3, 4, 5, 7) reconcile queue'ya ekler:
   - Her 30 saniyede: LIVE maçlar (status 2, 4, 5)
   - Her 20 saniyede: FIRST_HALF maçlar (status 2)
   - Her 15 saniyede: SECOND_HALF maçlar (status 4)
   - Her 30 saniyede: HALF_TIME maçlar (status 3)

---

### **ADIM 6: reconcileMatchToDatabase() Fonksiyonu**

**Dosya:** `src/services/thesports/match/matchDetailLive.service.ts`

**Ne Yapıyor:**

1. **`/match/detail_live`** endpoint'ini çağırır:
   ```typescript
   const response = await this.client.get('/match/detail_live', { match_id: "xyz123" })
   ```

2. Response'dan verileri çıkarır:
   ```typescript
   const live = extractLiveFields(response, "xyz123")
   // live.statusId = 2 (FIRST_HALF)
   // live.homeScoreDisplay = 0
   // live.awayScoreDisplay = 0
   // live.minute = null (provider göndermiyor)
   // live.liveKickoffTime = 1766656800 (score array'den)
   ```

3. Database'deki mevcut durumu okur:
   ```sql
   SELECT status_id, first_half_kickoff_ts, minute
   FROM ts_matches
   WHERE external_id = 'xyz123'
   ```

4. **Kritik Status Transition Kontrolü:**
   ```typescript
   const isCriticalTransition = 
     (existingStatusId === 1 && live.statusId === 2) || // NOT_STARTED → FIRST_HALF
     (existingStatusId === 2 && live.statusId === 3) || // FIRST_HALF → HALF_TIME
     (existingStatusId === 3 && live.statusId === 4) || // HALF_TIME → SECOND_HALF
     (existingStatusId === 4 && live.statusId === 8)    // SECOND_HALF → END
   
   // Eğer kritik transition ise, optimistic locking'i bypass et
   if (isCriticalTransition) {
     // Update'i yap, timestamp kontrolünü atla
   }
   ```

5. **Database'i günceller:**
   ```sql
   UPDATE ts_matches
   SET 
     status_id = 2,  -- FIRST_HALF
     first_half_kickoff_ts = 1766656800,  -- match_time'ı kullan
     minute = 5,  -- Hesaplanan dakika
     updated_at = NOW()
   WHERE external_id = 'xyz123'
   ```

6. **Minute Hesaplama:**
   ```typescript
   if (live.minute === null) {
     // Provider minute göndermiyor, kickoff timestamp'lerden hesapla
     const calculatedMinute = calculateMinuteFromKickoffs(
       live.statusId,  // 2 (FIRST_HALF)
       firstHalfKickoffTs,  // 1766656800
       secondHalfKickoffTs,  // NULL
       overtimeKickoffTs,    // NULL
       existing.minute,
       nowTs
     )
     // calculatedMinute = Math.floor((nowTs - 1766656800) / 60) + 1
     // = 5 dakika
   }
   ```

---

### **ADIM 7: Database Güncellendi**

```
Database State (Güncel):
- external_id: "xyz123"
- status_id: 2 (FIRST_HALF) ✅
- match_time: 1766656800
- first_half_kickoff_ts: 1766656800 ✅
- minute: 5 ✅
- updated_at: NOW()
```

---

### **ADIM 8: Frontend'de Görünür**

**Endpoint:** `GET /api/matches/live`

**Controller:** `src/controllers/match.controller.ts`

**Ne Yapıyor:**
1. Database'den canlı maçları çeker:
   ```sql
   SELECT * FROM ts_matches
   WHERE status_id IN (2, 3, 4, 5, 7)
   ```

2. Her maç için `minute_text` oluşturur:
   ```typescript
   const minuteText = generateMinuteText(minute, statusId)
   // minute = 5, statusId = 2
   // minuteText = "5'"
   ```

3. Frontend'e gönderir:
   ```json
   {
     "success": true,
     "data": {
       "results": [{
         "id": "xyz123",
         "status_id": 2,
         "minute": 5,
         "minute_text": "5'",
         "home_team_name": "Pyramids FC",
         "away_team_name": "Ismaily SC"
       }]
     }
   }
   ```

---

## 🎯 Özet: Maç Nasıl Canlıya Geçer?

1. **ProactiveMatchStatusCheckWorker** (20 saniye): `match_time` geçmiş + `status_id=1` olan maçları bulur → `/match/detail_live` çağırır
2. **DataUpdateWorker** (20 saniye): `/data/update` çağırır → değişen maçları bulur → `/match/detail_live` çağırır
3. **MatchSyncWorker** (1 dakika): `/match/recent/list` çağırır → değişen maçları sync eder
4. **reconcileMatchToDatabase()**: `/match/detail_live` response'unu parse eder → Database'i günceller
5. **Frontend**: `/api/matches/live` endpoint'i → Database'den canlı maçları çeker → `minute_text` oluşturur → Gösterir

---

## ⚠️ Kritik Noktalar

1. **Provider Status Authoritative:** Database'deki status değil, provider'dan gelen status kullanılır
2. **Critical Transitions Bypass:** NOT_STARTED → FIRST_HALF gibi kritik transition'lar optimistic locking'i bypass eder
3. **Minute Calculation:** Provider minute göndermiyorsa, `first_half_kickoff_ts`'den hesaplanır
4. **Fallback Mechanism:** `detail_live` boş dönerse, `diary` endpoint'i kullanılır

---

## 📊 Timing

- **En Hızlı:** 20 saniye (ProactiveMatchStatusCheckWorker veya DataUpdateWorker)
- **Ortalama:** 1 dakika (MatchSyncWorker)
- **En Yavaş:** 1 dakika (MatchSyncWorker incremental sync)


