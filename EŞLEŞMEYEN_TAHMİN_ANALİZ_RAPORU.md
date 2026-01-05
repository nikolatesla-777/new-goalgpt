# Eşleşmeyen Tahmin Analiz Raporu
## Simba Sports Club vs Muembe/Mwembe Makumbi City FC

**Tarih:** 3 Ocak 2026  
**Tahmin ID:** `9eceb4a8-1541-44e4-8cd1-5cbc8141e9e3`  
**Durum:** ✅ **ÇÖZÜLDÜ**

---

## 📊 Özet

Bu rapor, admin panelinde görünen eşleşmemiş bir tahminin neden eşleşmediğini ve nasıl çözüldüğünü detaylandırmaktadır.

### Tahmin Bilgileri
- **Bot:** 70. Dakika Botu
- **Lig:** Zanzibar Mapinduzi Cup
- **Maç:** Simba Sports Club - Muembe Makumbi City FC
- **Skor:** 1-0
- **Dakika:** 65'
- **Tahmin:** MS ÜST 1.5
- **Durum:** Bekliyor (Eşleşmemiş)

---

## 🔍 Sorun Analizi

### 1. Veritabanı Kontrolü

#### ai_predictions Tablosu
```sql
SELECT * FROM ai_predictions 
WHERE id = '9eceb4a8-1541-44e4-8cd1-5cbc8141e9e3';
```

**Bulgular:**
- ✅ Tahmin veritabanında mevcut
- ❌ `processed = false` (eşleşmemiş)
- **Home Team:** "Simba Sports Club"
- **Away Team:** "Muembe Makumbi City FC" ← **SORUN BURADA**

#### ts_matches Tablosu
```sql
SELECT * FROM ts_matches 
WHERE external_id = 'k82rekhg0w8nrep';
```

**Bulgular:**
- ✅ Maç veritabanında mevcut
- **Home Team:** Simba Sports Club (ID: `4jwq2gh4nwlm0ve`)
- **Away Team:** **Mwembe Makumbi City FC** (ID: `y39mp1h9yxwmojx`) ← **İSİM FARKI**
- **Competition:** ZAN CUP
- **Status:** 8 (Bitti)

### 2. İsim Farkı Tespiti

| Kaynak | Takım İsmi |
|--------|------------|
| **AI Tahmin** | "Muembe Makumbi City FC" |
| **TheSports DB** | "Mwembe Makumbi City FC" |
| **Fark** | **"Muembe" vs "Mwembe"** |

**Sorun:** Tahminde "Mu" ile başlıyor, veritabanında "Mw" ile başlıyor.

### 3. Eşleştirme Denemesi Sonuçları

#### Step 1: Takım İsmi Eşleştirmesi
- ✅ **Home Team (Simba Sports Club):** %100 eşleşti
  - Team ID: `6ypq3nh5pglmd7o`
  - Confidence: 100%
  
- ❌ **Away Team (Muembe Makumbi City FC):** Eşleşmedi
  - Alias tablosunda yok
  - Fuzzy match başarısız
  - Confidence: 0%

#### Step 2: Alias Tablosu Kontrolü
```sql
SELECT * FROM ts_team_aliases 
WHERE alias ILIKE '%Muembe%' OR alias ILIKE '%Mwembe%';
```
- ❌ Alias kaydı yok

#### Step 3: Benzer Takım İsimleri
- ✅ Simba Sports Club için 5 benzer takım bulundu
- ❌ Muembe/Mwembe için benzer takım bulunamadı

#### Step 4: Maç Arama
- ❌ `findMatchByTeams()` fonksiyonu maç bulamadı
- **Neden:** Away team eşleşmediği için maç bulunamadı
- **Ek Not:** Maç status_id = 8 (bitti) olduğu için canlı maç araması da başarısız

---

## ✅ Çözüm Adımları

### 1. Alias Ekleme
```sql
INSERT INTO ts_team_aliases (team_external_id, alias)
VALUES ('y39mp1h9yxwmojx', 'Muembe Makumbi City FC')
ON CONFLICT (alias) DO NOTHING;
```

**Sonuç:** ✅ Alias başarıyla eklendi
- "Muembe Makumbi City FC" → "Mwembe Makumbi City FC" (ID: `y39mp1h9yxwmojx`)

### 2. Manuel Eşleştirme
Maç bittiği için (status_id = 8) otomatik eşleştirme çalışmadı. Manuel eşleştirme yapıldı:

```sql
INSERT INTO ai_prediction_matches (
    prediction_id,
    match_external_id,
    match_uuid,
    home_team_id,
    away_team_id,
    home_team_confidence,
    away_team_confidence,
    overall_confidence,
    match_status,
    matched_at
) VALUES (
    '9eceb4a8-1541-44e4-8cd1-5cbc8141e9e3',
    'k82rekhg0w8nrep',
    <match_uuid>,
    '4jwq2gh4nwlm0ve',
    'y39mp1h9yxwmojx',
    1.0,
    1.0,
    1.0,
    'matched',
    NOW()
);
```

**Sonuç:** ✅ Eşleştirme başarıyla kaydedildi

### 3. Prediction Güncelleme
```sql
UPDATE ai_predictions
SET processed = true, updated_at = NOW()
WHERE id = '9eceb4a8-1541-44e4-8cd1-5cbc8141e9e3';
```

**Sonuç:** ✅ Tahmin "processed" olarak işaretlendi

---

## 📋 Veritabanı İlişkileri (Çözüm Sonrası)

```
ai_predictions (id: 9eceb4a8-1541-44e4-8cd1-5cbc8141e9e3)
    ↓
ai_prediction_matches (prediction_id → match_external_id)
    ↓ match_external_id: k82rekhg0w8nrep
ts_matches (external_id: k82rekhg0w8nrep)
    ↓
ts_teams (home_team_id: 4jwq2gh4nwlm0ve, away_team_id: y39mp1h9yxwmojx)
    ↑
ts_team_aliases (team_external_id: y39mp1h9yxwmojx, alias: "Muembe Makumbi City FC")
```

---

## 🎯 Öğrenilen Dersler

### 1. İsim Varyasyonları
- Dış kaynaklardan gelen takım isimleri, veritabanındaki isimlerle tam eşleşmeyebilir
- Küçük harf farkları ("Muembe" vs "Mwembe") eşleştirmeyi engelleyebilir
- **Çözüm:** Alias tablosu kullanarak varyasyonları eşleştir

### 2. Biten Maçlar
- Otomatik eşleştirme sadece canlı maçları (status_id: 2,3,4,5,7) arıyor
- Biten maçlar (status_id: 8) için manuel eşleştirme gerekebilir
- **Öneri:** Biten maçlar için de retry mekanizması eklenebilir

### 3. League İsimleri
- Tahminde "Zanzibar Mapinduzi Cup" yazıyor
- Veritabanında "ZAN CUP" olarak kayıtlı
- League eşleştirmesi şu an kullanılmıyor, sadece takım isimleri kullanılıyor

---

## 🔧 Öneriler

### 1. Alias Yönetimi
- Yaygın isim varyasyonları için alias'ları önceden ekle
- Örnek: "Muembe" → "Mwembe", "Fenerbahce" → "Fenerbahçe"

### 2. Fuzzy Matching İyileştirmesi
- Levenshtein distance threshold'u düşürülebilir (şu an %60)
- "Muembe" ve "Mwembe" arasındaki benzerlik hesaplanabilir

### 3. Retry Mekanizması
- Biten maçlar için periyodik retry job'u eklenebilir
- Eşleşmemiş tahminler için günlük batch işleme

### 4. Logging
- Eşleşmeyen tahminler için detaylı log kaydı
- Hangi adımda başarısız olduğunu kaydet

---

## ✅ Sonuç

**Durum:** ✅ **ÇÖZÜLDÜ**

- ✅ Alias eklendi
- ✅ Manuel eşleştirme yapıldı
- ✅ Tahmin "processed" olarak işaretlendi
- ✅ Admin panelinde artık "Eşleşen" olarak görünecek

**Sonraki Adımlar:**
1. Benzer isim varyasyonları için alias'ları toplu ekle
2. Biten maçlar için retry mekanizması ekle
3. Eşleşmeyen tahminler için otomatik bildirim sistemi kur

---

**Rapor Tarihi:** 3 Ocak 2026  
**Analiz Eden:** AI Prediction System  
**Durum:** ✅ Tamamlandı


