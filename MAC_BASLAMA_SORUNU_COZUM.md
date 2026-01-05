# Maç Başlama Sorunu - Çözüm Raporu

**Tarih:** 2026-01-05 09:09 TSİ  
**Durum:** Database'de maçlar VAR, ancak başlama saatleri geçmiş maçlar hala NOT_STARTED (status=1)

## ✅ Tespit Edilen Durum

1. **Database'de maçlar VAR:**
   - `/api/matches/diary?date=2026-01-05&status=1` → **112 maç** dönüyor
   - Frontend'de de 112 "başlamayanlar" görünüyor

2. **Sorun:**
   - Bu 112 maçın bir kısmının `match_time` değeri geçmiş olabilir
   - Ama status hala `NOT_STARTED` (1)
   - MatchWatchdogWorker bunları bulmalı ve reconcile etmeli

## 🔍 Kontrol Edilmesi Gerekenler

1. **Should-be-live maçlar:**
   - `match_time < now` olan ama `status_id = 1` olan maçlar
   - MatchWatchdogWorker bunları bulmalı

2. **MatchWatchdogWorker durumu:**
   - Her 5 saniyede bir çalışıyor ✅
   - `findShouldBeLiveMatches` maxMinutesAgo=1440, limit=2000 ✅
   - Ama reconcile başarısız oluyor olabilir

3. **Reconcile başarısızlık nedenleri:**
   - API'den veri gelmiyor (`detail_live` boş dönüyor)
   - Rate limiting nedeniyle API çağrıları bloke
   - Circuit breaker açık

## 💡 Çözüm Önerileri

1. **Should-be-live maçları kontrol et:**
   - Kaç tane `match_time < now` ama `status=1` olan maç var?
   - Bu maçlar MatchWatchdogWorker tarafından bulunuyor mu?

2. **Reconcile başarısızlık nedenini bul:**
   - Loglarda `reconcileMatchToDatabase` başarısız mı?
   - Hata mesajları neler?

3. **API durumunu kontrol et:**
   - TheSports API'den bu maçlar için veri geliyor mu?
   - Rate limiting aktif mi?

