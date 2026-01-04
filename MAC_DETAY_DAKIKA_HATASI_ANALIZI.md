# Maç Detay Dakika Hatası Analizi

## Problem

Kullanıcı bildiriyor:
1. "BU MAÇ BİR ANDA LİVESKOR SEKMESİNE DAKİKA 13 DEN GİRDİ"
2. "AMA BİZ BU SEKİLDE YAPMAMISTIK YANLIS HATIRLAMIYORSAM"
3. "MAÇIN DAKİKASI DA HATALI"

## Durum

- Maç `getMatchDetailLive` endpoint'i çağrıldığında status güncelleniyor
- `getMatchDetailLive` endpoint'i **RECONCILE YAPMIYOR** - sadece API'den data çekiyor
- MatchWatchdogWorker çok agresif çalışıyor (5 saniye interval, 2000 limit)
- Kullanıcı maç detay sayfasına girince MatchWatchdogWorker aynı anda maçı işliyor

## Sorunun Kaynağı

**GERÇEK SORUN**: `getMatchDetailLive` endpoint'i reconcile yapmıyor AMA MatchWatchdogWorker çok agresif çalışıyor. Kullanıcı maç detay sayfasına girdiğinde, MatchWatchdogWorker aynı anda maçı işliyor ve status'ü güncelliyor. Bu bir race condition yaratıyor.

**DAKİKA HATASI**: Maçın dakikası yanlış görünüyor (13 dakika görünüyor ama gerçekte farklı olabilir). Bu, `reconcileMatchToDatabase` fonksiyonunda dakika hesaplama mantığında bir sorun olabilir.

## Çözüm

**KRITIK**: `getMatchDetailLive` endpoint'i reconcile yapmıyor, bu doğru. Ama MatchWatchdogWorker çok agresif çalışıyor. Interval'i 5 saniyeye düşürdük ve limit'i 2000'e çıkardık. Bu, maçların daha hızlı başlamasını sağlar AMA aynı zamanda race condition'lara yol açabilir.

**ÖNERİ**: MatchWatchdogWorker'ın interval'ini 10 saniyeye geri almak ve limit'ini 1000'e düşürmek. Bu, maçların hala zamanında başlamasını sağlar ama race condition'ları azaltır.

**DAKİKA HATASI İÇİN**: `reconcileMatchToDatabase` fonksiyonunda dakika hesaplama mantığını kontrol etmek gerekiyor. Provider'dan gelen dakika bilgisi doğru mu? Yoksa hesaplama mantığında bir sorun mu var?

