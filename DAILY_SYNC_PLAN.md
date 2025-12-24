# Günlük Otomatik Senkronizasyon Planı

## 🎯 Amaç
Her gün 00:00 sonrası yeni günün maç bültenini otomatik olarak çekmek ve veritabanına kaydetmek.

## ⏰ Zamanlama

### 1. **Tam Senkronizasyon (Full Sync)**
- **Zaman:** Her gün **00:05** (gece yarısından 5 dakika sonra)
- **Neden 00:05?** API'nin yeni günün verilerini tam olarak hazırlaması için bekleme süresi
- **Cron:** `5 0 * * *`
- **İşlem:**
  - Bugünün tarihini al (YYYYMMDD formatında)
  - `/match/diary` endpoint'ini çağır (NO CACHE - forceRefresh)
  - `results_extra`'dan takımları ve ligleri önce kaydet
  - Tüm maçları veritabanına senkronize et
  - Detaylı loglama (kaç maç, kaç hata, success rate)

### 2. **Incremental Senkronizasyon (Canlı Güncellemeler)**
- **Zaman:** Her **10 dakikada bir**
- **Cron:** `*/10 * * * *`
- **İşlem:**
  - Bugünün maçlarını tekrar çek
  - Sadece değişen/güncel maçları güncelle
  - Canlı skorları ve durumları güncelle

## 📋 İşlem Akışı

```
00:05 → DailyDiary CRON tetiklenir
  ↓
Bugünün tarihini al (örn: 2025-12-20 → 20251220)
  ↓
/match/diary?date=20251220 (forceRefresh=true)
  ↓
results_extra'dan teams ve competitions kaydet
  ↓
Tüm maçları MatchSyncService ile senkronize et
  ↓
Log: "✅ SYNC COMPLETE: X/Y matches synced"
```

## 🔄 Her 10 Dakikada
```
Incremental CRON tetiklenir
  ↓
Aynı işlem (bugünün maçlarını çek ve güncelle)
  ↓
Sadece değişen maçlar güncellenir (upsert)
```

## 📊 Log Örnekleri

**Başarılı Sync:**
```
📅 [DailyDiary] Starting sync for TODAY: 2025-12-20
📦 [DailyDiary] API returned 273 matches
✅ [DailyDiary] SYNC COMPLETE:
   📊 Matches synced: 273/273
   ❌ Errors: 0
   📈 Success rate: 100%
```

**Hata Durumu:**
```
❌ [DailyDiary] API Error: Rate limit exceeded
⚠️ [DailyDiary] No matches found (normal if no matches scheduled)
```

## 🛡️ Hata Yönetimi

1. **API Hataları:** Logla ve devam et (bir sonraki 10 dakikada tekrar dener)
2. **Veritabanı Hataları:** Detaylı error logging (her reddedilen maç için neden)
3. **Rate Limiting:** 10 dakikalık interval yeterli (API limit: 120 req/min)

## 🚀 Başlatma

Worker otomatik olarak `server.ts`'de başlatılır:
```typescript
dailyMatchSyncWorker = new DailyMatchSyncWorker(theSportsClient);
dailyMatchSyncWorker.start();
```

## ✅ Doğrulama

Her sync sonrası:
- Veritabanında bugünün maç sayısını kontrol et
- API'den dönen sayı ile karşılaştır
- Hata loglarını kontrol et





