# Orchestrator Status Contract - TEKİL SÖZLEŞME

## Resmi Status Dönüş Değerleri

### MatchOrchestrator.updateMatch() Return Type
```typescript
interface UpdateResult {
  status: 'success' | 'rejected_stale' | 'rejected_locked' | 'rejected_invalid';
  fieldsUpdated: string[];
  reason?: string;
}
```

---

## Status Definitions

### 1. `'success'`
**Anlamı**: Match güncellendi
**Koşul**: Lock acquired + updates applied
**Job Action**: Count as success, don't retry
**Log Level**: `info` or `debug`

### 2. `'rejected_stale'`
**Anlamı**: Higher priority source already updated
**Koşul**: Timestamp older than existing data
**Job Action**: Skip, don't retry (normal behavior)
**Log Level**: `debug`

### 3. `'rejected_locked'`
**Koşul**: Advisory lock busy (another process updating)
**Job Action**: Skip, may retry on next tick (normal behavior)
**Log Level**: `debug`

### 4. `'rejected_invalid'` ⚠️ CRITICAL
**Anlamı**: Invalid matchId (lockKey === null)
**Koşul**: `LOCK_KEYS.matchUpdateLock(matchId)` returned `null`
**Job Action**: Skip permanently, count separately
**Log Level**: `debug` (NOT error/warn - this is defensive programming)

---

## YANLIŞLAR (Kullanılmaz)

❌ `status: 'error'` - **ASLA KULLANMA**
- Orchestrator `error` status döndürmez
- Hata fırlatırsa exception throw eder
- Job'lar bunu `catch` bloğunda yakalar

❌ `status: 'failed'` - **ASLA KULLANMA**
- Orchestrator bu status'ü döndürmez

---

## Kod Sözleşmesi

### LOCK_KEYS.matchUpdateLock()
```typescript
matchUpdateLock: (matchId: number | string): bigint | null => {
  // Invalid matchId → return null (NO THROW)
  if (!matchId || matchId === '') {
    return null;  // ✅ Correct
  }

  // Generate lock key
  return BigInt(lockKey);
}
```

### MatchOrchestrator.updateMatch()
```typescript
async updateMatch(matchId: string, updates: FieldUpdate[], source: string): Promise<UpdateResult> {
  const lockKey = LOCK_KEYS.matchUpdateLock(matchId);

  // Invalid matchId → rejected_invalid (NO THROW, NO ERROR STATUS)
  if (lockKey === null) {
    logger.debug(`[MatchOrchestrator] Skipping update for invalid matchId: ${matchId}`);
    return {
      status: 'rejected_invalid',  // ✅ Correct - not 'error'
      fieldsUpdated: [],
      reason: 'invalid_match_id'
    };
  }

  // ... rest of logic
}
```

### Job Caller Pattern (ALL JOBS)
```typescript
// ✅ CORRECT PATTERN
const result = await matchOrchestrator.updateMatch(matchId, updates, 'computed');

if (result.status === 'success') {
  updatedCount++;
  logger.debug(`Updated ${matchId}`);
}
else if (result.status === 'rejected_stale') {
  logger.debug(`Skipped ${matchId}: stale data`);
  skippedCount++;
}
else if (result.status === 'rejected_locked') {
  logger.debug(`Skipped ${matchId}: lock busy`);
  skippedCount++;
}
else if (result.status === 'rejected_invalid') {
  // ⚠️ CRITICAL: Log as DEBUG, not warn/error
  logger.debug(`Skipped ${matchId}: invalid matchId`);  // ✅ Correct
  skippedCount++;
}
else {
  // This should never happen (TypeScript exhaustiveness check)
  logger.warn(`Unknown orchestrator status: ${result.status}`);
}
```

---

## Metrik & Monitoring

### Prometheus Metrics (Önerilen)
```typescript
// Counters
orchestrator_updates_total{status="success"}
orchestrator_updates_total{status="rejected_stale"}
orchestrator_updates_total{status="rejected_locked"}
orchestrator_updates_total{status="rejected_invalid"}  // ⚠️ Separate counter

// Gauges
orchestrator_lock_contention_rate  // rejected_locked / total
orchestrator_invalid_match_ids_rate  // rejected_invalid / total
```

### Alert Rules
```yaml
# ✅ CORRECT: Monitor invalid match IDs separately
- alert: HighInvalidMatchIdRate
  expr: orchestrator_updates_total{status="rejected_invalid"} > 100
  annotations:
    summary: "Too many invalid match IDs (defensive check triggering)"

# ❌ WRONG: Don't alert on rejected_invalid as "error"
# This is normal defensive programming, not a failure
```

---

## Örnekler

### ✅ Doğru Kullanım
```typescript
// matchMinute.job.ts
if (orchestratorResult.status === 'rejected_invalid') {
  logger.debug(`[MinuteEngine.orchestrator] Skipped ${matchId}: invalid matchId`);
  skippedCount++;
}
```

### ❌ Yanlış Kullanım
```typescript
// ❌ WRONG 1: Log as error
if (orchestratorResult.status === 'rejected_invalid') {
  logger.error(`Invalid match ID: ${matchId}`);  // ❌ Too noisy
}

// ❌ WRONG 2: Check for 'error' status (doesn't exist)
if (orchestratorResult.status === 'error') {  // ❌ Never returned
  // This will never execute
}

// ❌ WRONG 3: Throw exception
if (orchestratorResult.status === 'rejected_invalid') {
  throw new Error('Invalid match ID');  // ❌ Breaks defensive pattern
}
```

---

## Özet Tablosu

| Status | Anlamı | Log Level | Retry? | Metric |
|--------|--------|-----------|--------|--------|
| `success` | Updated | info/debug | No | orchestrator_success |
| `rejected_stale` | Timestamp old | debug | No | orchestrator_stale |
| `rejected_locked` | Lock busy | debug | Maybe (next tick) | orchestrator_locked |
| `rejected_invalid` | Invalid matchId | **debug** | No | orchestrator_invalid |

---

## Test Checklist

- [ ] LOCK_KEYS.matchUpdateLock() returns `null` for invalid IDs (no throw)
- [ ] MatchOrchestrator returns `rejected_invalid` (not `error`)
- [ ] All jobs log `rejected_invalid` as **DEBUG** (not warn/error)
- [ ] Metrics track `rejected_invalid` separately
- [ ] No alerts fire on `rejected_invalid` (it's defensive, not failure)

---

**SONUÇ**: `rejected_invalid` is a **defensive programming pattern**, not an error condition. Log at DEBUG level and track separately.
