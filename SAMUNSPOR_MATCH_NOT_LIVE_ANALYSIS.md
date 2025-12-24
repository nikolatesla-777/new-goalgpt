# 🔍 Samsunspor Maçı Canlıya Gelmiyor - Sorun Analizi

**Tarih:** 2025-12-24  
**Durum:** ❌ SORUN AKTİF

---

## 📋 Sorun

Samsunspor maçı canlı maçlar listesinde görünmüyor. Maç muhtemelen canlı olmalı ama `/api/matches/live` endpoint'i bu maçı döndürmüyor.

---

## 🔍 Olası Nedenler

### 1. Maçın Status'ü Hala NOT_STARTED (status_id=1)

**Semptom:** Maç `status_id=1` (NOT_STARTED) durumunda.

**Neden:**
- `/data/update` bu maçı "değişen" olarak listelemiyor (maç henüz başlamadığı için)
- `/match/detail_live` bu maçı hala NOT_STARTED döndürüyor (API gecikmesi)
- ProactiveMatchStatusCheckWorker çalışıyor ama `/match/detail_live` başarısız oluyor

**Çözüm:** ProactiveMatchStatusCheckWorker bu durumu yakalamalı ama çalışmıyor olabilir.

---

### 2. ProactiveMatchStatusCheckWorker Çalışmıyor veya Başarısız Oluyor

**Kontrol Edilmesi Gerekenler:**
- Worker çalışıyor mu? (server.ts'de `proactiveCheckWorker.start()` çağrılıyor mu?)
- Worker log'larına bak: `[ProactiveCheck]` prefix'li log'lar var mı?
- `/match/detail_live` başarısız oluyor mu? (circuit breaker, rate limit, timeout)

**Kod:**
```typescript
// src/jobs/proactiveMatchStatusCheck.job.ts:37-88
async checkTodayMatches(): Promise<void> {
  // Bugünkü NOT_STARTED maçları bul
  const matches = await client.query(`
    SELECT external_id, match_time, status_id
    FROM ts_matches
    WHERE match_time >= $1 AND match_time < $2 AND match_time <= $3
      AND status_id = 1
  `, [todayStartTSI, todayEndTSI, nowTs]);
  
  // Her maç için /match/detail_live çek
  for (const match of matches) {
    await this.matchDetailLiveService.reconcileMatchToDatabase(match.external_id, null);
  }
}
```

---

### 3. /data/update Bu Maçı Listelemiyor

**Normal Akış:**
1. `/data/update` → değişen maçları listeler (her 20s)
2. `DataUpdateWorker` → `/match/detail_live` çağırır
3. Database güncellenir

**Sorun:** Maç başladığında `/data/update` bu maçı "değişen" olarak listelemiyor olabilir.

**Nedenler:**
- API gecikmesi (maç başladı ama henüz güncellenmedi)
- Küçük lig (bazı maçlar `/data/update`'e eklenmeyebilir)
- Rate limit (çok fazla istek)

---

## ✅ Çözüm Önerileri

### Çözüm 1: ProactiveMatchStatusCheckWorker'ın Çalıştığını Kontrol Et

**Kontrol:**
```bash
# VPS'de PM2 log'larına bak
pm2 logs goalgpt-backend | grep ProactiveCheck

# Beklenen log'lar:
# [ProactiveCheck] Worker started (20s interval)
# [ProactiveCheck] Found X matches that should be live
# [ProactiveCheck] Checking match: <match_id>
```

**Sorun:** Worker çalışmıyorsa veya hata veriyorsa, maçlar canlıya geçmez.

---

### Çözüm 2: /match/detail_live'ı Manuel Test Et

**Test:**
```bash
# Samsunspor maçının external_id'sini bul (database'den veya diary endpoint'inden)
# Sonra detail_live endpoint'ini çağır:
curl "http://localhost:3000/api/matches/<match_id>/detail-live"

# Response'da status_id ne?
# - status_id=1 → maç henüz başlamamış (API gecikmesi)
# - status_id=2 → maç başlamış ama database güncellenmemiş
```

---

### Çözüm 3: Database'deki Maç Status'ünü Kontrol Et

**SQL Sorgusu:**
```sql
SELECT 
  m.external_id,
  m.status_id,
  m.match_time,
  m.provider_update_time,
  m.last_event_ts,
  ht.name as home_team,
  at.name as away_team
FROM ts_matches m
LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
WHERE (
  ht.name ILIKE '%samsun%' 
  OR at.name ILIKE '%samsun%'
  OR ht.name ILIKE '%eyüp%'
  OR at.name ILIKE '%eyüp%'
)
AND m.match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
ORDER BY m.match_time DESC
LIMIT 5;
```

**Beklenen Sonuç:**
- `status_id=1` → ProactiveMatchStatusCheckWorker bu maçı kontrol etmeli
- `status_id=2,3,4,5,7` → Maç canlı, `/api/matches/live`'da görünmeli
- `status_id=8` → Maç bitti (watchdog yanlışlıkla END'e geçirmiş olabilir)

---

## 🎯 Hızlı Çözüm

**En Olası Sorun:** ProactiveMatchStatusCheckWorker çalışıyor ama `/match/detail_live` başarısız oluyor veya API maçı hala NOT_STARTED döndürüyor.

**Kontrol Adımları:**
1. ✅ PM2 log'larına bak: `[ProactiveCheck]` log'ları var mı?
2. ✅ Database'de maçın status'ü ne?
3. ✅ `/match/detail_live` endpoint'ini manuel test et
4. ✅ Circuit breaker açık mı? Rate limit var mı?

---

## 📝 Notlar

1. **Watchdog Devre Dışı:** Watchdog'u devre dışı bıraktık, o yüzden artık watchdog kontrol etmiyor.
2. **Normal Akış:** `/data/update` → `/match/detail_live` çalışmalı
3. **ProactiveMatchStatusCheckWorker:** Fallback mekanizması, NOT_STARTED maçları kontrol ediyor

**Sonraki Adım:** PM2 log'larını kontrol et ve database'deki maç status'ünü kontrol et.


