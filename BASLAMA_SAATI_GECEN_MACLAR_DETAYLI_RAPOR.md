# Başlama Saati Geçen Maçlar - Detaylı Durum Raporu

**Tarih:** 4 Ocak 2026  
**Sorun:** Başlama saati geçen ama status'leri hala "BAŞLAMADI" (status=1) gözüken maçlar

---

## 📊 1. DATABASE DURUMU

### Database Bağlantı Sorunu:
- ❌ PostgreSQL bağlantısı başarısız (Connection refused)
- ⚠️ VPS üzerinden doğrudan kontrol edilemedi

### Beklenen Database Durumu:
```sql
-- Başlama saati geçen ama status=1 olan maçlar
SELECT COUNT(*) as should_be_live_count 
FROM ts_matches 
WHERE status_id = 1 
  AND match_time <= EXTRACT(EPOCH FROM NOW())::bigint 
  AND match_time >= EXTRACT(EPOCH FROM NOW() - interval '24 hours')::bigint;

-- Gerçekten canlı olan maçlar
SELECT COUNT(*) as live_count 
FROM ts_matches 
WHERE status_id IN (2,3,4,5,7) 
  AND match_time >= EXTRACT(EPOCH FROM NOW() - interval '4 hours')::bigint 
  AND match_time <= EXTRACT(EPOCH FROM NOW())::bigint;
```

**Sonuç:** Database bağlantısı olmadığı için gerçek sayılar alınamadı.

---

## 🔧 2. BACKEND DURUMU

### 2.1 Endpoint: `/api/matches/live`

**Dosya:** `src/controllers/match.controller.ts` (line 773)

**Ne Yapıyor:**
```typescript
export const getLiveMatches = async (request, reply) => {
  const dbResult = await matchDatabaseService.getLiveMatches();
  // ...
}
```

**Çağırdığı Service:** `matchDatabaseService.getLiveMatches()`

### 2.2 Service: `matchDatabaseService.getLiveMatches()`

**Dosya:** `src/services/thesports/match/matchDatabase.service.ts` (line 215)

**SQL Query:**
```sql
WHERE m.status_id IN (2, 3, 4, 5, 7)  -- SADECE gerçekten canlı maçlar
  AND m.match_time >= $1  -- Son 4 saat
  AND m.match_time <= $2  -- Gelecek değil
```

**SORUN:** 
- ❌ Query **SADECE** `status_id IN (2,3,4,5,7)` olan maçları getiriyor
- ❌ **"Should be live" maçlar (status=1, match_time geçmiş) GETİRMİYOR!**

### 2.3 MatchWatchdogWorker

**Dosya:** `src/jobs/matchWatchdog.job.ts`

**Ne Yapıyor:**
- `findShouldBeLiveMatches()` çağrılıyor (status=1, match_time geçmiş maçları buluyor)
- Bu maçları reconcile edip status'lerini `1 → 2` (FIRST_HALF) olarak güncellemeye çalışıyor
- Her **10 saniyede** bir çalışıyor
- Limit: **1000 maç**

**Syntax Hatası:**
```
ERROR: Unexpected "catch" at line 545
```

**Log Çıktısı:**
```
2026-01-04 20:28:28 [info]: [LiveReconcile] Enqueued 20 matches for reconciliation.
```

**Sorun:**
- ⚠️ MatchWatchdogWorker syntax hatası var (line 545)
- ⚠️ Worker çalışıyor gibi görünüyor ama tam olarak çalışmıyor olabilir
- ⚠️ Reconcile işlemi başarısız olabilir (API hatası, rate limit, vb.)

---

## 🖥️ 3. FRONTEND DURUMU

### 3.1 Endpoint Kullanımı

**Dosya:** `frontend/src/api/matches.ts` (line 191)

**Endpoint:** `/api/matches/live`

**Kod:**
```typescript
export async function getLiveMatches(): Promise<MatchDiaryResponse> {
  const url = `${API_BASE_URL}/matches/live`;
  const response = await retryFetch(url, { signal: controller.signal });
  // ...
}
```

**Kullanıldığı Yer:**
- `MatchList.tsx` (line 49): `view === 'live'` olduğunda çağrılıyor
- `MatchDetailPage.tsx` (line 65): Canlı maç detayı için çağrılıyor

### 3.2 Frontend Filtreleme

**Dosya:** `frontend/src/components/MatchList.tsx` (line 123)

**Kod:**
```typescript
if (view === 'live') {
  filteredResults = results.filter((match: Match) => {
    const status = match.status ?? 0;
    return isLiveMatch(status); // status IN (2,3,4,5,7)
  });
}
```

**Sonuç:**
- ✅ Frontend doğru endpoint'e istek atıyor (`/api/matches/live`)
- ✅ Frontend'de ekstra filtreleme yapılıyor (ama backend zaten filtrelenmiş veri gönderiyor)
- ❌ **Sorun frontend'de DEĞİL, backend'de!**

---

## 🔍 4. SORUNUN KÖKÜ

### Ana Sorun:

**Backend `getLiveMatches()` query'si sadece `status_id IN (2,3,4,5,7)` olan maçları getiriyor.**

**"Should be live" maçlar (status=1, match_time geçmiş) bu query'de YOK!**

### Neden Status'ler Güncellenmiyor?

1. **MatchWatchdogWorker Syntax Hatası:**
   - Line 545'te syntax hatası var
   - Worker tam olarak çalışmıyor olabilir

2. **Reconcile İşlemi Başarısız:**
   - API hatası olabilir
   - Rate limit'e takılabilir
   - Optimistic locking nedeniyle güncelleme reddedilebilir

3. **Worker Yeterince Agresif Değil:**
   - Her 10 saniyede çalışıyor (biraz gecikme olabilir)
   - Limit 1000 maç (daha fazla maç varsa kaçırılabilir)

---

## 📝 5. ÇÖZÜM ÖNERİLERİ

### Çözüm 1: Backend Query'sine "Should Be Live" Maçları Ekle (ÖNERİLEN)

**Değişiklik:**
```sql
WHERE (
  -- Gerçekten canlı maçlar
  (m.status_id IN (2, 3, 4, 5, 7) AND m.match_time >= $1 AND m.match_time <= $2)
  OR
  -- Should be live maçlar (status=1 ama match_time geçmiş)
  (m.status_id = 1 AND m.match_time <= $2 AND m.match_time >= $1)
)
```

**Avantajlar:**
- ✅ Kullanıcı anında "should be live" maçları görür
- ✅ MatchWatchdogWorker'a bağımlı değil
- ✅ Daha doğru sayı gösterilir

### Çözüm 2: MatchWatchdogWorker Syntax Hatasını Düzelt

**Önce syntax hatasını düzelt, sonra test et.**

**Değişiklik:**
- Line 545'teki syntax hatasını düzelt
- Worker'ın düzgün çalıştığından emin ol

---

## ✅ SONUÇ

### Sorun Nerede?

1. **Backend Query:** ❌ "Should be live" maçları getirmiyor
2. **MatchWatchdogWorker:** ⚠️ Syntax hatası var, tam çalışmıyor olabilir
3. **Frontend:** ✅ Doğru endpoint'e istek atıyor, sorun yok

### Önerilen Çözüm:

**1. Önce MatchWatchdogWorker syntax hatasını düzelt**
**2. Sonra backend query'sine "should be live" maçları ekle**

---

## 🔧 YAPILACAKLAR

1. ✅ MatchWatchdogWorker syntax hatasını düzelt (line 545)
2. ✅ Backend `getLiveMatches()` query'sine "should be live" maçları ekle
3. ✅ Test et
4. ✅ Database'de gerçek sayıları kontrol et (bağlantı düzeldikten sonra)

