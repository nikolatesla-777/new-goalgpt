# Maç Başlama Akışı - Hangi Endpoint'ler Kullanılıyor?

## Normal Akış (3 Katmanlı Sistem)

### 1. **WebSocket/MQTT** (Real-time - En Hızlı) ⚡
**Endpoint:** MQTT Topic: `thesports/football/match/v1`

**Nasıl Çalışır:**
- TheSports API maç başladığında MQTT üzerinden real-time mesaj gönderir
- `WebSocketService.handleMessage()` bu mesajı alır
- Status otomatik olarak `NOT_STARTED (1)` → `FIRST_HALF (2)` geçer
- **Gecikme:** ~1-2 saniye (real-time)

**Kod:**
```typescript
// src/services/thesports/websocket/websocket.service.ts
private async handleMessage(message: any): Promise<void> {
  if (this.validator.isScoreMessage(message)) {
    const parsedScore = this.parser.parseScoreToStructured(scoreMsg);
    
    // Status değişti mi kontrol et
    if (statusChanged) {
      await this.updateMatchStatusInDatabase(parsedScore.matchId, parsedScore.statusId);
    }
  }
}
```

**Sorun:** WebSocket bağlantısı kopmuşsa veya provider mesaj göndermemişse çalışmaz.

---

### 2. **`/data/update`** (Her 20 Saniye - Fallback 1) 🔄
**Endpoint:** `GET /data/update`

**Nasıl Çalışır:**
- `DataUpdateWorker` her 20 saniyede bir çalışır
- Son 120 saniye içinde değişen maç ID'lerini döner
- Her değişen maç için `/match/detail_live` çağrılır
- **Gecikme:** En fazla 20 saniye

**Kod:**
```typescript
// src/jobs/dataUpdate.job.ts
async checkUpdates(): Promise<void> {
  // 1. /data/update endpoint'ini çağır
  const data = await this.dataUpdateService.checkUpdates();
  
  // 2. Değişen maç ID'lerini al
  const changedMatchIds = extractChangedMatches(data);
  
  // 3. Her maç için /match/detail_live çağır
  for (const matchId of changedMatchIds) {
    await this.matchDetailLiveService.reconcileMatchToDatabase(matchId);
  }
}
```

**Sorun:** Provider bazı maçları `/data/update`'e eklemeyebilir (küçük ligler).

---

### 3. **`/match/recent/list`** (Her 1 Dakika - Fallback 2) 🔄
**Endpoint:** `GET /match/recent/list?time=<timestamp>`

**Nasıl Çalışır:**
- `MatchSyncWorker` her 1 dakikada bir çalışır
- Son sync'ten sonra değişen maçları listeler
- Her değişen maç için `/match/detail_live` çağrılır
- **Gecikme:** En fazla 1 dakika

**Kod:**
```typescript
// src/jobs/matchSync.job.ts
async syncMatches(): Promise<void> {
  // 1. /match/recent/list endpoint'ini çağır (incremental sync)
  const result = await this.recentSyncService.syncIncremental();
  
  // 2. LIVE maçları reconcile et
  await this.reconcileLiveMatches();
}
```

**Sorun:** Sadece "recent" maçları döner, eski başlamış maçlar kaçabilir.

---

## Son Adım: `/match/detail_live` (Authoritative Source) ✅

**Tüm yukarıdaki mekanizmalar sonunda bu endpoint'i kullanır:**

**Endpoint:** `GET /match/detail_live?match_id=<id>`

**Ne Yapar:**
- Maçın güncel durumunu (status, score, minute, events) döner
- DB'yi günceller (status, score, minute, etc.)
- **Bu endpoint maçın "gerçek" durumunu gösterir**

**Kod:**
```typescript
// src/services/thesports/match/matchDetailLive.service.ts
async reconcileMatchToDatabase(matchId: string): Promise<ReconcileResult> {
  // 1. /match/detail_live endpoint'ini çağır
  const response = await this.client.get('/match/detail_live', { match_id: matchId });
  
  // 2. Status, score, minute bilgilerini çıkar
  const { statusId, homeScore, awayScore, minute } = this.extractLiveFields(response);
  
  // 3. DB'yi güncelle
  await this.updateDatabase(matchId, statusId, homeScore, awayScore, minute);
}
```

---

## Özet: Maç Başladığında Ne Olur?

### Senaryo 1: WebSocket Çalışıyorsa (İdeal)
```
05:00:00 - Maç başlar
05:00:01 - MQTT mesajı gelir → WebSocketService → DB güncellenir ✅
```

### Senaryo 2: WebSocket Çalışmıyorsa
```
05:00:00 - Maç başlar
05:00:20 - /data/update çalışır → Maç ID'si bulunur → /match/detail_live → DB güncellenir ✅
```

### Senaryo 3: /data/update'te Yoksa
```
05:00:00 - Maç başlar
05:01:00 - /match/recent/list çalışır → Maç bulunur → /match/detail_live → DB güncellenir ✅
```

### Senaryo 4: Hiçbiri Çalışmazsa (Osaka Maçı Durumu)
```
05:00:00 - Maç başlar
10:46:00 - Watchdog çalışır → "should-be-live" tespit eder → /match/detail_live → DB güncellenir ✅
```

---

## Watchdog Neden Var?

**Watchdog = Son Çare (Last Resort)**

- WebSocket çalışmıyor
- `/data/update` bu maçı döndürmüyor
- `/match/recent/list` bu maçı döndürmüyor
- **Ama maç başlamış!**

Watchdog:
1. DB'yi tarar: "Başlama saati geçmiş ama status hala NOT_STARTED"
2. Bu maçları bulur
3. `/match/detail_live` ile güncel durumu çeker
4. DB'yi günceller

**maxMinutesAgo Sorunu:**
- Watchdog sadece "son 120 dakika" içinde başlamış maçları kontrol ediyordu
- 5 saat önce başlamış maçlar kaçıyordu
- **Çözüm:** Bugünkü tüm maçları kontrol et (TSİ bazlı)

---

## Sonuç

**Normal akış:** WebSocket/MQTT → `/data/update` → `/match/recent/list`  
**Son adım:** Hepsi `/match/detail_live` kullanır  
**Watchdog:** Hiçbiri çalışmazsa devreye girer

**Osaka maçı sorunu:** 
- WebSocket mesajı gelmemiş
- `/data/update` bu maçı döndürmemiş
- `/match/recent/list` bu maçı döndürmemiş
- Watchdog da 120 dakika limiti yüzünden kaçırmış
- **Çözüm:** Watchdog'u bugünkü tüm maçları kontrol edecek şekilde düzelttik




