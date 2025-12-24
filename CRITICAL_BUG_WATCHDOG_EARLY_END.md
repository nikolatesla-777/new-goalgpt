# 🚨 KRİTİK HATA: Watchdog Erken END Geçişi (match_time Kontrolü Eksik)

**Tarih:** 2025-12-24  
**Öncelik:** 🔴 YÜKSEK  
**Durum:** ❌ AKTİF HATA

---

## 📋 Hata Açıklaması

### Sorun
Watchdog, maç `/match/recent/list` endpoint'inde bulunmazsa otomatik olarak END (status 8) yapıyor. Ancak **`match_time` kontrolü yok**. Bu, henüz bitmemiş maçların "BİTTİ" gösterilmesine neden oluyor.

### Etkilenen Kullanıcı Senaryosu
- **Maç başlama:** 20:30 (TSI)
- **Şu an:** 20:56 (TSI)
- **Geçen süre:** 26 dakika
- **Beklenen durum:** İlk yarı devam ediyor veya devre arası
- **Gerçek durum:** Sistem maçı "BİTTİ" (status 8) gösteriyor
- **Skor:** 1-0 (Samsunspor - Eyüpspor)

### Neden Oluyor?
1. Maç `/match/recent/list`'te bulunamıyor (pagination, rate limit, API hatası vb.)
2. Watchdog: "Recent/list'te yok → muhtemelen bitti → END'e geç"
3. `match_time` kontrolü olmadığı için 26 dakikalık maç bile END oluyor

---

## 🔍 Etkilenen Kod

**Dosya:** `src/jobs/matchWatchdog.job.ts`  
**Satırlar:** 128-154

### Mevcut Kod (HATALI)

```typescript
if (!recentListMatch) {
  // Match not in recent/list - likely finished, transition to END
  logger.info(`[Watchdog] Match ${stale.matchId} not in recent/list, transitioning to END (status 8)`);
  
  const client = await pool.connect();
  try {
    const updateResult = await client.query(
      `UPDATE ts_matches 
       SET status_id = 8, updated_at = NOW(), last_event_ts = $1::BIGINT
       WHERE external_id = $2 AND status_id IN (2, 3, 4, 5, 7)`,
      [Math.floor(Date.now() / 1000), stale.matchId]
    );
    
    if (updateResult.rowCount > 0) {
      successCount++;
      reasons['finished_not_in_recent_list'] = (reasons['finished_not_in_recent_list'] || 0) + 1;
      
      logEvent('info', 'watchdog.reconcile.done', {
        match_id: stale.matchId,
        result: 'success',
        reason: 'finished_not_in_recent_list',
        duration_ms: Date.now() - reconcileStartTime,
        row_count: updateResult.rowCount,
        new_status_id: 8,
      });
      continue; // Skip detail_live reconcile
    }
  } finally {
    client.release();
  }
}
```

### Sorunlar
1. ❌ `match_time` kontrolü yok
2. ❌ Recent/list'te olmaması = bitmiş varsayımı (yanlış)
3. ❌ Maç yeni başlamış olabilir (ilk 30-60 dakika)
4. ❌ API pagination'da kaybolmuş olabilir
5. ❌ Rate limit nedeniyle recent/list eksik dönmüş olabilir

---

## ✅ Çözüm Önerisi

### Düzeltilmiş Kod

```typescript
if (!recentListMatch) {
  // Check match_time before transitioning to END
  const matchInfo = await client.query(
    `SELECT match_time, first_half_kickoff_ts, second_half_kickoff_ts, status_id 
     FROM ts_matches WHERE external_id = $1`,
    [stale.matchId]
  );
  
  if (matchInfo.rows.length === 0) {
    continue; // Match not found, skip
  }
  
  const match = matchInfo.rows[0];
  const nowTs = Math.floor(Date.now() / 1000);
  const matchTime = match.match_time;
  
  // Calculate minimum time for match to be finished
  // Standard match: 90 minutes + 15 min HT = 105 minutes minimum
  // With overtime: up to 120 minutes
  // Safety margin: 150 minutes (2.5 hours) from match_time
  const minTimeForEnd = matchTime + (150 * 60); // 150 minutes in seconds
  
  // If match started less than 150 minutes ago, DO NOT transition to END
  if (nowTs < minTimeForEnd) {
    logger.warn(
      `[Watchdog] Match ${stale.matchId} not in recent/list but match_time (${matchTime}) ` +
      `is less than 150 minutes ago (now: ${nowTs}, diff: ${Math.floor((nowTs - matchTime) / 60)} min). ` +
      `Skipping END transition. Will try detail_live instead.`
    );
    // Continue to detail_live reconcile instead of END
    // (fall through to detail_live check below)
  } else {
    // Match time is old enough, safe to transition to END
    logger.info(
      `[Watchdog] Match ${stale.matchId} not in recent/list and match_time (${matchTime}) ` +
      `is ${Math.floor((nowTs - matchTime) / 60)} minutes ago (>150 min). Transitioning to END.`
    );
    
    const updateResult = await client.query(
      `UPDATE ts_matches 
       SET status_id = 8, updated_at = NOW(), last_event_ts = $1::BIGINT
       WHERE external_id = $2 AND status_id IN (2, 3, 4, 5, 7)`,
      [nowTs, stale.matchId]
    );
    
    if (updateResult.rowCount > 0) {
      successCount++;
      reasons['finished_not_in_recent_list_safe'] = (reasons['finished_not_in_recent_list_safe'] || 0) + 1;
      
      logEvent('info', 'watchdog.reconcile.done', {
        match_id: stale.matchId,
        result: 'success',
        reason: 'finished_not_in_recent_list_safe',
        duration_ms: Date.now() - reconcileStartTime,
        row_count: updateResult.rowCount,
        new_status_id: 8,
        match_time: matchTime,
        elapsed_minutes: Math.floor((nowTs - matchTime) / 60),
      });
      continue; // Skip detail_live reconcile
    }
  }
}
```

### Düzeltme Mantığı
1. ✅ `match_time` çek
2. ✅ Maç başlama zamanından 150 dakika geçti mi kontrol et
3. ✅ Eğer 150 dakikadan az geçtiyse → END'e geçme, `detail_live` ile kontrol et
4. ✅ Eğer 150 dakikadan fazla geçtiyse → Güvenli şekilde END'e geç
5. ✅ Log'lara `match_time` ve `elapsed_minutes` ekle

### Neden 150 Dakika?
- Standart maç: 90 dakika + 15 dakika devre arası = 105 dakika
- Uzatmalar: +30 dakika (2x 15 dakika)
- Penaltılar: +10 dakika
- **Güvenlik marjı:** 150 dakika (2.5 saat)
- Bu süre, neredeyse tüm maç senaryolarını kapsar

---

## 🎯 Alternatif Çözüm (Daha Agresif)

Eğer `first_half_kickoff_ts` veya `second_half_kickoff_ts` varsa, daha hassas hesaplama:

```typescript
// If we have actual kickoff times, use them for better accuracy
let minTimeForEnd = matchTime + (150 * 60); // Default: 150 min from match_time

if (match.second_half_kickoff_ts) {
  // If second half started, use that as reference
  // Second half: 45 min + safety margin (15 min) = 60 min
  minTimeForEnd = match.second_half_kickoff_ts + (60 * 60);
} else if (match.first_half_kickoff_ts) {
  // If only first half started, use that
  // First half (45) + HT (15) + Second half (45) + margin (15) = 120 min
  minTimeForEnd = match.first_half_kickoff_ts + (120 * 60);
}
```

---

## 📊 Test Senaryoları

### Senaryo 1: Yeni Başlayan Maç (26 dakika)
- `match_time`: 20:30 (1703360400)
- `now`: 20:56 (1703362560)
- `elapsed`: 26 dakika
- **Beklenen:** END'e geçme, `detail_live` kontrol et
- **Gerçek (hatada):** END'e geçiyor ❌
- **Gerçek (düzeltmede):** END'e geçmez ✅

### Senaryo 2: Biten Maç (180 dakika)
- `match_time`: 17:30 (1703349000)
- `now`: 20:56 (1703362560)
- `elapsed`: 180 dakika
- **Beklenen:** END'e geçmeli
- **Gerçek (hatada):** END'e geçiyor ✅
- **Gerçek (düzeltmede):** END'e geçer ✅

### Senaryo 3: Uzatmada Olan Maç (110 dakika)
- `match_time`: 19:00 (1703354400)
- `now`: 20:56 (1703362560)
- `elapsed`: 110 dakika
- **Beklenen:** END'e geçme, henüz uzatmada olabilir
- **Gerçek (hatada):** END'e geçiyor ❌
- **Gerçek (düzeltmede):** END'e geçmez ✅

---

## 🔗 İlgili Dosyalar

- `src/jobs/matchWatchdog.job.ts` (satır 128-154)
- `src/services/thesports/match/matchWatchdog.service.ts`
- `PHASE5_S_REVISION_SAFETY_FIXES.md` (ilgili eski düzeltme)
- `CRITICAL_FIXES_REPORT.md` (timezone hatası - benzer sorun)

---

## 📝 Notlar

1. Bu hata, `PHASE5_S_REVISION_SAFETY_FIXES.md` dosyasında ele alınan "Auto-END Logic" hatasına benzer.
2. Daha önce `matchDatabase.service.ts`'deki otomatik END geçişi kaldırılmıştı.
3. Ancak `matchWatchdog.job.ts`'de aynı mantık hatası devam ediyor.
4. Bu düzeltme, kullanıcı deneyimini doğrudan etkiliyor (aktif maçlar "BİTTİ" gösteriliyor).

---

**Sonraki Adım:** Bu düzeltmeyi uygulayın.

---

# 🚨 KRİTİK HATA #2: Should-Be-Live Detection Başarısız - Maç Başlatılamıyor

**Tarih:** 2025-12-24  
**Öncelik:** 🔴 YÜKSEK  
**Durum:** ❌ AKTİF HATA

---

## 📋 Hata Açıklaması

### Sorun
Maç başlama zamanı geçmiş (`match_time <= now`) ama status hala NOT_STARTED (1). Should-be-live detection çalışmıyor veya `detail_live`/`diary` başarısız oluyor. Maç canlıya geçemiyor.

### Etkilenen Kullanıcı Senaryosu
- **Maç başlama:** 21:00 (TSI)
- **Şu an:** 21:05 (TSI)
- **Geçen süre:** 5 dakika
- **Beklenen durum:** Maç başlamış olmalı (FIRST_HALF - status 2)
- **Gerçek durum:** Sistem maçı başlatamıyor, "BİTTİ" gösteriyor (0-0)
- **Maç:** El Mokawloon El Arab vs Tala'ea El Gaish

### Neden Oluyor?
1. Should-be-live detection çalışıyor (`findShouldBeLiveMatches()`)
2. Recent/list'te maç yok
3. `detail_live` çekiliyor ama başarısız oluyor (maç bulunamıyor)
4. `diary` fallback deniyor ama başarısız oluyor
5. Maç NOT_STARTED (1) durumunda kalıyor
6. Frontend'de yanlış gösteriliyor ("BİTTİ")

---

## 🔍 Etkilenen Kod

**Dosya:** `src/jobs/matchWatchdog.job.ts`  
**Satırlar:** 284-412 (should-be-live matches processing)

### Mevcut Kod (SORUNLU)

```typescript
if (!recentListMatch) {
  // Match not in recent/list - try detail_live first, then diary as fallback
  try {
    const reconcileResult = await this.matchDetailLiveService.reconcileMatchToDatabase(match.matchId, null);
    
    if (reconcileResult.updated && reconcileResult.rowCount > 0) {
      // Success
      continue;
    }
    
    // detail_live failed - try diary as fallback
    // ... diary fallback code ...
    
    // Both detail_live and diary failed
    skippedCount++;
    reasons['not_in_recent_list_no_detail_data'] = (reasons['not_in_recent_list_no_detail_data'] || 0) + 1;
    // ❌ Maç NOT_STARTED (1) durumunda kalıyor, başlatılamıyor
  }
}
```

### Sorunlar
1. ❌ `detail_live` başarısız olursa → maç NOT_STARTED kalıyor
2. ❌ `diary` fallback başarısız olursa → maç NOT_STARTED kalıyor
3. ❌ Maç yeni başladıysa (5 dakika) → API henüz güncellememiş olabilir
4. ❌ Rate limit nedeniyle `detail_live` başarısız olabilir
5. ❌ Circuit breaker açıksa → `detail_live` başarısız olur
6. ❌ Maç başladı ama API henüz "recent" listesine eklememiş

---

## ✅ Çözüm Önerisi

### Düzeltilmiş Kod

```typescript
if (!recentListMatch) {
  // Match not in recent/list - try detail_live first, then diary as fallback
  try {
    const reconcileResult = await this.matchDetailLiveService.reconcileMatchToDatabase(match.matchId, null);
    
    if (reconcileResult.updated && reconcileResult.rowCount > 0) {
      // Success
      continue;
    }
    
    // detail_live failed - try diary as fallback
    // ... diary fallback code ...
    
    // Both detail_live and diary failed
    // CRITICAL FIX: Check match_time before giving up
    const nowTs = Math.floor(Date.now() / 1000);
    const minutesSinceMatchTime = Math.floor((nowTs - match.matchTime) / 60);
    
    // If match started less than 10 minutes ago, retry later (API might not have updated yet)
    if (minutesSinceMatchTime < 10) {
      logger.warn(
        `[Watchdog] Match ${match.matchId} not in recent/list and detail_live/diary failed, ` +
        `but match started only ${minutesSinceMatchTime} minutes ago. ` +
        `Will retry later (API might not have updated yet).`
      );
      skippedCount++;
      reasons['should_be_live_too_recent'] = (reasons['should_be_live_too_recent'] || 0) + 1;
      continue; // Don't give up, will retry in next tick
    }
    
    // If match started more than 10 minutes ago but still no data, log warning
    logger.warn(
      `[Watchdog] Match ${match.matchId} not in recent/list and detail_live/diary failed, ` +
      `match started ${minutesSinceMatchTime} minutes ago. ` +
      `Possible reasons: API delay, rate limit, circuit breaker, or match cancelled.`
    );
    skippedCount++;
    reasons['not_in_recent_list_no_detail_data'] = (reasons['not_in_recent_list_no_detail_data'] || 0) + 1;
  }
}
```

### Düzeltme Mantığı
1. ✅ `detail_live` başarısız olursa → `diary` fallback dene
2. ✅ Her ikisi de başarısız olursa → `match_time` kontrolü yap
3. ✅ Maç başlama zamanından 10 dakika geçmediyse → retry later (API gecikmesi olabilir)
4. ✅ Maç başlama zamanından 10 dakika geçtiyse → warning log, retry continue

---

## 📊 Test Senaryoları

### Senaryo 1: Yeni Başlayan Maç (5 dakika)
- `match_time`: 21:00 (1703365200)
- `now`: 21:05 (1703365500)
- `elapsed`: 5 dakika
- **Beklenen:** Should-be-live detection çalışmalı, `detail_live` başarılı olmalı
- **Gerçek (hatada):** `detail_live` başarısız → NOT_STARTED kalıyor ❌
- **Gerçek (düzeltmede):** 10 dakikadan az → retry later ✅

### Senaryo 2: API Gecikmesi (15 dakika)
- `match_time`: 21:00 (1703365200)
- `now`: 21:15 (1703366100)
- `elapsed`: 15 dakika
- **Beklenen:** `detail_live` veya `diary` başarılı olmalı
- **Gerçek (hatada):** Her ikisi de başarısız → NOT_STARTED kalıyor ❌
- **Gerçek (düzeltmede):** 10 dakikadan fazla → warning log, retry continue ✅

---

## 🔗 İlgili Dosyalar

- `src/jobs/matchWatchdog.job.ts` (satır 284-412)
- `src/jobs/proactiveMatchStatusCheck.job.ts` (satır 37-246)
- `src/services/thesports/match/matchDetailLive.service.ts` (satır 279-571)
- `src/services/thesports/match/matchWatchdog.service.ts` (satır 129-175)

---

## 📝 Notlar

1. Bu hata, should-be-live detection'ın çalıştığını ama `detail_live`/`diary`'nin başarısız olduğunu gösteriyor.
2. İlk 10 dakika için daha agresif retry mekanizması gerekebilir.
3. Circuit breaker açıksa, `diary` fallback daha güvenilir olmalı.
4. Rate limit nedeniyle `detail_live` başarısız olabilir, bu durumda exponential backoff gerekebilir.

---

# 🚨 KRİTİK HATA #3: HALF_TIME → SECOND_HALF Geçişi Sırasında END'e Geçiyor

**Tarih:** 2025-12-24  
**Öncelik:** 🔴 YÜKSEK  
**Durum:** ❌ AKTİF HATA

---

## 📋 Hata Açıklaması

### Sorun
Maç DEVRE ARASI (HALF_TIME - status 3) statüsündeyken, ikinci yarı başladığında sistem maçı BİTTİ (END - status 8) olarak işaretliyor. HALF_TIME → SECOND_HALF geçişi sırasında Watchdog yanlış müdahale ediyor.

### Etkilenen Kullanıcı Senaryosu
- **Maç durumu:** DEVRE ARASI (HALF_TIME - status 3)
- **İkinci yarı başladı:** Sistem maçı BİTTİ (END - status 8) olarak işaretledi
- **Beklenen durum:** SECOND_HALF (status 4) olmalı
- **Gerçek durum:** END (status 8) gösteriliyor
- **Maç:** Al Qadisiya SC vs Sitra (1-0)

### Neden Oluyor?
1. HALF_TIME (status 3) stale olarak tespit ediliyor (900s = 15 dakika threshold)
2. Recent/list'te maç yok veya status 8 olarak görünüyor (pagination, rate limit, API gecikmesi)
3. Watchdog: "Recent/list'te yok → muhtemelen bitti → END'e geç" mantığı devreye giriyor
4. Ama maç aslında ikinci yarıya geçmiş olmalı (status 4)
5. HALF_TIME için özel kontrol yok → direkt END'e geçiyor

---

## 🔍 Etkilenen Kod

**Dosya:** `src/jobs/matchWatchdog.job.ts`  
**Satırlar:** 125-196 (stale matches processing)

### Mevcut Kod (HATALI)

```typescript
// Find stale matches (120s for live, 900s for HALF_TIME)
const stales = await this.matchWatchdogService.findStaleLiveMatches(nowTs, 120, 900, 100);

// Process each stale match
for (const stale of stales) {
  const recentListMatch = recentListAllMatches.get(stale.matchId);
  
  if (!recentListMatch) {
    // Match not in recent/list - likely finished, transition to END
    logger.info(`[Watchdog] Match ${stale.matchId} not in recent/list, transitioning to END (status 8)`);
    
    const updateResult = await client.query(
      `UPDATE ts_matches 
       SET status_id = 8, updated_at = NOW(), last_event_ts = $1::BIGINT
       WHERE external_id = $2 AND status_id IN (2, 3, 4, 5, 7)`,  // ❌ Status 3 (HALF_TIME) dahil!
      [Math.floor(Date.now() / 1000), stale.matchId]
    );
  }
}
```

### Sorunlar
1. ❌ HALF_TIME (status 3) için özel kontrol yok
2. ❌ Recent/list'te yoksa → direkt END'e geçiyor (status 3 dahil)
3. ❌ Devre arası 15 dakika sürebilir, ikinci yarı başladığında recent/list'te olmayabilir
4. ❌ `match_time` kontrolü yok (ilk hata ile aynı)
5. ❌ HALF_TIME → SECOND_HALF geçişi için `detail_live` kontrolü yok

---

## ✅ Çözüm Önerisi

### Düzeltilmiş Kod

```typescript
// Process each stale match
for (const stale of stales) {
  const recentListMatch = recentListAllMatches.get(stale.matchId);
  
  // CRITICAL FIX: HALF_TIME (status 3) için özel kontrol
  if (stale.statusId === 3) {
    // HALF_TIME için recent/list'te yoksa → END'e geçmeden önce detail_live kontrol et
    if (!recentListMatch) {
      logger.info(
        `[Watchdog] HALF_TIME match ${stale.matchId} not in recent/list, ` +
        `checking detail_live for SECOND_HALF transition before END`
      );
      
      try {
        const reconcileResult = await this.matchDetailLiveService.reconcileMatchToDatabase(
          stale.matchId,
          null
        );
        
        if (reconcileResult.updated && reconcileResult.rowCount > 0) {
          // detail_live başarılı → status güncellendi (muhtemelen SECOND_HALF)
          if (reconcileResult.statusId === 4) {
            logger.info(
              `[Watchdog] HALF_TIME match ${stale.matchId} transitioned to SECOND_HALF via detail_live`
            );
            successCount++;
            reasons['half_time_to_second_half'] = (reasons['half_time_to_second_half'] || 0) + 1;
            continue;
          }
        }
      } catch (detailLiveError: any) {
        logger.warn(
          `[Watchdog] detail_live failed for HALF_TIME match ${stale.matchId}: ${detailLiveError.message}`
        );
      }
      
      // detail_live başarısız → match_time kontrolü yap
      const matchInfo = await client.query(
        `SELECT match_time, first_half_kickoff_ts FROM ts_matches WHERE external_id = $1`,
        [stale.matchId]
      );
      
      if (matchInfo.rows.length > 0) {
        const match = matchInfo.rows[0];
        const nowTs = Math.floor(Date.now() / 1000);
        const matchTime = match.match_time;
        const firstHalfKickoff = match.first_half_kickoff_ts;
        
        // Calculate minimum time for match to be finished
        // First half (45) + HT (15) + Second half (45) + margin (15) = 120 minutes
        const minTimeForEnd = (firstHalfKickoff || matchTime) + (120 * 60);
        
        if (nowTs < minTimeForEnd) {
          logger.warn(
            `[Watchdog] HALF_TIME match ${stale.matchId} not in recent/list but match started ` +
            `${Math.floor((nowTs - matchTime) / 60)} minutes ago (<120 min). ` +
            `Skipping END transition. Will retry later.`
          );
          skippedCount++;
          reasons['half_time_too_recent'] = (reasons['half_time_too_recent'] || 0) + 1;
          continue; // Don't transition to END, retry later
        }
      }
    }
  }
  
  // Normal stale match processing (status 2, 4, 5, 7)
  if (!recentListMatch) {
    // ... existing code with match_time check (from HATA #1) ...
  }
}
```

### Düzeltme Mantığı
1. ✅ HALF_TIME (status 3) için özel kontrol ekle
2. ✅ Recent/list'te yoksa → önce `detail_live` çek (SECOND_HALF olabilir)
3. ✅ `detail_live` başarısız olursa → `match_time` kontrolü yap
4. ✅ Maç başlama zamanından 120 dakika geçmediyse → END'e geçme, retry later
5. ✅ Maç başlama zamanından 120 dakika geçtiyse → güvenli şekilde END'e geç

### Neden 120 Dakika?
- İlk yarı: 45 dakika
- Devre arası: 15 dakika
- İkinci yarı: 45 dakika
- **Toplam:** 105 dakika
- **Güvenlik marjı:** 120 dakika (2 saat)

---

## 📊 Test Senaryoları

### Senaryo 1: Devre Arası (10 dakika)
- `status_id`: 3 (HALF_TIME)
- `first_half_kickoff_ts`: 20:00 (1703364000)
- `now`: 20:55 (1703367300)
- `elapsed`: 55 dakika (ilk yarı + devre arası)
- **Beklenen:** İkinci yarı başlamış olabilir, `detail_live` kontrol et
- **Gerçek (hatada):** Recent/list'te yok → END'e geçiyor ❌
- **Gerçek (düzeltmede):** `detail_live` çek → SECOND_HALF'a geç ✅

### Senaryo 2: İkinci Yarı Başladı (60 dakika)
- `status_id`: 3 (HALF_TIME)
- `first_half_kickoff_ts`: 20:00 (1703364000)
- `now`: 21:00 (1703367600)
- `elapsed`: 60 dakika
- **Beklenen:** İkinci yarı başlamış olmalı (status 4)
- **Gerçek (hatada):** Recent/list'te yok → END'e geçiyor ❌
- **Gerçek (düzeltmede):** `detail_live` çek → SECOND_HALF'a geç ✅

---

## 🔗 İlgili Dosyalar

- `src/jobs/matchWatchdog.job.ts` (satır 125-196)
- `src/services/thesports/match/matchWatchdog.service.ts` (satır 47-114)
- `src/services/thesports/match/matchDetailLive.service.ts` (satır 422-431)

---

## 📝 Notlar

1. Bu hata, HATA #1 ile benzer (match_time kontrolü eksik).
2. Ancak HALF_TIME için özel bir durum var: İkinci yarı başladığında recent/list'te olmayabilir.
3. HALF_TIME → SECOND_HALF geçişi için `detail_live` kontrolü zorunlu.
4. Devre arası 15 dakika sürebilir, bu yüzden HALF_TIME için daha uzun threshold gerekebilir (20-25 dakika).

---

# 💡 BEYİN FIRTINASI: Neden Worker'lar Kullanıyoruz?

**Tarih:** 2025-12-24  
**Durum:** 🤔 ANALİZ

---

## 📋 Soru

Statü değişimleri için neden worker'lar, watchdog'lar gibi ikincil/üçüncül araçlar kullanıyoruz? Tek bir endpoint üzerinden gelmiyor mu?

---

## ✅ Cevap: Tek Endpoint Var!

### 1. `/data/update` Endpoint'i (Her 20 Saniye)

**Endpoint:** `GET /data/update`

**Ne Yapıyor:**
- Son 120 saniye içinde değişen maç ID'lerini döner
- `changed_matches` array'i içinde `match_id` ve `update_time` var
- Her değişen maç için `/match/detail_live` çağrılıyor
- Statü değişimleri bu şekilde yakalanıyor

**Kod:**
```typescript
// src/jobs/dataUpdate.job.ts:138-214
const payload = await this.dataUpdateService.checkUpdates();
const { matchIds: changedMatchIds } = this.normalizeChangedMatches(payload);

for (const matchId of changedMatchIds) {
  // Her değişen maç için detail_live çek
  await this.matchDetailLiveService.reconcileMatchToDatabase(matchId, updateTime);
}
```

### 2. `/match/detail_live` Endpoint'i (Provider-Authoritative)

**Endpoint:** `GET /match/detail_live?match_id=xxx`

**Ne Yapıyor:**
- Maç başlamadan önce çağrılırsa → `status_id=1` (NOT_STARTED) döner
- Maç başladıktan sonra çağrılırsa → `status_id=2` (FIRST_HALF) döner
- Devre arası → `status_id=3` (HALF_TIME) döner
- İkinci yarı → `status_id=4` (SECOND_HALF) döner
- Maç bitti → `status_id=8` (END) döner

**Kod:**
```typescript
// src/services/thesports/match/matchDetailLive.service.ts:163-168
const statusId = root?.status_id ?? root?.status ?? null;

// src/services/thesports/match/matchDetailLive.service.ts:388-391
if (hasLiveData && live.statusId !== null) {
  setParts.push(`status_id = $${i++}`);
  values.push(live.statusId); // Provider'dan gelen status_id direkt yazılıyor!
}
```

---

## ❌ Sorun: Watchdog Gereksiz!

Watchdog'un "recent/list'te yok → END'e geç" mantığı yanlış çünkü:

1. ✅ `/data/update` zaten değişen maçları listeler
2. ✅ Her değişen maç için `/match/detail_live` çağrılıyor
3. ✅ `reconcileMatchToDatabase()` → `status_id`'yi database'e yazıyor
4. ❌ Watchdog'un recent/list kontrolü gereksiz
5. ❌ Watchdog'un END'e geçme mantığı yanlış

---

## 🎯 Çözüm Önerisi

### Watchdog'u Kaldır veya Sadece Fallback Olarak Kullan

1. **`/data/update` çalışıyorsa** → Watchdog'a gerek yok
2. **`/data/update` başarısız olursa** → Watchdog fallback olarak devreye girer
3. **Watchdog'un END'e geçme mantığını kaldır** → Sadece `/match/detail_live` kullan

### Basitleştirilmiş Akış

```
1. DataUpdateWorker (her 20s)
   → GET /data/update
   → changed_matches array
   → Her maç için GET /match/detail_live
   → reconcileMatchToDatabase() → status_id güncelle

2. Watchdog (sadece fallback - /data/update başarısız olursa)
   → Stale match tespit et
   → GET /match/detail_live
   → reconcileMatchToDatabase() → status_id güncelle
   → ❌ Recent/list kontrolü YOK
   → ❌ END'e geçme mantığı YOK
```

---

## 📝 Notlar

1. **Asıl soru:** Neden `/data/update` çalışmıyor veya bazı maçları kaçırıyor?
   - Küçük ligler → `/data/update`'e eklenmeyebilir
   - Pagination → Bazı maçlar listede olmayabilir
   - Rate limit → `/data/update` başarısız olabilir
   - API gecikmesi → Maç başladı ama henüz güncellenmedi

2. **Watchdog'un amacı:** `/data/update` başarısız olduğunda fallback olarak çalışmak
3. **Ama Watchdog yanlış müdahale ediyor:** Recent/list'te yoksa END'e geçiyor (yanlış!)

---

# ❓ SORU: 21:00'de Başlaması Gereken Maç Neden Başlamıyor?

**Tarih:** 2025-12-24  
**Durum:** 🔍 ARAŞTIRMA

---

## 📋 Soru

21:00'de başlaması gereken maç neden başlamıyor? Canlıda 4-5 tane canlı maç var ama bu maç başlamamış.

---

## ✅ Cevap

**Sorun:** `/data/update` endpoint'i sadece **değişen** maçları listeler. Maç henüz başlamadıysa (21:00'de başlaması gerekiyor ama 21:03'te başladı), `/data/update` bu maçı "değişen" olarak listelemez çünkü henüz başlamamış.

**Kod:**
```typescript
// src/jobs/dataUpdate.job.ts:138-150
const payload = await this.dataUpdateService.checkUpdates();
const { matchIds: changedMatchIds } = this.normalizeChangedMatches(payload);

// changedMatchIds sadece DEĞİŞEN maçları içerir
// Maç henüz başlamadıysa (status_id=1), değişen olarak listelenmez!
```

**Sorun:** `/data/update` maç başlamadan önce değişiklik bildirmez. Maç başladığında (21:03) değişiklik bildirir, ama bu noktaya kadar maç `status_id=1` (NOT_STARTED) kalır.

**Çözüm:** `ProactiveMatchStatusCheckWorker` veya `MatchWatchdogWorker` bu maçı tespit etmeli:
- `match_time <= now` (21:00 <= 21:03)
- `status_id = 1` (NOT_STARTED)
- `/match/detail_live` çek → `status_id=2` (FIRST_HALF) döner
- Database'i güncelle

**Ama görünüşe göre çalışmıyor.**

---

## 🔍 Olası Nedenler

1. **`ProactiveMatchStatusCheckWorker` çalışmıyor** (her 20s olmalı)
2. **`MatchWatchdogWorker` bu maçı tespit edemiyor** (should-be-live detection başarısız)
3. **`/match/detail_live` başarısız oluyor** (circuit breaker, timeout, rate limit)
4. **`/data/update` bu maçı listelemiyor** (küçük lig, pagination)

---

# ❓ SORU: Maç 21:03'te Gerçekte Başladı, Hangi Endpoint ile Tetikleniyor?

**Tarih:** 2025-12-24  
**Durum:** ✅ CEVAP

---

## 📋 Soru

Örneğin maçın başlangıç saatini sen database'e 21:00 yazdırdın ama maç 3 dakika gerçekte geç başladı. Hakem sahaya geç çıktı. Bunu 21:03'te doğru saatte başlatmak için ekstra bir script olayına girmeden hangi endpoint üzerinden bu maçı tetikletip canlıya alıyor?

---

## ✅ Cevap: `/match/detail_live` Endpoint'i

**Endpoint:** `GET /match/detail_live?match_id=xxx`

**Akış:**
1. Maç 21:03'te başladı (gerçek başlama zamanı)
2. `/data/update` bu maçı "değişen" olarak listeler (21:03'te status değişti: 1 → 2)
3. `DataUpdateWorker` → `/match/detail_live` çağırır
4. `/match/detail_live` → `status_id=2` (FIRST_HALF) döner
5. `reconcileMatchToDatabase()` → Database'i günceller

**Kod:**
```typescript
// src/jobs/dataUpdate.job.ts:211-214
const result = await this.matchDetailLiveService.reconcileMatchToDatabase(
  matchIdStr,
  updateTime
);

// reconcileMatchToDatabase() içinde:
// src/services/thesports/match/matchDetailLive.service.ts:295-296
const resp = await this.getMatchDetailLive({ match_id }, { forceRefresh: true });
const live = this.extractLiveFields(resp, match_id);

// live.statusId = 2 (FIRST_HALF) → Database'e yazılıyor
// src/services/thesports/match/matchDetailLive.service.ts:388-391
if (hasLiveData && live.statusId !== null) {
  setParts.push(`status_id = $${i++}`);
  values.push(live.statusId); // Provider'dan gelen status_id direkt yazılıyor!
}
```

**Özet:** `/match/detail_live` endpoint'i maç başladığında otomatik olarak `status_id=2` döndürüyor. Ekstra script gerekmez.

---

## 🔄 Tam Akış

### Senaryo: Maç 21:00'de başlaması gerekiyor ama 21:03'te başladı

1. **21:00 - Maç başlaması gerekiyor**
   - Database: `status_id=1`, `match_time=21:00`
   - `/data/update`: Bu maçı listelemez (henüz değişmemiş)

2. **21:03 - Maç gerçekte başladı**
   - TheSports API: Maç başladı, `status_id=2` (FIRST_HALF)
   - `/data/update`: Bu maçı "değişen" olarak listeler
   - `DataUpdateWorker`: `/match/detail_live` çağırır
   - `/match/detail_live`: `status_id=2` döner
   - `reconcileMatchToDatabase()`: Database'i günceller
   - Database: `status_id=2`, `first_half_kickoff_ts=21:03` (gerçek başlama zamanı)

3. **Sonuç:** Maç otomatik olarak canlıya geçti, ekstra script gerekmedi!

---

## 📝 Notlar

1. **`/match/detail_live` provider-authoritative:** Provider ne derse o olur
2. **`/data/update` değişen maçları listeler:** Maç başladığında otomatik olarak listede olur
3. **Ekstra script gerekmez:** Sistem otomatik olarak çalışıyor
4. **Sorun:** Eğer `/data/update` bu maçı listelemezse → maç başlamaz (HATA #2)

---

**Sonraki Adım:** Tüm bu hataları düzelt ve sistemi basitleştir.

