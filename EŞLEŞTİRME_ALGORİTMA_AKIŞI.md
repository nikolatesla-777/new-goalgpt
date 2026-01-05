# Eşleştirme Algoritması Akış Şeması
## Takım İsmi → Maç ID Bulma Süreci

---

## 📋 Genel Akış

```
1. Tahmin Gelir
   ↓
2. Home & Away Takım İsimlerini Al
   ↓
3. Her İki Takımı Eşleştirmeye Çalış (findTeamByAlias)
   ↓
4. Takım Eşleşti mi?
   ├─ Her İki Takım Eşleşti → Strategy 1: İki Takım ID ile Maç Ara
   └─ Sadece Bir Takım Eşleşti → Strategy 2: Tek Takım ile Maç Ara
   ↓
5. Maç Bulundu mu?
   ├─ Evet → Maç ID'sini Döndür
   └─ Hayır → null Döndür
```

---

## 🔍 Adım 1: Takım İsmi Eşleştirme

### `findTeamByAlias(homeTeamName)` ve `findTeamByAlias(awayTeamName)`

**Yapılan İşlemler:**

#### 1.1. Alias Tablosu Kontrolü
```sql
SELECT t.external_id, t.name, t.short_name 
FROM ts_team_aliases a
JOIN ts_teams t ON t.external_id = a.team_external_id
WHERE LOWER(a.alias) = LOWER('Muembe Makumbi City FC')
```

**Kontrol:** ✅ **FULL takım ismi** alias tablosunda var mı?

#### 1.2. Eğer Alias'ta Yoksa → Fuzzy Search
```typescript
findBestMatch(teamName)
```

**Yapılan Kontroller:**

1. **Exact Match (Tam Eşleşme)**
   ```sql
   WHERE LOWER(name) = 'muembe makumbi city fc'
   ```
   - ✅ **FULL takım ismi** kontrol edilir

2. **Normalized Match**
   ```sql
   WHERE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g')) ILIKE '%muembe makumbi city%'
   ```
   - ✅ **FULL takım ismi** (normalize edilmiş) kontrol edilir

3. **Fuzzy Search**
   ```sql
   WHERE name ILIKE '%Muem%'  -- İlk 4 karakter
   ```
   - ⚠️ Sadece **prefix** kontrol edilir (bu kısım sorunlu)

**Sonuç:**
- Takım bulunursa → `TeamMatchResult` döner (teamId, confidence, matchMethod)
- Takım bulunamazsa → `null` döner

---

## 🎯 Adım 2: Maç Bulma Stratejileri

### Strategy 1: Her İki Takım Eşleşti

**Kod:**
```typescript
if (homeMatch && awayMatch) {
    // Her iki takım ID'si ile maç ara
    SELECT * FROM ts_matches
    WHERE home_team_id = $1 AND away_team_id = $2
      AND status_id IN (2, 3, 4, 5, 7)  -- Sadece CANLI maçlar
}
```

**Akış:**
```
Home Takım Eşleşti → teamId: "gs_12345"
Away Takım Eşleşti → teamId: "fb_67890"
   ↓
Maç Ara: home_team_id = "gs_12345" AND away_team_id = "fb_67890"
   ↓
Maç Bulundu → match_external_id: "match_987654321"
   ↓
Return: { matchExternalId: "match_987654321", ... }
```

**Özellikler:**
- ✅ Her iki takım da eşleşti
- ✅ Yüksek confidence (%100 + %100 / 2 = %100)
- ✅ Reverse kontrol (ev sahibi-deplasman yer değiştirebilir)

---

### Strategy 2: Sadece Bir Takım Eşleşti (Single Team Match)

**Kod:**
```typescript
if (singleTeamMatch) {  // homeMatch VEYA awayMatch
    // O takımın canlı maçlarını ara
    SELECT * FROM ts_matches
    WHERE (home_team_id = $1 OR away_team_id = $1)
      AND status_id IN (2, 3, 4, 5, 7)  -- Sadece CANLI maçlar
    LIMIT 5
}
```

**Akış:**
```
Home Takım Eşleşti → teamId: "gs_12345"
Away Takım Eşleşmedi → null
   ↓
O Takımın Canlı Maçlarını Ara: home_team_id = "gs_12345" OR away_team_id = "gs_12345"
   ↓
Maçlar Bulundu: [match1, match2, match3, ...]
   ↓
Eğer 1 maç varsa → Direkt kullan
Eğer çok maç varsa → Rakip takım ismini kontrol et (partial match)
   ↓
Return: { matchExternalId: "match_987654321", ... }
```

**Özellikler:**
- ✅ Sadece bir takım eşleşti
- ⚠️ Düşük confidence (singleTeamMatch.confidence * 0.7)
- ✅ Rakip takım ismini de kontrol eder (similarity > 0.3)

---

## 📊 Örnek Senaryo: Simba vs Muembe

### Adım 1: Takım Eşleştirme
```
Home: "Simba Sports Club"
   ↓ findTeamByAlias("Simba Sports Club")
   ↓ Alias kontrolü → Yok
   ↓ Fuzzy search → ✅ Bulundu (teamId: "6ypq3nh5pglmd7o", confidence: 100%)

Away: "Muembe Makumbi City FC"
   ↓ findTeamByAlias("Muembe Makumbi City FC")
   ↓ Alias kontrolü → ✅ Bulundu! (teamId: "y39mp1h9yxwmojx", confidence: 100%)
```

### Adım 2: Maç Bulma
```
Her İki Takım Eşleşti → Strategy 1
   ↓
Maç Ara: home_team_id = "6ypq3nh5pglmd7o" AND away_team_id = "y39mp1h9yxwmojx"
   ↓
Maç Bulundu: match_external_id = "k82rekhg0w8nrep"
   ↓
Return: { matchExternalId: "k82rekhg0w8nrep", overallConfidence: 100% }
```

---

## ✅ Kullanıcının Anlayışı Kontrolü

### Soru 1: "Algoritma home veya away takımının full adını kontrol ediyor"
**Cevap:** ✅ **DOĞRU**
- Alias tablosunda: FULL isim kontrol edilir
- Exact match: FULL isim kontrol edilir
- Normalized match: FULL isim (normalize) kontrol edilir
- Fuzzy search: Sadece prefix kontrol edilir (bu kısım sorunlu)

### Soru 2: "Bir takımın ismini eşleştirmeyi başarınca direkt gidip ilgili maçın ID'sini buluyor"
**Cevap:** ✅ **DOĞRU, AMA...**

**Detaylar:**
1. ✅ Takım eşleşince → `teamId` alınır
2. ✅ `teamId` ile maç aranır
3. ✅ Maç bulunursa → `match_external_id` döndürülür

**AMA:**
- Eğer **her iki takım** eşleşirse → İki takım ID'si ile maç aranır (daha kesin)
- Eğer **sadece bir takım** eşleşirse → O takımın canlı maçları aranır (daha esnek)

---

## 🎯 Özet

### Takım Eşleştirme
- ✅ **FULL takım ismi** kontrol edilir (alias, exact, normalized)
- ⚠️ Fuzzy search sadece **prefix** kontrol eder (sorunlu kısım)

### Maç Bulma
- ✅ Takım eşleşince → `teamId` alınır
- ✅ `teamId` ile maç aranır (sadece canlı maçlar: status_id IN 2,3,4,5,7)
- ✅ Maç bulunursa → `match_external_id` döndürülür

### Stratejiler
1. **Strategy 1:** Her iki takım eşleşti → İki takım ID ile maç ara (kesin)
2. **Strategy 2:** Sadece bir takım eşleşti → O takımın canlı maçlarını ara (esnek)

---

**Sonuç:** Kullanıcının anlayışı **%90 doğru**. Sadece "direkt" kelimesi biraz yanıltıcı - eğer her iki takım eşleşirse daha kesin arama yapılıyor, tek takım eşleşirse daha esnek arama yapılıyor.


