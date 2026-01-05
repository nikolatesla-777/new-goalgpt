# Period Sabit Kural Güncellemesi

**Tarih:** 2026-01-05  
**Değişiklik:** Period belirleme mantığı dakikaya göre sabit hale getirildi

---

## 🎯 Değişiklik

### Önce (Eski)
```
Period belirleme:
- Bot rule'daki prediction_period öncelikli
- Match status'a göre override edilebiliyordu
- AUTO durumunda dakikaya göre belirleniyordu
```

### Sonra (Yeni)
```
Period belirleme (SABIT KURAL):
- 1-45. dakika → IY (İlk Yarı) - SABIT
- 46-90. dakika → MS (Maç Sonu) - SABIT
- Bot rule'daki period IGNORE edilir
- Match status IGNORE edilir
```

---

## 📊 Örnekler

### Örnek 1: ALERT D, 10. Dakika, Skor 0-0
```
Gelen Tahmin:
- Bot: ALERT D
- Dakika: 10
- Skor: 0-0

Hesaplama:
- Period: IY (10 <= 45)
- Total Goals: 0
- prediction_value: "0.5"
- prediction_type: "IY ÜST"
- display_prediction: "⚡ IY 0.5 ÜST (10' dk)"

Database:
- prediction_type = "IY ÜST"
- prediction_value = "0.5"
- score_at_prediction = "0-0"
- minute_at_prediction = 10
```

### Örnek 2: İlk Yarıda +1 Gol (Instant Win)
```
Başlangıç:
- Tahmin: IY 0.5 ÜST
- Skor: 0-0

Gol Geldi (1-0 veya 0-1):
- Yeni Skor: 1-0 veya 0-1
- Total Goals: 1
- Kontrol: 1 > 0.5 → ✅ Instant WIN

Sonuç:
- prediction_result = "winner"
- result_reason = "Gol! Toplam 1 > 0.5"
```

### Örnek 3: CODE: 35, 15. Dakika, Skor 1-0
```
Gelen Tahmin:
- Bot: CODE: 35
- Dakika: 15
- Skor: 1-0

Hesaplama:
- Period: IY (15 <= 45)
- Total Goals: 1
- prediction_value: "1.5"
- prediction_type: "IY ÜST"
- display_prediction: "🤖 CODE:35 IY 1.5 ÜST (15' dk)"

Database:
- prediction_type = "IY ÜST"
- prediction_value = "1.5"
- score_at_prediction = "1-0"
- minute_at_prediction = 15
```

### Örnek 4: BOT 007, 65. Dakika, Skor 2-1
```
Gelen Tahmin:
- Bot: BOT 007
- Dakika: 65
- Skor: 2-1

Hesaplama:
- Period: MS (65 > 45)
- Total Goals: 3
- prediction_value: "3.5"
- prediction_type: "MS ÜST"
- display_prediction: "🤖 BOT 007 MS 3.5 ÜST (65' dk)"

Database:
- prediction_type = "MS ÜST"
- prediction_value = "3.5"
- score_at_prediction = "2-1"
- minute_at_prediction = 65
```

### Örnek 5: Algoritma: 01, 70. Dakika, Skor 1-1
```
Gelen Tahmin:
- Bot: Algoritma: 01
- Dakika: 70
- Skor: 1-1

Hesaplama:
- Period: MS (70 > 45)
- Total Goals: 2
- prediction_value: "2.5"
- prediction_type: "MS ÜST"
- display_prediction: "📊 Algoritma: 01 MS 2.5 ÜST (70' dk)"

Database:
- prediction_type = "MS ÜST"
- prediction_value = "2.5"
- score_at_prediction = "1-1"
- minute_at_prediction = 70
```

---

## 🔧 Kod Değişikliği

### 1. `determinePeriod()` Fonksiyonu

**Önce:**
```typescript
determinePeriod(minute: number, botPeriod: 'IY' | 'MS' | 'AUTO' | null): 'IY' | 'MS' {
    if (botPeriod === 'IY') return 'IY';
    if (botPeriod === 'MS') return 'MS';
    // AUTO: determine based on minute
    return minute <= 45 ? 'IY' : 'MS';
}
```

**Sonra:**
```typescript
determinePeriod(minute: number, botPeriod: 'IY' | 'MS' | 'AUTO' | null): 'IY' | 'MS' {
    // KRITIK: Dakikaya göre SABIT belirleme
    // Bot rule'daki period değeri kullanılmaz
    return minute <= 45 ? 'IY' : 'MS';
}
```

### 2. `ingestPrediction()` Metodu

**Önce:**
```typescript
// Override period based on match status if matched
let effectivePeriod = botGroup.predictionPeriod;
if (matchResult && matchResult.statusId) {
    if (matchResult.statusId === 2) effectivePeriod = 'IY';
    else if (matchResult.statusId === 4) effectivePeriod = 'MS';
}
```

**Sonra:**
```typescript
// KRITIK: Period sadece dakikaya göre belirlenir (SABIT KURAL)
// 1-45. dakika → IY (İlk Yarı)
// 46-90. dakika → MS (Maç Sonu)
// Bot rule'daki period veya match status IGNORE edilir
const effectivePeriod = parsed.minuteAtPrediction <= 45 ? 'IY' : 'MS';
```

---

## ✅ Instant Win Mantığı (Zaten Mevcut)

**Kod:** `checkInstantWin()` ve `settleInstantWin()`

**Mantık:**
- OVER (ÜST) tahminler: `totalGoals > predictionValue` → ✅ Instant WIN
- Örnek: IY 0.5 ÜST, Skor 1-0 → Total: 1 > 0.5 → WIN

**Çalışma:**
- WebSocket'ten GOAL event geldiğinde `settleInstantWin()` çağrılıyor
- İlk yarıda (IY) gelen tahminler için anında sonuçlandırılıyor

---

## 📋 Özet

### Sabit Kurallar
- **1-45. dakika:** Period = IY (İlk Yarı)
- **46-90. dakika:** Period = MS (Maç Sonu)

### Instant Win
- İlk yarıda +1 gol gelince → IY 0.5 ÜST → Instant WIN ✅
- İkinci yarıda +1 gol gelince → MS X.5 ÜST → Instant WIN ✅

### Database Kaydı
- `prediction_type`: "IY ÜST" veya "MS ÜST"
- `prediction_value`: Skordan hesaplanan değer (totalGoals + 0.5)

---

**Güncelleme Tamamlandı** ✅

