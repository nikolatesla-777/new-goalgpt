# Maç Başlama Sorunu - Detaylı Analiz

**Tarih:** 2026-01-05 09:13 TSİ  
**Durum:** 112 NOT_STARTED maç var, ancak should-be-live endpoint'i 0 dönüyor

## 🔍 Tespit Edilen Durumlar

### 1. Database Durumu
- **NOT_STARTED (status=1) maçlar:** 112 adet
- **Should-be-live endpoint:** 0 maç dönüyor
- **Çelişki:** Maçlar var ama should-be-live query'si bulamıyor

### 2. Timezone Hesaplaması
- **Now (UTC):** 2026-01-05 06:13:30
- **Now (TSİ):** 2026-01-05 09:13:30
- **Today Start TSI:** 2026-01-04 21:00:00 UTC = 2026-01-05 00:00:00 TSİ
- **Diff:** 12+ saat (doğru)

### 3. Query Analizi
```sql
SELECT external_id, match_time
FROM ts_matches
WHERE match_time <= $1  -- nowTs
  AND match_time >= $2  -- todayStartTSI
  AND status_id = 1
ORDER BY match_time DESC
LIMIT $3
```

**Sorun:** Query doğru görünüyor, ama 0 sonuç dönüyor.

## 🚨 Olası Sorunlar

### A. Match Time Değerleri Bugünün Dışında
- Maçların `match_time` değerleri `todayStartTSI`'dan önce olabilir
- Bu durumda query hiçbir maç bulamaz

### B. Timezone Conversion Hatası
- `match_time` değerleri farklı bir timezone'da saklanıyor olabilir
- `todayStartTSI` hesaplaması yanlış olabilir

### C. Database Connection Sorunu
- PostgreSQL bağlantısı başarısız olabilir
- Query çalışmıyor olabilir

## 💡 Kontrol Edilmesi Gerekenler

1. **Maçların match_time değerleri:**
   - Kaç tanesi `todayStartTSI` ile `now` arasında?
   - Kaç tanesi `todayStartTSI`'dan önce?

2. **Query test:**
   - Doğrudan database'de query çalıştır
   - Sonuçları kontrol et

3. **Timezone kontrolü:**
   - `match_time` değerleri hangi timezone'da?
   - `todayStartTSI` hesaplaması doğru mu?

## 🎯 Sonraki Adımlar

1. Maçların `match_time` değerlerini analiz et
2. Query'yi doğrudan database'de test et
3. Timezone conversion'ı doğrula

