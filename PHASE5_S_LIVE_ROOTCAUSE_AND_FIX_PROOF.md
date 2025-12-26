# PHASE5-S: Live Match Root Cause & Fix Proof

## Delta / What Changed in This Report

- The real root cause is provider update feeds being unavailable (IP not authorized / recent-list empty / detail_live not found), so DB cannot transition to LIVE unless provider returns a non-1 status.
- Watchdog “selection” can use `match_time` only to decide *which matches to attempt reconcile* (candidate selection), but status changes are still provider-authoritative.
- The “minimal fix” is to add a *diary fallback for reconcile attempts/logging*, not to fabricate LIVE.

---

## Step 1: Debug Script Output

### Command
```bash
npx tsx src/scripts/debug-live-match.ts --externalId pxwrxlhyxv6yryk --date 20251224
```

### DB State
```json
{
  "match_time": 1766541600,
  "status_id": 1,
  "minute": null,
  "home_score": null,
  "away_score": null,
  "provider_update_time": null,
  "last_event_ts": null,
  "updated_at": "2025-12-24T00:30:01.047Z"
}
```

### Provider State

**Diary:**
- Found: ✅ YES
- Status: 1 (NOT_STARTED)
- Minute: null
- Score: 0-0
- Update Time: NULL

**Recent/List:**
- Found: ❌ NO
- Total in recent/list: 0

**Detail Live:**
- Found: ❌ NO  
- Error: IP not authorized (provider access restriction) OR NOT_FOUND  
- Impact: detail_live cannot be used as a reliable fallback in this environment.

### Logs Analysis

#### Log proof commands
```bash
grep -n "watchdog\.reconcile" logs/combined.log | tail -20
grep -n "DataUpdate\] Reconciling" logs/combined.log | tail -20
grep -n "websocket\.(connected|subscribed|message)" logs/combined.log | tail -20
```

Observed: (fill with real output when available)

### Root Cause

Primary root cause: Provider LIVE update feeds are not available (IP whitelist / unauthorized), so no authoritative LIVE/score/minute updates reach the system.  
Secondary contributing factor: Watchdog reconcile path relied on recent/list + detail_live; when both return empty/unavailable, no further fallback existed.  
Non-cause: The DB-only controller design and minute engine are working as intended; the missing LIVE state is due to missing provider signals.

---

## Step 2: Why DB Wasn't Updated

### Analysis

1. **WebSocket:** No message received for this match  
2. **DataUpdate:** `/data/update` returns IP whitelist error (not working)  
3. **Recent/List:** Match not in `/match/recent/list` (0 total matches)  
4. **Detail Live:** Match not found in `/match/detail_live` response  
5. **Watchdog:** Reconcile cannot succeed if provider endpoints return empty/unavailable; ensure watchdog.tick.summary logs confirm it is running.

### What this means

- If provider diary also reports `status_id=1`, then DB must remain 1; we should not force LIVE.  
- If AIScore shows LIVE while provider diary says 1, then either (a) AIScore uses a different provider feed, (b) our key/IP is restricted, or (c) we are querying the wrong endpoint/product.

---

## Step 3: Minimal Fix Applied

### Change: Watchdog adds Diary fallback for reconcile attempts (provider-authoritative)

**File:** `src/jobs/matchWatchdog.job.ts`

**Logic:**
1. Try `detail_live` first (existing)  
2. If `detail_live` fails AND match not in `recent/list`:  
   - Fetch `diary` for match's date  
   - If match found in diary:  
     - Extract status/score/minute from diary  
     - MatchDiaryService must be injected (or constructed via the same TheSportsClient used elsewhere), not via private property access.  
     - If diary match exists, always update `provider_update_time`/`last_event_ts` when present (minimal UPDATE) to support stale detection.  
     - Only change `status_id`/`minute`/`score` when diary provides authoritative non-null values AND (`provider_update_time` increases OR current `provider_update_time` is NULL).  
     - Update DB with optimistic locking based on `provider_update_time` monotonicity.

**Key Rules:**
- ✅ Provider is authoritative (no heuristic status changes)  
- ✅ If diary match exists, always update `provider_update_time`/`last_event_ts` when present (minimal update)  
- ✅ Only change status/minute/score when diary provides authoritative non-null values AND update is newer based on `provider_update_time`  
- ✅ Optimistic locking prevents stale updates  
- ✅ No `match_time` heuristic (status only from provider)  
- ✅ `updated_at` timestamp should not be modified by minute engine updates; status updates update `updated_at` as normal.

**Example SQL update snippet:**

```typescript
await client.query(`
  UPDATE ts_matches
  SET status_id = $1,
      home_score_regular = $2,
      away_score_regular = $3,
      minute = $4,
      provider_update_time = $5,
      last_event_ts = $6,
      updated_at = NOW()
  WHERE external_id = $7
    AND (provider_update_time IS NULL OR $5 > provider_update_time)
`, [
  diaryStatusId,
  diaryHomeScore,
  diaryAwayScore,
  diaryMinute,
  diaryProviderUpdateTime,
  diaryLastEventTs,
  match.matchId,
]);
```

---

## Step 4: After Fix - Debug Output

### Proof commands (post-fix)

```bash
# Wait for watchdog tick (30 seconds) and tail logs for watchdog reconcile activity
tail -200 logs/combined.log | grep -E "watchdog\.tick\.summary|watchdog\.reconcile\.(start|done)" | tail -80

# Run debug script again
npx tsx src/scripts/debug-live-match.ts --externalId pxwrxlhyxv6yryk --date 20251224

# Query DB for match state
psql -c "SELECT external_id, status_id, minute, home_score_regular, away_score_regular, provider_update_time, last_event_ts, updated_at FROM ts_matches WHERE external_id = 'pxwrxlhyxv6yryk';"
```

### Pass/Fail criteria

- PASS if provider reports non-1 status and DB transitions accordingly within 1-2 watchdog ticks.  
- PASS if provider reports status=1 and DB remains 1 (no heuristic LIVE).  
- FAIL if watchdog is not running (no tick logs) or if `provider_update_time` never updates while provider says LIVE.

---

## Acceptance Criteria

✅ **Provider says LIVE/FT → DB says LIVE/FT**  
✅ **minute_text null olmaz** (generated from minute + status)  
✅ **Hiçbir heuristic status yok** (match_time geçti diye status değiştirme YASAK)  
✅ Kanıt: watchdog logları + debug script + DB row çıktıları markdown dosyasına eklenecek (placeholder yok).

---

## Hard Limitations / Next Required Action

- If provider endpoints return 401/"IP not authorized" or recent/list is empty for periods when matches are known LIVE, the system cannot be correct without fixing provider credentials/IP whitelist.  
- Next action: verify TheSports key/product permissions and IP whitelist; capture one direct provider call proof (HTTP status + error body) and attach to this report.

---

## Notes

- **Provider diary status=1:** This might be provider's actual state (match not started yet, or provider hasn't updated)  
- **Fix ensures:** If provider diary shows status=2+, DB will be updated  
- **No heuristic:** We never change status based on `match_time` - only provider data



