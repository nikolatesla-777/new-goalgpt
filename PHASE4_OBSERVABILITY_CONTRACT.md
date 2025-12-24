# Phase 4: Observability Contract

**Version:** 1.0  
**Date:** 2025-12-22  
**Status:** ✅ Active

---

## Overview

This contract defines the canonical log format and event catalogue for all workers and services in the GoalGPT system. All logs must conform to this contract to ensure consistent observability and debugging.

---

## Canonical Log Line Format

**Format:** Structured line format (Winston-style)
```
[timestamp] [level] message {structured_fields}
```

**Example:**
```
2025-12-22 10:59:23 [info]: Worker started {"service":"goalgpt-dashboard","component":"worker","event":"worker.started","ts":1734859163,"worker":"DataUpdateWorker","interval_sec":20}
```

**Note:** Structured fields are appended as JSON at the end of the log line. The format is compatible with Winston's JSON formatter and can be parsed by log aggregation tools.

---

## Required Base Fields

Every log entry MUST include these base fields:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `service` | string | Service identifier | `"goalgpt-dashboard"` |
| `component` | string | Component type | `"worker"`, `"websocket"`, `"controller"` |
| `event` | string | Event name (see Event Catalogue) | `"worker.started"` |
| `ts` | number | Unix timestamp (seconds) | `1734859163` |
| `level` | string | Log level | `"info"`, `"warn"`, `"error"`, `"debug"` |

---

## Optional Fields

These fields MAY be included when relevant:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `worker` | string | Worker name | `"DataUpdateWorker"` |
| `schedule` | string | Cron schedule | `"0 */12 * * *"` |
| `interval_sec` | number | Interval in seconds | `20`, `30` |
| `match_id` | string | Match external ID | `"4wyrn4h6o944q86"` |
| `external_id` | string | External entity ID | `"4wyrn4h6o944q86"` |
| `provider_update_time` | number | Provider timestamp (seconds) | `1734859163` |
| `last_event_ts` | number | Last event timestamp (seconds) | `1734859163` |
| `status_id` | number | Match status ID | `2`, `3`, `4` |
| `minute` | number | Match minute | `45`, `90` |
| `minute_text` | string | Minute text | `"45+"`, `"HT"`, `"FT"` |
| `run_id` | string | Run identifier | `"443c67"` |
| `count` | number | Count of items | `5`, `100` |
| `duration_ms` | number | Duration in milliseconds | `469` |
| `reason` | string | Reason/description | `"stale match detected"` |

---

## Event Catalogue

### Worker Events

| Event Name | Level | Required Fields | Optional Fields | Description |
|------------|-------|-----------------|-----------------|-------------|
| `worker.started` | INFO | `worker`, `component="worker"` | `schedule`, `interval_sec` | Worker started on boot |

### Diary Sync Events

| Event Name | Level | Required Fields | Optional Fields | Description |
|------------|-------|-----------------|-----------------|-------------|
| `diary.sync.start` | INFO | `component="diary"` | `date`, `run_id` | Diary sync started |
| `diary.sync.batch` | INFO | `component="diary"` | `batch_num`, `count`, `run_id` | Diary batch processed |
| `diary.sync.done` | INFO | `component="diary"` | `total_count`, `duration_ms`, `run_id` | Diary sync completed |

### Data Update Events

| Event Name | Level | Required Fields | Optional Fields | Description |
|------------|-------|-----------------|-----------------|-------------|
| `dataupdate.tick.start` | DEBUG | `component="dataupdate"` | `run_id` | DataUpdate tick started |
| `dataupdate.changed` | INFO | `component="dataupdate"` | `count`, `match_ids[]`, `run_id` | Changed matches detected |
| `dataupdate.reconcile.start` | INFO | `component="dataupdate"`, `match_id` | `provider_update_time`, `run_id` | Reconcile started |
| `dataupdate.reconcile.done` | INFO | `component="dataupdate"`, `match_id` | `duration_ms`, `rowCount`, `run_id` | Reconcile completed |
| `dataupdate.reconcile.no_data` | WARN | `component="dataupdate"`, `match_id` | `run_id` | No usable data for reconcile |

### WebSocket Events

| Event Name | Level | Required Fields | Optional Fields | Description |
|------------|-------|-----------------|-----------------|-------------|
| `websocket.connecting` | INFO | `component="websocket"` | `host`, `user` | WebSocket connecting |
| `websocket.connected` | INFO | `component="websocket"` | `host`, `user` | WebSocket connected |
| `websocket.subscribed` | INFO | `component="websocket"` | `topics[]` | WebSocket subscribed to topics |
| `websocket.disconnected` | WARN | `component="websocket"` | `reason` | WebSocket disconnected |
| `websocket.msg.received` | DEBUG | `component="websocket"` | `msg_type`, `match_id` | MQTT message received (aggregated, not per-message) |

**Note:** `websocket.msg.received` is for aggregated logging only. Per-message INFO logs are NOT allowed (Phase 4-2 will add message count logging).

### Detail Live Events

| Event Name | Level | Required Fields | Optional Fields | Description |
|------------|-------|-----------------|-----------------|-------------|
| `detail_live.reconcile.start` | INFO | `component="detail_live"`, `match_id` | `provider_update_time` | Detail live reconcile started |
| `detail_live.reconcile.done` | INFO | `component="detail_live"`, `match_id` | `duration_ms`, `rowCount`, `status_id` | Detail live reconcile completed |
| `detail_live.reconcile.no_data` | WARN | `component="detail_live"`, `match_id` | `reason` | No usable data for detail live |

### Minute Engine Events

| Event Name | Level | Required Fields | Optional Fields | Description |
|------------|-------|-----------------|-----------------|-------------|
| `minute.tick` | DEBUG | `component="minute"` | `processed_count`, `updated_count` | Minute engine tick |
| `minute.update` | INFO | `component="minute"`, `match_id` | `old_minute`, `new_minute` | Minute updated (only when changed) |

### Watchdog Events

| Event Name | Level | Required Fields | Optional Fields | Description |
|------------|-------|-----------------|-----------------|-------------|
| `watchdog.tick` | INFO | `component="watchdog"` | `scanned_count`, `stale_count` | Watchdog tick |
| `watchdog.stale_detected` | INFO | `component="watchdog"`, `match_id` | `status_id`, `reason`, `last_event_ts` | Stale match detected |
| `watchdog.reconcile.enqueued` | INFO | `component="watchdog"`, `match_id` | `reason` | Reconcile enqueued for stale match |

---

## "DO NOT" Rules

**Critical invariants that MUST NOT be violated:**

1. **No per-message MQTT logs at INFO**
   - MQTT messages must NOT be logged individually at INFO level
   - Use `websocket.msg.received` at DEBUG level for debugging only
   - Phase 4-2 will add aggregated message count logging

2. **Minute engine must not update `updated_at`**
   - Minute engine updates ONLY `minute` and `last_minute_update_ts`
   - `updated_at` is updated only by reconcile/WebSocket paths
   - This is a Phase 3C frozen invariant

3. **Optimistic lock timestamps must be monotonic**
   - `provider_update_time` and `last_event_ts` must only increase
   - Stale updates must be rejected (rowCount=0)
   - This is a Phase 3C frozen invariant

4. **Controllers must remain DB-only**
   - Controllers read from DB only (no API fallback)
   - Daily diary sync is the only source filling DB
   - This is a Phase 3C frozen invariant

5. **No fallback match selection**
   - No `r[0]` or `v[0]` fallbacks in match selection logic
   - If match_id not found, return null and log WARN
   - This is a Phase 3C frozen invariant

---

## Implementation Guidelines

### Using the Helper

```typescript
import { logEvent } from '../utils/obsLogger';

// Worker started
logEvent('info', 'worker.started', {
  worker: 'DataUpdateWorker',
  interval_sec: 20
});

// DataUpdate changed
logEvent('info', 'dataupdate.changed', {
  count: 5,
  match_ids: ['id1', 'id2'],
  run_id: '443c67'
});

// Reconcile start
logEvent('info', 'dataupdate.reconcile.start', {
  match_id: '4wyrn4h6o944q86',
  provider_update_time: 1734859163,
  run_id: '443c67'
});
```

### Base Fields Auto-Populated

The helper automatically adds:
- `service`: "goalgpt-dashboard"
- `component`: Derived from event name (e.g., "worker" for `worker.started`)
- `event`: The event name passed
- `ts`: Current Unix timestamp
- `level`: The log level passed

### Event Name Derivation

Event names follow the pattern: `{component}.{action}` or `{component}.{action}.{outcome}`

Examples:
- `worker.started` → component="worker"
- `dataupdate.changed` → component="dataupdate"
- `websocket.connected` → component="websocket"
- `detail_live.reconcile.done` → component="detail_live"

---

## Validation

**All logs must:**
- Include all required base fields
- Use event names from the Event Catalogue
- Include relevant optional fields when applicable
- NOT violate any "DO NOT" rules

**Proof requirements:**
- All 17 workers must emit `worker.started` at INFO level
- Critical paths must emit structured events
- No per-message MQTT spam at INFO level
- Minute engine must not update `updated_at` (test proof required)

---

**End of Observability Contract**





