# CRITICAL DEPLOYMENT STEPS - HEMEN YAPILACAK

## 0A) data_completeness Migration - PROD

### Adım 1: Migration Çalıştır
```bash
# SSH to prod
ssh root@142.93.103.128

# Navigate
cd /var/www/goalgpt/current

# Check Node version
node -v

# Run migration
npx ts-node src/scripts/run-half-stats-migration.ts
```

### Adım 2: Doğrula (SQL) - DİNAMİK TABLO KONTROLÜ

**OTOMAT İK VERİFİKASYON** (Önerilen):
```bash
# Dinamik doğrulama script'i (migration'dan tablo adını otomatik çıkarır)
./scripts/verify-migration.sh

# Beklenen çıktı:
# Step 1: Extracting target table from migration...
# ✅ Migration targets table: ts_matches
#
# Step 2: Verifying columns in 'ts_matches'...
# data_completeness        | jsonb | '{"first_half": false, ...}'
# incidents_first_half     | jsonb | '[]'
# incidents_second_half    | jsonb | '[]'
# statistics_second_half   | jsonb | NULL
#
# ✅ All 4 columns found in table 'ts_matches'
```

**MANUEL VERİFİKASYON** (Script yoksa):
```bash
# Step 1: Migration hangi tabloyu hedefliyor? (HARD-CODE YOK!)
TARGET_TABLE=$(grep -oP "ALTER TABLE \K\w+" src/database/migrations/add-half-statistics-persistence.ts | head -1)
echo "Migration targets: $TARGET_TABLE"

# Step 2: Dinamik SQL sorgusu (extracted table kullan)
psql -U postgres -d goalgpt -c "
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name = '$TARGET_TABLE'
  AND column_name IN (
    'data_completeness',
    'statistics_second_half',
    'incidents_first_half',
    'incidents_second_half'
  )
ORDER BY column_name;
"

# Expected: 4 rows

# Step 3: Index kontrolü (dinamik tablo adı ile)
psql -U postgres -d goalgpt -c "
SELECT indexname, indexdef
FROM pg_indexes
WHERE table_schema='public'
  AND tablename = '$TARGET_TABLE'
  AND indexname LIKE '%data_completeness%';
"
```

**ÖNEMLİ**:
- ❌ `table_name = 'ts_matches'` gibi hard-coded sorgular KULLANMA
- ✅ Migration'dan tablo adını extract et, onu kullan
- ✅ Eğer migration başka tablo hedefleseydi (örn. ts_half_statistics), script otomatik o tabloya bakar

### Adım 3: PM2 Log Kontrolü
```bash
# Watch logs for errors
pm2 logs goalgpt --lines 50 | grep "data_completeness"

# Expected: NO MORE "column data_completeness does not exist" errors
# Before: [HalfStatsPersistence] column "data_completeness" does not exist
# After: Should be ZERO occurrences
```

### Beklenen Çıktı
Migration script'ten:
```
========================================
Running Half Statistics Persistence Migration
========================================
Starting half statistics persistence migration...
✅ Added statistics_second_half column to ts_matches
✅ Added incidents_first_half column to ts_matches
✅ Added incidents_second_half column to ts_matches
✅ Added data_completeness column to ts_matches
✅ Created index on data_completeness column
✅ Half statistics persistence migration completed successfully

📊 Current half statistics columns in ts_matches:
┌─────────┬────────────────────────┬───────────┬────────────────────────────────────────────────────────────┐
│ (index) │     column_name        │ data_type │                    column_default                          │
├─────────┼────────────────────────┼───────────┼────────────────────────────────────────────────────────────┤
│    0    │ 'data_completeness'    │ 'jsonb'   │ '{"first_half": false, "second_half": false, ...}'         │
│    1    │ 'first_half_stats'     │ 'jsonb'   │ NULL                                                       │
│    2    │ 'incidents_first_half' │ 'jsonb'   │ '[]'                                                       │
│    3    │ 'incidents_second_half'│ 'jsonb'   │ '[]'                                                       │
│    4    │ 'statistics_second_half'│'jsonb'   │ NULL                                                       │
└─────────┴────────────────────────┴───────────┴────────────────────────────────────────────────────────────┘
```

**EĞER** "already exists" derse:
```
⏭️ data_completeness column already exists, skipping
⏭️ data_completeness index already exists, skipping
```
Bu OK - script idempotent.

---

## 0B) 24h Monitoring - Kanıt Üretimi

### Adım 1: Monitoring Directory Oluştur
```bash
# On prod server
mkdir -p /var/www/goalgpt/shared/monitoring
```

### Adım 2: Monitoring Başlat (Timestamp'li Log)
```bash
cd /var/www/goalgpt/current

# Start monitoring with file output
npx tsx scripts/monitor-pool-health.ts | tee -a /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log

# Alternative: nohup for background
nohup npx tsx scripts/monitor-pool-health.ts >> /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log 2>&1 &
```

### Adım 3: Snapshot Görüntüleme
```bash
# Her 30dk snapshot görmek için:
tail -f /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log

# Belirli metrikleri grep'le:
tail -f /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log | grep "Status\|ALERTS"
```

### Beklenen Log Formatı
```
[2026-01-24T12:00:00.000Z] [PoolHealthMonitor] Status {
  maxClientsErrors: 0,
  cacheHitRate: '65%',
  dbActive: '25/50',
  poolIdle: 15,
  poolWaiting: 0,
  alerts: 'none'
}

[2026-01-24T12:30:00.000Z] [PoolHealthMonitor] Status {
  maxClientsErrors: 0,
  cacheHitRate: '68%',
  dbActive: '28/50',
  poolIdle: 12,
  poolWaiting: 0,
  alerts: 'none'
}

=== ALERTS ===
⚠️ Cache hit rate low: 45% (target: >60%, trigger: <50%)
```

### 24 Saat Sonra - Final Report
```
=== 24H MONITORING REPORT ===
Duration: 1440 samples
Start: 2026-01-24T10:00:00.000Z
End: 2026-01-25T10:00:00.000Z

MaxClients Errors: 0 (target: 0)
Cache Hit Rate (avg): 67.5% (target: >60%)
DB Active Connections (avg): 26.3 (max: 42, limit: 45)

=== RECOMMENDATIONS ===
✅ All metrics healthy - continue monitoring
```

---

## Kritik Metrikler (Her 30dk Snapshot)

| Zaman | Active Conn | Waiting Queue | MaxClients | Cache Hit |
|-------|-------------|---------------|------------|-----------|
| 10:00 | 25/50       | 0             | 0          | 65%       |
| 10:30 | 28/50       | 0             | 0          | 68%       |
| 11:00 | 32/50       | 1             | 0          | 62%       |
| ...   | ...         | ...           | ...        | ...       |

---

## Monitoring Kontrolü

### Test 1: Monitoring Çalışıyor mu?
```bash
# Log dosyası büyüyor mu?
watch -n 60 'ls -lh /var/www/goalgpt/shared/monitoring/pool-health-*.log'

# Son 5 satır
tail -5 /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log
```

### Test 2: Metrikler Anlamlı mı?
```bash
# MaxClients error count
grep "maxClientsErrors" /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log | tail -10

# Cache hit rate trend
grep "cacheHitRate" /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log | tail -10

# DB active connections peak
grep "dbActive" /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log | sort -t':' -k2 -rn | head -5
```

### Test 3: Alert Detection
```bash
# Check if any alerts fired
grep "ALERTS" /var/www/goalgpt/shared/monitoring/pool-health-$(date +%F).log

# Expected: Empty or specific warnings
```

---

## Başarı Kriterleri

### 0A Migration Başarılı ✅
- [ ] Migration script "✅ Added" veya "⏭️ already exists" dedi
- [ ] SQL query `data_completeness` column'u döndü
- [ ] PM2 logs'ta "column data_completeness does not exist" SIFIR

### 0B Monitoring Başarılı ✅
- [ ] Log dosyası oluştu: `/var/www/goalgpt/shared/monitoring/pool-health-*.log`
- [ ] Her 60s yeni satır ekleniyor
- [ ] Metrikler gerçekçi (active conn 0-50, cache hit 0-100%)
- [ ] 24h sonra final report üretildi

---

## Rollback Plan

### Migration Rollback (SADECE GEREKİRSE)
```sql
-- Drop index
DROP INDEX IF EXISTS idx_ts_matches_data_completeness;

-- Drop columns
ALTER TABLE ts_matches DROP COLUMN IF EXISTS data_completeness;
ALTER TABLE ts_matches DROP COLUMN IF EXISTS statistics_second_half;
ALTER TABLE ts_matches DROP COLUMN IF EXISTS incidents_first_half;
ALTER TABLE ts_matches DROP COLUMN IF EXISTS incidents_second_half;
```

### Monitoring Durdur
```bash
# Find process
ps aux | grep monitor-pool-health

# Kill
kill <PID>

# Or if nohup
pkill -f monitor-pool-health
```

---

**Zaman**: 0A = 2 dakika, 0B = 5 dakika (başlatma)
**Toplam**: ~7 dakika kritik adımlar
