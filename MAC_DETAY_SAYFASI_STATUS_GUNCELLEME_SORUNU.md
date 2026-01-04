# Maç Detay Sayfası Status Güncelleme Sorunu

## Problem

Kullanıcı bir maçın detay sayfasına girdiğinde, maçın status'ü otomatik olarak güncelleniyor. Bu, kullanıcı deneyimini bozuyor çünkü:
- Ana sayfa (livescore) ile detay sayfası farklı status gösteriyor
- Maç detay sayfası açılınca status güncelleniyor, ama ana sayfa eski status'ü gösteriyor
- Status güncellemesi sadece background worker'lar tarafından yapılmalı, frontend endpoint'leri tarafından değil

## Tespit Edilen Durum

1. **`getMatchById` endpoint'i**: ✅ Reconcile kodu kaldırıldı - sadece database'den okuyor
2. **`getMatchDetailLive` endpoint'i**: ✅ Reconcile yapmıyor - sadece API'den data çekiyor
3. **MatchWatchdogWorker**: ⚠️ Çok agresif çalışıyor (5 saniye interval, 2000 limit)
4. **Frontend çağrıları**: `getMatchDetailLive`, `getMatchLiveStats`, `getMatchTrend` gibi endpoint'ler çağrılıyor

## Sorunun Kaynağı

Kullanıcı maç detay sayfasına girdiğinde:
- Frontend `getMatchDetailLive` endpoint'ini çağırıyor
- Bu endpoint `matchDetailLiveService.getMatchDetailLive()` çağırıyor
- Bu servis API'den data çekiyor ve cache'e yazıyor
- **AMA**: MatchWatchdogWorker aynı anda çalışıyor ve maçın status'ünü güncelliyor

**ASIL SORUN**: MatchWatchdogWorker çok agresif çalışıyor (5 saniye interval). Maç detay sayfası açıldığında, MatchWatchdogWorker aynı anda maçı işliyor ve status'ü güncelliyor. Bu bir race condition yaratıyor.

## Çözüm

MatchWatchdogWorker'ın interval'ini artırmak veya limit'ini azaltmak **YANLIŞ BİR ÇÖZÜM** çünkü:
- MatchWatchdogWorker'ın görevi "should-be-live" maçları bulmak
- Interval'i artırırsak, maçlar daha geç başlayacak
- Limit'i azaltırsak, bazı maçlar kaçacak

**DOĞRU ÇÖZÜM**: Frontend endpoint'lerinin hiçbir şekilde status güncellemesi yapmaması gerekiyor. Status güncellemesi SADECE background worker'lar tarafından yapılmalı.

Ama `getMatchDetailLive` zaten reconcile yapmıyor. O zaman sorun ne?

**GERÇEK SORUN**: MatchWatchdogWorker çok agresif ve kullanıcı maç detay sayfasına girdiğinde, MatchWatchdogWorker aynı anda maçı işliyor. Bu bir race condition yaratıyor ve kullanıcı "maç detay sayfası açılınca status güncelleniyor" zanneder.

**ASIL ÇÖZÜM**: MatchWatchdogWorker'ın interval'ini ve limit'ini optimize etmek. Ama kullanıcı "maç detay sayfası açılınca status güncelleniyor" diyor, bu yüzden frontend endpoint'lerinde bir sorun olabilir.

## Test Edilmesi Gerekenler

1. MatchWatchdogWorker'ın log'larını kontrol et - maç detay sayfası açılınca MatchWatchdogWorker çalışıyor mu?
2. `getMatchDetailLive` endpoint'inin log'larını kontrol et - reconcile yapıyor mu?
3. Frontend'de hangi endpoint'ler çağrılıyor?

## Not

Kullanıcı diyor ki: "BU MAÇ BİR ANDA LİVESKOR SEKMESİNE DAKİKA 13 DEN GİRDİ. AMA BİZ BU SEKİLDE YAPMAMISTIK"

Bu, maçın status'ünün güncellendiğini ve canlı sekmesine girdiğini gösteriyor. Ama dakikası hatalı (13 dakika görünüyor ama gerçekte farklı olabilir).

MatchWatchdogWorker'ın interval'ini 5 saniyeye düşürdük ve limit'ini 2000'e çıkardık. Bu, maçların daha hızlı başlamasını sağlar AMA aynı zamanda race condition'lara yol açabilir.

**ÖNERİ**: MatchWatchdogWorker'ın interval'ini 10 saniyeye geri almak ve limit'ini 1000'e düşürmek. Bu, maçların hala zamanında başlamasını sağlar ama race condition'ları azaltır.

