# Mimari Uygunluk Analizi - Kritik Gereksinimler

**Tarih:** 3 Ocak 2026  
**Durum:** 🔴 **KRİTİK EKSİKLER TESPİT EDİLDİ**

---

## 📋 Kullanıcı Gereksinimleri

1. ✅ **Her şeyin database üzerinden ilerlemesi lazım**
2. ❌ **Başlama saati gelen maçı endpoint ile kickoff yapabiliyor mu sistem?**
3. ⚠️ **Diğer yardımcı elemanlar destek olması lazım eş zamanlı çalışıp çakışma yapmaması gerekiyor**
4. ❌ **Maç detay kartının içindeki eventler, trend bilgisi, istatistikler vs gibi sekmeler WebSocket ile dinlenmesi lazım**
5. ⚠️ **Mimari buna uygun mu yapılmış?**

---

## 1. DATABASE-CENTRIC YAKLAŞIM ✅

### Mevcut Durum

**✅ İYİ:**
- Controllers database'den okuyor (API fallback minimal)
- Match data database'den geliyor
- WebSocket events database'e yazılıyor
- Worker'lar database'i güncelliyor

**⚠️ SORUNLU:**
- Bazı endpoint'ler hala API fallback kullanıyor
- `getMatchDetailLive()` cache'den okuyor ama API'ye de gidebiliyor

### Öneri

**Tüm endpoint'ler database-centric olmalı:**
```typescript
// ❌ YANLIŞ (API fallback var)
const match = await matchDetailLiveService.getMatchDetailLive({ match_id });

// ✅ DOĞRU (Sadece database)
const match = await matchDatabaseService.getMatchById(matchId);
```

**Durum:** %80 uyumlu, %20 iyileştirme gerekiyor

---

## 2. OTOMATİK KICKOFF MEKANİZMASI ❌

### Mevcut Durum

**❌ EKSİK:**
- `MatchWatchdogWorker` "should-be-live" maçları tespit ediyor
- Ancak **otomatik kickoff endpoint'i YOK**
- Sadece provider'dan (`/match/detail_live`) veri çekip database'e yazıyor
- Provider'dan veri gelmezse maç başlamıyor

**Kod İncelemesi:**
```typescript
// src/jobs/matchWatchdog.job.ts:94
const shouldBeLive = await this.matchWatchdogService.findShouldBeLiveMatches(nowTs, 1440, 1000);

// Her maç için reconcile çağrılıyor
await this.matchDetailLiveService.reconcileMatchToDatabase(match.matchId, null);
```

**Sorun:**
- `reconcileMatchToDatabase()` provider API'sine bağımlı
- Provider'dan veri gelmezse maç başlamıyor
- **Database'den direkt kickoff yapılamıyor**

### Gereksinim

**Kullanıcı İsteği:**
> "Başlama saati gelen maçı endpoint ile kickoff yapabiliyor mu sistem?"

**Cevap:** ❌ **HAYIR** - Sistem provider'a bağımlı

### Önerilen Çözüm

**1. Database-Centric Kickoff Endpoint:**
```typescript
// YENİ: POST /api/matches/:matchId/kickoff
export const kickoffMatch = async (
  request: FastifyRequest<{ Params: { matchId: string } }>,
  reply: FastifyReply
) => {
  const { matchId } = request.params;
  
  // Database'den maç bilgisini al
  const match = await matchRepository.findByExternalId(matchId);
  
  if (!match) {
    return reply.status(404).send({ success: false, message: 'Match not found' });
  }
  
  // match_time kontrolü
  const nowTs = Math.floor(Date.now() / 1000);
  if (match.match_time > nowTs) {
    return reply.status(400).send({ 
      success: false, 
      message: 'Match time has not passed yet' 
    });
  }
  
  // Status kontrolü
  if (match.status_id !== 1) {
    return reply.status(400).send({ 
      success: false, 
      message: 'Match is not in NOT_STARTED status' 
    });
  }
  
  // Database'de direkt kickoff yap
  await matchRepository.update(match.id, {
    status_id: 2, // FIRST_HALF
    first_half_kickoff_ts: nowTs,
    provider_update_time: nowTs,
    last_event_ts: nowTs,
  });
  
  // WebSocket'e event gönder
  broadcastEvent({
    type: 'MATCH_STATE_CHANGE',
    matchId,
    oldStatus: 1,
    newStatus: 2,
  });
  
  return reply.send({ success: true, message: 'Match kicked off' });
};
```

**2. Watchdog Worker'ı Güncelle:**
```typescript
// Watchdog "should-be-live" maçları bulduğunda:
// 1. Önce provider'dan veri çek (reconcile)
// 2. Başarısız olursa, database'den direkt kickoff yap
const reconcileResult = await this.matchDetailLiveService.reconcileMatchToDatabase(matchId);

if (!reconcileResult.updated) {
  // Provider'dan veri gelmedi, database'den direkt kickoff yap
  await this.kickoffMatchFromDatabase(matchId);
}
```

**Durum:** ❌ **EKSİK** - Yeni endpoint ve logic gerekiyor

---

## 3. WORKER KOORDİNASYONU ⚠️

### Mevcut Durum

**✅ İYİ:**
- Optimistic locking var (`provider_update_time` kontrolü)
- `MatchWriteQueue` backpressure control yapıyor
- Worker'lar `isRunning` flag kullanıyor (aynı worker'ın çakışmasını önlüyor)

**⚠️ SORUNLU:**
- Worker'lar arasında explicit lock mekanizması YOK
- `SyncLock` class var ama kullanılmıyor
- Aynı maç için birden fazla worker aynı anda güncelleme yapabilir

**Kod İncelemesi:**
```typescript
// src/services/thesports/sync/sync-strategy.ts
class SyncLock {
  private locks: Map<SyncType, boolean> = new Map();
  // ... lock mekanizması var ama kullanılmıyor
}

// Worker'lar optimistic locking kullanıyor:
// src/services/thesports/websocket/websocket.service.ts:898
private async shouldApplyUpdate(
  client: any,
  matchId: string,
  incomingProviderUpdateTime: number | null
): Promise<{ apply: boolean; ... }> {
  // provider_update_time kontrolü yapıyor
  // Ama worker'lar arasında lock YOK
}
```

**Sorun:**
- `DataUpdateWorker` ve `MatchWatchdogWorker` aynı maçı aynı anda güncelleyebilir
- Optimistic locking race condition'ı önlüyor ama **çakışmayı tamamen önlemiyor**

### Gereksinim

**Kullanıcı İsteği:**
> "Diğer yardımcı elemanlar destek olması lazım eş zamanlı çalışıp çakışma yapmaması gerekiyor"

**Cevap:** ⚠️ **KISMEN** - Optimistic locking var ama worker koordinasyonu eksik

### Önerilen Çözüm

**1. Match-Level Locking:**
```typescript
// YENİ: Match-level lock mekanizması
class MatchLockManager {
  private locks: Map<string, { worker: string; timestamp: number }> = new Map();
  
  async acquireLock(matchId: string, worker: string, timeout: number = 5000): Promise<boolean> {
    const existing = this.locks.get(matchId);
    
    if (existing) {
      // Lock var, timeout kontrolü yap
      if (Date.now() - existing.timestamp > timeout) {
        // Timeout oldu, lock'u serbest bırak
        this.locks.delete(matchId);
      } else {
        // Lock hala aktif
        return false;
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
    // Match güncelleme işlemi
    await updateMatchInDatabase(matchId);
  } finally {
    lockManager.releaseLock(matchId);
  }
}
```

**2. Worker Priority System:**
```typescript
// Worker öncelikleri:
// 1. WebSocketService (en yüksek - real-time)
// 2. DataUpdateWorker (yüksek - her 20s)
// 3. MatchWatchdogWorker (orta - her 30s)
// 4. MatchSyncWorker (düşük - her 1dk)

// Yüksek öncelikli worker lock'u alabilir, düşük öncelikli worker bekler
```

**Durum:** ⚠️ **KISMEN UYGUN** - Optimistic locking var ama explicit coordination eksik

---

## 4. WEBSOCKET ENTEGRASYONU (MAÇ DETAY) ❌

### Mevcut Durum

**❌ EKSİK:**
- `MatchDetailPage` WebSocket kullanmıyor
- Sadece initial fetch yapıyor, real-time updates YOK
- Tab data (events, trend, stats) WebSocket ile dinlenmiyor

**Kod İncelemesi:**
```typescript
// frontend/src/components/match-detail/MatchDetailPage.tsx:116
// CRITICAL FIX: Removed polling to prevent screen flickering
// Real-time updates should come from WebSocket, not polling
// Polling causes unnecessary re-renders and screen flickering
// If WebSocket is not available, user can manually refresh the page

// No polling interval - WebSocket handles real-time updates
```

**Sorun:**
- WebSocket entegrasyonu YOK
- Comment'te "WebSocket handles real-time updates" yazıyor ama kod yok

### Gereksinim

**Kullanıcı İsteği:**
> "Maç detay kartının içindeki eventler, trend bilgisi, istatistikler vs gibi sekmeler WebSocket ile dinlenmesi lazım"

**Cevap:** ❌ **HAYIR** - WebSocket entegrasyonu eksik

### Önerilen Çözüm

**1. WebSocket Hook Kullan:**
```typescript
// frontend/src/hooks/useSocket.ts (mevcut)
// MatchDetailPage'de kullan:
import { useSocket } from '../../hooks/useSocket';

export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  
  // WebSocket bağlantısı
  const socket = useSocket();
  
  useEffect(() => {
    if (!socket || !matchId) return;
    
    // Match-specific events dinle
    const handleMatchEvent = (event: any) => {
      if (event.matchId !== matchId) return;
      
      switch (event.type) {
        case 'GOAL':
        case 'SCORE_CHANGE':
          // Skor güncelle
          setMatch(prev => ({
            ...prev,
            home_score: event.homeScore,
            away_score: event.awayScore,
          }));
          break;
          
        case 'MATCH_STATE_CHANGE':
          // Status güncelle
          setMatch(prev => ({
            ...prev,
            status_id: event.newStatus,
            minute_text: event.minuteText,
          }));
          break;
          
        case 'EVENT':
          // Event ekle (events tab için)
          setTabData(prev => ({
            ...prev,
            incidents: [...(prev?.incidents || []), event.incident],
          }));
          break;
          
        case 'STATS_UPDATE':
          // İstatistik güncelle (stats tab için)
          setTabData(prev => ({
            ...prev,
            stats: event.stats,
          }));
          break;
          
        case 'TREND_UPDATE':
          // Trend güncelle (trend tab için)
          setTabData(prev => ({
            ...prev,
            trend: event.trend,
          }));
          break;
      }
    };
    
    socket.on('message', handleMatchEvent);
    
    return () => {
      socket.off('message', handleMatchEvent);
    };
  }, [socket, matchId]);
  
  // ... rest of component
}
```

**2. Backend'de Match-Specific Events:**
```typescript
// src/routes/websocket.routes.ts
// Match-specific event filtering
export function broadcastMatchEvent(matchId: string, event: MatchEvent): void {
  // Sadece bu maçı dinleyen client'lara gönder
  activeConnections.forEach((socket) => {
    if (socket.subscribedMatches?.has(matchId)) {
      socket.send(JSON.stringify({
        type: event.type,
        matchId,
        ...event,
      }));
    }
  });
}
```

**3. Tab-Specific Updates:**
```typescript
// Backend'de her tab için ayrı event:
// - EVENTS_UPDATE: Events tab için
// - STATS_UPDATE: Stats tab için
// - TREND_UPDATE: Trend tab için
// - H2H_UPDATE: H2H tab için (nadir)
```

**Durum:** ❌ **EKSİK** - WebSocket entegrasyonu yapılmalı

---

## 5. MİMARİ UYGUNLUK DEĞERLENDİRMESİ ⚠️

### Genel Durum

| Gereksinim | Durum | Uygunluk |
|------------|-------|----------|
| Database-centric | ✅ | %80 uyumlu |
| Otomatik kickoff | ❌ | %0 uyumlu |
| Worker koordinasyonu | ⚠️ | %60 uyumlu |
| WebSocket (maç detay) | ❌ | %0 uyumlu |

### Mimari Tasarım: ✅ SAĞLAM

**Güçlü Yönler:**
- Layered architecture doğru
- Repository pattern kullanılıyor
- Optimistic locking var
- WebSocket infrastructure hazır

**Zayıf Yönler:**
- Database-centric yaklaşım tam değil (API fallback var)
- Otomatik kickoff mekanizması yok
- Worker koordinasyonu eksik
- Frontend WebSocket entegrasyonu eksik

### Önerilen İyileştirmeler

**Öncelik 1 (KRİTİK):**
1. ✅ Otomatik kickoff endpoint'i ekle (`POST /api/matches/:matchId/kickoff`)
2. ✅ MatchDetailPage WebSocket entegrasyonu
3. ✅ Tab-specific WebSocket events (events, stats, trend)

**Öncelik 2 (YÜKSEK):**
4. ✅ Worker koordinasyonu (MatchLockManager)
5. ✅ Database-centric yaklaşımı tamamla (API fallback kaldır)

**Öncelik 3 (ORTA):**
6. ⚠️ Worker priority system
7. ⚠️ Match-specific WebSocket subscriptions

---

## 📊 SONUÇ

**Mimari temel tasarım:** ✅ **SAĞLAM**

**Execution layer:** ⚠️ **EKSİKLER VAR**

**Toplam Uygunluk:** %35

**Yapılması Gerekenler:**
1. ❌ Otomatik kickoff endpoint'i
2. ❌ MatchDetailPage WebSocket entegrasyonu
3. ⚠️ Worker koordinasyonu
4. ⚠️ Database-centric yaklaşımı tamamla

---

## 🔗 İLGİLİ DOSYALAR

- `src/controllers/match.controller.ts` - Kickoff endpoint eklenmeli
- `src/jobs/matchWatchdog.job.ts` - Kickoff logic eklenmeli
- `frontend/src/components/match-detail/MatchDetailPage.tsx` - WebSocket entegrasyonu
- `src/routes/websocket.routes.ts` - Match-specific events
- `src/services/thesports/sync/sync-strategy.ts` - Lock mekanizması kullanılmalı

---

**Rapor Tarihi:** 3 Ocak 2026  
**Hazırlayan:** AI Architect Assistant


