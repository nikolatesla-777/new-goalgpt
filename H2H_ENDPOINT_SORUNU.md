# H2H Endpoint Sorunu - Analiz

## Sorun

H2H sekmesi boş geliyor: "H2H verisi bulunamadı"

## API Dokümantasyonu

**Endpoint:** `/match/analysis`  
**Kullanım:** Maç başlamadan önce (historical confrontation/recent results)  
**Limit:** Sadece gelecek 30 gün içindeki maçlar için çalışır  
**Request times:** 60 times/min

**ÖNEMLİ:** API dokümantasyonuna göre bu endpoint **sadece başlamamış maçlar** için veri döndürür.

## Test Sonuçları

**Maç ID:** `l5ergph4oz3gr8k`  
**Maç Durumu:** CANLI (90+ dakika, 1-1 skor)  
**API Response:**
```json
{
  "code": 0,
  "results": {}
}
```

API boş `results: {}` döndürüyor çünkü maç **zaten başlamış**.

## Sorunun Kök Nedeni

1. Kod, **başlamış/biten maçlar** için de `/match/analysis` endpoint'ini çağırıyor
2. API, **sadece başlamamış maçlar** için veri döndürüyor
3. Sonuç: Başlamış maçlar için boş results dönüyor

## Çözüm Önerileri

### Seçenek 1: Database'den okuma (mevcut verileri kullan)
- Eğer maç başlamadan önce H2H verisi sync edilmişse, database'den oku
- Başlamış maçlar için API'ye istek atma

### Seçenek 2: Sadece NOT_STARTED maçlar için sync
- `getMatchH2H` endpoint'inde maç durumunu kontrol et
- Sadece `status_id = 1` (NOT_STARTED) maçlar için `syncH2HToDb` çağır
- Başlamış maçlar için sadece database'den oku

### Seçenek 3: Pre-sync kullan
- Maçlar başlamadan önce `DailyPreSyncService` ile H2H verilerini sync et
- Başlamış maçlar için sadece database'den oku

## Önerilen Çözüm

**Seçenek 2 + Seçenek 3 kombinasyonu:**
1. `DailyPreSyncService` ile maçlar başlamadan önce H2H verilerini sync et
2. `getMatchH2H` endpoint'inde:
   - Önce database'den oku
   - Database'de yoksa VE maç `NOT_STARTED` ise API'den çek
   - Başlamış maçlar için API'ye istek atma (sadece database'den oku)

