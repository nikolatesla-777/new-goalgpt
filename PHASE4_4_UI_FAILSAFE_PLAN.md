# Phase 4-4: UI Failsafe Plan

**Status:** Planning  
**Prerequisites:** Phase 4-3 CLOSED  
**Goal:** Ensure UI never calculates minutes client-side, always uses backend `minute_text`, and provides failsafe visualization for stale matches.

---

## Executive Summary

Phase 4-4 enforces the **DB-only, backend-minute-authoritative** architecture at the UI layer. The frontend will:
- **Never calculate minutes** - All minute display comes from backend `minute_text`
- **Always use backend truth** - `minute`, `minute_text`, `status_id` from API responses only
- **Provide failsafe visualization** - Visual indicators when matches are stale (based on backend-provided timestamps)
- **Maintain contract compliance** - All match responses include `minute_text` (never null)

**Critical Principle:** Frontend is a **pure renderer** of backend data. No business logic, no time calculations, no minute engines.

---

## Non-Goals

**Explicitly NOT in Phase 4-4:**

1. **Frontend Minute Calculation**
   - NO `Date.now()` based minute calculations
   - NO `calculateMatchMinute()` or similar functions
   - NO `45+`, `90+` client-side logic
   - NO `setInterval` for minute updates

2. **Frontend Business Logic**
   - NO status transition logic
   - NO match time estimation
   - NO provider update time calculations (unless backend provides `age_sec`)

3. **Backend Changes**
   - NO new endpoints
   - NO database schema changes
   - Controllers remain DB-only (no API fallbacks)

4. **UI Behavior Changes**
   - NO auto-refresh mechanisms
   - NO polling intervals
   - NO WebSocket reconnection logic

---

## UI Rendering Contract

### Required Fields (Backend → Frontend)

Every match object in API responses **MUST** include:

```typescript
interface MatchResponse {
  // Required for minute display
  minute: number | null;           // Current minute (backend-calculated)
  minute_text: string;              // Display text (NEVER null, use "—" if unavailable)
  status_id: number;                // Match status (1=NOT_STARTED, 2=FIRST_HALF, etc.)
  
  // Required for failsafe detection
  updated_at: string;                // ISO timestamp of last DB update
  provider_update_time?: number | null;  // Optional: provider timestamp (epoch seconds)
  last_event_ts?: number | null;        // Optional: last event timestamp (epoch seconds)
  
  // Optional for debug/stale detection
  age_sec?: number;                  // Optional: age since last update (backend-calculated)
  stale_reason?: string;             // Optional: stale reason from Phase 4-3
}
```

### `minute_text` Values

Backend `minute_text` will be one of:
- `"1'"`, `"2'"`, ..., `"45'"` - Regular minutes (first half)
- `"45+1"`, `"45+2"`, ... - Stoppage time (first half)
- `"HT"` - Half Time
- `"46'"`, `"47'"`, ..., `"90'"` - Regular minutes (second half)
- `"90+1"`, `"90+2"`, ... - Stoppage time (second half)
- `"FT"` - Full Time
- `"AET"` - After Extra Time
- `"PEN"` - Penalties
- `"—"` - Not available / Not calculable

**Contract:** `minute_text` is **always a string** (never `null` or `undefined`). If minute cannot be calculated, backend returns `"—"`.

### Example Payload

```json
{
  "results": [
    {
      "match_id": "12345",
      "minute": 67,
      "minute_text": "67'",
      "status_id": 4,
      "updated_at": "2025-12-22T20:30:00Z",
      "provider_update_time": 1766423220,
      "last_event_ts": 1766423220
    },
    {
      "match_id": "12346",
      "minute": null,
      "minute_text": "HT",
      "status_id": 3,
      "updated_at": "2025-12-22T20:25:00Z",
      "provider_update_time": 1766423100,
      "last_event_ts": null
    }
  ]
}
```

---

## Failsafe Rules

### Stale Match Detection (UI)

UI will display a **"⚠️ Güncelleme gecikiyor"** badge when:

1. **Match is LIVE** (`status_id IN (2, 4, 5, 7)`)
2. **AND** one of:
   - Backend provides `age_sec` and `age_sec > threshold` (preferred)
   - OR backend provides `stale_reason` (preferred)
   - OR (fallback) `now - updated_at > threshold` (client-side, minimal risk)

### Thresholds (Phase 4-3 Compatible)

- **LIVE matches** (status 2, 4, 5, 7): 120 seconds (2 minutes)
- **HALF_TIME** (status 3): 900 seconds (15 minutes)
- **SECOND_HALF with progress** (status 4, minute >= 45): 180 seconds (3 minutes)

### Implementation Priority

1. **Preferred:** Use backend-provided `age_sec` or `stale_reason` (if present)
2. **Fallback:** Calculate `(now - updated_at)` only if backend does not provide `age_sec`
3. **Minimum risk:** Fallback calculation is **passive** (display only, no business logic)

### Visual Indicator

```typescript
// Badge display logic (pseudo-code)
if (match.status_id IN [2, 4, 5, 7]) {
  const ageSec = match.age_sec ?? calculateAgeFromUpdatedAt(match.updated_at);
  const threshold = getThresholdForStatus(match.status_id, match.minute);
  
  if (ageSec > threshold) {
    displayBadge("⚠️ Güncelleme gecikiyor");
  }
}
```

**Note:** Badge is **informational only**. UI does not trigger any actions or API calls.

---

## Files to Change

### Frontend Files

- [ ] **`frontend/src/utils/matchStatus.ts`**
  - Remove all minute calculation functions (`calculateMatchMinute`, etc.)
  - Keep only formatting/display helpers (if any)
  - Remove dead code related to minute calculations

- [ ] **`frontend/src/components/MatchCard.tsx`**
  - Remove any `useState` for `currentMinute`
  - Remove any `useEffect` with `setInterval` for minute updates
  - Remove any `Date.now()` based calculations
  - Display `match.minute_text` directly (with `"—"` fallback)
  - Add stale badge rendering (if `age_sec > threshold`)

- [ ] **`frontend/src/components/MatchList.tsx`** (if exists)
  - Ensure `minute_text` is used in list rendering
  - Remove any minute calculations

- [ ] **`frontend/src/components/LeagueSection.tsx`** (if exists)
  - Ensure `minute_text` is used in league section rendering
  - Remove any minute calculations

- [ ] **`frontend/src/api/matches.ts`**
  - Update TypeScript interfaces to include `minute_text: string` (required, never null)
  - Update `MatchRecent`, `MatchDiary`, `MatchLive` interfaces
  - Ensure `minute_text` is typed as `string` (not `string | null`)

### Backend Files (if needed)

- [ ] **`src/controllers/match.controller.ts`**
  - Verify all match normalizers include `minute_text`
  - Ensure `minute_text` is never `null` (use `"—"` if unavailable)
  - Add `age_sec` to response if available (from Phase 4-3 detection)

- [ ] **`src/services/thesports/match/matchDatabase.service.ts`**
  - Verify `getLiveMatches()` and `getMatchesByDate()` include `minute_text` in SELECT
  - Ensure `minute_text` is generated via `generateMinuteText()` helper

---

## Proof Commands

### Proof 1: Frontend Minute Calculation Removal

**Command:**
```bash
rg -n "Date\.now\(|new Date\(|minute engine|calcMinute|45\+|90\+" frontend/src
```

**Expected Output:**
- No matches (or only in comments/documentation)
- If matches found, they must be removed

### Proof 2: Frontend minute_text Usage

**Command:**
```bash
rg -n "minute_text" frontend/src
```

**Expected Output:**
- `frontend/src/api/matches.ts`: Interface definitions with `minute_text: string`
- `frontend/src/components/MatchCard.tsx`: Direct rendering of `match.minute_text`
- `frontend/src/components/MatchList.tsx`: Usage in list rendering
- No calculation logic, only display

### Proof 3: MatchCard minute_text Render

**Command:**
```bash
rg -n "minute_text" frontend/src/components/MatchCard.tsx
```

**Expected Output:**
- Direct usage: `{match.minute_text || "—"}`
- No `calculateMatchMinute()` calls
- No `Date.now()` based logic

### Proof 4: Backend minute_text Contract

**Command:**
```bash
rg -n "minute_text" src/controllers src/services | head -20
```

**Expected Output:**
- All match normalizers include `minute_text: generateMinuteText(...)`
- No `null` returns for `minute_text` (always string, use `"—"` if unavailable)

### Proof 5: Golden Day Smoke Test

**Command:**
```bash
curl -s http://localhost:3000/api/matches/live | \
  node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    const matches = data.results || [];
    const missing = matches.filter(m => !m.minute_text || m.minute_text === null);
    if (missing.length > 0) {
      console.error('❌ FAIL: Matches missing minute_text:', missing.length);
      process.exit(1);
    }
    console.log('✅ PASS: All', matches.length, 'matches have minute_text');
  "
```

**Expected Output:**
- `✅ PASS: All X matches have minute_text`
- No matches with missing or null `minute_text`

### Proof 6: TypeScript Interface Compliance

**Command:**
```bash
rg -A 3 "interface.*Match" frontend/src/api/matches.ts
```

**Expected Output:**
- All match interfaces include `minute_text: string` (not `string | null`)
- No `minute?: number` calculation logic

---

## Acceptance Criteria

### Frontend

- [ ] **No minute calculations**
  - `rg -n "Date\.now\(|calcMinute" frontend/src` returns no matches (or only comments)
  - No `setInterval` for minute updates in `MatchCard.tsx`
  - No `useState` for `currentMinute` in any component

- [ ] **minute_text always used**
  - All match displays use `match.minute_text` directly
  - Fallback to `"—"` if `minute_text` is missing (defensive)
  - No client-side generation of minute text

- [ ] **TypeScript interfaces updated**
  - `MatchRecent`, `MatchDiary`, `MatchLive` include `minute_text: string`
  - `minute_text` is typed as required (not optional, not null)

- [ ] **Stale badge implemented**
  - Badge displays when `age_sec > threshold` (if backend provides)
  - Fallback to `(now - updated_at)` calculation only if `age_sec` not provided
  - Badge is informational only (no actions triggered)

### Backend

- [ ] **minute_text contract enforced**
  - All match responses include `minute_text` (never null)
  - `minute_text` uses `generateMinuteText()` helper
  - Fallback to `"—"` if minute cannot be calculated

- [ ] **Response normalizers updated**
  - `getMatchDiary()` includes `minute_text`
  - `getLiveMatches()` includes `minute_text`
  - All normalizers use `generateMinuteText(row.minute ?? null, row.status_id)`

### Integration

- [ ] **Golden Day smoke test passes**
  - `/api/matches/live` returns all matches with `minute_text`
  - `/api/matches/diary?date=2025-12-22` returns all matches with `minute_text`
  - No null or missing `minute_text` values

- [ ] **UI renders correctly**
  - Match cards display `minute_text` without calculation
  - Stale badge appears for stale matches (if backend provides `age_sec`)
  - No console errors related to minute calculations

---

## Implementation Steps

1. **Audit Current State**
   - Run proof commands to identify existing minute calculation logic
   - Document current `minute_text` usage (if any)
   - Identify all files that need changes

2. **Backend Contract Enforcement**
   - Verify all match normalizers include `minute_text`
   - Ensure `minute_text` is never null (use `"—"` if unavailable)
   - Add `age_sec` to responses (if available from Phase 4-3)

3. **Frontend Cleanup**
   - Remove all minute calculation functions from `matchStatus.ts`
   - Remove `setInterval` and `useState` for minutes from `MatchCard.tsx`
   - Update TypeScript interfaces to include `minute_text: string`

4. **Frontend Implementation**
   - Update `MatchCard.tsx` to render `match.minute_text` directly
   - Add stale badge rendering logic (using `age_sec` if available)
   - Update `MatchList.tsx` and `LeagueSection.tsx` to use `minute_text`

5. **Testing**
   - Run all proof commands and verify outputs
   - Run Golden Day smoke test
   - Verify UI renders correctly with backend `minute_text`
   - Verify stale badge appears for stale matches

6. **Documentation**
   - Create `PHASE4_4_UI_FAILSAFE_IMPLEMENTATION_REPORT.md`
   - Include all proof command outputs
   - Document any deviations or edge cases

---

## Risk Mitigation

### Risk 1: Frontend Still Calculates Minutes

**Mitigation:**
- Run proof commands before and after implementation
- Code review to ensure no `Date.now()` based calculations
- TypeScript types enforce `minute_text` is string (not calculated)

### Risk 2: Backend Returns Null minute_text

**Mitigation:**
- Backend contract: `minute_text` is always string (use `"—"` if unavailable)
- Frontend defensive: Fallback to `"—"` if `minute_text` is missing
- Golden Day smoke test verifies all matches have `minute_text`

### Risk 3: Stale Badge False Positives

**Mitigation:**
- Use backend-provided `age_sec` (preferred)
- Fallback calculation is passive (display only)
- Thresholds match Phase 4-3 (no inconsistency)

---

## Success Metrics

- **Zero minute calculations in frontend:** `rg -n "Date\.now\(|calcMinute" frontend/src` returns no matches
- **100% minute_text coverage:** All match responses include `minute_text`
- **Stale badge accuracy:** Badge appears only when matches are actually stale (per Phase 4-3 rules)
- **UI rendering correctness:** All match cards display `minute_text` without calculation

---

## Out of Scope

**Explicitly NOT in Phase 4-4:**

1. **Auto-refresh mechanisms**
   - No polling intervals
   - No WebSocket reconnection logic
   - No automatic data refresh

2. **Backend minute engine changes**
   - No changes to `MatchMinuteService`
   - No changes to minute calculation logic
   - No changes to Phase 3 invariants

3. **New endpoints**
   - No new API endpoints
   - No new WebSocket events
   - No new data structures

4. **UI behavior changes**
   - No new user interactions
   - No new navigation flows
   - No new features

---

**End of Phase 4-4 Plan**

**Next Step:** Implementation begins after plan approval.







