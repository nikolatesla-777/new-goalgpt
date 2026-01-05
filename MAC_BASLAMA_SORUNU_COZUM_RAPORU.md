# Maç Başlama Sorunu - Çözüm Raporu

**Tarih:** 2026-01-05 09:15 TSİ  
**Sorun:** 112 NOT_STARTED maç var, ancak should-be-live endpoint'i 0 dönüyor

## 🚨 Tespit Edilen Sorun

### Timezone Hesaplama Tutarsızlığı

**İki farklı metod farklı timezone hesaplamaları kullanıyordu:**

1. **`findShouldBeLiveMatches` (matchWatchdog.service.ts):**
   - TSİ-based today start kullanıyor ✅
   - `todayStartTSI = UTC midnight - 3 hours`

2. **`getShouldBeLiveMatches` (matchDatabase.service.ts):**
   - UTC-based today start kullanıyor ❌
   - `todayStart = UTC midnight` (yanlış!)

**Sonuç:** MatchWatchdogWorker maçları buluyor ama API endpoint bulamıyor!

## ✅ Uygulanan Çözüm

### 1. Timezone Hesaplaması Düzeltildi
```typescript
// ÖNCE (YANLIŞ):
const todayStart = Math.floor(now / 86400) * 86400; // UTC

// SONRA (DOĞRU):
const TSI_OFFSET_SECONDS = 3 * 3600;
const nowDate = new Date(now * 1000);
const year = nowDate.getUTCFullYear();
const month = nowDate.getUTCMonth();
const day = nowDate.getUTCDate();
const todayStart = Math.floor((Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000) / 1000);
```

### 2. Query Parametreleri Düzeltildi
```typescript
// effectiveMinTime kullanarak hem todayStart hem de maxMinutesAgo'yu dikkate al
const effectiveMinTime = Math.max(minTime, todayStart);
const result = await pool.query(query, [now, effectiveMinTime, safeLimit]);
```

## 📊 Beklenen Sonuç

- Should-be-live endpoint'i artık doğru maçları bulmalı
- MatchWatchdogWorker ile API endpoint tutarlı olmalı
- Başlama saatleri geçen maçlar otomatik olarak reconcile edilmeli

## 🔍 Test Edilmesi Gerekenler

1. Should-be-live endpoint'i test et
2. MatchWatchdogWorker loglarını kontrol et
3. Maçların otomatik olarak başlayıp başlamadığını gözlemle

