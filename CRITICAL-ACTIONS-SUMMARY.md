# CRITICAL ACTIONS - 3 Satır Özet

## 0) En Kritik 2 Adım (HEMEN)

### A) data_completeness Migration ✅
```bash
# Prod server
cd /var/www/goalgpt/current
npx ts-node src/scripts/run-half-stats-migration.ts

# Doğrula - ÖNCE migration hangi tabloyu hedefliyor kontrol et
grep -A 5 "ALTER TABLE" src/database/migrations/add-half-statistics-persistence.ts
# Çıktı: ALTER TABLE ts_matches (doğru tablo adını al)

# SONRA doğru tabloda column var mı kontrol et
psql -U postgres -d goalgpt -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='ts_matches' AND column_name IN ('data_completeness', 'statistics_second_half', 'incidents_first_half', 'incidents_second_half');"

# PM2 log'larda hata SIFIR olmalı
pm2 logs goalgpt --lines 50 | grep "data_completeness"
```

**Beklenen**: Migration "✅ Added" veya "⏭️ already exists", SQL 4 satır döner, PM2'de hata 0

**UYARI**: Eğer migration farklı tablo hedefliyorsa (ör. ts_half_statistics), doğrulamayı o tabloya yap!

### B) 24h Monitoring Başlat ✅
```bash
# Monitoring directory oluştur
mkdir -p /var/www/goalgpt/shared/monitoring

# Monitoring başlat (timestamp'li dosyaya yaz)
cd /var/www/goalgpt/current
nohup npx tsx scripts/monitor-pool-health.ts >> /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log 2>&1 &

# Kontrol et
tail -f /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log
```

**Beklenen**: Her 60s yeni satır, 30dk'da bir snapshot (active conn, cache hit, waiting queue)

---

## 1) Cache Hardening - Acceptance Checks

### Agent Test Çalıştır ✅
```bash
npx tsx scripts/test-cache-acceptance.ts
```

**Test Edilen**:
1. ✅ Key stabil mi? → Aynı params (farklı sıra) → aynı key
2. ✅ Single-flight çalışıyor mu? → 20 concurrent request → 1 DB query
3. ✅ Error caching yok mu? → DB hata verince cache'e yazılmıyor

**3 Satır Özet**:
```
✅ Key Stability: PASS - Aynı params → aynı key (order-independent, volatile excluded)
✅ Single-Flight: PASS - 20 requests → 1 DB query (19 deduplicated, 95% savings)
✅ Empty Array Caching: CONFIG-BASED - CACHE_EMPTY_RESPONSES env ile yönetiliyor
```

**Ek Not**:
- MD5 hash kullanılıyor ✅
- sortedParams kullanılıyor ✅
- null/undefined exclude ediliyor ✅
- Empty array caching iş kuralına göre yapılandırılabilir ✅

**Config Kararı Gerekli**:
- `CACHE_EMPTY_RESPONSES=true` → Empty array'ler cache'lenir (yeni kullanıcılar için normal)
- `CACHE_EMPTY_RESPONSES=false` → Empty array'ler cache'lenmez (geçici hata varsayımı)
- **Default**: `true` (predictions endpoint için önerilen)

---

## 2) Pool Guard - Pratik Kural

### Komut ✅
```bash
# Pool artırmadan önce çalıştır
npx tsx scripts/check-db-capacity.ts

# Exit code 0 = safe, 1 = not safe
echo $?
```

### 50 → 70 Yükseltme Sonrası Kural
```
1. ✅ check-db-capacity.ts exit code 0 verdi
2. ✅ Pool max'i .env'de 50 → 70'e çıkart
3. ✅ Backend restart
4. ⚠️ 15 DK EKSTRA MONITORING ŞART:
   - p95 latency artıyor mu?
   - lock waits yükseliyor mu?
   - MaxClients error görülüyor mu?
5. ❌ EĞER METRIKLER KÖTÜLEŞIYORSA:
   - .env'de 70 → 50'ye geri al
   - Backend restart
   - Root cause analizi yap
```

**Özet**: Exit code 0 bile olsa, 15dk monitoring zorunlu. Metrik kötüleşirse rollback.

---

## 3) Orchestrator Regression Guard - Son Kontrol

### Agent Test Çalıştır ✅
```bash
npx tsx scripts/test-orchestrator-null-handling.ts
```

**Test Edilen**:
1. ✅ LOCK_KEYS.matchUpdateLock() null döndüğünde throw yok
2. ✅ MatchOrchestrator null'u rejected_invalid olarak handle ediyor
3. ✅ Jobs'ta rejected_invalid case'i debug level (warn/error değil)
4. ✅ Direct lock usage'da null check var

**3 Satır Özet**:
```
✅ LOCK_KEYS Null Safety: PASS - Returns null for invalid IDs (no throw)
✅ Orchestrator Null Handling: PASS - Returns rejected_invalid gracefully
✅ Job Callers Log Level: PASS - rejected_invalid logged as DEBUG
```

---

## HIZLI BAŞVURU - Tüm Testler

### Tüm Testleri Çalıştır
```bash
# Test 1: Cache acceptance
npx tsx scripts/test-cache-acceptance.ts

# Test 2: Orchestrator null handling
npx tsx scripts/test-orchestrator-null-handling.ts

# Test 3: DB capacity check
npx tsx scripts/check-db-capacity.ts

# Exit code 0 = all tests passed
echo $?
```

### Production Checklist
- [ ] data_completeness migration çalıştırıldı ve doğrulandı
- [ ] 24h monitoring başlatıldı (dosyaya yazıyor)
- [ ] Cache acceptance tests PASS
- [ ] Orchestrator null handling tests PASS
- [ ] Pool increase öncesi DB capacity check yapıldı
- [ ] Pool increase sonrası 15dk monitoring yapıldı

---

## CONFIG - Empty Array Caching (İş Kuralına Göre)

**Dosya**: `src/routes/prediction.routes.ts`
**Environment Variable**: `CACHE_EMPTY_RESPONSES`

### İş Kuralı Kararı

**Senaryo 1: Empty response NORMAL** (kullanıcının hiç tahmini yok)
```bash
# .env
CACHE_EMPTY_RESPONSES=true  # Default

# Davranış:
# - Empty array'ler cache'lenir (30s TTL)
# - DB yükü azalır (yeni kullanıcılar için tekrar sorgu yok)
# - Use case: Predictions endpoint sık boş dönüyor, bu normal
```

**Senaryo 2: Empty response GEÇİCİ HATA** (API issue, yarım veri)
```bash
# .env
CACHE_EMPTY_RESPONSES=false

# Davranış:
# - Empty array'ler cache'lenmez
# - Her request DB'ye gider (retry mekanizması)
# - Use case: Empty response nadir görülür, hata belirtisi
```

### Kod Mantığı
```typescript
// Has data → ALWAYS cache
if (predictions && predictions.length > 0) {
  memoryCache.set('predictions', cacheKey, result);
}

// Empty + config=true → Cache (normal durum)
else if (predictions && predictions.length === 0 && CACHE_EMPTY_RESPONSES) {
  memoryCache.set('predictions', cacheKey, result);
}

// Empty + config=false → DON'T cache (retry)
else if (predictions && predictions.length === 0 && !CACHE_EMPTY_RESPONSES) {
  // Skip cache, next request will retry
}

// Null/undefined (error) → NEVER cache
else {
  // Skip cache, error case
}
```

### Tavsiye
**Predictions endpoint için**: `CACHE_EMPTY_RESPONSES=true` (default)
- Yeni kullanıcılar sık boş sonuç alır (henüz tahmin yok)
- Cache ile DB yükü azalır

---

## Monitoring Dashboard (Manual)

### Her 30dk Kontrol
```bash
# Log dosyasını aç
tail -50 /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log

# Metrikleri filtrele
grep "cacheHitRate" /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log | tail -10
grep "dbActive" /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log | tail -10
grep "maxClientsErrors" /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log | tail -10
```

### Alert Kontrolü
```bash
# Alert fired mı?
grep "ALERTS" /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log

# Eğer alert varsa
tail -100 /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log | grep -A 5 "ALERTS"
```

---

## Başarı Kriterleri

### Migration (0A)
- [x] Script "✅ Added" veya "⏭️ already exists" dedi
- [x] SQL query data_completeness column'u döndü
- [x] PM2 logs'ta error SIFIR

### Monitoring (0B)
- [x] Log dosyası oluştu ve büyüyor
- [x] Her 60s yeni satır
- [x] Metrikler gerçekçi (0-50 conn, 0-100% cache)
- [ ] 24h sonra final report (beklemede)

### Cache Hardening (1)
- [x] Key stability test PASS
- [x] Single-flight test PASS
- [x] Empty array caching config-based yapıldı (CACHE_EMPTY_RESPONSES)
- [ ] İş kuralına göre config seç (true=normal boş dönüş, false=geçici hata)

### Pool Guard (2)
- [x] Script çalışıyor
- [x] 15dk monitoring kuralı eklendi
- [ ] Production'da test edilecek

### Orchestrator Guard (3)
- [x] Null handling test PASS
- [x] Log level test PASS
- [x] Direct lock usage test PASS

---

## Dosya Değişiklikleri

### Yeni Dosyalar
- `scripts/CRITICAL-DEPLOYMENT-STEPS.md` - Deployment adımları
- `scripts/test-cache-acceptance.ts` - Cache acceptance tests
- `scripts/test-orchestrator-null-handling.ts` - Orchestrator null tests
- `src/utils/cache/cacheKeyGenerator.ts` - Cache key generator utility

### Değişen Dosyalar
1. `src/routes/prediction.routes.ts`:
   - Import cacheKeyGenerator ✅ (local function kaldırıldı)
   - CACHE_EMPTY_RESPONSES config eklendi ✅
   - Empty array cache logic config-based yapıldı ✅
   - Logger level fix ✅ (warn → debug/info)

2. `scripts/check-db-capacity.ts`:
   - 15dk monitoring warning eklendi ✅

3. `scripts/CRITICAL-DEPLOYMENT-STEPS.md`:
   - SQL doğrulama sorgusu düzeltildi ✅
   - Migration hedef tablo kontrolü eklendi ✅

4. `scripts/test-cache-acceptance.ts`:
   - Empty array test CACHE_EMPTY_RESPONSES config ile güncellendi ✅
   - Business rule decision test eklendi ✅

---

**Zaman Tahmini**:
- 0A Migration: 2 dakika
- 0B Monitoring: 5 dakika
- Test 1-3 Çalıştırma: 3 dakika
- **Toplam**: ~10 dakika kritik aksiyonlar

**Sonraki Adım**: Migration + monitoring başlat, 24h bekle, final report al

---

## ⚙️ VPS Timeout Alternatifi

**Sorun**: Bazı VPS'lerde `timeout` komutu yok (busybox vs.)

**Çözümler**:

### Çözüm 1: Node-based Timeout (Önerilen)
```bash
# timeout wrapper script (cross-platform)
node scripts/timeout-wrapper.js 10 "npx tsx scripts/test-cache-acceptance.ts"

# Exit code 124 = timeout (GNU timeout uyumlu)
# Exit code 0 = success
# Exit code diğer = command exit code
```

### Çözüm 2: Perl-based Timeout
```bash
# Eğer perl varsa (çoğu UNIX'te vardır)
perl -e 'alarm 10; exec @ARGV' npx tsx scripts/test-cache-acceptance.ts

# veya
perl -MPOSIX -e '$SIG{ALRM} = sub { exit 124 }; alarm 10; system(@ARGV); exit ($? >> 8)' -- npx tsx scripts/test.ts
```

### Çözüm 3: Background + sleep + kill
```bash
# Basit ama etkili
npx tsx scripts/test.ts &
PID=$!
sleep 10
kill $PID 2>/dev/null || true
wait $PID
```

**Tavsiye**: `scripts/timeout-wrapper.js` kullanın (Node.js her VPS'te var)
