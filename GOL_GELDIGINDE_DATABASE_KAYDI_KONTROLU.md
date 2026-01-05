# Gol Geldiğinde Database Kaydı Kontrolü

**Tarih:** 2026-01-05  
**Amaç:** Gol geldiğinde otomatik sonuçlandırmanın database'e kaydedilip kaydedilmediğini kontrol etmek

---

## ✅ Mevcut Durum: EVET, Database'e Kaydediliyor

### 1. Gol Event Akışı

```
WebSocket GOAL Event
    ↓
websocket.service.ts:288
    ↓
aiPredictionService.settleInstantWin()
    ↓
Database'e UPDATE
```

---

### 2. `settleInstantWin()` Fonksiyonu

**Dosya:** `src/services/ai/aiPrediction.service.ts:1200`

**Akış:**
1. ✅ Pending tahminleri bulur (`prediction_result = 'pending'`)
2. ✅ Her tahmin için `checkInstantWin()` kontrolü yapar
3. ✅ Eğer `isInstantWin = true` ise → **Database'e UPDATE yapar**

**Database UPDATE:**
```sql
UPDATE ai_prediction_matches 
SET prediction_result = 'winner', 
    result_reason = $1,
    final_home_score = $2,
    final_away_score = $3,
    resulted_at = NOW(),
    updated_at = NOW()
WHERE id = $4
```

**Kaydedilen Alanlar:**
- ✅ `prediction_result = 'winner'`
- ✅ `result_reason` (örn: "Gol! Toplam 1 > 0.5")
- ✅ `final_home_score` (gol sonrası skor)
- ✅ `final_away_score` (gol sonrası skor)
- ✅ `resulted_at = NOW()` (sonuçlandırma zamanı)
- ✅ `updated_at = NOW()` (güncelleme zamanı)

---

### 3. WebSocket Entegrasyonu

**Dosya:** `src/services/thesports/websocket/websocket.service.ts:288`

**Kod:**
```typescript
// Detect goal
const goalEvent = this.eventDetector.detectGoalFromIncident(
    parsedIncident.matchId,
    parsedIncident
);
if (goalEvent) {
    // AUTO SETTLEMENT: Trigger instant settlement on verified GOAL event
    aiPredictionService.settleInstantWin(
        parsedIncident.matchId,
        goalEvent.homeScore,
        goalEvent.awayScore,
        goalEvent.time
    ).catch(err => logger.error(`[AutoSettlement] Error in goal handler: ${err.message}`));
}
```

**Çalışma:**
- ✅ WebSocket'ten GOAL event geldiğinde otomatik çağrılıyor
- ✅ Hata durumunda log yazılıyor ama işlem devam ediyor

---

## 📊 Örnek Senaryo

### Senaryo: IY 0.5 ÜST - Gol Geldi

```
1. Başlangıç:
   - prediction_result = "pending"
   - score_at_prediction = "0-0"

2. Gol Geldi (10. dakika):
   - WebSocket GOAL event
   - Yeni skor: 1-0
   - settleInstantWin() çağrıldı

3. Kontrol:
   - checkInstantWin() → isInstantWin = true
   - Reason: "Gol! Toplam 1 > 0.5"

4. Database UPDATE:
   UPDATE ai_prediction_matches 
   SET prediction_result = 'winner',
       result_reason = 'Gol! Toplam 1 > 0.5',
       final_home_score = 1,
       final_away_score = 0,
       resulted_at = NOW(),
       updated_at = NOW()
   WHERE id = <match_link_id>

5. Sonuç:
   ✅ Database'e kaydedildi
   ✅ prediction_result = "winner"
   ✅ resulted_at = şu anki zaman
```

---

## ⚠️ Eksik Olan Kısım (UNDER Tahminler)

**Mevcut Kod:**
```typescript
if (check.isInstantWin) {
    // ✅ WIN durumu database'e kaydediliyor
    await client.query(`UPDATE ... SET prediction_result = 'winner' ...`);
} else if (check.reason && check.reason.includes('Kaybetti')) {
    // ❌ LOSS durumu database'e kaydedilmiyor!
    // Sadece yorum satırı var
}
```

**Sorun:**
- UNDER (ALT) tahminler için gol geldiğinde `isInstantWin = false` oluyor
- `check.reason.includes('Kaybetti')` durumunda database'e kayıt yapılmıyor
- Sadece yorum satırı var: "The requirement was Instant Settlement on Goal (Winner)."

**Örnek:**
```
Tahmin: MS 2.5 ALT
Skor: 1-1
Gol Geldi: 2-1 (Total: 3)
Kontrol: 3 > 2.5 → Kaybetti
AMA: Database'e kaydedilmiyor! ❌
```

---

## ✅ Özet

### Gol Geldiğinde KAZANDI Durumu
- ✅ WebSocket GOAL event → `settleInstantWin()` çağrılıyor
- ✅ `checkInstantWin()` kontrolü yapılıyor
- ✅ `isInstantWin = true` ise → **Database'e kaydediliyor**
- ✅ `prediction_result = 'winner'` ✅
- ✅ `resulted_at = NOW()` ✅

### Gol Geldiğinde KAYBETTİ Durumu (UNDER Tahminler)
- ⚠️ `check.reason.includes('Kaybetti')` durumunda database'e kayıt yapılmıyor
- ⚠️ Sadece yorum satırı var
- ❌ **EKSİK:** UNDER tahminler için instant loss kaydı yok

---

## 🔧 Önerilen Düzeltme

**UNDER tahminler için instant loss kaydı eklenmeli:**

```typescript
} else if (check.reason && check.reason.includes('Kaybetti')) {
    logger.info(`[AIPrediction] INSTANT LOSS! Prediction ${row.prediction_id} lost. Reason: ${check.reason}`);
    
    await client.query(`
        UPDATE ai_prediction_matches 
        SET prediction_result = 'loser', 
            result_reason = $1,
            final_home_score = $2,
            final_away_score = $3,
            resulted_at = NOW(),
            updated_at = NOW()
        WHERE id = $4
    `, [check.reason, homeScore, awayScore, row.match_link_id]);
}
```

---

**Kontrol Tamamlandı** ✅

