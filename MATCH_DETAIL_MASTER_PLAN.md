# Match Detail Page Master Plan

## Genel Bakış

Bu plan, maç detay sayfasındaki kritik sorunları çözmek için kapsamlı bir yaklaşım sunar:
1. **WebSocket entegrasyonu** - Canlı maçlarda real-time güncellemeler
2. **Auto-refresh mekanizması** - Tab verilerinin otomatik güncellenmesi
3. **Database okuma** - Biten maçlar için direkt database okuma (cache yok)
4. **Database okuma düzeltmeleri** - Trend verisi okuma sorunu

---

## 1. WebSocket Entegrasyonu (Match Detail Page)

### 1.1 Frontend: MatchDetailPage WebSocket Bağlantısı

**Dosya:** `frontend/src/components/match-detail/MatchDetailPage.tsx`

**Değişiklikler:**
- `useMatchSocket` hook'unu import et ve kullan
- WebSocket event'lerini dinle (GOAL, SCORE_CHANGE, MATCH_STATE_CHANGE)
- Event geldiğinde match bilgisini ve aktif tab'ın verisini güncelle
- Debounce mekanizması ekle (500ms) - WebSocket event'leri ile polling çakışmasını önle

**Kod Yapısı:**
```typescript
// MatchDetailPage.tsx içine eklenecek
import { useMatchSocket } from '../../hooks/useSocket';

// Component içinde:
const { isConnected } = useMatchSocket(matchId, {
  onScoreChange: (event) => {
    // Match bilgisini güncelle (üst kart)
    // Aktif tab'ın verisini yeniden fetch et (debounced)
  },
  onMatchStateChange: (event) => {
    // Match status'unu güncelle
    // Tab verilerini yeniden fetch et
  },
  onAnyEvent: (event) => {
    // Events tab için incidents güncelle
    // Stats tab için stats güncelle
    // Trend tab için trend güncelle
  }
});
```

**Bağımlılıklar:**
- `frontend/src/hooks/useSocket.ts` - Mevcut WebSocket hook'u
- `frontend/src/components/MatchList.tsx` - Referans implementasyon

---

### 1.2 Backend: WebSocket Event Broadcasting

**Dosya:** `src/server.ts` (WebSocket handler)

**Durum:** ✅ Mevcut - WebSocket zaten çalışıyor, sadece frontend'de dinlenmesi gerekiyor

**Kontrol Edilecek:**
- WebSocket event'lerinin doğru broadcast edildiğini doğrula
- Match detail sayfası için özel event filtering gerekli mi?

---

## 2. Auto-Refresh Mekanizması

### 2.1 Tab Data Auto-Refresh

**Dosya:** `frontend/src/components/match-detail/MatchDetailPage.tsx`

**Değişiklikler:**
- WebSocket event geldiğinde aktif tab'ın verisini yeniden fetch et
- Debounce timer ekle (500ms) - Hızlı event'leri batch'le
- Overlapping request'leri önle (isFetchingRef kullan)

**Kod Yapısı:**
```typescript
// WebSocket event handler içinde
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

const refreshTabData = useCallback(() => {
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }
  
  debounceTimerRef.current = setTimeout(() => {
    // Aktif tab'ın verisini yeniden fetch et
    fetchTabData();
  }, 500);
}, [activeTab, matchId]);
```

---

### 2.2 Match Bilgisi Auto-Refresh (Üst Kart)

**Dosya:** `frontend/src/components/match-detail/MatchDetailPage.tsx`

**Değişiklikler:**
- WebSocket event geldiğinde match bilgisini güncelle
- Optimistic update: WebSocket event'inden gelen data ile hemen güncelle
- Sonra backend'den tam veriyi fetch et (fallback)

**Kod Yapısı:**
```typescript
// WebSocket event handler içinde
const updateMatchFromEvent = useCallback((event: WebSocketEvent) => {
  // Optimistic update
  setMatch(prevMatch => ({
    ...prevMatch,
    home_score: event.homeScore,
    away_score: event.awayScore,
    minute: event.minute,
    status: event.status
  }));
  
  // Full refresh (debounced)
  debouncedFetchMatch();
}, []);
```

---

## 3. Database Okuma (Biten Maçlar)

### 3.1 Backend: Direct Database Read

**Dosya:** `src/controllers/match.controller.ts`

**Değişiklikler:**
- Biten maçlar için **CACHE YOK** - Her zaman database'den oku
- `getMatchDetailLive`, `getMatchLiveStats`, `getMatchTrend` endpoint'lerinde
- Kullanıcı tıkladığında direkt database'den göster

**Kod Yapısı:**
```typescript
// match.controller.ts içinde
if (isFinished) {
  // CACHE YOK - Direkt database'den oku
  const dbResult = await combinedStatsService.getCombinedStatsFromDatabase(match_id);
  
  if (dbResult && dbResult.allStats.length > 0) {
    logger.debug(`[MatchController] Match finished, returning from DB for ${match_id}`);
    return reply.send({ success: true, data: dbResult });
  }
  
  // Database'de yoksa API'den dene (fallback)
  logger.warn(`[MatchController] Match finished but no DB data for ${match_id}`);
}
```

**Etkilenen Endpoint'ler:**
- `GET /api/matches/:match_id/detail-live`
- `GET /api/matches/:match_id/live-stats`
- `GET /api/matches/:match_id/trend`

**Strateji:**
- ✅ Her request'te database'den oku
- ❌ Cache mekanizması yok
- ✅ Kullanıcı her zaman güncel database verisini görür

---

## 4. Database Okuma Düzeltmeleri

### 4.1 Trend Verisi Okuma Sorunu

**Dosya:** `src/controllers/match.controller.ts`

**Sorun:** 
- `PostMatchProcessor` trend verisini `trend_data` kolonuna yazıyor ✅
- `getTrendFromDatabase()` `statistics->'trend'` okuyor ❌

**Çözüm:**
```typescript
// match.controller.ts:917-939
async function getTrendFromDatabase(matchId: string): Promise<any | null> {
  const result = await client.query(`
    SELECT trend_data
    FROM ts_matches
    WHERE external_id = $1
      AND trend_data IS NOT NULL
  `, [matchId]);
  
  if (result.rows.length === 0 || !result.rows[0].trend_data) {
    return null;
  }
  
  // trend_data formatını MatchTrendResponse formatına çevir
  return { results: result.rows[0].trend_data };
}
```

**Değişiklik:**
- `statistics->'trend'` yerine `trend_data` kolonundan oku
- Response formatını düzelt

---

## 5. Implementasyon Sırası

### Faz 1: Kritik Düzeltmeler (Öncelikli)
1. ✅ Trend verisi okuma sorunu düzelt (`getTrendFromDatabase`)
2. ✅ WebSocket entegrasyonu (MatchDetailPage)
3. ✅ Match bilgisi auto-refresh (üst kart)

### Faz 2: Auto-Refresh
4. ✅ Tab data auto-refresh (WebSocket event'lerine göre)
5. ✅ Debounce mekanizması

### Faz 3: Database Okuma
6. ✅ Biten maçlar için direkt database okuma (cache yok)

---

## 6. Test Senaryoları

### 6.1 WebSocket Test
- Canlı maçta gol atıldığında events tab güncelleniyor mu?
- Skor değiştiğinde üst kart güncelleniyor mu?
- Status değiştiğinde match bilgisi güncelleniyor mu?

### 6.2 Database Test
- Biten maç detay sayfası açıldığında database'den geliyor mu?
- Her request'te database query yapılıyor mu?
- Database'de veriler mevcut mu?

### 6.3 Database Test
- Trend verisi `trend_data` kolonundan okunuyor mu?
- Biten maçların verileri database'de mevcut mu?

---

## 7. Beklenen Sonuçlar

### Öncesi:
- ❌ Canlı maçlarda tab verileri güncellenmiyor
- ❌ Match bilgisi (üst kart) güncellenmiyor
- ❌ WebSocket entegrasyonu eksik
- ❌ Trend verisi yanlış yerden okunuyor
- ❌ Biten maçlar için cache yok

### Sonrası:
- ✅ Canlı maçlarda tab verileri real-time güncelleniyor
- ✅ Match bilgisi (üst kart) WebSocket ile güncelleniyor
- ✅ WebSocket entegrasyonu tam
- ✅ Trend verisi doğru yerden okunuyor
- ✅ Biten maçlar için direkt database okuma (cache yok)

---

## 8. Riskler ve Önlemler

### Risk 1: WebSocket Bağlantı Sorunları
**Önlem:** Auto-reconnect mekanizması zaten var (`useSocket` hook'unda)

### Risk 2: Race Condition (WebSocket + Polling)
**Önlem:** Debounce mekanizması ve overlapping request önleme

### Risk 3: Database Performance
**Önlem:** Database query'leri optimize edildi, index'ler mevcut

---

## 9. Dosya Listesi

### Frontend:
- `frontend/src/components/match-detail/MatchDetailPage.tsx` - WebSocket entegrasyonu, auto-refresh
- `frontend/src/hooks/useSocket.ts` - Mevcut (değişiklik yok)

### Backend:
- `src/controllers/match.controller.ts` - Database okuma, trend verisi düzeltme
- `src/services/liveData/postMatchProcessor.ts` - Mevcut (değişiklik yok)

---

## 10. Biten Maçlar Database Stratejisi

### Mevcut Durum:
- ✅ Biten maçların verileri database'e yazılıyor (`PostMatchProcessor`)
- ✅ Backend biten maçlar için database'den okuyor
- ✅ Her request'te database query yapılıyor (cache yok)

### Strateji:
- ✅ **CACHE YOK** - Her zaman database'den oku
- ✅ Kullanıcı tıkladığında direkt database'den göster
- ✅ Her request'te güncel database verisi dönüyor

### Database Okuma Stratejisi:
```
1. Request geldi → Database'den oku
2. Database'den veri var → Response dön
3. Database'de veri yok → API'den dene (fallback)
4. Response dön
```

**Not:** Biten maçların verileri database'de kalıcı olarak saklanıyor. Kullanıcı her tıkladığında direkt database'den gösteriliyor. Cache mekanizması yok - performans için database query'leri optimize edilmiş.

---

**Plan Tarihi:** 3 Ocak 2026  
**Hazırlayan:** AI Architect Assistant

