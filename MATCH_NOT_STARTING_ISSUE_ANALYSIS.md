# Maç Başlamama Sorunu - Tespit Raporu

## 🔍 Tespit Edilen Olası Sorunlar

### **SORUN 1: `/match/detail_live` Maçı Bulamıyor**

**Kod:** `src/services/thesports/match/matchDetailLive.service.ts:438-453`

**Sorun:**
```typescript
if (live.statusId === null && live.homeScoreDisplay === null && live.awayScoreDisplay === null) {
  if (providerUpdateTimeOverride !== null) {
    // Minimal update yap
  } else {
    return { updated: false, rowCount: 0, statusId: null, score: null };
  }
}
```

**Açıklama:**
- `/match/detail_live` endpoint'i çağrılıyor
- `extractLiveFields()` maçı bulamıyor (`unwrapResults` null döner)
- `live.statusId === null` oluyor
- `providerUpdateTimeOverride` yoksa → **Update yapılmıyor!**

**Neden Olabilir:**
- TheSports'ta maç farklı ID ile kayıtlı
- Maç henüz TheSports sistemine eklenmemiş
- Response formatı beklenenden farklı

---

### **SORUN 2: Diary Fallback'te Status Kontrolü Yanlış**

**Kod:** `src/jobs/proactiveMatchStatusCheck.job.ts:166`

**Sorun:**
```typescript
const statusChanged = diaryStatusId !== null && diaryStatusId !== 1 && diaryStatusId !== existing.status_id;
```

**Açıklama:**
- `diaryStatusId !== 1` şartı var
- Eğer diary'de de `status_id = 1` ise → **Update yapılmıyor!**
- Ama maç başlamış olabilir, sadece diary'de henüz güncellenmemiş

**Çözüm Gerekiyor:**
- Diary fallback'te `status_id = 1` olsa bile, eğer `match_time` geçmişse ve provider'dan başka bilgi (score, minute) geliyorsa update yapılmalı

---

### **SORUN 3: ProactiveMatchStatusCheckWorker Query'si**

**Kod:** `src/jobs/proactiveMatchStatusCheck.job.ts:74-78`

**Query:**
```sql
WHERE match_time >= $1  -- todayStartTSI
  AND match_time < $2   -- todayEndTSI
  AND status_id = 1     -- NOT_STARTED
  AND match_time <= $3  -- nowTs
```

**Potansiyel Sorun:**
- `match_time` UTC mi TSİ mi? Kontrol edilmeli
- `todayStartTSI` TSİ bazlı hesaplanıyor ama `match_time` UTC olabilir
- Eğer `match_time` UTC ise ve `todayStartTSI` TSİ ise → **Maç bulunamayabilir!**

---

### **SORUN 4: Optimistic Locking Bypass Sadece Critical Transition İçin**

**Kod:** `src/services/thesports/match/matchDetailLive.service.ts:490-513`

**Sorun:**
- Critical transition (1→2) için optimistic locking bypass var ✅
- Ama eğer `live.statusId === null` ise (maç bulunamadı), zaten update yapılmıyor
- Bu durumda bypass hiç çalışmıyor

---

## 🎯 En Olası Sorun

**SORUN 2 + SORUN 1 kombinasyonu:**

1. `/match/detail_live` maçı bulamıyor → `live.statusId === null`
2. Fallback olarak `/match/diary` kullanılıyor
3. Diary'de `status_id = 1` geliyor (henüz güncellenmemiş)
4. `statusChanged = false` (çünkü `diaryStatusId === 1`)
5. **Update yapılmıyor!**

---

## 🔧 Çözüm Önerileri

### **Çözüm 1: Diary Fallback'te Status Kontrolünü Düzelt**

**Mevcut Kod:**
```typescript
const statusChanged = diaryStatusId !== null && diaryStatusId !== 1 && diaryStatusId !== existing.status_id;
```

**Düzeltilmiş Kod:**
```typescript
// Eğer match_time geçmişse ve status hala 1 ise, provider'dan gelen status'u kabul et
const matchTimePassed = match.match_time <= nowTs;
const statusChanged = 
  (diaryStatusId !== null && diaryStatusId !== 1 && diaryStatusId !== existing.status_id) ||
  (matchTimePassed && diaryStatusId !== null && diaryStatusId !== existing.status_id && existing.status_id === 1);
```

### **Çözüm 2: extractLiveFields'da Daha İyi Fallback**

Eğer maç bulunamazsa, response'un tamamını logla ve farklı formatları dene.

### **Çözüm 3: match_time Timezone Kontrolü**

`match_time` UTC mi TSİ mi kontrol et ve query'yi buna göre düzelt.

---

## 📊 Test Edilmesi Gerekenler

1. Bu maçın `external_id`'si nedir?
2. Database'de `match_time` değeri nedir? (UTC mi TSİ mi?)
3. `/match/detail_live` endpoint'i bu maç için ne döndürüyor?
4. `/match/diary` endpoint'i bu maç için ne döndürüyor?
5. ProactiveMatchStatusCheckWorker bu maçı buluyor mu? (Query sonucu)


