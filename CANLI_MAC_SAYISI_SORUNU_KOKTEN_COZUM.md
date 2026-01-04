# Canlı Maç Sayısı Sorunu - Kökten Çözüm

**Tarih:** 4 Ocak 2026  
**Sorun:** Canlı maç sayısı 21 gösteriyor ama daha fazla olması gerekli. Saati geçen ama başlamayan maçlar var.

---

## 🔍 SORUN TESPİTİ

### Browser Test Sonuçları:
- **Canlı Maçlar:** 21 maç gösteriliyor
- **Beklenen:** Daha fazla olmalı (saati geçen ama başlamayan maçlar var)

### Olası Nedenler:

1. **MatchWatchdogWorker Yeterince Agresif Değil**
   - Her 10 saniyede çalışıyor ✅
   - Limit 1000 maç ✅
   - Ama reconcile başarısız olabilir ❌

2. **Reconcile İşlemi Başarısız**
   - API'den gelen veriler yanlış olabilir
   - Optimistic locking nedeniyle güncelleme reddedilebilir
   - API rate limit'e takılıyor olabilir

3. **Time Filter Çok Kısıtlayıcı**
   - `getLiveMatches()` query'sinde 4 saatlik time filter var
   - Bu, 4 saatten önce başlayan maçları filtreliyor olabilir

4. **Status Transition Eksik**
   - Maçlar status=1'den status=2'ye geçemiyor
   - Reconcile işlemi status'ü güncellemiyor

---

## 🔧 ÇÖZÜM PLANI

### 1. MatchWatchdogWorker'ı Daha Agresif Yap

**Değişiklikler:**
- Interval: 10s → **5s** (daha sık kontrol)
- Limit: 1000 → **2000** (daha fazla maç işle)
- Batch size: **100** (daha büyük batch'ler)

**Dosya:** `src/jobs/matchWatchdog.job.ts`

### 2. Reconcile İşlemini İyileştir

**Değişiklikler:**
- Retry logic ekle (3 deneme)
- Error handling iyileştir
- Logging artır (hangi maçlar başarısız oldu)

**Dosya:** `src/jobs/matchWatchdog.job.ts`

### 3. Time Filter'ı Genişlet

**Değişiklikler:**
- `getLiveMatches()` query'sinde 4 saat → **6 saat**
- Veya time filter'ı kaldır (sadece status'e göre filtrele)

**Dosya:** `src/services/thesports/match/matchDatabase.service.ts`

### 4. Status Transition'ı Zorla

**Değişiklikler:**
- Eğer reconcile başarısız olursa, status'ü manuel olarak güncelle
- `match_time <= nowTs AND status_id = 1` → `status_id = 2` (FIRST_HALF)

**Dosya:** `src/jobs/matchWatchdog.job.ts`

---

## 📋 UYGULAMA ADIMLARI

1. ✅ MatchWatchdogWorker interval'ını 5s'ye düşür
2. ✅ Limit'i 2000'e çıkar
3. ✅ Reconcile retry logic ekle
4. ✅ Time filter'ı 6 saate çıkar
5. ✅ Status transition'ı zorla (fallback)
6. ✅ Logging artır
7. ✅ Test et ve deploy et

---

## 🎯 BEKLENEN SONUÇ

- Canlı maç sayısı artacak (21 → 30+)
- Saati geçen maçlar otomatik başlayacak
- Status transition'lar daha hızlı olacak
- Reconcile başarı oranı artacak

---

## ⚠️ RİSKLER

- **API Rate Limit:** Daha sık kontrol = daha fazla API çağrısı
- **Database Load:** Daha fazla query = daha fazla yük
- **Worker Overload:** 5 saniye çok agresif olabilir

**Mitigasyon:**
- Circuit breaker kullan
- Rate limiting ekle
- Batch processing kullan

