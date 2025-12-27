# CRITICAL FIX: Bitmiş Maçlar END Status'üne Geçmiyor

**Date:** 2025-12-27  
**Status:** ✅ FIXED

---

## Sorun

Bitmiş maçlar (2. Yarı'da oynananlar) hala canlı maçlar listesinde görünüyordu. Bu maçlar END (status 8) olmalıydı ama status 4 (SECOND_HALF) olarak kalıyordu.

---

## Kök Neden

`reconcileMatchToDatabase()` fonksiyonunda:
1. Provider'dan (`/match/detail_live`) maç gelmediğinde (bitmiş maçlar için provider maçı döndürmeyebilir)
2. `live.statusId === null` oluyordu
3. Fonksiyon `return { updated: false, ... }` yapıyordu
4. Maç END'e geçmiyordu ve hala canlı listesinde kalıyordu

---

## Çözüm

**File:** `src/services/thesports/match/matchDetailLive.service.ts`  
**Function:** `reconcileMatchToDatabase()`

**Değişiklik:**
- Provider'dan maç gelmediğinde, match'in DB'deki durumunu kontrol et
- Eğer match LIVE status'te ise (2, 3, 4, 5, 7) ve `match_time` üzerinden 150 dakika geçmişse
- Maçı END (status 8) olarak işaretle
- Bu, watchdog'a bağımlı olmadan direkt END transition yapılmasını sağlar

**Kod:**
```typescript
// CRITICAL FIX: If provider didn't return match data AND match is currently LIVE status,
// check if enough time has passed to safely transition to END
if (live.statusId === null && live.homeScoreDisplay === null && live.awayScoreDisplay === null) {
  // ...
  if ([2, 3, 4, 5, 7].includes(existingStatusId) && matchTime !== null) {
    const minTimeForEnd = matchTime + (150 * 60); // 150 minutes in seconds
    
    if (nowTs >= minTimeForEnd) {
      // Match time is old enough (>150 min), safe to transition to END
      const updateResult = await client.query(
        `UPDATE ts_matches 
         SET status_id = 8, updated_at = NOW(), last_event_ts = $1::BIGINT,
             ${minuteColumn} = NULL
         WHERE external_id = $2 AND status_id IN (2, 3, 4, 5, 7)`,
        [nowTs, match_id]
      );
      // ...
    }
  }
}
```

---

## Mantık

- **150 dakika threshold:** Standard maç 90 dakika + 15 dakika devre arası = 105 dakika. Overtime ile birlikte 120 dakikaya çıkabilir. Güvenlik için 150 dakika (2.5 saat) threshold kullanıldı.
- **MatchSyncWorker:** SECOND_HALF (status 4) maçları her 15 saniyede bir reconcile ediyor. Bu sayede bitmiş maçlar hızlıca END'e geçecek.
- **Provider response yok:** Bitmiş maçlar için provider `/match/detail_live` endpoint'inden maçı döndürmeyebilir. Bu durumda match_time kontrolü yaparak END'e geçiyoruz.

---

## Test

1. 2. Yarı'da oynanan bir maç bul
2. Maç bittikten sonra `/match/detail_live` endpoint'i maçı döndürmeyebilir
3. `MatchSyncWorker` maçı reconcile ettiğinde (her 15 saniye)
4. `reconcileMatchToDatabase()` maçı END'e geçirmeli
5. Maç artık canlı listesinde görünmemeli

---

## İlgili Kod

- `src/services/thesports/match/matchDetailLive.service.ts` (line 546-625)
- `src/jobs/matchSync.job.ts` (line 198-203) - SECOND_HALF reconcile interval

