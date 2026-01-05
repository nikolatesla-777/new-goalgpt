# Manuel Tahmin Lig Bilgisi Otomatik Doldurma

**Tarih:** 2026-01-05  
**Durum:** ✅ Aktif

---

## ✅ EVET, Yeni Manuel Tahminlerde Lig Bilgisi Otomatik Kaydediliyor

### 1. Otomatik Doldurma Mantığı

**Fonksiyon:** `createManualPrediction()`

**Dosya:** `src/services/ai/aiPrediction.service.ts:1317`

**Akış:**
```
Manuel Tahmin Oluşturuluyor
    ↓
league parametresi kontrol ediliyor
    ↓
Eğer league boş/null/"-" ise
    ↓
Maçın competition_name'i database'den alınıyor
    ↓
league_name alanına kaydediliyor ✅
```

---

### 2. Kod Detayı

**Kontrol:**
```typescript
// KRITIK: Eğer league boşsa, maçın competition_name'ini al
let leagueName = data.league;
if (!leagueName || leagueName.trim() === '' || leagueName === '-') {
    const matchQuery = await client.query(`
        SELECT c.name as competition_name
        FROM ts_matches m
        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
        WHERE m.external_id = $1
    `, [data.match_external_id]);

    if (matchQuery.rows.length > 0 && matchQuery.rows[0].competition_name) {
        leagueName = matchQuery.rows[0].competition_name;
        logger.info(`[AIPrediction] Manuel tahmin için lig bilgisi maçtan alındı: ${leagueName}`);
    }
}
```

**Kayıt:**
```typescript
INSERT INTO ai_predictions (
    ...
    league_name,  // ← Güncellenmiş lig bilgisi buraya kaydediliyor
    ...
) VALUES (..., leagueName || '', ...)
```

---

### 3. Senaryo Örnekleri

#### Senaryo 1: Frontend'den league boş gönderiliyor
```
Frontend Payload:
{
    match_external_id: "abc123",
    league: "",  // ← Boş
    ...
}

Backend İşlem:
1. league boş mu? → EVET
2. Maçın competition_name'i al → "Australia A-League"
3. leagueName = "Australia A-League"
4. Database'e kaydet → league_name = "Australia A-League" ✅
```

#### Senaryo 2: Frontend'den league "-" gönderiliyor
```
Frontend Payload:
{
    match_external_id: "abc123",
    league: "-",  // ← Dash
    ...
}

Backend İşlem:
1. league "-" mi? → EVET
2. Maçın competition_name'i al → "Indo D4"
3. leagueName = "Indo D4"
4. Database'e kaydet → league_name = "Indo D4" ✅
```

#### Senaryo 3: Frontend'den league dolu gönderiliyor
```
Frontend Payload:
{
    match_external_id: "abc123",
    league: "Premier League",  // ← Dolu
    ...
}

Backend İşlem:
1. league boş mu? → HAYIR
2. leagueName = "Premier League" (değişmeden)
3. Database'e kaydet → league_name = "Premier League" ✅
```

---

### 4. Frontend Entegrasyonu

**Dosya:** `frontend/src/components/admin/AdminManualPredictions.tsx:122`

**Mevcut Kod:**
```typescript
league: selectedMatch.league_name || selectedMatch.competition?.name || selectedMatch.competition_name || '',
```

**Durum:**
- Frontend zaten `competition_name`'i göndermeye çalışıyor
- Ama bazen boş gelebiliyor
- **Backend artık güvence altında:** Boş gelse bile otomatik dolduruyor ✅

---

## ✅ Sonuç

### Yeni Manuel Tahminlerde:
- ✅ **Lig bilgisi otomatik kaydediliyor**
- ✅ Frontend'den boş gelse bile, backend maçtan alıp kaydediyor
- ✅ `league_name` alanı her zaman dolu olacak (eğer maçta competition_name varsa)

### Kontrol:
- ✅ Kod güncellendi
- ✅ GitHub'a push edildi
- ✅ VPS'e deploy edildi
- ✅ Backend restart edildi

---

**Artık yeni manuel tahminlerde lig bilgisi otomatik kaydediliyor!** ✅

