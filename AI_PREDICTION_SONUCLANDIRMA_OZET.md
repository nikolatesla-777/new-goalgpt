# AI Prediction Sonuçlandırma Özeti

**Tarih:** 2026-01-05  
**Amaç:** Settlement mantığının özeti

---

## 🎯 Settlement Mantığı (Özet)

### 1. GOL GELİRSE → HEMEN KAZANDI ✅ (Instant Win)

**Ne Zaman:**
- WebSocket'ten GOAL event geldiğinde
- Skor değiştiğinde (score change event)

**Mantık:**
- OVER (ÜST) tahminler: `totalGoals > predictionValue` → ✅ **KAZANDI**
- Örnek: IY 0.5 ÜST, Skor 1-0 → Total: 1 > 0.5 → **KAZANDI** ✅

**Kod:**
```typescript
// WebSocket'ten GOAL event geldiğinde
aiPredictionService.settleInstantWin(
    matchId,
    homeScore,
    awayScore,
    minute
);

// checkInstantWin() kontrolü
if (isOver && newTotalGoals > value) {
    return { isInstantWin: true, reason: `Gol! Toplam ${newTotalGoals} > ${value}` };
}
```

**Sonuç:**
- `prediction_result = "winner"` ✅
- `resulted_at = NOW()` ✅
- **HEMEN** sonuçlandırılır, beklemez ✅

---

### 2. GOL GELMEZSE → İLK YARI VEYA MAÇ SONU STATÜSÜNE GEÇİLDİĞİNDE KAYBETTİ ❌

#### a) İlk Yarı (IY) Tahminler → Devre Arası (Status 3) Geçildiğinde KAYBETTİ

**Ne Zaman:**
- Maç devre arasına geçtiğinde (Status 3 = HALF_TIME)

**Mantık:**
- IY tahminler için devre arası skoruna bakılır
- Eğer `htTotal <= predictionValue` → ❌ **KAYBETTİ**
- Örnek: IY 0.5 ÜST, Devre Arası: 0-0 → Total: 0 <= 0.5 → **KAYBETTİ** ❌

**Kod:**
```typescript
// WebSocket'ten Status 3 (HALF_TIME) geçildiğinde
if (statusId === 3) {
    aiPredictionService.settleMatchPredictions(matchId, statusId, homeScore, awayScore);
}

// calculatePredictionResult() kontrolü
if (period === 'IY') {
    if (isHalftimeReached) {
        // Devre arası skoruna göre kontrol
        if (htTotal <= line) {
            return { outcome: 'loser', reason: `Finished IY: ${htTotal} <= ${line}` };
        }
    }
}
```

**Sonuç:**
- `prediction_result = "loser"` ❌
- `resulted_at = NOW()` ✅
- Devre arası geçildiğinde sonuçlandırılır ✅

---

#### b) Maç Sonu (MS) Tahminler → Maç Bitti (Status 8) Geçildiğinde KAYBETTİ

**Ne Zaman:**
- Maç bittiğinde (Status 8 = END)
- Status 8, 20 dakika stabil kaldığında

**Mantık:**
- MS tahminler için final skoruna bakılır
- Eğer `finalTotal <= predictionValue` → ❌ **KAYBETTİ**
- Örnek: MS 2.5 ÜST, Final: 1-1 → Total: 2 <= 2.5 → **KAYBETTİ** ❌

**Kod:**
```typescript
// WebSocket'ten Status 8 (END) geçildiğinde (20 dakika stabil)
if (matchState?.status === MatchState.END) {
    aiPredictionService.settleMatchPredictions(matchId);
}

// calculatePredictionResult() kontrolü
if (period === 'MS') {
    if (isMatchFinished) {
        // Final skoruna göre kontrol
        if (finalTotal <= line) {
            return { outcome: 'loser', reason: `Finished MS: ${finalTotal} <= ${line}` };
        }
    }
}
```

**Sonuç:**
- `prediction_result = "loser"` ❌
- `resulted_at = NOW()` ✅
- Maç bittiğinde sonuçlandırılır ✅

---

## 📊 Senaryo Örnekleri

### Senaryo 1: IY 0.5 ÜST - Gol Geldi (KAZANDI) ✅

```
Başlangıç:
- Tahmin: IY 0.5 ÜST
- Skor: 0-0
- prediction_result: "pending"

Gol Geldi (10. dakika):
- Yeni Skor: 1-0
- Total Goals: 1
- Kontrol: 1 > 0.5 → ✅ KAZANDI

Sonuç:
- prediction_result = "winner" ✅
- resulted_at = NOW() ✅
- HEMEN sonuçlandırıldı ✅
```

---

### Senaryo 2: IY 0.5 ÜST - Gol Gelmedi (KAYBETTİ) ❌

```
Başlangıç:
- Tahmin: IY 0.5 ÜST
- Skor: 0-0
- prediction_result: "pending"

Devre Arası Geçildi (45. dakika):
- Devre Arası Skor: 0-0
- Total Goals: 0
- Kontrol: 0 <= 0.5 → ❌ KAYBETTİ

Sonuç:
- prediction_result = "loser" ❌
- resulted_at = NOW() ✅
- Devre arası geçildiğinde sonuçlandırıldı ✅
```

---

### Senaryo 3: MS 2.5 ÜST - Gol Geldi (KAZANDI) ✅

```
Başlangıç:
- Tahmin: MS 2.5 ÜST
- Skor: 1-1
- prediction_result: "pending"

Gol Geldi (70. dakika):
- Yeni Skor: 2-1
- Total Goals: 3
- Kontrol: 3 > 2.5 → ✅ KAZANDI

Sonuç:
- prediction_result = "winner" ✅
- resulted_at = NOW() ✅
- HEMEN sonuçlandırıldı ✅
```

---

### Senaryo 4: MS 2.5 ÜST - Gol Gelmedi (KAYBETTİ) ❌

```
Başlangıç:
- Tahmin: MS 2.5 ÜST
- Skor: 1-1
- prediction_result: "pending"

Maç Bitti (90. dakika):
- Final Skor: 1-1
- Total Goals: 2
- Kontrol: 2 <= 2.5 → ❌ KAYBETTİ

Sonuç:
- prediction_result = "loser" ❌
- resulted_at = NOW() ✅
- Maç bittiğinde sonuçlandırıldı ✅
```

---

## 🔄 Settlement Akış Şeması

```
TAHMIN OLUŞTURULDU
    ↓
prediction_result = "pending"
    ↓
    ├─→ GOL GELDİ? 
    │   ├─→ EVET → totalGoals > predictionValue?
    │   │   ├─→ EVET → ✅ KAZANDI (HEMEN)
    │   │   └─→ HAYIR → Bekle...
    │   │
    │   └─→ HAYIR → Bekle...
    │
    ↓
    ├─→ İLK YARI TAHMİNİ (IY)?
    │   ├─→ EVET → Devre Arası (Status 3) Geçildi?
    │   │   ├─→ EVET → htTotal <= predictionValue?
    │   │   │   ├─→ EVET → ❌ KAYBETTİ
    │   │   │   └─→ HAYIR → ✅ KAZANDI (devre arası sonrası)
    │   │   └─→ HAYIR → Bekle...
    │   │
    │   └─→ HAYIR → Maç Sonu Tahmini (MS)
    │       └─→ Maç Bitti (Status 8) Geçildi?
    │           ├─→ EVET → finalTotal <= predictionValue?
    │           │   ├─→ EVET → ❌ KAYBETTİ
    │           │   └─→ HAYIR → ✅ KAZANDI
    │           └─→ HAYIR → Bekle...
```

---

## ✅ Özet

### 1. GOL GELİRSE → HEMEN KAZANDI ✅
- WebSocket GOAL event → `settleInstantWin()`
- `totalGoals > predictionValue` → `prediction_result = "winner"`
- **HEMEN** sonuçlandırılır, beklemez

### 2. GOL GELMEZSE → STATÜ DEĞİŞİKLİĞİNDE KAYBETTİ ❌

#### İlk Yarı (IY) Tahminler:
- Devre Arası (Status 3) geçildiğinde
- `htTotal <= predictionValue` → `prediction_result = "loser"`
- Devre arası geçildiğinde sonuçlandırılır

#### Maç Sonu (MS) Tahminler:
- Maç Bitti (Status 8) geçildiğinde
- `finalTotal <= predictionValue` → `prediction_result = "loser"`
- Maç bittiğinde sonuçlandırılır

---

**Özet Tamamlandı** ✅

