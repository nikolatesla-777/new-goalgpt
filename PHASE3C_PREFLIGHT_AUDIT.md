# Phase 3C-0: Preflight Audit

**Date:** 2025-12-21  
**Status:** ✅ AUDIT COMPLETE  
**Phase:** 3C-0 (Discovery & Documentation)

---

## Scope & Goal

**Goal:** Produce a complete inventory of (1) frontend minute calculation points and (2) backend response gaps, with exact file paths + symbols + short notes. This audit is documentation-only; no code changes are performed.

**Purpose:** Identify all locations where frontend calculates minutes vs. where backend should provide `minute` and `minute_text` fields. This inventory will guide Phase 3C-1 and 3C-2 implementation.

**Invariant:** No runtime code changes in Phase 3C-0. This is audit-only.

---

## 1. Frontend Minute Calculation Inventory

### 1.1: Core Calculation Functions

#### `frontend/src/utils/matchStatus.ts`

**Function:** `calculateMatchMinute()`  
**Lines:** 101-164  
**Symbols:** `calculateMatchMinute`, `Date.now()`, `Math.floor()`, `elapsedSeconds`, `kickoffTime`, `secondHalfKickoffTime`

**Behavior:**
- Calculates minute from `kickoffTime`, `status`, and optional `secondHalfKickoffTime`
- Uses `Date.now()` to get current Unix timestamp (line 111)
- Performs time-based calculations: `(now - kickoffTime) / 60 + 1`
- Handles different phases: FIRST_HALF, SECOND_HALF, OVERTIME, PENALTY
- Returns calculated minute number or null

**Note:** This is the PRIMARY frontend minute calculation function that must be removed/replaced with backend `minute` field.

---

**Function:** `formatMatchMinute()`  
**Lines:** 171-202  
**Symbols:** `formatMatchMinute`, `minute`, `status`, `MatchState`

**Behavior:**
- Formats minute number for display: "45+", "90+", "HT", "FT", "ET", "PEN", "12'"
- Takes calculated `minute` and `status` as parameters
- Returns formatted string

**Note:** May be kept as fallback during transition, but ideally backend will provide `minute_text` so this is not needed.

---

### 1.2: React Components with Minute Calculation

#### `frontend/src/components/MatchCard.tsx`

**Component:** `MatchCard`  
**Symbols:** `currentMinute`, `useEffect`, `setInterval`, `calculateMatchMinute`, `liveKickoffTime`, `secondHalfKickoffTime`

**Lines:** 66-92  
**Behavior:**
- Maintains `currentMinute` state (line 66): `const [currentMinute, setCurrentMinute] = useState<number | null>(null)`
- Uses `useEffect` hook (line 72-92) that:
  - Runs when `isLive`, `liveKickoffTime`, `matchTime`, or `normalizedSecondHalfKickoffTime` changes
  - Calls `calculateMatchMinute()` inside a `compute()` function
  - Sets up `setInterval(compute, 30000)` to recalculate every 30 seconds
  - Extracts `kickoff` from `liveKickoffTime ?? matchTime`
  - Passes `kickoff`, `status`, and `normalizedSecondHalfKickoffTime` to `calculateMatchMinute()`

**Lines:** 23-43  
**Kickoff Time Extraction:**
- Reads `live_kickoff_time` from match object (line 23)
- Extracts `secondHalfKickoffTime` from multiple possible fields (lines 26-43)
- Normalizes kickoff times for calculation

**Lines:** 139-148  
**Display Usage:**
- Uses `currentMinute` in render: `{currentMinute !== null && status !== MatchState.HALF_TIME && ...}`
- Calls `formatMatchMinute(currentMinute, status)` to format display (line 148)

**Note:** This is the PRIMARY UI component that performs live minute calculation. Must be refactored to read `match.minute` and `match.minute_text` from backend.

---

#### `frontend/src/components/MatchList.tsx`

**Component:** `MatchList`  
**Symbols:** `useEffect`, `setInterval`, `fetchMatches`

**Lines:** 203-214  
**Behavior:**
- Uses `useEffect` hook with `setInterval` (line 208)
- Polls `/api/matches/live` or `/api/matches/diary` every 60 seconds (line 208: `setInterval(() => { fetchMatches(); }, 60000)`)
- Refreshes match list, causing `MatchCard` components to re-render and recalculate minutes

**Note:** This polling is acceptable (it fetches fresh backend data), but once backend provides `minute`, the polling will refresh the correct backend-calculated minute. No changes needed here, but the polling ensures fresh `minute` values.

---

### 1.3: API Interfaces

#### `frontend/src/api/matches.ts`

**Interface:** `MatchRecent`  
**Lines:** 15-50  
**Missing Fields:**
- ❌ `minute?: number | null`
- ❌ `minute_text?: string | null`

**Current Fields:**
- ✅ `live_kickoff_time?: number | null` (line 22) - used for frontend calculation (to be deprecated/optional)

---

**Interface:** `MatchDiary`  
**Lines:** 52-87  
**Missing Fields:**
- ❌ `minute?: number | null`
- ❌ `minute_text?: string | null`

**Current Fields:**
- ✅ `live_kickoff_time?: number | null` (line 59) - used for frontend calculation (to be deprecated/optional)

---

**Note:** Both interfaces need to add `minute` and `minute_text` fields. `live_kickoff_time` can remain for backward compatibility but will not be used for minute calculation after Phase 3C-1.

---

## 2. Backend Response Gaps Inventory

### 2.1: SQL Queries Missing `minute` Column

#### `src/services/thesports/match/matchDatabase.service.ts`

**Function:** `getMatchesByDate()`  
**Lines:** 55-104  
**SQL Query:** Lines 55-104

**Current SELECT fields:**
```sql
SELECT 
  m.external_id as id,
  m.competition_id,
  m.season_id,
  m.match_time,
  m.status_id as status_id,
  m.home_team_id,
  m.away_team_id,
  m.home_score_regular as home_score,
  m.away_score_regular as away_score,
  ...
  live_kickoff_time,  -- Present (for frontend calculation)
  ...
FROM ts_matches m
```

**Missing:**
- ❌ `m.minute` - NOT selected in query

**Fix Required (3C-1.1):** Add `m.minute` to SELECT statement.

---

**Function:** `getLiveMatches()`  
**Lines:** 269-320  
**SQL Query:** Lines 269-320

**Current SELECT fields:**
```sql
SELECT
  m.external_id as id,
  m.competition_id,
  m.season_id,
  m.match_time,
  m.status_id as status_id,
  m.home_team_id,
  m.away_team_id,
  ...
  live_kickoff_time,  -- Present (for frontend calculation)
  ...
FROM ts_matches m
```

**Missing:**
- ❌ `m.minute` - NOT selected in query

**Fix Required (3C-1.1):** Add `m.minute` to SELECT statement.

---

### 2.2: Response Normalizers Missing `minute` and `minute_text`

#### `src/controllers/match.controller.ts`

**Function:** `getMatchDiary()`  
**Lines:** 141-172  
**Normalizer:** `normalizeDbMatch()` (lines 141-172)

**Current normalized fields:**
```typescript
return {
  ...row,
  external_id: externalId,
  status: statusId,
  match_status: statusId,
  status_id: statusId,
  home_score: ...,
  away_score: ...,
  live_kickoff_time: row.live_kickoff_time ?? row.match_time ?? null,  // Present
  ...
};
```

**Missing:**
- ❌ `minute: number | null`
- ❌ `minute_text: string | null`

**Fix Required (3C-1.2):** Add `minute` and `minute_text` fields using `generateMinuteText()` helper (from 3C-2.1).

---

**Function:** `getLiveMatches()`  
**Lines:** 343-369  
**Normalizer:** `normalizeDbMatch()` (lines 343-369)

**Current normalized fields:**
```typescript
return {
  ...row,
  external_id: externalId,
  status: statusId,
  match_status: statusId,
  status_id: statusId,
  home_score: ...,
  away_score: ...,
  live_kickoff_time: row.live_kickoff_time ?? row.match_time ?? null,  // Present
  ...
};
```

**Missing:**
- ❌ `minute: number | null`
- ❌ `minute_text: string | null`

**Fix Required (3C-1.2):** Add `minute` and `minute_text` fields using `generateMinuteText()` helper (from 3C-2.1).

---

**Note:** Both normalizers are separate functions (not shared). Both need the same fix: read `row.minute`, call `generateMinuteText(row.minute, statusId)`, and include both fields in returned object.

---

### 2.3: Other Match Endpoints

#### `src/controllers/match.controller.ts`

**Function:** `getMatchRecentList()`  
**Lines:** 87-115

**Note:** This endpoint uses `MatchRecentService` which calls TheSports API directly (not DB). This endpoint may need similar treatment in future, but for Phase 3C, focus is on DB-only endpoints (`/matches/diary` and `/matches/live`).

**Status:** Out of scope for Phase 3C (uses API, not DB). Documented for future reference.

---

## 3. API Contract Delta

### 3.1: Backend → Frontend (Must Exist After 3C)

**Required Fields (NEW):**
```typescript
{
  minute: number | null,           // Backend-calculated minute (from Minute Engine)
  minute_text: string | null,      // UI-friendly display text (HT/45+/90+/FT/etc.)
  status_id: number,               // Keep as-is (unchanged)
  // ... other existing fields
}
```

**Legacy Fields (DEPRECATED but kept for backward compatibility):**
```typescript
{
  live_kickoff_time?: number | null,  // Keep for now, but frontend should NOT use for calculation
  // ... other existing fields
}
```

---

### 3.2: Frontend Must Stop Doing

**Removed Behaviors:**
1. ❌ Any time-based minute calculation using `Date.now()`
2. ❌ Any calculation based on `kickoffTime` or `live_kickoff_time`
3. ❌ Any calculation based on `secondHalfKickoffTime`
4. ❌ Any `setInterval` that recalculates minute in UI (the interval in `MatchCard.tsx`)
5. ❌ Calling `calculateMatchMinute()` function

**Allowed Behaviors:**
1. ✅ Polling backend API (via `MatchList.tsx` interval) - this refreshes backend `minute` values
2. ✅ Reading `match.minute` and `match.minute_text` directly from API response
3. ✅ Using `formatMatchMinute()` as fallback ONLY if `minute_text` is null (during transition)

---

## 4. Risk Notes

### Risk 1: Frontend Calculation Removal Timing
**Issue:** If frontend stops calculating before backend provides `minute`, UI will show no minute for live matches.

**Mitigation:** 
- Implement backend changes first (3C-2, then 3C-1.1, then 3C-1.2)
- Only remove frontend calculation (3C-1.4) after backend is confirmed working
- Keep `formatMatchMinute()` as fallback during transition

---

### Risk 2: Null Minute Values
**Issue:** If `minute` is null in DB (e.g., Minute Engine hasn't run yet), UI will show blank.

**Mitigation:**
- Backend `minute_text` generation handles null gracefully (status labels like HT/FT still work)
- UI should display status text if `minute_text` is null
- Watchdog/reconcile ensures `minute` is populated for live matches

---

### Risk 3: Polling Race Conditions
**Issue:** Frontend polling interval (60s) may not align with Minute Engine tick (30s).

**Mitigation:**
- This is acceptable - polling is a fallback, WebSocket provides real-time updates
- As long as backend `minute` is updated by Minute Engine, polling will eventually refresh it

---

### Risk 4: Legacy `live_kickoff_time` Usage
**Issue:** Frontend may still try to use `live_kickoff_time` for calculation if removal is incomplete.

**Mitigation:**
- Remove all `calculateMatchMinute()` calls in Phase 3C-1.4
- Remove `live_kickoff_time` reading logic from `MatchCard.tsx`
- Keep field in API response for backward compatibility, but document it as deprecated

---

### Risk 5: TypeScript Interface Mismatch
**Issue:** If TypeScript interfaces are not updated, frontend code may not recognize `minute` and `minute_text` fields.

**Mitigation:**
- Update `MatchRecent` and `MatchDiary` interfaces in Phase 3C-1.3
- Ensure backend normalizers return these fields
- TypeScript will catch any mismatches at compile time

---

## 5. Next Steps (3C-1 Checklist Pointers)

### Phase 3C-1 Implementation Order

1. **3C-1.1:** Update SQL queries
   - File: `src/services/thesports/match/matchDatabase.service.ts`
   - Add `m.minute` to `getMatchesByDate()` SELECT (line ~61)
   - Add `m.minute` to `getLiveMatches()` SELECT (line ~275)

2. **3C-2.1:** Create minute text helper (can be done in parallel with 3C-1.1)
   - File: `src/utils/matchMinuteText.ts` (NEW)
   - Function: `generateMinuteText(minute: number | null, statusId: number): string | null`

3. **3C-1.2:** Update response normalizers
   - File: `src/controllers/match.controller.ts`
   - Update `normalizeDbMatch()` in `getMatchDiary()` (line ~141)
   - Update `normalizeDbMatch()` in `getLiveMatches()` (line ~343)
   - Read `row.minute`, call `generateMinuteText()`, add both fields

4. **3C-1.3:** Update frontend interfaces
   - File: `frontend/src/api/matches.ts`
   - Add `minute?: number | null` to `MatchRecent` (line ~22)
   - Add `minute_text?: string | null` to `MatchRecent` (line ~22)
   - Add `minute?: number | null` to `MatchDiary` (line ~59)
   - Add `minute_text?: string | null` to `MatchDiary` (line ~59)

5. **3C-1.4:** Remove frontend minute calculation
   - File: `frontend/src/components/MatchCard.tsx`
   - Remove `currentMinute` state (line 66)
   - Remove `useEffect` hook with `calculateMatchMinute()` (lines 72-92)
   - Remove `calculateMatchMinute` import (line 2)
   - Remove kickoff time extraction logic (lines 23-43) - optional, can keep for backward compat

6. **3C-1.5:** Deprecate/remove calculation function
   - File: `frontend/src/utils/matchStatus.ts`
   - Remove `calculateMatchMinute()` function (lines 101-164)
   - Keep `formatMatchMinute()` as fallback (lines 171-202)

7. **3C-1.6:** Update minute display
   - File: `frontend/src/components/MatchCard.tsx`
   - Replace `currentMinute` usage with `match.minute_text ?? formatMatchMinute(match.minute, status)`
   - Update display logic (lines 139-148)

---

## 6. Proof Artifact

### Search Commands Executed

```bash
# Frontend minute calculation patterns
rg -n "calculateMatchMinute|formatMatchMinute|Date\.now\(|setInterval\(|kickoff|secondHalf|live_kickoff|minute_text|minute\b" frontend/src

# Frontend useEffect/setInterval usage
rg -n "useEffect\(|setTimeout\(|setInterval\(" frontend/src/components

# Backend SQL queries
rg -n "SELECT.*FROM\s+ts_matches|FROM\s+ts_matches" src/services src/repositories src/controllers

# Backend normalizers
rg -n "normalizeDbMatch|normalize.*Match|minute_text|live_kickoff_time|kickoff" src

# Match endpoint functions
rg -n "getMatchesByDate|getLiveMatches|getRecentMatches|diary" src
```

### File Count Summary

**Frontend Files with Minute Computation:**
- ✅ 3 files found:
  1. `frontend/src/utils/matchStatus.ts` - calculation + formatting functions
  2. `frontend/src/components/MatchCard.tsx` - useEffect with interval calculation
  3. `frontend/src/components/MatchList.tsx` - polling (acceptable, no changes needed)

**Backend Files with Response Gaps:**
- ✅ 2 files found:
  1. `src/services/thesports/match/matchDatabase.service.ts` - SQL queries missing `minute`
  2. `src/controllers/match.controller.ts` - normalizers missing `minute` and `minute_text`

**Frontend Interface Files Needing Updates:**
- ✅ 1 file found:
  1. `frontend/src/api/matches.ts` - interfaces missing `minute` and `minute_text`

---

### Audit Completion Statement

**No code changes performed in Phase 3C-0; audit only.**

**Summary:**
- Found 3 frontend files with minute computation patterns (2 require changes, 1 is acceptable polling)
- Found 2 backend files with response gaps (SQL queries + normalizers)
- Found 1 frontend interface file needing updates
- All findings mapped to specific implementation tasks in Phase 3C-1 checklist

**Status:** ✅ Ready for Phase 3C-1 implementation.

---

**End of Audit Document**






