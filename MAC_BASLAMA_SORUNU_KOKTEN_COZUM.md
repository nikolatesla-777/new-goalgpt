# Maç Başlama Sorunu - Kökten Çözüm

**Tarih:** 2026-01-05 09:15 TSİ  
**Kritik Bulgu:** İki farklı metod farklı timezone hesaplamaları kullanıyor!

## 🚨 KRİTİK SORUN

### 1. `findShouldBeLiveMatches` (matchWatchdog.service.ts)
```typescript
// TSİ-based today start (DOĞRU)
const TSI_OFFSET_SECONDS = 3 * 3600;
const todayStartTSI = Math.floor((Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000) / 1000);
```

### 2. `getShouldBeLiveMatches` (matchDatabase.service.ts)
```typescript
// UTC-based today start (YANLIŞ!)
const todayStart = Math.floor(now / 86400) * 86400; // Today 00:00 UTC
```

**Sorun:** `getShouldBeLiveMatches` UTC kullanıyor, `findShouldBeLiveMatches` TSİ kullanıyor!

## 📊 Sonuç

- **MatchWatchdogWorker:** `findShouldBeLiveMatches` kullanıyor (TSİ-based) ✅
- **API Endpoint:** `getShouldBeLiveMatches` kullanıyor (UTC-based) ❌
- **Çelişki:** Aynı maçlar için farklı sonuçlar!

## 💡 Çözüm

`getShouldBeLiveMatches` metodunu `findShouldBeLiveMatches` ile aynı TSİ-based hesaplamayı kullanacak şekilde düzelt.

