<file name=0 path=/Users/utkubozbay/Desktop/project/PHASE3C_PLAN.md># Phase 3C: End-to-End Live Truth Implementation Plan

## Goal
Connect UI minute display to backend truth. Frontend will no longer calculate minutes; it will only render what backend provides. Backend Minute Engine (Phase 3B Madde 4) is the single source of truth.

## Global Invariants (MUST NOT BREAK)

1. **DB tek zaman kaynağı:** Unix seconds (UTC reference). TSİ offset DB'ye yazılmaz.
2. **Minute gerçeği backend:** UI hesap yapmaz, sadece render eder.
3. **Minute Engine updated_at'e dokunmaz** (Phase 3B Madde 4 invariant korunur).
4. **Watchdog updated_at'e dokunmaz** (sadece reconcile tetikler).
5. **Fallback match selection yok** (r[0]/v[0] vs kesin yasak).

## Current State Analysis

### Frontend Minute Calculation Points (TO BE REMOVED)

1. **`frontend/src/utils/matchStatus.ts`:**
   - `calculateMatchMinute()` function (line 101-164): Calculates minute from `kickoffTime`, `status`, `secondHalfKickoffTime`
   - Uses `Date.now()` and time calculations
   - **Action:** Remove or deprecate this function

2. **`frontend/src/components/MatchCard.tsx`:**
   - `useEffect` hook (line 72-92): Calls `calculateMatchMinute()` every 30 seconds
   - `currentMinute` state (line 66): Stores calculated minute
   - **Action:** Remove minute calculation logic, read from `match.minute` or `match.minute_text`

3. **`frontend/src/utils/matchStatus.ts`:**
   - `formatMatchMinute()` function (line 171-202): Formats minute for display ("45+", "90+", "HT", "FT")
   - **Action:** Keep for backward compatibility OR remove if backend provides `minute_text`

### Backend Response Current State

1. **`src/controllers/match.controller.ts`:**
   - `normalizeDbMatch()` function: Does NOT include `minute` field
   - Includes `live_kickoff_time` (for frontend calculation - TO BE REMOVED)
   - **Action:** Add `minute` and `minute_text` fields to response

2. **`src/services/thesports/match/matchDatabase.service.ts`:**
   - `getMatchesByDate()` SQL query: Does NOT SELECT `minute` column
   - `getLiveMatches()` SQL query: Does NOT SELECT `minute` column
   - **Action:** Add `m.minute` to SELECT statements

3. **`frontend/src/api/matches.ts`:**
   - `MatchRecent` and `MatchDiary` interfaces: Do NOT include `minute` or `minute_text` fields
   - **Action:** Add `minute?: number | null` and `minute_text?: string | null` to interfaces

## Implementation Steps

### 3C-0: Preflight (Discovery & Documentation)

**Goal:** Identify all frontend minute calculation points and backend response gaps.

**Tasks:**
1. Document all frontend minute calculation locations:
   - ✅ `frontend/src/utils/matchStatus.ts` - `calculateMatchMinute()` (line 101-164)
   - ✅ `frontend/src/components/MatchCard.tsx` - `useEffect` with `calculateMatchMinute()` (line 72-92)
   - ✅ `frontend/src/utils/matchStatus.ts` - `formatMatchMinute()` (line 171-202)

2. Document backend response gaps:
   - ✅ `matchDatabase.service.ts` - SQL queries missing `minute` column
   - ✅ `match.controller.ts` - `normalizeDbMatch()` missing `minute` and `minute_text`
   - ✅ `frontend/src/api/matches.ts` - Interfaces missing `minute` and `minute_text`

3. Create audit document:
   - File: `PHASE3C_PREFLIGHT_AUDIT.md`
   - List all minute calculation points
   - List all backend response gaps
   - Acceptance: Complete inventory of changes needed

**Acceptance:**
- ✅ All frontend minute calculation points documented
- ✅ All backend response gaps documented
- ✅ Audit document created

---

### 3C-1: UI Minute Logic Removal + Backend Truth Connection

**Goal:** Remove all frontend minute calculations, make UI read from backend.

**Tasks:**

#### 1.1: Update Backend SQL Queries

**File:** `src/services/thesports/match/matchDatabase.service.ts`

**Changes:**
- `getMatchesByDate()` SQL query: Add `m.minute` to SELECT
- `getLiveMatches()` SQL query: Add `m.minute` to SELECT

**SQL Example:**
```sql
SELECT 
  m.external_id as id,
  m.status_id as status_id,
  m.minute,  -- ADD THIS
  ...
FROM ts_matches m
```

#### 1.2: Update Backend Response Normalization

**File:** `src/controllers/match.controller.ts`

**Changes:**
- `normalizeDbMatch()` function: Add `minute` and `minute_text` fields
- `minute_text` generation logic:
  - Status 3 (HALF_TIME) → `"HT"`
  - Status 8 (END) → `"FT"`
  - Status 5 (OVERTIME) → `"ET"`
  - Status 7 (PENALTY) → `"PEN"`
  - Status 9 (DELAY) → `"DELAY"`
  - Status 10 (INTERRUPT) → `"INT"`
  - Status 2 (FIRST_HALF) + minute >= 45 → `"45+"`
  - Status 4 (SECOND_HALF) + minute >= 90 → `"90+"`
  - Else → `"${minute}'"` (if minute exists)
  - Else → `null` (if minute is null)

**Code Pattern:**
```typescript
const normalizeDbMatch = (row: any) => {
  const minute = row.minute !== null ? Number(row.minute) : null;
  const statusId = row.status_id ?? row.status ?? 1;
  
  // Generate minute_text using helper function
  const minuteText = generateMinuteText(minute, statusId);
  
  return {
    ...row,
    minute,
    minute_text: minuteText,
    // ... rest of fields
  };
};
```

#### 1.3: Update Frontend API Interfaces

**File:** `frontend/src/api/matches.ts`

**Changes:**
- Add to `MatchRecent` interface:
  ```typescript
  minute?: number | null;
  minute_text?: string | null;
  ```
- Add to `MatchDiary` interface:
  ```typescript
  minute?: number | null;
  minute_text?: string | null;
  ```

#### 1.4: Remove Frontend Minute Calculation

**File:** `frontend/src/components/MatchCard.tsx`

**Changes:**
- Remove `currentMinute` state (line 66)
- Remove `useEffect` hook that calculates minute (line 72-92)
- Remove `calculateMatchMinute()` import
- Update minute display to use `match.minute_text` or `match.minute`

**Code Pattern:**
```typescript
// REMOVE:
// const [currentMinute, setCurrentMinute] = useState<number | null>(null);
// useEffect(() => { ... calculateMatchMinute() ... }, [...]);

// REPLACE WITH:
const displayMinute = match.minute_text ?? (match.minute !== null ? `${match.minute}'` : null);
```

#### 1.5: Deprecate/Remove Frontend Calculation Functions

**File:** `frontend/src/utils/matchStatus.ts`

**Changes:**
- Option A: Remove `calculateMatchMinute()` function entirely
- Option B: Deprecate with warning log (for safety during transition)
- Keep `formatMatchMinute()` for backward compatibility OR remove if backend provides `minute_text`

**Recommendation:** Remove `calculateMatchMinute()`, keep `formatMatchMinute()` as fallback only.

#### 1.6: Update MatchCard Minute Display

**File:** `frontend/src/components/MatchCard.tsx`

**Changes:**
- Find where `currentMinute` or `formatMatchMinute(currentMinute, status)` is used
- Replace with `match.minute_text ?? formatMatchMinute(match.minute, status)`
- If `minute_text` exists, use it directly (no formatting needed)

**Acceptance:**
- ✅ UI no longer calculates minutes using `Date.now()`
- ✅ UI reads `minute` and `minute_text` from backend
- ✅ Live match minute updates when backend updates (via polling/refresh)
- ✅ No frontend time calculations remain

---

### 3C-2: Backend Response Standardization

**Goal:** Ensure backend provides UI-friendly minute/status text consistently.

**Tasks:**

#### 2.1: Create Minute Text Helper Function

**File:** `src/utils/matchMinuteText.ts` (NEW)

**Purpose:** Centralized minute text generation logic

**Function:**
```typescript
export function generateMinuteText(
  minute: number | null,
  statusId: number
): string | null {
  // Status-specific labels MUST win even if minute is null
  if (statusId === 3) return 'HT';   // HALF_TIME
  if (statusId === 8) return 'FT';   // END
  if (statusId === 5) return 'ET';   // OVERTIME
  if (statusId === 7) return 'PEN';  // PENALTY_SHOOTOUT
  if (statusId === 9) return 'DELAY';// DELAY
  if (statusId === 10) return 'INT'; // INTERRUPT

  // Injury time indicators
  if (minute !== null) {
    if (statusId === 2 && minute >= 45) return '45+'; // FIRST_HALF
    if (statusId === 4 && minute >= 90) return '90+'; // SECOND_HALF

    // Default: show minute with apostrophe
    return `${minute}'`;
  }

  return null;
}
```

#### 2.2: Apply Minute Text in All Controllers

**Files:**
- `src/controllers/match.controller.ts` - Use `generateMinuteText()` in `normalizeDbMatch()`
- Ensure all match response endpoints include `minute_text`

**Acceptance:**
- ✅ Backend provides `minute_text` consistently
- ✅ UI does not need status mapping logic (backend handles it)
- ✅ All match endpoints return `minute` and `minute_text`

---

### 3C-3: Golden Day E2E Proof

**Goal:** Prove end-to-end flow: DB → Backend API → Frontend UI.

**Tasks:**

#### 3.1: Create E2E Test Script

**File:** `src/scripts/test-phase3c-e2e.ts` (NEW)

**Test Flow:**
1. Select a live match from DB (status IN (2,3,4,5,7))
2. Verify DB has `minute` value (not null for live matches)
3. Call backend API (`/api/matches/live` or `/api/matches/diary`)
4. Verify API response includes `minute` and `minute_text`
5. Verify `minute_text` format is correct (HT/45+/90+/FT/etc.)
6. Simulate frontend: Parse API response and verify `minute_text` can be displayed

**Assertions:**
- ✅ DB `minute` is populated for live matches
- ✅ API response includes `minute` and `minute_text`
- ✅ `minute_text` format matches expected (HT/45+/90+/FT)
- ✅ Frontend can render `minute_text` directly

#### 3.2: Manual UI Verification

**Steps:**
1. Start backend server
2. Start frontend dev server
3. Navigate to live matches view
4. Verify minute display updates without frontend calculation
5. Check browser console: No `calculateMatchMinute` calls
6. Verify minute changes when backend updates (watchdog/reconcile)

**Acceptance:**
- ✅ E2E test script passes
- ✅ UI displays backend-provided minute
- ✅ No frontend minute calculation in console logs
- ✅ Minute updates reflect backend changes

---

## Files to Create

1. `PHASE3C_PREFLIGHT_AUDIT.md` - Discovery document
2. `src/utils/matchMinuteText.ts` - Minute text generation helper
3. `src/scripts/test-phase3c-e2e.ts` - E2E test script

## Files to Modify

### Backend:
1. `src/services/thesports/match/matchDatabase.service.ts` - Add `minute` to SQL queries
2. `src/controllers/match.controller.ts` - Add `minute` and `minute_text` to `normalizeDbMatch()`

### Frontend:
1. `frontend/src/api/matches.ts` - Add `minute` and `minute_text` to interfaces
2. `frontend/src/components/MatchCard.tsx` - Remove minute calculation, use backend fields
3. `frontend/src/utils/matchStatus.ts` - Remove/deprecate `calculateMatchMinute()`

## Acceptance Criteria

1. ✅ Frontend no longer calculates minutes (no `Date.now()` calculations)
2. ✅ Backend provides `minute` and `minute_text` in all match responses
3. ✅ UI displays backend-provided `minute_text` directly
4. ✅ E2E test proves DB → API → UI flow
5. ✅ No regression: Live matches display correctly
6. ✅ No TypeScript errors introduced
7. ✅ All Phase 3B invariants preserved

## Risk Mitigation

### Risk 1: UI Cache/Polling Shows Stale Minute
**Mitigation:**
- Ensure frontend polling interval is reasonable (30-60 seconds)
- Verify React state updates when API response changes
- Test with multiple browser tabs to verify real-time updates

### Risk 2: Minute Null in UI
**Mitigation:**
- Backend `minute_text` generation handles null gracefully
- UI fallback: Show status text if `minute_text` is null
- Watchdog/reconcile ensures `minute` is populated for live matches

### Risk 3: Breaking Existing UI
**Mitigation:**
- Keep `formatMatchMinute()` as fallback during transition
- Gradual rollout: Test with one view first, then expand
- Monitor logs for any frontend calculation errors

## Implementation Order

1. **3C-0:** Preflight audit (document all changes)
2. **3C-2:** Backend response standardization (add `minute`/`minute_text` to API)
3. **3C-1:** Frontend minute removal (remove calculations, use backend fields)
4. **3C-3:** E2E proof (test and verify)

**Rationale:** Backend changes first ensure API contract is ready before frontend changes.

## Testing Strategy

1. **Unit Tests:**
   - `generateMinuteText()` function tests (all status cases)
   - SQL query verification (minute column included)

2. **Integration Tests:**
   - API response includes `minute` and `minute_text`
   - `normalizeDbMatch()` generates correct `minute_text`

3. **E2E Tests:**
   - DB → API → UI flow verification
   - Live match minute updates correctly

4. **Manual Testing:**
   - UI displays backend minute
   - No frontend calculation errors in console
   - Minute updates when backend updates

## Notes

- **Backward Compatibility:** Keep `formatMatchMinute()` as fallback during transition
- **Gradual Rollout:** Consider feature flag for minute_text display
- **Monitoring:** Add logs to track frontend minute calculation removal
- **Documentation:** Update frontend README with new minute display approach

## Status

**Current:** ✅ Phase 3C-1 IMPLEMENTATION COMPLETE  
**Next:** 3C-3 Golden Day E2E Proof

---

## Phase 3C-1 Implementation Proof

### Proof Commands Executed

#### 1. Frontend Minute Calculation Removal Verification

```bash
# Check MatchCard.tsx for removed minute calculation patterns
grep -n "calculateMatchMinute\|Date\.now\|setInterval\|secondHalfKickoffTime\|liveKickoffTime" frontend/src/components/MatchCard.tsx
```

**Result:** No matches found - frontend minute calculation removed ✅

#### 2. Backend Minute Fields in API Response

**Expected:** API responses should include `minute` and `minute_text` fields.

**Verification Steps:**
- Backend SQL queries updated: `getMatchesByDate()` and `getLiveMatches()` now SELECT `m.minute`
- Controller normalizers updated: Both `normalizeDbMatch()` functions include `minute` and `minute_text`
- Frontend interfaces updated: `MatchRecent` and `MatchDiary` include `minute` and `minute_text` fields

#### 3. Files Modified

**Backend:**
1. ✅ `src/services/thesports/match/matchDatabase.service.ts` - Added `m.minute` to both SQL queries
2. ✅ `src/utils/matchMinuteText.ts` - NEW FILE - `generateMinuteText()` helper function
3. ✅ `src/controllers/match.controller.ts` - Added `minute` and `minute_text` to both normalizers

**Frontend:**
1. ✅ `frontend/src/api/matches.ts` - Added `minute` and `minute_text` to both interfaces
2. ✅ `frontend/src/components/MatchCard.tsx` - Removed minute calculation, uses `match.minute_text`
3. ✅ `frontend/src/utils/matchStatus.ts` - Removed `calculateMatchMinute()` function

#### 4. Implementation Status

- ✅ Step 1: Backend SQL queries include `minute` column
- ✅ Step 2: `generateMinuteText()` helper created
- ✅ Step 3: Controller normalizers include `minute` and `minute_text`
- ✅ Step 4: Frontend interfaces updated
- ✅ Step 5: MatchCard minute calculation removed
- ✅ Step 6: `calculateMatchMinute()` deprecated/removed

**Phase 3C-1 Complete:** Frontend no longer calculates minutes. Backend provides `minute` and `minute_text` fields. UI displays backend truth.

</file>
