# Canlı Maç Kontrolü Analizi
## Yeni Algoritma - Canlı Maç Kısıtı

**Tarih:** 3 Ocak 2026  
**Soru:** Yeni algoritma gelen yapay zeka tahmininin o an canlıda olup olmadığına bakıyor mu?

---

## ✅ EVET, SİSTEM CANLI MAÇ KONTROLÜ YAPIYOR

### Kod İncelemesi

```typescript
// src/services/ai/teamNameMatcher.service.ts:328
const matchQuery = `
    SELECT ...
    FROM ts_matches m
    WHERE 
        (m.home_team_id = $1 OR m.away_team_id = $1)
        AND m.status_id IN (2, 3, 4, 5, 7) -- Only LIVE matches
    ...
`;
```

**Status ID'ler:**
- **2:** First Half (1. Yarı)
- **3:** Half Time (Devre Arası)
- **4:** Second Half (2. Yarı)
- **5:** Extra Time (Uzatma)
- **7:** Penalties (Penaltılar)

**Dışlanan Status ID'ler:**
- **1:** Not Started (Başlamadı)
- **8:** Finished (Bitti)
- **9:** Postponed (Ertelendi)
- **10:** Cancelled (İptal)
- **11:** Abandoned (Terk Edildi)
- **12:** Suspended (Askıya Alındı)
- **13:** Interrupted (Kesintiye Uğradı)

---

## ❌ SORUN: Bu Kısıt Çok Sıkı!

### Senaryo 1: Tahmin Geldiğinde Maç Henüz Başlamamış

**Örnek:**
- Tahmin: "15. dakika - IY ÜST 0.5"
- Maç durumu: status_id = 1 (Not Started)
- **Sonuç:** ❌ Eşleşmez (sadece canlı maçlar aranıyor)

**Sorun:** Tahmin geldi ama maç henüz başlamadı → Eşleşme yapılmıyor

### Senaryo 2: Tahmin Geldiğinde Maç Az Önce Bitti

**Örnek:**
- Tahmin: "65. dakika - MS ÜST 1.5"
- Maç durumu: status_id = 8 (Finished)
- **Sonuç:** ❌ Eşleşmez (sadece canlı maçlar aranıyor)

**Sorun:** Tahmin geldi ama maç bitti → Eşleşme yapılmıyor

### Senaryo 3: Tahmin Geldiğinde Maç Canlı

**Örnek:**
- Tahmin: "15. dakika - IY ÜST 0.5"
- Maç durumu: status_id = 2 (First Half)
- **Sonuç:** ✅ Eşleşir (canlı maç)

**Durum:** ✅ Çalışıyor

---

## 📊 Mevcut Durum

### Algoritma Akışı

```
1. Tahmin Gelir
   ↓
2. Takım İsimlerini Eşleştir
   ↓
3. Maç Ara (SADECE CANLI MAÇLAR)
   WHERE status_id IN (2, 3, 4, 5, 7)
   ↓
4. Maç Bulundu mu?
   ├─ Evet → Eşleştir
   └─ Hayır → Eşleştirme Yapılmaz
```

### Sorunlu Durumlar

| Tahmin Zamanı | Maç Durumu | Eşleşme |
|---------------|------------|---------|
| Maç başlamadan önce | status_id = 1 | ❌ Eşleşmez |
| Maç canlı | status_id = 2,3,4,5,7 | ✅ Eşleşir |
| Maç bitti | status_id = 8 | ❌ Eşleşmez |
| Maç ertelendi | status_id = 9 | ❌ Eşleşmez |

---

## 💡 Çözüm Önerileri

### Öneri 1: Esnek Status Kontrolü

**Mevcut:**
```sql
AND m.status_id IN (2, 3, 4, 5, 7) -- Only LIVE
```

**Öneri:**
```sql
AND m.status_id IN (1, 2, 3, 4, 5, 7) -- LIVE + Not Started
-- VEYA
AND m.status_id >= 1 AND m.status_id <= 8 -- All active states
```

**Avantaj:**
- Henüz başlamamış maçlar da eşleşir
- Biten maçlar da eşleşir (geçmiş tahminler için)

### Öneri 2: Zaman Bazlı Kontrol

**Mantık:**
- Tahmin geldiğinde `minute_at_prediction` var
- Eğer minute > 0 ise → Maç başlamış olmalı (status_id >= 2)
- Eğer minute = 0 ise → Maç henüz başlamamış olabilir (status_id = 1)

**Kod:**
```typescript
// Tahmin dakikasına göre status kontrolü
const statusFilter = minuteHint && minuteHint > 0
    ? [2, 3, 4, 5, 7]  // Canlı maçlar
    : [1, 2, 3, 4, 5, 7, 8];  // Başlamamış + Canlı + Biten
```

### Öneri 3: Retry Mekanizması

**Mantık:**
- İlk eşleştirmede canlı maç bulunamazsa
- Biten maçları da kontrol et (son 24 saat)
- Eğer bulunursa eşleştir

**Kod:**
```typescript
// Önce canlı maçları ara
let match = await findLiveMatch(teamId);

// Bulunamazsa, son 24 saatte biten maçları ara
if (!match) {
    match = await findRecentFinishedMatch(teamId, last24Hours);
}
```

---

## 🎯 Önerilen Değişiklik

### Mevcut Kod
```typescript
AND m.status_id IN (2, 3, 4, 5, 7) -- Only LIVE matches
```

### Önerilen Kod
```typescript
-- Esnek kontrol: Canlı + Henüz başlamamış + Az önce biten
AND m.status_id IN (1, 2, 3, 4, 5, 7, 8)
AND (
    m.status_id IN (2, 3, 4, 5, 7)  -- Canlı
    OR (m.status_id = 1 AND m.match_time <= EXTRACT(EPOCH FROM NOW()) + 3600)  -- Başlamak üzere (1 saat içinde)
    OR (m.status_id = 8 AND m.match_time >= EXTRACT(EPOCH FROM NOW()) - 86400)  -- Az önce bitti (24 saat içinde)
)
```

**Avantajlar:**
- ✅ Canlı maçlar eşleşir
- ✅ Henüz başlamamış maçlar eşleşir (1 saat içinde başlayacak)
- ✅ Az önce biten maçlar eşleşir (24 saat içinde bitti)

---

## 📋 Sonuç

### Mevcut Durum

✅ **Sistem canlı maç kontrolü yapıyor**
- Sadece status_id IN (2, 3, 4, 5, 7) maçları aranıyor
- Canlı olmayan maçlar eşleşmiyor

❌ **Sorun:**
- Henüz başlamamış maçlar eşleşmiyor
- Biten maçlar eşleşmiyor
- Bu yüzden bazı tahminler eşleşemiyor

### Öneri

**Esnek status kontrolü ekle:**
- Canlı maçlar (öncelik)
- Henüz başlamamış maçlar (1 saat içinde başlayacak)
- Az önce biten maçlar (24 saat içinde bitti)

Bu sayede daha fazla tahmin eşleşecek!

---

**Rapor Tarihi:** 3 Ocak 2026  
**Durum:** ✅ Canlı maç kontrolü var, ama çok sıkı

