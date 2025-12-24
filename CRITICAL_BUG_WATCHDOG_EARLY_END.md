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

