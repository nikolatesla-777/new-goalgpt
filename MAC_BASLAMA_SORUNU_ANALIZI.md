# Maç Başlama Sorunu - Detaylı Analiz

**Tarih:** 2026-01-05 09:03 TSİ  
**Sorun:** Görseldeki maçlar (01:30 ve 03:30 başlama saatli) hala "Başlamadı" durumunda gözüküyor.

## 🔍 Tespit Edilen Durumlar

### 1. MatchWatchdogWorker Durumu
- **Interval:** Her 5 saniyede bir çalışıyor ✅
- **findShouldBeLiveMatches:** maxMinutesAgo=1440 (24 saat), limit=2000 ✅
- **Query:** TSİ-based today start kullanıyor ✅

### 2. API Endpoint Kontrolü
- `/api/matches/should-be-live?maxMinutesAgo=1440&limit=50` → **BOŞ DÖNÜYOR**
- Bu, database'de "should-be-live" maç bulunmadığı anlamına geliyor

### 3. Olası Sorunlar

#### A. Database'de Maç Yok
- Görseldeki maçlar database'e sync edilmemiş olabilir
- Competition "Copinha" için maçlar sync edilmemiş olabilir

#### B. Match Time Yanlış
- Maçların `match_time` değeri gelecekte set edilmiş olabilir
- Timezone farkı nedeniyle match_time yanlış hesaplanmış olabilir

#### C. Reconcile Başarısız
- `reconcileMatchToDatabase` API'den veri alamıyor olabilir
- Circuit breaker açık olabilir
- Rate limiting nedeniyle API çağrıları bloke olabilir

#### D. Status Update Başarısız
- Reconcile başarılı ama status update database'e yazılmıyor olabilir
- Optimistic locking nedeniyle update reddediliyor olabilir

## 🔧 Kontrol Edilmesi Gerekenler

1. **Database'de maç var mı?**
   ```sql
   SELECT external_id, status_id, match_time, to_timestamp(match_time) as match_time_readable
   FROM ts_matches 
   WHERE competition_id IN (SELECT external_id FROM ts_competitions WHERE name ILIKE '%Copinha%')
   ORDER BY match_time DESC;
   ```

2. **MatchWatchdogWorker logları**
   - `should_be_live_count` değeri nedir?
   - `reconcileMatchToDatabase` başarılı mı?
   - Hata mesajları var mı?

3. **API Durumu**
   - TheSports API'den veri geliyor mu?
   - Circuit breaker durumu nedir?
   - Rate limiting aktif mi?

4. **Timezone Kontrolü**
   - Server timezone nedir?
   - Match time TSİ mi UTC mi?
   - Timezone conversion doğru mu?

## 🚨 Kritik Bulgular

1. **Loglardan:** `detail_live failed` hatası görülüyor
2. **API Endpoint:** `/api/matches/should-be-live` boş dönüyor
3. **MatchWatchdogWorker:** Çalışıyor ama sonuç yok

## 💡 Önerilen Çözümler

1. **Database Kontrolü:** Görseldeki maçların database'de olup olmadığını kontrol et
2. **Match Time Kontrolü:** Match time değerlerinin doğru olup olmadığını kontrol et
3. **Reconcile Debug:** `reconcileMatchToDatabase` metoduna detaylı log ekle
4. **API Test:** TheSports API'den bu maçlar için veri gelip gelmediğini test et
5. **Circuit Breaker:** Circuit breaker durumunu kontrol et ve reset et gerekirse

