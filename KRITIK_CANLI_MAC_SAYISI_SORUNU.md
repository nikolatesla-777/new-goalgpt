# KRİTİK SORUN: Canlı Maç Sayısı Tutarsızlığı

**Tarih:** 3 Ocak 2026  
**Durum:** 🔴 **KRİTİK - ACİL DÜZELTME GEREKLİ**  
**Sorun:** Canlı maç sayısı sürekli değişiyor (93 → 76 → 69) - Bu kadar kısa sürede bu kadar değişiklik olmamalı

---

## 🎯 SORUN TANIMI

**Kullanıcı Gözlemi:**
- Sayfa açıkken canlı maç sayısı kendiliğinden değişiyor
- 93 maç → 76 maç → 69 maç (birkaç saniye içinde)
- Bu kadar kısa sürede bu kadar değişiklik **FİZİKSEL OLARAK İMKANSIZ**

**Beklenen Davranış:**
- Canlı maç sayısı sadece gerçek maç başlamaları/bitişleri ile değişmeli
- Sayfa açıkken sayı sabit kalmalı (maç bitene kadar)

---

## 🔍 KÖK NEDEN ANALİZİ

### 1. RACE CONDITION (EN BÜYÜK SORUN) ⚠️

**Sorun:**
4 farklı worker aynı anda status güncelleyebilir:

```
T0: WebSocket → Match A: status_id 2 → 8 (END)
T1: DataUpdateWorker → Match B: status_id 2 → 8 (END)  
T2: MatchWatchdogWorker → Match C: status_id 1 → 2 (FIRST_HALF)
T3: MatchSyncWorker → Match D: status_id 2 → 3 (HALF_TIME)
```

**Sonuç:**
- Frontend polling sırasında farklı sayıda maç görebilir
- Query sırasında status değişiyor (non-atomic read)

**Kod İncelemesi:**
```typescript
// src/services/thesports/match/matchDatabase.service.ts:266
WHERE m.status_id IN (2, 3, 4, 5, 7)  // Query çalışırken status değişebilir
```

**Sorun:** Database query **non-atomic** - Query sırasında worker'lar status güncelleyebilir

---

### 2. WEBSOCKET + POLLING ÇAKIŞMASI ⚠️

**Sorun:**
- WebSocket event geldiğinde `fetchMatches()` çağrılıyor
- Aynı anda polling de çalışıyor (her 15 saniye)
- İki istek aynı anda çalışıyor → Race condition

**Kod:**
```typescript
// frontend/src/components/MatchList.tsx:307-310
debounceTimerRef.current = window.setTimeout(() => {
  fetchRef.current(); // WebSocket event → fetchMatches()
  debounceTimerRef.current = null;
}, 500);

// frontend/src/components/MatchList.tsx:349-357
const interval = setInterval(() => {
  if (debounceTimerRef.current === null) {
    fetchMatches(); // Polling → fetchMatches()
  }
}, pollInterval);
```

**Sorun:** Debounce 500ms ama polling 15 saniye - Hala çakışma olabilir

---

### 3. FRONTEND'DE ÇİFT FİLTRELEME ⚠️

**Sorun:**
- Backend zaten sadece canlı maçları (status 2,3,4,5,7) döndürüyor
- Frontend tekrar `isLiveMatch()` ile filtreliyor
- Bu gereksiz ama zararsız (sadece performans kaybı)

**Kod:**
```typescript
// frontend/src/components/MatchList.tsx:107-111
if (view === 'live') {
  filteredResults = results.filter((match: Match) => {
    const status = match.status ?? 0;
    return isLiveMatch(status); // Gereksiz filtreleme
  });
}
```

**Sorun:** Gereksiz filtreleme ama asıl sorun değil

---

### 4. WORKER KOORDİNASYONU EKSİK ❌

**Sorun:**
- Worker'lar arasında explicit lock mekanizması YOK
- Aynı maç için birden fazla worker aynı anda güncelleme yapabilir
- Optimistic locking var ama yeterli değil

**Kod:**
```typescript
// src/services/thesports/websocket/websocket.service.ts:591-612
private async updateMatchStatusInDatabase(matchId: string, statusId: number, ...) {
  // Optimistic locking check
  const freshnessCheck = await this.shouldApplyUpdate(client, matchId, providerUpdateTime);
  if (!freshnessCheck.apply) {
    return; // Stale update, skip
  }
  
  // UPDATE query - Ama başka worker da aynı anda güncelleyebilir
  await client.query(`UPDATE ts_matches SET status_id = $1 ...`);
}
```

**Sorun:** Optimistic locking race condition'ı önlüyor ama **çakışmayı tamamen önlemiyor**

---

### 5. DATABASE QUERY TIMING ⚠️

**Sorun:**
- Database query çalışırken worker'lar status güncelleyebilir
- Query sonuçları tutarsız olabilir

**Senaryo:**
```
T0: Query başladı → SELECT * FROM ts_matches WHERE status_id IN (2,3,4,5,7)
T1: WebSocket → Match A: status_id 2 → 8 (END) → Query'den çıktı
T2: Query devam ediyor → Match B: status_id 1 → 2 (FIRST_HALF) → Query'ye girdi
T3: Query bitti → Sonuç: 93 maç (ama gerçekte 92 olmalıydı)
```

**Sorun:** Non-atomic read - Query sırasında status değişiyor

---

## 🔧 ÇÖZÜM ÖNERİLERİ

### 1. DATABASE QUERY'YE SNAPSHOT İZOLASYONU ✅

**Sorun:** Query sırasında status değişiyor

**Çözüm:**
```typescript
// src/services/thesports/match/matchDatabase.service.ts:220-272
// Transaction ile snapshot isolation
const query = `
  BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  
  SELECT ... FROM ts_matches
  WHERE status_id IN (2, 3, 4, 5, 7)
  
  COMMIT;
`;
```

**Veya daha basit:**
```typescript
// Query'yi daha hızlı yap (index kullan)
// Status değişikliklerini minimize et (worker koordinasyonu)
```

---

### 2. WORKER KOORDİNASYONU (MATCH-LEVEL LOCKING) ✅

**Sorun:** Worker'lar aynı anda status güncelleyebilir

**Çözüm:**
```typescript
// YENİ: Match-level lock mekanizması
class MatchLockManager {
  private locks: Map<string, { worker: string; timestamp: number }> = new Map();
  
  async acquireLock(matchId: string, worker: string, timeout: number = 5000): Promise<boolean> {
    const existing = this.locks.get(matchId);
    
    if (existing) {
      // Lock var, timeout kontrolü yap
      if (Date.now() - existing.timestamp > timeout) {
        this.locks.delete(matchId);
      } else {
        return false; // Lock hala aktif
      }
    }
    
    // Lock al
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
    logger.debug(`[DataUpdate] Match ${matchId} is locked by another worker, skipping`);
    return;
  }
  
  try {
    await updateMatchInDatabase(matchId);
  } finally {
    lockManager.releaseLock(matchId);
  }
}
```

---

### 3. FRONTEND'DE DEBOUNCE İYİLEŞTİRME ✅

**Sorun:** WebSocket + Polling çakışması

**Çözüm:**
```typescript
// frontend/src/components/MatchList.tsx
// Debounce süresini artır (500ms → 2000ms)
debounceTimerRef.current = window.setTimeout(() => {
  fetchRef.current();
  debounceTimerRef.current = null;
}, 2000); // 2 saniye debounce

// Polling sırasında WebSocket event'lerini ignore et
const interval = setInterval(() => {
  // WebSocket debounce aktifse polling'i skip et
  if (debounceTimerRef.current === null) {
    fetchMatches();
  }
}, pollInterval);
```

---

### 4. DATABASE QUERY'YE ZAMAN FİLTRESİ EKLE ✅

**Sorun:** Eski maçlar query'ye giriyor olabilir

**Çözüm:**
```typescript
// src/services/thesports/match/matchDatabase.service.ts:220-272
const query = `
  SELECT ... FROM ts_matches m
  WHERE m.status_id IN (2, 3, 4, 5, 7)
    AND m.match_time >= $1  -- Son 4 saat içinde başlayan maçlar
    AND m.match_time <= $2  -- Gelecekteki maçlar hariç
  ORDER BY ...
`;

const nowTs = Math.floor(Date.now() / 1000);
const fourHoursAgo = nowTs - (4 * 3600);
const result = await pool.query(query, [fourHoursAgo, nowTs]);
```

---

### 5. STATUS GÜNCELLEMELERİNİ SIRALI YAP ✅

**Sorun:** Worker'lar aynı anda status güncelleyebilir

**Çözüm:**
```typescript
// Status güncellemelerini sıralı yap (queue-based)
class StatusUpdateQueue {
  private queue: Array<{ matchId: string; statusId: number; worker: string }> = [];
  private processing = false;
  
  async enqueue(matchId: string, statusId: number, worker: string): Promise<void> {
    this.queue.push({ matchId, statusId, worker });
    await this.process();
  }
  
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        await this.updateStatus(item.matchId, item.statusId, item.worker);
      }
    }
    this.processing = false;
  }
}
```

---

## 📊 SORUN ÖNCELİK SIRASI

| Sorun | Öncelik | Etki | Çözüm Zorluğu |
|-------|---------|------|---------------|
| **Race Condition** | 🔴 KRİTİK | Yüksek | Orta |
| **WebSocket + Polling Çakışması** | 🔴 KRİTİK | Yüksek | Düşük |
| **Database Query Timing** | 🟡 YÜKSEK | Orta | Düşük |
| **Worker Koordinasyonu** | 🟡 YÜKSEK | Orta | Orta |
| **Frontend Çift Filtreleme** | 🟢 DÜŞÜK | Düşük | Düşük |

---

## 🎯 ACİL DÜZELTME PLANI

### Adım 1: Frontend Debounce İyileştirme (5 dakika)
- Debounce süresini 500ms → 2000ms yap
- Polling sırasında WebSocket event'lerini ignore et

### Adım 2: Database Query'ye Zaman Filtresi (10 dakika)
- Query'ye `match_time >= fourHoursAgo` filtresi ekle
- Eski maçları query'den çıkar

### Adım 3: Match-Level Locking (30 dakika)
- `MatchLockManager` class'ı ekle
- Worker'larda lock kullan

### Adım 4: Status Update Queue (1 saat)
- `StatusUpdateQueue` class'ı ekle
- Status güncellemelerini sıralı yap

---

## 🔍 TEST SENARYOLARI

### Senaryo 1: Normal Durum
```
1. Frontend polling yaptı → 93 maç geldi
2. 15 saniye sonra tekrar polling yaptı → 93 maç geldi
3. ✅ TUTARLI
```

### Senaryo 2: Maç Bitti (Normal)
```
1. Frontend polling yaptı → 93 maç geldi
2. Maç bitti (status 2 → 8)
3. Frontend polling yaptı → 92 maç geldi
4. ✅ TUTARLI (sayı azalması normal)
```

### Senaryo 3: Race Condition (SORUNLU)
```
1. Frontend polling başladı → Query çalışıyor
2. WebSocket event geldi → Match A: status 2 → 8
3. Query devam ediyor → Match A query'den çıktı
4. Query bitti → 92 maç geldi
5. Frontend polling tekrar başladı → Query çalışıyor
6. DataUpdateWorker → Match B: status 2 → 8
7. Query devam ediyor → Match B query'den çıktı
8. Query bitti → 91 maç geldi
9. ❌ TUTARSIZ (2 saniye içinde 2 maç bitti - imkansız)
```

---

## 📋 KONTROL LİSTESİ

- [ ] Frontend debounce süresini artır (500ms → 2000ms)
- [ ] Database query'ye zaman filtresi ekle
- [ ] Match-level locking ekle
- [ ] Status update queue ekle
- [ ] Worker koordinasyonu iyileştir
- [ ] Frontend'de çift filtrelemeyi kaldır
- [ ] Database query'yi optimize et (index kullan)

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
**Durum:** 🔴 **KRİTİK - ACİL DÜZELTME GEREKLİ**

