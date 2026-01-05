# FAZ 2: Post-Match Data Persistence - Implementation Plan

**Tarih:** 2026-01-02  
**Durum:** 🚧 İN PROGRESS  
**Hedef:** Maç bitişinde tüm verilerin (stats, incidents, trend, player stats, standings) database'e kaydedilmesi

---

## 📋 MEVCUT DURUM

### ✅ Tamamlananlar

1. **PostMatchProcessor Service** ✅
   - `src/services/liveData/postMatchProcessor.ts` mevcut
   - `processMatchEnd()` metodu: stats, incidents, trend, player stats, standings kaydediyor
   - `onMatchEnded()` metodu: match_id ile çağrılıyor

2. **PostMatchProcessorJob** ✅
   - `src/jobs/postMatchProcessor.job.ts` mevcut
   - Her 30 dakikada bir çalışıyor
   - `server.ts`'de başlatılıyor (satır 108-109)

3. **Hook'lar Eklendi** ✅
   - **WebSocket:** `websocket.service.ts` satır 128-134 (status=8'de tetikleniyor)
   - **DataUpdate:** `dataUpdate.job.ts` satır 231-246 (status=8'de tetikleniyor)
   - **matchDetailLive:** `matchDetailLive.service.ts` satır 800-804 (status=8'de tetikleniyor)

---

## 🎯 YAPILACAKLAR

### FAZ 2.1: Hook'ların Doğrulanması ✅
- [x] PostMatchProcessorJob server.ts'de başlatılıyor mu? ✅
- [x] WebSocket hook'u doğru yerleştirilmiş mi? ✅
- [x] DataUpdate hook'u doğru yerleştirilmiş mi? ✅
- [x] matchDetailLive hook'u doğru yerleştirilmiş mi? ✅

### FAZ 2.2: Post-Match Persistence Test Senaryoları
- [ ] Senaryo 1: WebSocket üzerinden maç bitişi (status=8)
- [ ] Senaryo 2: DataUpdateWorker üzerinden maç bitişi (status=8)
- [ ] Senaryo 3: matchDetailLive reconcile üzerinden maç bitişi (status=8)
- [ ] Senaryo 4: PostMatchProcessorJob catch-up (30 dakikada bir)

### FAZ 2.3: Veri Doğrulama Testleri
- [ ] Final statistics database'e kaydedildi mi? (`statistics` column)
- [ ] Final incidents database'e kaydedildi mi? (`incidents` column)
- [ ] Final trend data database'e kaydedildi mi? (`trend_data` column)
- [ ] Player statistics database'e kaydedildi mi? (`player_stats` column)
- [ ] Standings güncellendi mi? (`ts_standings` table)

### FAZ 2.4: Cache'den Veri Okuma Testi
- [ ] Biten bir maçın detay sayfasına git
- [ ] Statistics sekmesinde veri görünüyor mu?
- [ ] Events sekmesinde veri görünüyor mu?
- [ ] Trend sekmesinde veri görünüyor mu?
- [ ] Player stats görünüyor mu?

---

## 🔍 TEST SENARYOLARI

### Senaryo 1: WebSocket Üzerinden Maç Bitişi

**Adımlar:**
1. Canlı bir maçı izle
2. WebSocket'ten `status=8` mesajı geldiğinde:
   - `websocket.service.ts` → `triggerPostMatchPersistence()` çağrılmalı
   - `PostMatchProcessor.onMatchEnded()` çağrılmalı
   - Tüm veriler database'e kaydedilmeli

**Beklenen Log:**
```
[WebSocket] Match {matchId} ended (status=8), triggering post-match persistence...
[PostMatch] Processing ended match: {matchId}
[PostMatch] Stats saved for {matchId}
[PostMatch] Incidents saved for {matchId}
[PostMatch] Trend saved for {matchId}
[PostMatch] Player stats saved for {matchId}
[PostMatch] Standings updated for season {seasonId}
[PostMatch] ✅ Completed processing match {matchId}
[WebSocket] ✅ Post-match persistence completed for {matchId}
```

**Doğrulama:**
```sql
SELECT 
  external_id,
  status_id,
  statistics,
  incidents,
  trend_data,
  player_stats
FROM ts_matches 
WHERE external_id = '{matchId}';
```

---

### Senaryo 2: DataUpdateWorker Üzerinden Maç Bitişi

**Adımlar:**
1. Canlı bir maçı izle
2. DataUpdateWorker `/data/update` endpoint'inden `status=8` geldiğinde:
   - `dataUpdate.job.ts` → `processor.onMatchEnded()` çağrılmalı
   - Tüm veriler database'e kaydedilmeli

**Beklenen Log:**
```
[DataUpdate:{runId}] Match {matchId} ended (status=8), triggering post-match persistence...
[PostMatch] Processing ended match: {matchId}
[PostMatch] ✅ Completed processing match {matchId}
[DataUpdate:{runId}] ✅ Post-match persistence completed for {matchId}
```

**Doğrulama:**
```sql
SELECT 
  external_id,
  status_id,
  statistics,
  incidents,
  trend_data,
  player_stats
FROM ts_matches 
WHERE external_id = '{matchId}';
```

---

### Senaryo 3: matchDetailLive Reconcile Üzerinden Maç Bitişi

**Adımlar:**
1. Canlı bir maçı izle
2. `matchDetailLive.reconcileMatchToDatabase()` çağrıldığında `status=8` geldiğinde:
   - `matchDetailLive.service.ts` → `triggerPostMatchPersistence()` çağrılmalı
   - Tüm veriler database'e kaydedilmeli

**Beklenen Log:**
```
[DetailLive] Status transition to END (8) for {matchId} from status {existingStatus}
[DetailLive] ✅ Post-match persistence completed for {matchId}
[PostMatch] Processing ended match: {matchId}
[PostMatch] ✅ Completed processing match {matchId}
```

**Doğrulama:**
```sql
SELECT 
  external_id,
  status_id,
  statistics,
  incidents,
  trend_data,
  player_stats
FROM ts_matches 
WHERE external_id = '{matchId}';
```

---

### Senaryo 4: PostMatchProcessorJob Catch-Up

**Adımlar:**
1. PostMatchProcessorJob her 30 dakikada bir çalışıyor
2. Son 24 saat içinde bitmiş ama verisi eksik olan maçları buluyor
3. Her birini işliyor

**Beklenen Log:**
```
🔄 [PostMatchJob] Processing ended matches...
[PostMatch] Found {count} ended matches needing processing
[PostMatch] Processing ended match: {matchId1}
[PostMatch] ✅ Completed processing match {matchId1}
[PostMatch] Processing ended match: {matchId2}
[PostMatch] ✅ Completed processing match {matchId2}
✅ [PostMatchJob] Completed in {duration}ms: {processed} processed, {success} success, {failed} failed
```

**Doğrulama:**
```sql
-- Son 24 saat içinde bitmiş ama verisi eksik olan maçları bul
SELECT 
  external_id,
  status_id,
  match_time,
  CASE 
    WHEN statistics IS NULL THEN 'missing_stats'
    WHEN incidents IS NULL THEN 'missing_incidents'
    WHEN trend_data IS NULL THEN 'missing_trend'
    WHEN player_stats IS NULL THEN 'missing_player_stats'
    ELSE 'complete'
  END as missing_data
FROM ts_matches 
WHERE status_id = 8
  AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
  AND (
    statistics IS NULL 
    OR incidents IS NULL 
    OR trend_data IS NULL 
    OR player_stats IS NULL
  )
ORDER BY match_time DESC;
```

---

## 🧪 TEST SCRIPT'İ

### Test Script: `test-post-match-persistence.ts`

```typescript
/**
 * Test Post-Match Persistence
 * 
 * Tests all scenarios for post-match data persistence:
 * 1. WebSocket status=8 trigger
 * 2. DataUpdateWorker status=8 trigger
 * 3. matchDetailLive reconcile status=8 trigger
 * 4. PostMatchProcessorJob catch-up
 */

import { pool } from './src/database/connection';
import { logger } from './src/utils/logger';

async function testPostMatchPersistence() {
  const client = await pool.connect();
  try {
    // 1. Find a recently ended match
    const result = await client.query(`
      SELECT 
        external_id,
        status_id,
        match_time,
        statistics,
        incidents,
        trend_data,
        player_stats
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
      ORDER BY match_time DESC
      LIMIT 5
    `);

    logger.info(`Found ${result.rows.length} recently ended matches`);

    for (const match of result.rows) {
      logger.info(`\n=== Testing Match: ${match.external_id} ===`);
      logger.info(`Status: ${match.status_id}`);
      logger.info(`Statistics: ${match.statistics ? '✅' : '❌'}`);
      logger.info(`Incidents: ${match.incidents ? '✅' : '❌'}`);
      logger.info(`Trend Data: ${match.trend_data ? '✅' : '❌'}`);
      logger.info(`Player Stats: ${match.player_stats ? '✅' : '❌'}`);

      // Check if all data is present
      const allDataPresent = 
        match.statistics && 
        match.incidents && 
        match.trend_data && 
        match.player_stats;

      if (allDataPresent) {
        logger.info(`✅ Match ${match.external_id} has all post-match data`);
      } else {
        logger.warn(`⚠️ Match ${match.external_id} is missing some post-match data`);
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}

testPostMatchPersistence().catch(console.error);
```

---

## 📊 BAŞARI KRİTERLERİ

### ✅ Tüm Senaryolarda:
1. **Statistics kaydedildi:** `statistics` column'da JSONB data var
2. **Incidents kaydedildi:** `incidents` column'da JSONB array var
3. **Trend data kaydedildi:** `trend_data` column'da JSONB array var
4. **Player stats kaydedildi:** `player_stats` column'da JSONB array var
5. **Standings güncellendi:** `ts_standings` table'da güncel veri var

### ✅ Cache'den Veri Okuma:
1. Biten maçın detay sayfasında statistics görünüyor
2. Biten maçın detay sayfasında events görünüyor
3. Biten maçın detay sayfasında trend görünüyor
4. Biten maçın detay sayfasında player stats görünüyor

---

## 🚀 SONRAKİ ADIMLAR

1. **Test Script'i Çalıştır:** `test-post-match-persistence.ts` script'ini çalıştır
2. **Biten Maç İzle:** Canlı bir maçı izle ve bitişini test et
3. **Log'ları Kontrol Et:** Post-match persistence log'larını kontrol et
4. **Database'i Kontrol Et:** Database'de verilerin kaydedildiğini doğrula
5. **Frontend'i Test Et:** Biten maçın detay sayfasında verilerin göründüğünü doğrula

---

**Son Güncelleme:** 2026-01-02  
**Durum:** 🚧 İN PROGRESS - Test senaryoları hazırlandı, test script'i oluşturuldu


