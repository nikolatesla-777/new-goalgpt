# Maç Başlama Tespiti Nasıl Çalışıyor?

## 🎯 Kısa Cevap

**Ekstra tetikleyici GEREKMİYOR.** Sistem **2 yöntemle** çalışıyor:

1. **TheSports Otomatik Bildirimi** (Reactive) - `/data/update` endpoint'i
2. **Kendi Proaktif Kontrolümüz** (Proactive) - `match_time` kontrolü

---

## 📡 Yöntem 1: TheSports Otomatik Bildirimi (Reactive)

### `/data/update` Endpoint'i

**TheSports API'nin kendi bildirim sistemi:**

```
GET https://api.thesports.com/v1/football/data/update
```

**Ne Yapıyor:**
- Son **120 saniye** içinde değişen maçları listeler
- Maç başladığında TheSports bu endpoint'e maç ID'sini ekler
- **Sadece match_id listesi** döner, status bilgisi YOK

**Kod:**
```typescript
// DataUpdateWorker (her 20 saniyede çalışır)
const data = await dataUpdateService.checkUpdates()
// Response: { results: { "1": [{ match_id: "xyz123" }] } }

// Sonra her maç için /match/detail_live çağrılır
for (const matchId of changedMatchIds) {
  await matchDetailLiveService.reconcileMatchToDatabase(matchId)
  // Bu çağrı /match/detail_live endpoint'ini kullanır
  // Ve status_id = 2 (FIRST_HALF) gelirse maç başlamış demektir
}
```

**Avantaj:** TheSports otomatik bildiriyor, hızlı (en fazla 20 saniye gecikme)

**Dezavantaj:** TheSports her zaman `/data/update`'e eklemeyebilir (küçük ligler, bazı durumlar)

---

## 🔍 Yöntem 2: Proaktif Kontrol (Proactive)

### ProactiveMatchStatusCheckWorker

**Kendi sistemimizin kontrol mekanizması:**

**Ne Yapıyor:**
1. Database'de `match_time` geçmiş ama hala `status_id = 1` olan maçları bulur
2. Bu maçlar için **`/match/detail_live`** endpoint'ini çağırır
3. Provider'dan `status_id = 2` gelirse → Database'i günceller

**Kod:**
```typescript
// ProactiveMatchStatusCheckWorker (her 20 saniyede çalışır)
const query = `
  SELECT external_id, match_time, status_id
  FROM ts_matches
  WHERE match_time <= NOW()  -- Saat geçmiş
    AND status_id = 1        -- Ama hala NOT_STARTED
    AND match_time >= todayStartTSI  -- Bugünkü maçlar
`

// Bulunan maçlar için /match/detail_live çağır
for (const match of matches) {
  await matchDetailLiveService.reconcileMatchToDatabase(match.external_id)
}
```

**Avantaj:** TheSports bildirmese bile tespit eder, güvenilir

**Dezavantaj:** Biraz daha yavaş (en fazla 20 saniye gecikme)

---

## 🔄 İkisi Birlikte Nasıl Çalışıyor?

### Senaryo 1: TheSports Bildirdi (İdeal Durum)

```
21:00:00 - Maç başladı (TheSports'ta)
21:00:05 - TheSports /data/update'e maç ID'sini ekledi
21:00:10 - DataUpdateWorker çalıştı
         → /data/update çağrıldı
         → match_id: "xyz123" bulundu
         → /match/detail_live çağrıldı
         → status_id = 2 geldi
         → Database güncellendi ✅
```

**Gecikme:** ~10 saniye

---

### Senaryo 2: TheSports Bildirmedi (Fallback)

```
21:00:00 - Maç başladı (TheSports'ta)
21:00:05 - TheSports /data/update'e EKLEMEDİ (sorun var)
21:00:20 - ProactiveMatchStatusCheckWorker çalıştı
         → Database'de match_time geçmiş + status_id=1 bulundu
         → /match/detail_live çağrıldı
         → status_id = 2 geldi
         → Database güncellendi ✅
```

**Gecikme:** ~20 saniye

---

## 📊 Özet Tablo

| Yöntem | Tetikleyici | Endpoint | Gecikme | Güvenilirlik |
|--------|-------------|----------|---------|--------------|
| **TheSports Bildirimi** | TheSports `/data/update` | `/match/detail_live` | ~10-20 saniye | ⚠️ Bazen çalışmaz |
| **Proaktif Kontrol** | `match_time` kontrolü | `/match/detail_live` | ~20 saniye | ✅ Her zaman çalışır |

---

## 🎯 Sonuç

**Ekstra tetikleyici GEREKMİYOR.** Sistem zaten 2 katmanlı çalışıyor:

1. **TheSports bildirirse** → Hızlı tespit (DataUpdateWorker)
2. **TheSports bildirmese bile** → Yine tespit eder (ProactiveMatchStatusCheckWorker)

**Her iki durumda da `/match/detail_live` endpoint'i kullanılıyor** ve provider'dan gelen `status_id = 2` bilgisi ile maç başlatılıyor.

**Kritik Nokta:** Sistem **provider-authoritative** çalışıyor. Yani:
- Database'deki `status_id` değil
- **TheSports'tan gelen `status_id`** kullanılıyor
- `/match/detail_live` endpoint'i **tek gerçek kaynak**


