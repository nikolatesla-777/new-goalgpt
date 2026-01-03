# Canlı Maç Sayısı Tutarsızlığı - Before/After Analiz Raporu

**Tarih:** 3 Ocak 2026  
**Durum:** 🟡 **İYİLEŞTİRME YAPILDI - TEST EDİLMELİ**  
**URL:** https://partnergoalgpt.com/livescore

---

## 📊 EXECUTIVE SUMMARY

**Sorun:** Canlı maç sayısı sürekli değişiyordu (93 → 76 → 69) - Fiziksel olarak imkansız bir durum.

**Durum:** Kullanıcı 1-2 işlem yaptı, durum iyileşti gibi görünüyor. Detaylı analiz ve öneriler aşağıda.

---

## 🔴 BEFORE (ÖNCEKİ DURUM)

### 1. Frontend - WebSocket + Polling Çakışması

**Sorun:**
```typescript
// ❌ ÖNCEKİ DURUM
// WebSocket event geldiğinde hemen fetchMatches() çağrılıyordu
ws.onmessage = (event) => {
  if (message.type === 'GOAL' || message.type === 'SCORE_CHANGE') {
    fetchMatches(); // ❌ Hemen çağrılıyor - Race condition
  }
};

// Polling her 10 saniyede bir çalışıyordu
setInterval(() => {
  fetchMatches(); // ❌ WebSocket ile çakışma riski
}, 10000);
```

**Sonuç:**
- WebSocket event ve polling aynı anda `fetchMatches()` çağırıyordu
- İki istek aynı anda çalışıyordu → Race condition
- Frontend'de sayı tutarsız görünüyordu

---

### 2. Backend - Database Query Non-Atomic

**Sorun:**
```typescript
// ❌ ÖNCEKİ DURUM
// Query çalışırken worker'lar status güncelleyebilir
const query = `
  SELECT ... FROM ts_matches
  WHERE status_id IN (2, 3, 4, 5, 7)
`;

const result = await pool.query(query);
// ❌ Query sırasında status değişebilir
// ❌ Zaman filtresi yok - Eski maçlar da query'ye giriyor
```

**Sonuç:**
- Query sırasında worker'lar status güncelleyebilir
- Eski maçlar (24 saat önce başlayan) query'ye giriyordu
- Non-atomic read → Tutarsız sonuçlar

---

### 3. Worker Koordinasyonu Eksik

**Sorun:**
```typescript
// ❌ ÖNCEKİ DURUM
// 4 farklı worker aynı anda status güncelleyebilir
// WebSocket Service (anlık)
// DataUpdateWorker (her 20 saniye)
// MatchWatchdogWorker (her 60 saniye)
// MatchSyncWorker (her 1 dakika)

// ❌ Lock mekanizması YOK
// ❌ Optimistic locking var ama yeterli değil
```

**Sonuç:**
- Aynı maç için birden fazla worker aynı anda güncelleme yapabilir
- Race condition riski yüksek

---

### 4. Frontend - Çift Filtreleme

**Sorun:**
```typescript
// ❌ ÖNCEKİ DURUM
// Backend zaten sadece canlı maçları döndürüyor
// Frontend tekrar filtreliyor
if (view === 'live') {
  filteredResults = results.filter((match: Match) => {
    return isLiveMatch(status); // ❌ Gereksiz filtreleme
  });
}
```

**Sonuç:**
- Gereksiz performans kaybı
- Asıl sorun değil ama optimize edilebilir

---

## ✅ AFTER (MEVCUT DURUM - İYİLEŞTİRİLMİŞ)

### 1. Frontend - WebSocket + Polling Koordinasyonu ✅

**İyileştirme:**
```typescript
// ✅ MEVCUT DURUM
// Debounce mekanizması eklendi
const debounceTimerRef = useRef<number | null>(null);

ws.onmessage = (event) => {
  if (message.type === 'GOAL' || message.type === 'SCORE_CHANGE' || message.type === 'MATCH_STATE_CHANGE') {
    // ✅ Debounce timer temizleniyor
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    
    // ✅ 500ms debounce ile fetchMatches() çağrılıyor
    debounceTimerRef.current = window.setTimeout(() => {
      fetchRef.current();
      debounceTimerRef.current = null;
    }, 500);
  }
};

// ✅ Polling sırasında WebSocket debounce kontrolü
setInterval(() => {
  if (debounceTimerRef.current === null) {
    // ✅ Sadece debounce aktif değilse polling yap
    fetchMatches();
  } else {
    console.log('[MatchList] Skipping polling cycle - WebSocket debounce active');
  }
}, 15000); // ✅ Polling süresi 10s → 15s artırıldı
```

**Sonuç:**
- ✅ WebSocket event'leri debounce ile batch'leniyor
- ✅ Polling ve WebSocket çakışmıyor
- ✅ Race condition riski azaldı

---

### 2. Backend - Database Query İyileştirmeleri ✅

**İyileştirme:**
```typescript
// ✅ MEVCUT DURUM
// Sadece canlı maçlar döndürülüyor (status 2,3,4,5,7)
const query = `
  SELECT ... FROM ts_matches m
  WHERE m.status_id IN (2, 3, 4, 5, 7)  -- ✅ Sadece canlı maçlar
  ORDER BY ...
`;

// ✅ Cache disabled - Her zaman fresh data
// ✅ API fallback removed - DB is authoritative
```

**Sonuç:**
- ✅ Sadece canlı maçlar döndürülüyor
- ✅ Cache disabled - Stale data yok
- ✅ API fallback removed - DB single source of truth

**⚠️ EKSİK:** Zaman filtresi hala yok - Eski maçlar query'ye girebilir

---

### 3. Frontend - Overlapping Request Prevention ✅

**İyileştirme:**
```typescript
// ✅ MEVCUT DURUM
const isFetchingRef = useRef(false);

const fetchMatches = useCallback(async () => {
  // ✅ Overlapping request kontrolü
  if (isFetchingRef.current) return;
  isFetchingRef.current = true;
  
  try {
    // ... fetch logic
  } finally {
    isFetchingRef.current = false;
  }
}, [view, date]);
```

**Sonuç:**
- ✅ Aynı anda birden fazla request engelleniyor
- ✅ Race condition riski azaldı

---

### 4. Frontend - Error Handling İyileştirmeleri ✅

**İyileştirme:**
```typescript
// ✅ MEVCUT DURUM
// Hata durumunda mevcut maçları koru
catch (err: any) {
  setError(errorMessage);
  // ✅ setMatches([]) çağrılmıyor - Mevcut data korunuyor
}
```

**Sonuç:**
- ✅ Hata durumunda sayı sıfırlanmıyor
- ✅ Kullanıcı deneyimi iyileşti

---

## 🔍 MEVCUT DURUM ANALİZİ

### ✅ İYİLEŞTİRİLENLER:

1. **WebSocket + Polling Koordinasyonu:**
   - ✅ Debounce mekanizması eklendi (500ms)
   - ✅ Polling sırasında WebSocket debounce kontrolü
   - ✅ Race condition riski azaldı

2. **Overlapping Request Prevention:**
   - ✅ `isFetchingRef` ile aynı anda birden fazla request engelleniyor
   - ✅ Race condition riski azaldı

3. **Error Handling:**
   - ✅ Hata durumunda mevcut data korunuyor
   - ✅ Kullanıcı deneyimi iyileşti

4. **Backend Query:**
   - ✅ Sadece canlı maçlar döndürülüyor
   - ✅ Cache disabled
   - ✅ API fallback removed

---

### ⚠️ HALA EKSİK OLANLAR:

1. **Database Query Zaman Filtresi:**
   ```typescript
   // ❌ EKSİK: Zaman filtresi yok
   // Eski maçlar (24 saat önce başlayan) query'ye girebilir
   WHERE m.status_id IN (2, 3, 4, 5, 7)
   // ✅ ÖNERİLEN:
   WHERE m.status_id IN (2, 3, 4, 5, 7)
     AND m.match_time >= $1  -- Son 4 saat
     AND m.match_time <= $2  -- Şimdi
   ```

2. **Frontend Çift Filtreleme:**
   ```typescript
   // ⚠️ HALA VAR: Gereksiz filtreleme
   if (view === 'live') {
     filteredResults = results.filter((match: Match) => {
       return isLiveMatch(status); // Backend zaten doğru döndürüyor
     });
   }
   ```

3. **Worker Koordinasyonu:**
   - ⚠️ Match-level locking yok
   - ⚠️ Status update queue yok
   - ⚠️ Optimistic locking var ama yeterli değil

4. **Debounce Süresi:**
   ```typescript
   // ⚠️ MEVCUT: 500ms
   // ✅ ÖNERİLEN: 2000ms (daha güvenli)
   debounceTimerRef.current = window.setTimeout(() => {
     fetchRef.current();
   }, 2000); // 500ms → 2000ms
   ```

---

## 🎯 ÖNERİLEN İYİLEŞTİRMELER

### 1. Database Query'ye Zaman Filtresi Ekle (ÖNCELİK: YÜKSEK)

**Dosya:** `src/services/thesports/match/matchDatabase.service.ts`

**Değişiklik:**
```typescript
// BEFORE
const query = `
  SELECT ... FROM ts_matches m
  WHERE m.status_id IN (2, 3, 4, 5, 7)
`;

// AFTER
const nowTs = Math.floor(Date.now() / 1000);
const fourHoursAgo = nowTs - (4 * 3600); // Son 4 saat

const query = `
  SELECT ... FROM ts_matches m
  WHERE m.status_id IN (2, 3, 4, 5, 7)
    AND m.match_time >= $1  -- Son 4 saat içinde başlayan maçlar
    AND m.match_time <= $2  -- Gelecekteki maçlar hariç
`;

const result = await pool.query(query, [fourHoursAgo, nowTs]);
```

**Etki:**
- ✅ Eski maçlar query'den çıkar
- ✅ Query performansı artar
- ✅ Tutarsızlık riski azalır

---

### 2. Frontend Debounce Süresini Artır (ÖNCELİK: ORTA)

**Dosya:** `frontend/src/components/MatchList.tsx`

**Değişiklik:**
```typescript
// BEFORE
debounceTimerRef.current = window.setTimeout(() => {
  fetchRef.current();
}, 500); // 500ms

// AFTER
debounceTimerRef.current = window.setTimeout(() => {
  fetchRef.current();
}, 2000); // 2000ms (2 saniye)
```

**Etki:**
- ✅ WebSocket event'leri daha iyi batch'lenir
- ✅ Race condition riski daha da azalır
- ⚠️ Güncelleme gecikmesi artabilir (kabul edilebilir)

---

### 3. Frontend Çift Filtrelemeyi Kaldır (ÖNCELİK: DÜŞÜK)

**Dosya:** `frontend/src/components/MatchList.tsx`

**Değişiklik:**
```typescript
// BEFORE
if (view === 'live') {
  filteredResults = results.filter((match: Match) => {
    const status = match.status ?? 0;
    return isLiveMatch(status); // Gereksiz
  });
}

// AFTER
if (view === 'live') {
  // Backend zaten sadece canlı maçları döndürüyor
  filteredResults = results; // Filtreleme yok
}
```

**Etki:**
- ✅ Performans iyileşir (küçük)
- ✅ Kod basitleşir

---

### 4. Worker Koordinasyonu (ÖNCELİK: ORTA - UZUN VADELİ)

**Dosya:** Yeni dosya oluştur: `src/utils/matchLockManager.ts`

**Değişiklik:**
```typescript
// YENİ: Match-level lock mekanizması
class MatchLockManager {
  private locks: Map<string, { worker: string; timestamp: number }> = new Map();
  
  async acquireLock(matchId: string, worker: string, timeout: number = 5000): Promise<boolean> {
    const existing = this.locks.get(matchId);
    
    if (existing) {
      if (Date.now() - existing.timestamp > timeout) {
        this.locks.delete(matchId);
      } else {
        return false; // Lock hala aktif
      }
    }
    
    this.locks.set(matchId, { worker, timestamp: Date.now() });
    return true;
  }
  
  releaseLock(matchId: string): void {
    this.locks.delete(matchId);
  }
}

// Worker'larda kullanım:
const lockManager = new MatchLockManager();

async function updateMatch(matchId: string) {
  const lockAcquired = await lockManager.acquireLock(matchId, 'DataUpdateWorker');
  
  if (!lockAcquired) {
    logger.debug(`[DataUpdate] Match ${matchId} is locked, skipping`);
    return;
  }
  
  try {
    await updateMatchInDatabase(matchId);
  } finally {
    lockManager.releaseLock(matchId);
  }
}
```

**Etki:**
- ✅ Worker'lar aynı maç için çakışmaz
- ✅ Race condition riski minimize olur
- ⚠️ Implementasyon zaman alır

---

## 📊 KARŞILAŞTIRMA TABLOSU

| Özellik | BEFORE | AFTER | İYİLEŞTİRME |
|---------|--------|-------|-------------|
| **WebSocket Debounce** | ❌ Yok | ✅ 500ms | ✅ İyileşti |
| **Polling + WebSocket Koordinasyonu** | ❌ Yok | ✅ Var | ✅ İyileşti |
| **Overlapping Request Prevention** | ❌ Yok | ✅ Var | ✅ İyileşti |
| **Error Handling** | ❌ Data kaybı | ✅ Data korunuyor | ✅ İyileşti |
| **Database Query Zaman Filtresi** | ❌ Yok | ❌ Hala yok | ⚠️ Eksik |
| **Frontend Çift Filtreleme** | ❌ Var | ❌ Hala var | ⚠️ Eksik |
| **Worker Koordinasyonu** | ❌ Yok | ❌ Hala yok | ⚠️ Eksik |
| **Debounce Süresi** | ❌ Yok | ⚠️ 500ms (kısa) | ⚠️ Artırılabilir |

---

## 🎯 SONUÇ VE ÖNERİLER

### ✅ YAPILAN İYİLEŞTİRMELER:

1. **WebSocket + Polling Koordinasyonu:** ✅ İyileşti
2. **Overlapping Request Prevention:** ✅ İyileşti
3. **Error Handling:** ✅ İyileşti
4. **Backend Query:** ✅ İyileşti (cache disabled, API fallback removed)

### ⚠️ HALA YAPILMASI GEREKENLER:

1. **Database Query Zaman Filtresi:** 🔴 YÜKSEK ÖNCELİK
   - Eski maçları query'den çıkar
   - Query performansını artır
   - Tutarsızlık riskini azalt

2. **Frontend Debounce Süresini Artır:** 🟡 ORTA ÖNCELİK
   - 500ms → 2000ms
   - Race condition riskini daha da azalt

3. **Frontend Çift Filtrelemeyi Kaldır:** 🟢 DÜŞÜK ÖNCELİK
   - Performans iyileştirmesi (küçük)
   - Kod basitleştirmesi

4. **Worker Koordinasyonu:** 🟡 ORTA ÖNCELİK (UZUN VADELİ)
   - Match-level locking
   - Status update queue
   - Daha kompleks implementasyon

---

## 📋 TEST SENARYOLARI

### Senaryo 1: Normal Durum (İYİLEŞTİRİLMİŞ)
```
1. Frontend polling yaptı → 93 maç geldi
2. WebSocket event geldi → Debounce başladı (500ms)
3. Polling cycle geldi → Debounce aktif, polling skip edildi
4. Debounce bitti → fetchMatches() çağrıldı → 93 maç geldi
5. ✅ TUTARLI (WebSocket + Polling çakışmıyor)
```

### Senaryo 2: Maç Bitti (İYİLEŞTİRİLMİŞ)
```
1. Frontend polling yaptı → 93 maç geldi
2. Maç bitti (status 2 → 8)
3. WebSocket event geldi → Debounce başladı
4. Debounce bitti → fetchMatches() çağrıldı → 92 maç geldi
5. ✅ TUTARLI (sayı azalması normal, çakışma yok)
```

### Senaryo 3: Race Condition (HALA RİSK VAR)
```
1. Frontend polling başladı → Query çalışıyor
2. WebSocket event geldi → Match A: status 2 → 8
3. Query devam ediyor → Match A query'den çıktı
4. Query bitti → 92 maç geldi
5. ⚠️ HALA RİSK: Query sırasında status değişebilir
```

---

## 🔗 İLGİLİ DOSYALAR

- `src/services/thesports/match/matchDatabase.service.ts` - getLiveMatches()
- `frontend/src/components/MatchList.tsx` - fetchMatches() ve polling
- `src/services/thesports/websocket/websocket.service.ts` - updateMatchStatusInDatabase()
- `src/jobs/dataUpdate.job.ts` - checkUpdates()
- `src/jobs/matchWatchdog.job.ts` - tick()
- `src/jobs/matchSync.job.ts` - reconcileLiveMatches()

---

**Rapor Tarihi:** 3 Ocak 2026  
**Hazırlayan:** AI Architect Assistant  
**Durum:** 🟡 **İYİLEŞTİRME YAPILDI - TEST EDİLMELİ**

**Sonraki Adımlar:**
1. Database query'ye zaman filtresi ekle
2. Frontend debounce süresini artır (500ms → 2000ms)
3. Frontend çift filtrelemeyi kaldır
4. Worker koordinasyonu ekle (uzun vadeli)

