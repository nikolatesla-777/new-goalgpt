# 📋 Plan: Dakikalar Sadece WebSocket ve /match/detail_live'dan Gelecek

**Tarih:** 2025-12-24  
**Durum:** 📝 PLAN  
**Öncelik:** 🔴 YÜKSEK

---

## 🎯 Amaç

Kullanıcı, maç dakikalarının (75, 33 gibi) sadece WebSocket ve `/match/detail_live` endpoint'lerinden gelmesini istiyor. `MatchMinuteWorker`'ın otomatik dakika hesaplama mekanizmasını kaldırmak.

---

## 📊 Mevcut Durum

### 1. WebSocket (MQTT) Mesajları
- **Dakika bilgisi:** ❌ YOK
- **Gelen bilgiler:** 
  - `score`: [match_id, status_id, home_data[], away_data[], message_timestamp]
  - `tlive`: timeline/phase updates (HT, 2H, FT)
  - `incidents`: maç eventleri
  - `stats`: istatistikler

### 2. `/match/detail_live` Endpoint'i
- **Dakika bilgisi:** ✅ VAR (ama extract edilmiyor!)
- **Kod:** `src/services/thesports/match/matchDetailLive.service.ts:94`
  ```typescript
  minute: number | null; // CRITICAL FIX: Extract minute from provider
  ```
- **Sorun:** `extractLiveFields()` fonksiyonunda dakika extract edilmiyor (satır 224'te return'de minute yok)

### 3. MatchMinuteWorker
- **Ne yapıyor:** Her 30 saniyede bir tüm canlı maçlar için dakika hesaplıyor (kickoff_ts'den)
- **Kod:** `src/jobs/matchMinute.job.ts`
- **Sorun:** Kullanıcı bunu istemiyor, sadece WebSocket/detail_live'dan dakika gelmeli

---

## ✅ Çözüm Planı

### Adım 1: `/match/detail_live`'dan Dakika Extract Et

**Dosya:** `src/services/thesports/match/matchDetailLive.service.ts`

**Değişiklik:**
1. `extractLiveFields()` fonksiyonunda dakika extract et
2. Return statement'a `minute` ekle
3. Database'e yaz (zaten kod var, satır 454-458)

**Kod:**
```typescript
// extractLiveFields() içinde (satır 223'ten sonra):
const minuteRaw =
  (typeof root?.minute === 'number' ? root.minute : null) ??
  (typeof root?.match_minute === 'number' ? root.match_minute : null) ??
  (typeof root?.match?.minute === 'number' ? root.match.minute : null) ??
  (typeof root?.match?.match_minute === 'number' ? root.match.match_minute : null) ??
  null;

const minute =
  typeof minuteRaw === 'number' && Number.isFinite(minuteRaw) && minuteRaw >= 0
    ? minuteRaw
    : null;

return { statusId, homeScoreDisplay, awayScoreDisplay, incidents, statistics, liveKickoffTime, updateTime, minute };
```

**Database'e yazma (zaten var, satır 454-458):**
```typescript
// CRITICAL FIX: Update minute from provider if available (provider-authoritative)
if (this.minuteColumnName && live.minute !== null) {
  setParts.push(`${this.minuteColumnName} = $${i++}`);
  values.push(live.minute);
  logger.debug(`[DetailLive] Setting minute=${live.minute} from provider for match_id=${match_id}`);
}
```

---

### Adım 2: MatchMinuteWorker'ı Devre Dışı Bırak

**Dosya:** `src/jobs/matchMinute.job.ts`

**Seçenek 1: Worker'ı tamamen kaldır**
- `src/server.ts`'den `matchMinuteWorker.start()` çağrısını kaldır
- Worker dosyasını sil (opsiyonel)

**Seçenek 2: Worker'ı devre dışı bırak (daha güvenli)**
- `start()` metodunu boş bırak veya `return` ekle
- Gelecekte tekrar aktif edilebilir

**Kod:**
```typescript
// src/jobs/matchMinute.job.ts
start(): void {
  logger.warn('[MinuteEngine] DISABLED: Minute updates now come only from WebSocket/detail_live');
  return; // Worker disabled - minutes come from WebSocket/detail_live only
  
  // OLD CODE (commented out):
  // if (this.intervalId) {
  //   logger.warn('Match minute worker already started');
  //   return;
  // }
  // ...
}
```

---

### Adım 3: WebSocket'ten Dakika Gelip Gelmediğini Kontrol Et

**Dosya:** `src/services/thesports/websocket/websocket.service.ts`

**Kontrol:**
- WebSocket mesajlarında dakika bilgisi var mı?
- Varsa, parse et ve database'e yaz
- Yoksa, sadece `/match/detail_live`'dan gelen dakikayı kullan

**Not:** Şu anda WebSocket mesajlarında dakika bilgisi yok gibi görünüyor. Ama kontrol edilmeli.

---

## 🔄 Yeni Akış

### Senaryo 1: WebSocket'ten Dakika Geliyorsa
```
1. WebSocket MQTT mesajı gelir
2. Dakika bilgisi extract edilir
3. Database'e yazılır (minute field)
4. Frontend'de gösterilir
```

### Senaryo 2: WebSocket'ten Dakika Gelmiyorsa (Mevcut Durum)
```
1. /data/update endpoint'i değişen maçları listeler
2. Her değişen maç için /match/detail_live çağrılır
3. detail_live'dan dakika extract edilir
4. Database'e yazılır (minute field)
5. Frontend'de gösterilir
```

### Senaryo 3: MatchMinuteWorker (KALDIRILACAK)
```
❌ Her 30 saniyede bir dakika hesaplama
❌ Kickoff_ts'den dakika hesaplama
❌ Database'e otomatik yazma
```

---

## 📝 Notlar

1. **WebSocket'te dakika yok:** Şu anda WebSocket mesajlarında dakika bilgisi yok. Sadece skor, status, tlive geliyor.
2. **`/match/detail_live`'dan dakika var:** Provider dakika bilgisini döndürüyor, ama extract edilmiyor.
3. **MatchMinuteWorker gereksiz:** Eğer dakikalar sadece WebSocket/detail_live'dan gelecekse, MatchMinuteWorker'a gerek yok.
4. **Fallback mekanizması:** WebSocket'ten dakika gelmezse, `/match/detail_live`'dan gelen dakika kullanılacak (DataUpdateWorker zaten bunu yapıyor).

---

## 🎯 Sonuç

- ✅ `/match/detail_live`'dan dakika extract et
- ✅ Database'e yaz (zaten kod var)
- ✅ MatchMinuteWorker'ı devre dışı bırak
- ✅ WebSocket'ten dakika gelip gelmediğini kontrol et (gelecekte eklenebilir)

**Sonraki Adım:** Bu planı uygula.

