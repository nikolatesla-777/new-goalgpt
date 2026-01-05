# Maç Başlama Sorunu - Özet Rapor

**Tarih:** 2026-01-05 09:20 TSİ  
**Durum:** Sorun tespit edildi ve çözüldü ✅

## 🔍 Tespit Edilen Sorunlar

### 1. Timezone Hesaplama Tutarsızlığı
- **Sorun:** `getShouldBeLiveMatches` UTC kullanıyordu, `findShouldBeLiveMatches` TSİ kullanıyordu
- **Etki:** API endpoint 0 maç dönerken, MatchWatchdogWorker maçları buluyordu
- **Çözüm:** `getShouldBeLiveMatches` TSİ-based hesaplamaya geçirildi ✅

### 2. maxMinutesAgo Limit Çok Kısıtlıydı
- **Sorun:** Limit 240 dakika (4 saat) ile sınırlıydı, 1440 gönderilse bile 240'a düşürülüyordu
- **Etki:** 4 saatten eski maçlar bulunamıyordu
- **Çözüm:** Limit 1440'a (24 saat) çıkarıldı ✅

## ✅ Sonuçlar

### Önce:
- Should-be-live endpoint: **0 maç** ❌
- MatchWatchdogWorker: Maçları buluyor ama API endpoint bulamıyordu

### Sonra:
- Should-be-live endpoint: **13 maç** ✅
- MatchWatchdogWorker: Maçları tespit ediyor ve reconcile ediyor

## 🔄 Sistem Durumu

1. **MatchWatchdogWorker:** Her 5 saniyede bir çalışıyor ✅
2. **Should-be-live detection:** 13 maç tespit edildi ✅
3. **Reconcile:** Devam ediyor (loglarda görülüyor) ✅

## 📊 Beklenen Sonuç

- Başlama saatleri geçen maçlar otomatik olarak reconcile edilecek
- Status'ları NOT_STARTED'dan LIVE'e geçecek
- Frontend'de "Başlamayanlar" sekmesinden "Canlı Maçlar" sekmesine geçecekler

## 🎯 Sonraki Kontroller

1. 15-30 saniye sonra should-be-live sayısını kontrol et (azalmalı)
2. NOT_STARTED maç sayısını kontrol et (azalmalı)
3. Frontend'de "Canlı Maçlar" sekmesini kontrol et (artmalı)

