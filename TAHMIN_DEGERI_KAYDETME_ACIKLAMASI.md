# Tahmin Değeri (prediction_value) Kaydetme Açıklaması

**Tarih:** 2026-01-05  
**Amaç:** AI prediction'ların `prediction_value` alanının nasıl kaydedildiğini açıklamak

---

## ⚠️ KRİTİK BULGU

**Mevcut Kod Davranışı:**
- Sistem **HER ZAMAN** `generatePredictionFromScore()` çağırıyor
- Payload'da `prediction_value` olsa bile, **SKORDAN OTOMATIK HESAPLANIYOR**
- Payload'dan gelen değer **OVERRIDE EDİLİYOR** ❌

**Kod:**
```typescript
// src/services/ai/aiPrediction.service.ts:568-576
// HER ZAMAN generatePredictionFromScore çağrılıyor
const generatedDetails = this.generatePredictionFromScore(
    parsed.scoreAtPrediction,
    parsed.minuteAtPrediction,
    {
        ...botGroup,
        predictionPeriod: effectivePeriod
    }
);

// Database'e generatedDetails.predictionValue kaydediliyor
// parsed.predictionValue KULLANILMIYOR!
```

---

## 📊 Tahmin Değeri Kaydetme Akışı

### 1. Gelen Payload'dan Parse Etme

**Kaynak:** `src/services/ai/aiPrediction.service.ts`

#### a) Multi-Line Format (En Yaygın)
```
00084⚽ *Sunderland A.F.C - Manchester City  ( 0 - 0 )*
🏟 English Premier League
⏰ 10
❗ IY Gol
👉 AlertCode: IY-1 Ev: 18.5 Dep: 6.2
```

**Parse Mantığı:**
```typescript
// Line: "*3.5 ÜST*" veya "*2.5 ALT*"
if (line.match(/^\*[\d.]+\s*(ÜST|ALT|OVER|UNDER)\*$/i)) {
    predictionValue = line.replace(/^\*|\*$/g, '').trim(); // "3.5 ÜST"
    predictionType = predictionValue;
}
```

**Sonuç:**
- `parsed.predictionValue = "3.5 ÜST"` (eğer payload'da varsa)
- **AMA:** Bu değer kullanılmıyor! Sistem skordan yeniden hesaplıyor ❌

---

#### b) JSON Format
```json
{
  "home_team": "Sunderland A.F.C",
  "away_team": "Manchester City",
  "score": "0-0",
  "minute": 10,
  "prediction_type": "IY ÜST",
  "prediction_value": "2.5"  // ← Payload'da VAR
}
```

**Parse Mantığı:**
```typescript
predictionValue: json.prediction_value || json.predictionValue || json.prediction || ''
// parsed.predictionValue = "2.5"
```

**AMA:** Bu değer kullanılmıyor! Sistem skordan yeniden hesaplıyor ❌

---

### 2. OTOMATIK HESAPLAMA (Her Zaman Çalışıyor)

**Kritik Kod:**
```typescript
// src/services/ai/aiPrediction.service.ts:568-576

// HER ZAMAN generatePredictionFromScore çağrılıyor
// parsed.predictionValue kontrol edilmiyor!
const generatedDetails = this.generatePredictionFromScore(
    parsed.scoreAtPrediction,  // "0-0", "1-0", etc.
    parsed.minuteAtPrediction,  // 10, 20, 70, etc.
    {
        ...botGroup,
        predictionPeriod: effectivePeriod
    }
);
```

---

### 3. Otomatik Hesaplama Mantığı

**Fonksiyon:** `calculatePredictionValue(totalGoals: number)`

```typescript
calculatePredictionValue(totalGoals: number): string {
    return `${totalGoals + 0.5}`;
}
```

**Örnekler:**

| Skor | Total Goals | Hesaplanan `prediction_value` |
|------|------------|------------------------------|
| 0-0  | 0          | `"0.5"`                      |
| 1-0  | 1          | `"1.5"`                      |
| 2-1  | 3          | `"3.5"`                      |
| 0-2  | 2          | `"2.5"`                      |

**Mantık:**
- Mevcut toplam gol sayısına **+0.5** eklenir
- Bu, "OVER" tahminleri için standart bir değerdir
- Örnek: Skor 1-0 ise → `prediction_value = "1.5"` → "1.5 ÜST" tahmini

---

### 4. Database'e Kaydetme

**INSERT Query:**
```sql
INSERT INTO ai_predictions (
  external_id, bot_group_id, bot_name, league_name, 
  home_team_name, away_team_name,
  score_at_prediction, minute_at_prediction, 
  prediction_type, prediction_value,  -- ← BURAYA KAYDEDİLİYOR
  raw_payload, processed, display_prediction
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12)
```

**Kod:**
```typescript
const insertResult = await client.query(insertQuery, [
    parsed.externalId,
    botGroup.botGroupId,
    botGroup.botDisplayName,
    parsed.leagueName,
    parsed.homeTeamName,
    parsed.awayTeamName,
    parsed.scoreAtPrediction,
    parsed.minuteAtPrediction,
    generatedDetails.predictionType,   // "IY ÜST" veya "MS ÜST"
    generatedDetails.predictionValue,   // "0.5", "1.5", "2.5" (SKORDAN HESAPLANAN)
    parsed.rawPayload,
    generatedDetails.displayPrediction
]);
```

**ÖNEMLİ:** `parsed.predictionValue` kullanılmıyor! Her zaman `generatedDetails.predictionValue` kaydediliyor.

---

## 🔍 Database Örnekleri

### Örnek 1: Skor 0-0, 10. Dakika
```
Gelen Payload:
- score: "0-0"
- minute: 10
- prediction_value: (YOK)

Hesaplama:
- totalGoals = 0 + 0 = 0
- prediction_value = "0.5" (0 + 0.5)
- prediction_type = "IY ÜST" (10. dakika → IY)
- display_prediction = "⚡ IY 0.5 ÜST (10' dk)"

Database Kaydı:
- prediction_value = "0.5" ✅
- prediction_type = "IY ÜST"
- score_at_prediction = "0-0"
- minute_at_prediction = 10
```

### Örnek 2: Skor 1-0, 20. Dakika
```
Gelen Payload:
- score: "1-0"
- minute: 20
- prediction_value: (YOK)

Hesaplama:
- totalGoals = 1 + 0 = 1
- prediction_value = "1.5" (1 + 0.5)
- prediction_type = "IY ÜST" (20. dakika → IY)
- display_prediction = "🎱 Code Zero IY 1.5 ÜST (20' dk)"

Database Kaydı:
- prediction_value = "1.5" ✅
- prediction_type = "IY ÜST"
- score_at_prediction = "1-0"
- minute_at_prediction = 20
```

### Örnek 3: Skor 2-1, 70. Dakika (Payload'da Değer VAR ama KULLANILMIYOR!)
```
Gelen Payload:
- score: "2-1"
- minute: 70
- prediction_value: "3.5"  ← PAYLOAD'DA VAR

Hesaplama:
- totalGoals = 2 + 1 = 3
- prediction_value = "3.5" (3 + 0.5) ← SKORDAN HESAPLANAN
- prediction_type = "MS ÜST" (70. dakika → MS)
- display_prediction = "📊 Algoritma: 01 MS 3.5 ÜST (70' dk)"

Database Kaydı:
- prediction_value = "3.5"  ← SKORDAN HESAPLANAN (payload'dan değil!)
- prediction_type = "MS ÜST"
- score_at_prediction = "2-1"
- minute_at_prediction = 70

NOT: Payload'daki "3.5" değeri kullanılmadı! Skordan hesaplanan değer kullanıldı.
```

### Örnek 4: Skor 0-0, 15. Dakika (Payload'da Farklı Değer VAR)
```
Gelen Payload:
- score: "0-0"
- minute: 15
- prediction_value: "2.5"  ← PAYLOAD'DA VAR (farklı değer!)

Hesaplama:
- totalGoals = 0 + 0 = 0
- prediction_value = "0.5" (0 + 0.5) ← SKORDAN HESAPLANAN
- prediction_type = "IY ÜST" (15. dakika → IY)
- display_prediction = "🤖 CODE:35 IY 0.5 ÜST (15' dk)"

Database Kaydı:
- prediction_value = "0.5"  ← SKORDAN HESAPLANAN
- prediction_type = "IY ÜST"
- score_at_prediction = "0-0"
- minute_at_prediction = 15

NOT: Payload'daki "2.5" değeri IGNORE EDİLDİ! Skordan hesaplanan "0.5" kullanıldı.
```

---

## 🎯 Özet

### Mevcut Sistem Davranışı

1. **Payload'dan Parse:** `parsed.predictionValue` alanı parse ediliyor
2. **AMA Kullanılmıyor:** `parsed.predictionValue` hiçbir zaman kullanılmıyor
3. **Her Zaman Hesaplanıyor:** `generatePredictionFromScore()` her zaman çağrılıyor
4. **Skordan Hesaplanıyor:** `prediction_value = (homeGoals + awayGoals) + 0.5`

### Sonuç

**Tüm tahminler için `prediction_value` skordan otomatik hesaplanıyor:**
- Skor 0-0 → `prediction_value = "0.5"`
- Skor 1-0 → `prediction_value = "1.5"`
- Skor 2-1 → `prediction_value = "3.5"`
- Skor 0-2 → `prediction_value = "2.5"`

**Payload'da farklı bir değer olsa bile, skordan hesaplanan değer kullanılıyor!**

---

## ❓ Soru

**Bu davranış doğru mu?**
- Eğer payload'da `prediction_value` varsa, o değer kullanılmalı mı?
- Yoksa her zaman skordan hesaplanmalı mı?

**Mevcut kod:** Her zaman skordan hesaplıyor (payload'daki değeri ignore ediyor)

---

**Açıklama Tamamlandı** ✅
