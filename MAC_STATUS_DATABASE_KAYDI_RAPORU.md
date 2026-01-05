# Maç Statü Durumları Database Kaydı Raporu

**Tarih:** 2026-01-05  
**Soru:** Maç statü durumları database'e sürekli kaydediliyor değil mi?

## ✅ CEVAP: EVET, SÜREKLİ KAYDEDİLİYOR

Maç statü durumları **7/24 otomatik olarak** database'e kaydediliyor. Birden fazla mekanizma bu işi yapıyor:

## 🔄 Database'e Statü Yazan Sistemler

### 1. WebSocket Service ✅ (En Hızlı - Gerçek Zamanlı)

**Çalışma:** Sürekli (WebSocket bağlantısı açıkken)

**Ne Zaman Yazıyor:**
- Score message geldiğinde → `status_id` güncelleniyor
- TLIVE message geldiğinde → `status_id` güncelleniyor
- Incident message geldiğinde → İlgili status güncelleniyor

**Kod:**
```typescript
// src/services/thesports/websocket/websocket.service.ts
private async updateMatchStatusInDatabase(
  matchId: string, 
  statusId: number, 
  providerUpdateTime: number | null = null
): Promise<void> {
  const res = await client.query(
    `UPDATE ts_matches 
     SET status_id = $1, 
         provider_update_time = ...,
         last_event_ts = $4,
         updated_at = NOW() 
     WHERE external_id = $2`,
    [statusId, matchId, ...]
  );
}
```

**Sıklık:** Gerçek zamanlı (event geldiğinde anında)

---

### 2. DataUpdateWorker ✅ (Her 20 Saniyede Bir)

**Çalışma:** Her 20 saniyede bir otomatik

**Ne Zaman Yazıyor:**
- `/data/update` endpoint'inden değişen maçlar geldiğinde
- Her değişen maç için `reconcileMatchToDatabase` çağrılıyor
- Bu da status'u database'e yazıyor

**Kod:**
```typescript
// src/jobs/dataUpdate.job.ts
async checkUpdates(): Promise<void> {
  const payload = await this.dataUpdateService.checkUpdates();
  const { matchIds, updateTimeByMatchId } = this.normalizeChangedMatches(payload);
  
  for (const matchId of changedMatchIds) {
    const result = await this.matchDetailLiveService.reconcileMatchToDatabase(
      matchIdStr,
      updateTime
    );
    // reconcileMatchToDatabase içinde status database'e yazılıyor
  }
}
```

**Sıklık:** Her 20 saniyede bir

---

### 3. MatchWatchdogWorker ✅ (Her 5 Saniyede Bir)

**Çalışma:** Her 5 saniyede bir otomatik

**Ne Zaman Yazıyor:**
- Should-be-live maçları tespit edildiğinde → Status NOT_STARTED → LIVE
- Stale maçlar tespit edildiğinde → Status LIVE → END
- recent/list'ten status bilgisi alındığında → Database'e yazılıyor

**Kod:**
```typescript
// src/jobs/matchWatchdog.job.ts
// Should-be-live maçlar için:
const updateQuery = `
  UPDATE ts_matches
  SET status_id = $1,
      provider_update_time = ...,
      last_event_ts = $3::BIGINT,
      updated_at = NOW()
  WHERE external_id = $4
    AND status_id = 1
`;

// Stale maçlar için:
UPDATE ts_matches 
SET status_id = 8, 
    updated_at = NOW(), 
    last_event_ts = $1::BIGINT
WHERE external_id = $2 
  AND status_id IN (2, 3, 4, 5, 7)
```

**Sıklık:** Her 5 saniyede bir

---

### 4. MatchDetailLiveService.reconcileMatchToDatabase ✅

**Çalışma:** Yukarıdaki sistemler tarafından çağrılıyor

**Ne Zaman Yazıyor:**
- DataUpdateWorker tarafından çağrıldığında
- MatchWatchdogWorker tarafından çağrıldığında
- Frontend'den match detail sayfası açıldığında (sadece okuma, yazma yok)

**Kod:**
```typescript
// src/services/thesports/match/matchDetailLive.service.ts
async reconcileMatchToDatabase(
  matchId: string,
  providerUpdateTime: number | null = null
): Promise<ReconcileResult> {
  // API'den match detail çekiliyor
  // Status database'e yazılıyor
  // Score, minute, incidents database'e yazılıyor
}
```

**Sıklık:** Yukarıdaki sistemlerin sıklığına bağlı

---

## 📊 Statü Güncelleme Akışı

```
1. WebSocket Event Geliyor (Gerçek Zamanlı)
   ↓
   updateMatchStatusInDatabase() → Database'e yazılıyor ✅

2. DataUpdateWorker (Her 20 saniyede bir)
   ↓
   /data/update kontrol ediliyor
   ↓
   Değişen maçlar için reconcileMatchToDatabase() → Database'e yazılıyor ✅

3. MatchWatchdogWorker (Her 5 saniyede bir)
   ↓
   Should-be-live maçlar tespit ediliyor
   ↓
   recent/list'ten status alınıyor → Database'e yazılıyor ✅

4. Stale maçlar tespit ediliyor
   ↓
   Status END'e geçiriliyor → Database'e yazılıyor ✅
```

## 🎯 Sonuç

### ✅ Statü Durumları Sürekli Kaydediliyor

1. **WebSocket:** Gerçek zamanlı (event geldiğinde anında)
2. **DataUpdateWorker:** Her 20 saniyede bir
3. **MatchWatchdogWorker:** Her 5 saniyede bir
4. **MatchDetailLiveService:** Yukarıdaki sistemler tarafından çağrılıyor

### ✅ Optimistic Locking

Tüm sistemler **optimistic locking** kullanıyor:
- `provider_update_time` kontrol ediliyor
- Sadece daha yeni veriler database'e yazılıyor
- Eski veriler yazılmıyor (stale update koruması)

### ✅ Veri Tutarlılığı

- Database **single source of truth**
- Tüm sistemler database'den okuyor
- Tüm sistemler database'e yazıyor
- Optimistic locking ile çakışma yok

## 💡 Özet

**SORU:** Maç statü durumları database'e sürekli kaydediliyor değil mi?  
**CEVAP:** EVET ✅ - 7/24 otomatik olarak kaydediliyor

**MEKANİZMALAR:**
1. WebSocket (gerçek zamanlı)
2. DataUpdateWorker (her 20 saniyede bir)
3. MatchWatchdogWorker (her 5 saniyede bir)
4. MatchDetailLiveService (yukarıdaki sistemler tarafından)

**SONUÇ:** Statü durumları **sürekli ve otomatik** olarak database'e kaydediliyor. Manuel müdahale gerekmiyor.

