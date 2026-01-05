# Maç Başlama Sorunu - Durum Raporu

**Tarih:** 2026-01-05 09:22 TSİ  
**Durum:** Sorunlar tespit edildi ve düzeltmeler uygulandı

## ✅ Yapılan Düzeltmeler

### 1. Timezone Hesaplama Tutarsızlığı ✅ DÜZELTİLDİ
- `getShouldBeLiveMatches` artık TSİ-based today start kullanıyor
- `findShouldBeLiveMatches` ile tutarlı hale getirildi

### 2. maxMinutesAgo Limit Çok Kısıtlıydı ✅ DÜZELTİLDİ
- Limit 240'dan 1440'a (24 saat) çıkarıldı

## 📊 Mevcut Durum

### Should-be-live Endpoint
- **Önce:** 0 maç ❌
- **Sonra:** 13 maç ✅

### MatchWatchdogWorker
- **Tespit:** Maçları buluyor (`watchdog.should_be_live_detected` log'u görünüyor) ✅
- **Reconcile:** Devam ediyor (loglarda görülüyor) ✅

### NOT_STARTED Maçlar
- **Toplam:** 112 maç
- **Should-be-live:** 13 maç (match_time geçmiş)
- **Gelecek:** 99 maç (match_time henüz gelmemiş)

## 🔍 Reconcile Mekanizması

MatchWatchdogWorker should-be-live maçları için:

1. **recent/list kontrolü:**
   - Maç recent/list'te varsa → Status'u güncelle, sonra detail_live çağır
   - Maç recent/list'te yoksa → detail_live çağır

2. **detail_live başarısız olursa:**
   - Diary fallback yok (TheSports docs'a göre diary schedule için, real-time için değil)
   - Bir sonraki watchdog tick'inde tekrar dene

## ⏱️ Beklenen Süreç

- MatchWatchdogWorker her 5 saniyede bir çalışıyor
- Her tick'te 13 should-be-live maçı işliyor
- Reconcile başarılı olursa status NOT_STARTED → LIVE geçecek
- Başarısız olursa bir sonraki tick'te tekrar denenecek

## 🎯 Sonraki Kontroller

1. **30-60 saniye sonra:**
   - Should-be-live sayısı azalmalı (reconcile başarılı olursa)
   - NOT_STARTED sayısı azalmalı
   - Canlı maç sayısı artmalı

2. **Reconcile başarısızlık nedenleri:**
   - API'den veri gelmiyor mu?
   - Rate limiting aktif mi?
   - Circuit breaker açık mı?

