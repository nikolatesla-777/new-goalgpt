# Maç Sayısı Tutarsızlığı - Kökten Tespit Raporu

**Tarih:** 4 Ocak 2026 23:40  
**Öncelik:** ÇOK CİDDİ  
**Sorun:** Günün Maçları ≠ Canlı + Biten + Başlamayan

---

## 📊 TESPİT EDİLEN SAYILAR

### Browser'da Görülen Sayılar:
- **Günün Maçları:** 641
- **Canlı Maçlar:** 22
- **Bitenler:** 541
- **Başlamayanlar:** 11

### Matematiksel Kontrol:
```
Canlı (22) + Biten (541) + Başlamayan (11) = 574
Günün Maçları = 641
FARK = 641 - 574 = 67 MAÇ EKSİK! ❌
```

---

## 🔍 KÖK SEBEP ANALİZİ

### 1. STATUS FİLTRELEME EKSİKLİĞİ

**Günün Maçları:**
- Endpoint: `/api/matches/diary?date=2026-01-04` (status filtresi YOK)
- Backend: `matchDatabaseService.getMatchesByDate(dbDate, undefined)`
- SQL: Status filtresi olmadan tüm status'ler getiriliyor
- Sonuç: **Tüm status'ler dahil: 0,1,2,3,4,5,7,8,9,10,11,12,13**

**Canlı Maçlar:**
- Endpoint: `/api/matches/live`
- Backend: `matchDatabaseService.getLiveMatches()`
- SQL: `WHERE m.status_id IN (2,3,4,5,7)`
- Sonuç: Sadece live status'ler (FIRST_HALF, HALF_TIME, SECOND_HALF, OVERTIME, PENALTY_SHOOTOUT)

**Bitenler:**
- Endpoint: `/api/matches/diary?date=2026-01-04&status=8`
- Backend: `matchDatabaseService.getMatchesByDate(dbDate, [8])`
- SQL: `WHERE m.status_id = ANY($3)` (status=8)
- Sonuç: Sadece END status

**Başlamayanlar:**
- Endpoint: `/api/matches/diary?date=2026-01-04&status=1`
- Backend: `matchDatabaseService.getMatchesByDate(dbDate, [1])`
- SQL: `WHERE m.status_id = ANY($3)` (status=1)
- Sonuç: Sadece NOT_STARTED status

---

## ❌ EKSİK STATUS'LER

Aşağıdaki status'ler **HİÇBİR SEKMEDE** gösterilmiyor:

| Status ID | Status Name | Açıklama | Gösteriliyor mu? |
|-----------|-------------|----------|------------------|
| 0 | UNKNOWN | Bilinmeyen | ❌ HAYIR |
| 9 | INTERRUPTED | Kesintiye uğradı | ❌ HAYIR |
| 10 | POSTPONED | Ertelendi | ❌ HAYIR |
| 11 | CANCELLED | İptal edildi | ❌ HAYIR |
| 12 | SUSPENDED | Askıya alındı | ❌ HAYIR |
| 13 | DELAYED | Gecikti | ❌ HAYIR |

**Toplam Eksik:** 67 maç (muhtemelen bu status'lerden biri veya birkaçı)

---

## 📝 BACKEND KOD ANALİZİ

### `getMatchDiary` (match.controller.ts:155-250):
```typescript
// Status filtresi parse ediliyor
let statusFilter: number[] | undefined;
if (query.status) {
  statusFilter = query.status.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

// matchDatabaseService'e geçiriliyor
const dbResult = await matchDatabaseService.getMatchesByDate(dbDate, statusFilter);
```

**Sorun:** Status filtresi YOKSA, tüm status'ler getiriliyor (Günün Maçları).

### `getMatchesByDate` (matchDatabase.service.ts:62-199):
```typescript
// Status filtresi varsa SQL'e ekleniyor
if (statusFilter && statusFilter.length > 0) {
  query += ` AND m.status_id = ANY($${params.length + 1})`;
  params.push(statusFilter);
}

// Status filtresi YOKSA, TÜM status'ler getiriliyor
```

**Sorun:** Status filtresi yoksa, status 0, 9, 10, 11, 12, 13 de dahil ediliyor!

### `getLiveMatches` (matchDatabase.service.ts:215-330):
```typescript
// Sadece live status'ler
WHERE m.status_id IN (2, 3, 4, 5, 7)
```

**Sorun:** Sadece live status'ler, diğer status'ler YOK.

---

## 🔧 FRONTEND KOD ANALİZİ

### `MatchList.tsx` (fetchMatches):
```typescript
// Status filtresi sadece finished/not_started için
let statusParam: string | undefined;
if (view === 'finished') {
  statusParam = '8'; // END status
} else if (view === 'not_started') {
  statusParam = '1'; // NOT_STARTED status
}
// For 'diary' view, don't pass status (get all matches)

response = await getMatchDiary(dateStr, statusParam);
```

**Sorun:** "diary" view'ında status filtresi YOK, ama frontend'de bu status'ler için ayrı sekme YOK!

---

## ✅ ÇÖZÜM ÖNERİLERİ

### Çözüm 1: "Diğer Status'ler" Sekmesi Ekle (ÖNERİLEN)

**Backend:**
- `/api/matches/diary?date=2026-01-04&status=0,9,10,11,12,13` endpoint'ini destekle
- Veya `/api/matches/other?date=2026-01-04` endpoint'i ekle

**Frontend:**
- "Diğer" kategorisi ekle
- Status 0, 9, 10, 11, 12, 13 için ayrı sekme veya "Diğer" sekmesi

**Sonuç:**
```
Günün Maçları = Canlı + Biten + Başlamayan + Diğer
641 = 22 + 541 + 11 + 67 ✅
```

### Çözüm 2: "Günün Maçları" Sekmesini Kaldır

- "Günün Maçları" sekmesini kaldır
- Sadece kategorize edilmiş sekmeler göster (Canlı, Biten, Başlamayan, Diğer)

**Dezavantaj:** Kullanıcı tüm maçları tek sekmede göremeyecek.

### Çözüm 3: "Günün Maçları" Sekmesini Filtrele

- "Günün Maçları" sekmesinde sadece status 1, 2, 3, 4, 5, 7, 8 göster
- Status 0, 9, 10, 11, 12, 13'ü "Diğer" sekmesine taşı

**Dezavantaj:** "Günün Maçları" artık "tüm maçlar" olmayacak, kullanıcı şaşırabilir.

---

## 📊 DATABASE KONTROLÜ GEREKLİ

Aşağıdaki SQL sorgusu ile kesin sayıları alabiliriz:

```sql
-- Status dağılımı
SELECT 
  status_id,
  CASE status_id
    WHEN 0 THEN 'UNKNOWN'
    WHEN 1 THEN 'NOT_STARTED'
    WHEN 2 THEN 'FIRST_HALF'
    WHEN 3 THEN 'HALF_TIME'
    WHEN 4 THEN 'SECOND_HALF'
    WHEN 5 THEN 'OVERTIME'
    WHEN 7 THEN 'PENALTY_SHOOTOUT'
    WHEN 8 THEN 'END'
    WHEN 9 THEN 'INTERRUPTED'
    WHEN 10 THEN 'POSTPONED'
    WHEN 11 THEN 'CANCELLED'
    WHEN 12 THEN 'SUSPENDED'
    WHEN 13 THEN 'DELAYED'
    ELSE 'OTHER'
  END as status_name,
  COUNT(*) as count
FROM ts_matches
WHERE DATE(to_timestamp(match_time)) = CURRENT_DATE
GROUP BY status_id
ORDER BY status_id;
```

**Beklenen Sonuç:**
- Status 0, 9, 10, 11, 12, 13 toplamı ≈ 67

---

## 🎯 SONRAKİ ADIMLAR

1. ✅ Database'de status dağılımını kontrol et (SQL sorgusu ile)
2. ✅ "Diğer" kategorisi ekle (backend + frontend)
3. ✅ Sayıların tutarlı olduğunu doğrula
4. ✅ Test et ve deploy et

---

## 🔴 KRİTİK NOT

Bu sorun **VERİ KAYBI DEĞİL**, sadece **GÖSTERİM SORUNU**:
- Tüm maçlar database'de mevcut
- Sadece bazı status'ler hiçbir sekmede gösterilmiyor
- Kullanıcı bu maçları göremez, ama veri kaybı yok

**Ancak kullanıcı deneyimi açısından ÇOK CİDDİ:**
- Kullanıcı 67 maçı göremiyor
- Sayılar tutmuyor (641 ≠ 574)
- Güven problemi yaratıyor
