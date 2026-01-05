# Tahmin Eşleşme Sorunu Analizi

**Tarih:** 2026-01-05  
**Tahmin:** ALERT D - Myanmar Professional League - Laconi Lian vs Dagon FC

---

## 🔍 Sorun Tespiti

### Tahmin Bilgileri:
- **Tahmin ID:** 959cc831...
- **Bot:** ALERT D
- **Lig:** Myanmar Professional League
- **Maç:** Laconi Lian vs Dagon FC
- **Skor:** 0-0
- **Dakika:** 10
- **Durum:** ❌ Eşleşmedi

---

## ❌ Neden Eşleşmedi?

### 1. Takım Eşleşmesi:
- **Home Team "Laconi Lian"** → 0 takım bulundu ❌
- **Away Team "Dagon FC"** → 2 takım bulundu ✅
  - Dagon FC U19
  - Dagon FC U21

### 2. Database Kontrolü:
- Myanmar liginde **20 takım** var
- "Laconi Lian" takımı **database'de yok** ❌
- "Laconi" veya "Lian" içeren takımlar var ama Myanmar liginde değil

### 3. Eşleşme Mantığı:
- `findMatchByTeams()` sadece **canlı maçları** (status_id IN (2, 3, 4, 5, 7)) arıyor
- Home team eşleşmediği için maç aranamıyor
- Eşleşme yapılamadığında tahmin `processed = false` olarak kalıyor

---

## 🔧 Çözüm Önerileri

### 1. Takım Alias Ekleme (Kısa Vadeli)
**Manuel olarak alias ekle:**
```sql
INSERT INTO ts_team_aliases (team_external_id, alias)
VALUES ('gerçek_takım_id', 'Laconi Lian');
```

**Sorun:** Hangi takıma alias ekleneceği bilinmiyor (takım database'de yok)

### 2. Fuzzy Matching İyileştirme (Orta Vadeli)
**Mevcut fuzzy matching'i iyileştir:**
- Word-based similarity'i güçlendir
- Partial match threshold'u düşür (0.6 → 0.4)
- Myanmar ligindeki tüm takımları kontrol et

**Sorun:** "Laconi Lian" hiçbir takıma benzemiyor

### 3. Periyodik Retry Worker (Uzun Vadeli)
**Eşleşmemiş tahminleri periyodik kontrol et:**
- Her 5 dakikada bir `processed = false` tahminleri kontrol et
- Yeni sync edilen maçları kontrol et
- Takım isimlerini tekrar dene

**Avantaj:** Maç henüz sync edilmemişse, sonra eşleşebilir

### 4. Maç Sync Kontrolü
**Maç database'de var mı kontrol et:**
- Myanmar ligindeki bugünkü maçları kontrol et
- "Laconi Lian" vs "Dagon FC" maçı var mı?
- Eğer varsa, status nedir?

---

## 📊 Mevcut Durum

### Eşleşme Akışı:
```
1. Tahmin geldi (ingestPrediction)
   ↓
2. Takım eşleşmesi (findMatchByTeams)
   ↓
3. Home team bulunamadı → ❌
   ↓
4. Eşleşme yapılamadı
   ↓
5. processed = false
```

### Sorun:
- **Home team "Laconi Lian" database'de yok**
- **Fuzzy matching de eşleşme bulamadı**
- **Maç henüz sync edilmemiş olabilir**

---

## ✅ Önerilen Çözüm

### 1. Periyodik Retry Worker Ekle
**Her 5 dakikada bir:**
- `processed = false` tahminleri bul
- Takım eşleşmesini tekrar dene
- Yeni sync edilen maçları kontrol et

### 2. Fuzzy Matching İyileştir
**Word-based similarity:**
- "Laconi Lian" → Myanmar ligindeki tüm takımlarla karşılaştır
- En yüksek similarity'yi bul
- Threshold'u düşür (0.6 → 0.4)

### 3. Maç Sync Kontrolü
**Myanmar ligindeki bugünkü maçları kontrol et:**
- "Laconi Lian" vs "Dagon FC" maçı var mı?
- Eğer varsa, alias ekle veya fuzzy matching'i tekrar dene

---

**Analiz Tamamlandı** ✅


