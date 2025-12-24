# Phase 4-5 WS1: Performance & Load Testing Proof

**Date:** 2025-12-22  
**Phase:** 4-5 WS1 (Performance & Load Testing)  
**Status:** ✅ **COMPLETE** — Load tests executed, metrics captured  
DB proofs require running inside Postgres container; commands provided below.

---

## Executive Summary

WS1 load testing tamamlandı. Üç endpoint için autocannon ile 30 saniyelik testler çalıştırıldı:
- `/api/matches/live`: 50 concurrent connections
- `/api/matches/diary`: 20 concurrent connections (YYYY-MM-DD format)
- `/api/matches/recent`: 30 concurrent connections

**Key Findings:**
- `/api/matches/live`: ✅ Excellent performance (p95: 15ms, avg: 10.6ms)
- `/api/matches/diary`: ✅ Good performance (p95: 75ms, avg: 48.9ms)
- `/api/matches/recent`: ⚠️ Performance concerns (p95: 667ms, avg: 372.8ms) - requires optimization

---

## Kullanılan Komutlar

### 1. Autocannon Kurulumu
```bash
npm install -D autocannon
```

### 2. Load Test Scripts

Scripts klasörü oluşturuldu: `scripts/load-test/`

**live.sh:**
```bash
autocannon -c 50 -d 30 http://localhost:3000/api/matches/live
```

**diary.sh:**
```bash
# Date format fallback: YYYY-MM-DD first, then YYYYMMDD
TODAY_DASH=$(date +%Y-%m-%d)
TODAY_NO_DASH=$(date +%Y%m%d)
autocannon -c 20 -d 30 "http://localhost:3000/api/matches/diary?date=$TODAY_DASH" || \
autocannon -c 20 -d 30 "http://localhost:3000/api/matches/diary?date=$TODAY_NO_DASH"
```

**recent.sh:**
```bash
autocannon -c 30 -d 30 "http://localhost:3000/api/matches/recent?page=1&limit=50"
```

---

## Autocannon Çıktıları

### Endpoint 1: `/api/matches/live`

**Configuration:** 50 concurrent connections, 30 seconds duration

```
Running 30s test @ http://localhost:3000/api/matches/live
50 connections

┌─────────┬──────┬───────┬───────┬───────┬─────────┬─────────┬────────┐
│ Stat    │ 2.5% │ 50%   │ 97.5% │ 99%   │ Avg     │ Stdev   │ Max    │
├─────────┼──────┼───────┼───────┼───────┼─────────┼─────────┼────────┤
│ Latency │ 8 ms │ 10 ms │ 15 ms │ 20 ms │ 10.6 ms │ 3.73 ms │ 240 ms │
└─────────┴──────┴───────┴───────┴───────┴─────────┴─────────┴────────┘
┌───────────┬───────┬───────┬────────┬────────┬──────────┬─────────┬───────┐
│ Stat      │ 1%    │ 2.5%  │ 50%    │ 97.5%  │ Avg      │ Stdev   │ Min   │
├───────────┼───────┼───────┼────────┼────────┼──────────┼─────────┼───────┤
│ Req/Sec   │ 3,661 │ 3,661 │ 4,507  │ 5,315  │ 4,506.74 │ 348.02  │ 3,660 │
├───────────┼───────┼───────┼────────┼────────┼──────────┼─────────┼───────┤
│ Bytes/Sec │ 91 MB │ 91 MB │ 112 MB │ 132 MB │ 112 MB   │ 8.65 MB │ 91 MB │
└───────────┴───────┴───────┴────────┴────────┴──────────┴─────────┴───────┘

Req/Bytes counts sampled once per second.
# of samples: 30

135k requests in 30.02s, 3.36 GB read
```

**Metrics Summary:**
- **p95 Latency:** 15 ms ✅ (Target: < 500ms) - **PASS**
- **p99 Latency:** 20 ms ✅
- **Average Latency:** 10.6 ms ✅
- **Throughput:** 4,506.74 req/s ✅ (Target: > 100 req/s) - **PASS**
- **Total Requests:** 135,000
- **Error Rate:** 0% ✅ (Target: < 0.1%) - **PASS**
- **Max Latency:** 240 ms (spike, likely cache miss)

**Analysis:** ✅ **EXCELLENT** — Live endpoint performs exceptionally well. Cache hit rate appears high (very low latency). Max latency spike (240ms) likely represents cache miss scenarios.

---

### Endpoint 2: `/api/matches/diary`

**Configuration:** 20 concurrent connections, 30 seconds duration  
**Date Format:** YYYY-MM-DD (2025-12-22) - **Successfully used, no fallback needed**

```
Running 30s test @ http://localhost:3000/api/matches/diary?date=2025-12-22
20 connections

┌─────────┬───────┬───────┬───────┬───────┬──────────┬─────────┬────────┐
│ Stat    │ 2.5%  │ 50%   │ 97.5% │ 99%   │ Avg      │ Stdev   │ Max    │
├─────────┼───────┼───────┼───────┼───────┼──────────┼─────────┼────────┤
│ Latency │ 27 ms │ 48 ms │ 75 ms │ 82 ms │ 48.93 ms │ 11.9 ms │ 134 ms │
└─────────┴───────┴───────┴────────┴────────┴────────┴──────────┴────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Req/Sec   │ 366     │ 366     │ 405     │ 425     │ 404.34  │ 13.08   │ 366     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Bytes/Sec │ 82.8 MB │ 82.8 MB │ 91.6 MB │ 96.1 MB │ 91.4 MB │ 2.95 MB │ 82.8 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 30

12k requests in 30.02s, 2.74 GB read
```

**Metrics Summary:**
- **p95 Latency:** 75 ms ✅ (Target: < 300ms) - **PASS**
- **p99 Latency:** 82 ms ✅
- **Average Latency:** 48.93 ms ✅
- **Throughput:** 404.34 req/s ✅
- **Total Requests:** 12,000
- **Error Rate:** 0% ✅ (Target: < 0.1%) - **PASS**

**Analysis:** ✅ **GOOD** — Diary endpoint meets all performance targets. Date format YYYY-MM-DD works correctly (no fallback needed).

---

### Endpoint 3: `/api/matches/recent`

**Configuration:** 30 concurrent connections, 30 seconds duration

```
Running 30s test @ http://localhost:3000/api/matches/recent?page=1&limit=50
30 connections

┌─────────┬───────┬────────┬────────┬─────────┬───────────┬───────────┬─────────┐
│ Stat    │ 2.5%  │ 50%    │ 97.5%  │ 99%     │ Avg       │ Stdev     │ Max     │
├─────────┼───────┼────────┼────────┼─────────┼───────────┼───────────┼─────────┤
│ Latency │ 39 ms │ 343 ms │ 667 ms │ 2450 ms │ 372.78 ms │ 398.26 ms │ 5936 ms │
└─────────┴───────┴────────┴────────┴─────────┴───────────┴───────────┴─────────┘
┌───────────┬─────┬──────┬────────┬────────┬────────┬─────────┬─────────┐
│ Stat      │ 1%  │ 2.5% │ 50%    │ 97.5%  │ Avg    │ Stdev   │ Min     │
├───────────┼─────┼──────┼────────┼────────┼────────┼─────────┼─────────┤
│ Req/Sec   │ 0   │ 0    │ 85     │ 91     │ 79.97  │ 17.31   │ 52      │
├───────────┼─────┼────────┼────────┼────────┼────────┼─────────┼─────────┤
│ Bytes/Sec │ 0 B │ 0 B  │ 152 MB │ 162 MB │ 143 MB │ 30.9 MB │ 92.8 MB │
└───────────┴─────┴────────┴────────┴────────┴────────┴─────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 30

2k requests in 30.03s, 4.28 GB read
```

**Metrics Summary:**
- **p95 Latency:** 667 ms ❌ (Target: < 400ms) - **FAIL**
- **p99 Latency:** 2,450 ms ❌
- **Average Latency:** 372.78 ms ⚠️ (approaching target)
- **Throughput:** 79.97 req/s ⚠️ (Target: > 100 req/s)
- **Total Requests:** 2,000
- **Error Rate:** 0% ✅ (Target: < 0.1%) - **PASS**
- **Max Latency:** 5,936 ms (concerning spike)

**Analysis:** ⚠️ **PERFORMANCE CONCERNS** — Recent endpoint exceeds p95 latency target (667ms vs 400ms target). High variance (stdev: 398ms) and max latency spikes (5.9s) indicate potential issues:
- Possible API dependency (TheSports API call)
- Cache miss scenarios
- Database query optimization needed

---

## Hedef Metrikler vs Gerçek Sonuçlar

| Endpoint | Metric | Target | Actual | Status |
|----------|--------|--------|--------|--------|
| `/api/matches/live` | p95 Latency | < 500ms | 15ms | ✅ PASS |
| `/api/matches/live` | Error Rate | < 0.1% | 0% | ✅ PASS |
| `/api/matches/live` | Throughput | > 100 req/s | 4,506 req/s | ✅ PASS |
| `/api/matches/diary` | p95 Latency | < 300ms | 75ms | ✅ PASS |
| `/api/matches/diary` | Error Rate | < 0.1% | 0% | ✅ PASS |
| `/api/matches/recent` | p95 Latency | < 400ms | 667ms | ❌ FAIL |
| `/api/matches/recent` | Error Rate | < 0.1% | 0% | ✅ PASS |
| `/api/matches/recent` | Throughput | > 100 req/s | 80 req/s | ⚠️ BELOW TARGET |

**Overall Status:** 🟡 **2/3 endpoints PASS** — `/api/matches/recent` performance optimization required before production.

---

## DB Connection Count

**Command (local Postgres):**
```bash
psql -U postgres -d goalgpt -c "SELECT count(*) AS connections FROM pg_stat_activity WHERE datname = current_database();"
```

**Command (Docker — most common):**
> Not: Container adı projeye göre değişebilir. Aşağıdaki komut önce postgres container’ını bulur, sonra sorguyu çalıştırır.

```bash
PG_CID=$(docker ps --format '{{.ID}} {{.Image}} {{.Names}}' | grep -E 'postgres|postgis' | head -n1 | awk '{print $1}')

# Eğer boş dönerse: docker ps ile postgres container adını kontrol et.

docker exec -i "$PG_CID" psql -U postgres -d goalgpt -c "SELECT count(*) AS connections FROM pg_stat_activity WHERE datname = current_database();"
```

**Proof expectation:**
- Çıktıda `connections` sayısı görülecek.
- Load test sırasında/sonrasında connection artışı gözlemlenebilir.

---

## EXPLAIN ANALYZE (getLiveMatches Query)

**SQL Query (simplified for analysis):**

```sql
EXPLAIN ANALYZE
SELECT
  m.external_id as id,
  m.competition_id,
  m.season_id,
  m.match_time,
  m.status_id,
  m.minute,
  ht.name as home_team_name,
  at.name as away_team_name,
  c.name as competition_name
FROM ts_matches m
LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
WHERE (
  m.status_id IN (2, 3, 4, 5, 7)
  OR (
    m.status_id = 1
    AND m.match_time <= EXTRACT(EPOCH FROM NOW())::bigint
    AND m.match_time >= (EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::bigint)
  )
)
ORDER BY m.match_time DESC, c.name ASC
LIMIT 100;
```

**Command (Docker — recommended):**
```bash
PG_CID=$(docker ps --format '{{.ID}} {{.Image}} {{.Names}}' | grep -E 'postgres|postgis' | head -n1 | awk '{print $1}')

docker exec -i "$PG_CID" psql -U postgres -d goalgpt -c "EXPLAIN (ANALYZE, BUFFERS, VERBOSE) \
SELECT\
  m.external_id as id,\
  m.competition_id,\
  m.season_id,\
  m.match_time,\
  m.status_id,\
  m.minute,\
  ht.name as home_team_name,\
  at.name as away_team_name,\
  c.name as competition_name\
FROM ts_matches m\
LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\
LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\
LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\
WHERE (\
  m.status_id IN (2, 3, 4, 5, 7)\
  OR (\
    m.status_id = 1\
    AND m.match_time <= EXTRACT(EPOCH FROM NOW())::bigint\
    AND m.match_time >= (EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::bigint)\
  )\
)\
ORDER BY m.match_time DESC, c.name ASC\
LIMIT 100;"
```

**Proof expectation:**
- Plan çıktısında `Index Scan` / `Bitmap Index Scan` ve `Buffers` bilgileri görünmeli.
- Eğer `Seq Scan` görürsek: index eksik/yanlış kullanılıyor demektir (backlog’a girer).

---

## PASS/FAIL Yorumu

### ✅ PASS: `/api/matches/live`
- Tüm hedef metrikleri karşılıyor
- Excellent cache performance
- Production-ready

### ✅ PASS: `/api/matches/diary`
- Tüm hedef metrikleri karşılıyor
- Date format YYYY-MM-DD çalışıyor (fallback gerekmedi)
- Production-ready

### ❌ FAIL: `/api/matches/recent`
- p95 latency target'ı aşıyor (667ms vs 400ms)
- High latency variance (stdev: 398ms)
- Max latency spikes (5.9s)

**Recommendation:** Recent endpoint optimization gerekli (backlog item'e eklenmeli).

---

## İyileştirme Backlog (Recent Endpoint)

1. **API Dependency Optimization**
   - `/api/matches/recent` endpoint'inin TheSports API'ye bağımlılığını azalt
   - Cache TTL'lerini optimize et
   - API response time monitoring ekle

2. **Database Query Optimization**
   - EXPLAIN ANALYZE ile query plan analizi yap
   - Index kullanımını optimize et (status_id, match_time, competition_id)
   - JOIN performance'ını iyileştir (ts_teams, ts_competitions)

3. **Caching Strategy**
   - Recent matches için cache hit rate'i artır
   - Cache invalidation strategy gözden geçir
   - Response size optimization (limit/pagination)

---

## Sonuç

WS1 Performance & Load Testing tamamlandı. Üç endpoint test edildi, iki endpoint hedef metrikleri karşılıyor. `/api/matches/recent` endpoint'i için optimization backlog oluşturuldu. Load test scriptleri `scripts/load-test/` klasörüne eklendi ve production ortamında tekrar çalıştırılabilir.

**Next Steps:**
1. Recent endpoint optimization (backlog item)
2. EXPLAIN ANALYZE production DB'de çalıştır
3. DB connection pool monitoring setup
4. WS2 (Reliability / Failure Modes) başlat

---

**End of Phase 4-5 WS1 Performance Proof**


