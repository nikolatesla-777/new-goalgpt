# Phase 3C-3: Golden Day E2E Proof Plan

## Objective
Create `PHASE3C_3_GOLDEN_DAY_PROOF.md` as a proof report documenting end-to-end verification that the entire chain from DB → API → UI works correctly for December 22, 2025 (Golden Day).

## File to Create
- `PHASE3C_3_GOLDEN_DAY_PROOF.md` (repo root)

## Proof Sections

### 1. DB Proof - December 22, 2025 Data Existence

**SQL Queries to Execute (TSİ Day Window - Epoch Range):**

**CRITICAL:** Use TSİ day boundaries (UTC+3) to avoid timezone-related false negatives.

**TSİ Day Window:**
- 2025-12-22 00:00:00 TSİ → 2025-12-21 21:00:00 UTC (epoch start)
- 2025-12-23 00:00:00 TSİ → 2025-12-22 21:00:00 UTC (epoch end)

```sql
-- Golden Day: 2025-12-22 TSİ day window (UTC epoch range)
-- Total count for Dec 22, 2025 (TSİ)
SELECT COUNT(*)
FROM ts_matches
WHERE match_time >= EXTRACT(EPOCH FROM TIMESTAMPTZ '2025-12-21 21:00:00+00')
  AND match_time <  EXTRACT(EPOCH FROM TIMESTAMPTZ '2025-12-22 21:00:00+00');

-- Count by status_id for Dec 22, 2025 (TSİ)
SELECT status_id, COUNT(*)
FROM ts_matches
WHERE match_time >= EXTRACT(EPOCH FROM TIMESTAMPTZ '2025-12-21 21:00:00+00')
  AND match_time <  EXTRACT(EPOCH FROM TIMESTAMPTZ '2025-12-22 21:00:00+00')
GROUP BY status_id
ORDER BY status_id;
```

**Actions:**
- Run queries via `psql` or TypeScript script
- If count = 0:
  - Run `npm run sync:diary` (3-day window sync)
  - Re-run queries
  - Check sync logs for which dates were fetched
  - Document timezone/date calculation if still 0

**Report Format:**
- "DB Status: X matches found for 2025-12-22"
- Status breakdown table
- Sync action taken (if needed)

### 2. Runtime Proof - Workers Running

**Log Source:**
- **Primary:** `/tmp/goalgpt-server.log` (server log file)
- **Optional:** Running process output (if log file not available)
- **Optional:** PM2 logs (`pm2 logs`) if using PM2

**Check Server Logs for:**
- DailyDiarySyncWorker start/run logs (yesterday/today/tomorrow sync)
- MatchMinuteWorker start log
- MatchWatchdogWorker start log
- DataUpdateWorker tick logs

**Log Evidence:**
- Extract relevant log lines from `/tmp/goalgpt-server.log`
- Document worker start times
- If logs are debug-only, note "log level: debug" but don't modify code
- If log file not found, document "log file not found" and use alternative source

**Report Format:**
- Worker status table (Running/Not Found)
- Key log snippets with timestamps
- Log source path documented

### 3. API Proof - DB → API Response

**3.1 Diary Endpoint**
```bash
curl -s "http://localhost:3000/api/matches/diary?date=2025-12-22" | head -c 2000
```

**Verification:**
- Check response contains `minute` and `minute_text` fields
- Extract 2 sample matches showing: `status_id`, `minute`, `minute_text`
- If response empty → refer to Section 1 (DB data missing)

**3.2 Live Endpoint**
```bash
curl -s "http://localhost:3000/api/matches/live" | head -c 2000
```

**Verification:**
- Check response structure
- If matches exist: verify `minute_text` present
- If empty: document "no live matches" (acceptable)

**Report Format:**
- API response snippets (JSON)
- Field presence verification table

### 4. Minute Engine DB Proof

**4.1 Find Live Match (if available)**
```sql
-- Try to find a live match from Dec 22, 2025 (TSİ day window)
SELECT external_id, status_id, minute, last_minute_update_ts, updated_at 
FROM ts_matches 
WHERE match_time >= EXTRACT(EPOCH FROM TIMESTAMPTZ '2025-12-21 21:00:00+00')
  AND match_time <  EXTRACT(EPOCH FROM TIMESTAMPTZ '2025-12-22 21:00:00+00')
  AND status_id IN (2, 3, 4, 5, 7)
ORDER BY match_time ASC 
LIMIT 1;
```

**4.2 If No Live Match Found:**
- Document: "No live matches found for Golden Day (2025-12-22 TSİ)"
- Status: **N/A (acceptable)** - Minute Engine proof not applicable if no live matches
- Note: This is expected if Golden Day has no matches in live status at proof time

**4.3 If Live Match Found - Initial Snapshot (T0):**
- Record: `external_id`, `status_id`, `minute`, `last_minute_update_ts`, `updated_at`
- Note timestamp T0

**4.4 After 40 Seconds (T+40):**
- Wait 40 seconds
- Re-run same query (same `external_id`)
- Compare results

**Verification:**
- `minute` or `last_minute_update_ts` should change (Minute Engine updates)
- `updated_at` should NOT change (invariant - Minute Engine does not update `updated_at`)
- If no change: document reason (match may have ended, or Minute Engine tick not yet occurred)

**Report Format:**
- Live match found: Yes/No
- If found:
  - T0 snapshot (table)
  - T+40 snapshot (table)
  - Diff analysis
  - `updated_at` invariant verification
- If not found:
  - Status: **N/A (acceptable)**
  - Reason: "No live matches on Golden Day at proof time"

### 5. UI Proof - Frontend Display

**Actions:**
- Open frontend UI
- Navigate to "Günün Maçları" / Diary view for Dec 22, 2025
- Open browser DevTools → Network tab
- Select 2 specific matches from the list (note their `external_id` or `id`)

**Verification (MANDATORY - Same 2 Matches):**

**5.1 Network Response Evidence:**
- Capture Network response for `/api/matches/diary?date=2025-12-22`
- Extract JSON snippet showing the 2 selected matches
- Verify both matches have `minute_text` field in response
- Document: `match_id_1`, `minute_text_1`, `match_id_2`, `minute_text_2`

**5.2 UI Screenshot Evidence:**
- Take screenshot of UI showing the same 2 match cards
- Verify `minute_text` values displayed match Network response values
- Verify format (e.g., "12'", "HT", "FT", "45+", "90+")

**5.3 Cross-Verification:**
- Network response `minute_text` value = UI displayed value (for both matches)
- This proves: UI is NOT calculating minute (no Date.now() logic)
- UI is rendering backend-provided `minute_text` directly

**Evidence Requirements:**
- **MANDATORY:** Network response JSON snippet (2 matches with `minute_text`)
- **MANDATORY:** UI screenshot showing same 2 matches with `minute_text` displayed
- **MANDATORY:** Cross-reference table: Match ID → Network `minute_text` → UI Display

**Note:** "Recent" tab is out of scope (API-only endpoint)

**Report Format:**
- Network response JSON snippet (2 matches)
- UI screenshot (same 2 matches visible)
- Cross-reference table (Match ID → Network → UI)
- Verification statement: "UI renders backend `minute_text` without calculation"

### 6. Acceptance Criteria Checklist

**Final Checklist:**
- [ ] DB has 2025-12-22 matches (COUNT proof using TSİ day window epoch range)
- [ ] `/api/matches/diary?date=2025-12-22` returns `minute_text` (curl proof)
- [ ] `/api/matches/live` behavior verified (doluysa `minute_text`, boşsa "no live matches")
- [ ] Minute Engine proof completed:
  - [ ] Live match found → T0 vs T+40 proof (minute update, `updated_at` invariant)
  - [ ] No live match → Documented as "N/A (acceptable)"
- [ ] UI diary view renders backend `minute_text` (Network response + Screenshot for same 2 matches)

## Implementation Notes

**Timezone Handling:**
- **CRITICAL:** DB queries use TSİ day window (UTC+3) epoch range, NOT `to_timestamp(match_time)::date`
- TSİ day boundaries: 00:00:00 TSİ = 21:00:00 UTC (previous day)
- System uses TSİ (UTC+3) for date boundaries in `getMatchesByDate()`
- Match times stored as Unix timestamps (UTC)
- **Golden Day query:** `match_time >= 2025-12-21 21:00:00 UTC AND match_time < 2025-12-22 21:00:00 UTC`

**Worker Verification:**
- Check running process output for worker start logs
- Don't modify code to add logs - use existing log output
- If workers not found, document but don't fail proof

**Date Format:**
- API expects: `YYYY-MM-DD` (converted to `YYYYMMDD` internally)
- SQL date comparison: **TSİ day window epoch range** (NOT `to_timestamp(match_time)::date`)
- Example: `match_time >= EXTRACT(EPOCH FROM TIMESTAMPTZ '2025-12-21 21:00:00+00') AND match_time < EXTRACT(EPOCH FROM TIMESTAMPTZ '2025-12-22 21:00:00+00')`

**Minute Engine Invariant:**
- `updated_at` should NOT change when Minute Engine updates `minute`
- Only `minute` and `last_minute_update_ts` should change

## Report Structure

1. **Executive Summary** (1 paragraph)
2. **Section 1: DB Proof** (SQL results, sync actions)
3. **Section 2: Runtime Proof** (worker logs)
4. **Section 3: API Proof** (curl outputs, field verification)
5. **Section 4: Minute Engine DB Proof** (T0/T+40 snapshots)
6. **Section 5: UI Proof** (screenshot + console log)
7. **Section 6: Acceptance Criteria** (checklist)
8. **Conclusion** (overall status)

## Constraints

- **READ-ONLY**: No code modifications
- **Evidence-based**: All claims backed by commands/outputs
- **Minimal commentary**: Focus on proof, not explanation
- **No assumptions**: If data missing, document and take action (sync)

## Deliverable

Single file: `PHASE3C_3_GOLDEN_DAY_PROOF.md` containing all proof evidence and acceptance criteria verification.

