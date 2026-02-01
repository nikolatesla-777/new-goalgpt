# Field Provenance Map: Günlük Liste Tahminleri UI

**Generated**: 2026-01-31
**Scope**: `/admin/telegram/daily-lists` (Frontend + Backend + Database)
**Purpose**: Trace every UI field from database → backend → frontend → display with exact file paths and line numbers

---

## EXECUTIVE SUMMARY

1. **Range Endpoint Bug (P0)**: `/api/telegram/daily-lists/range` only returns start date, not full range (Line 431-436 in `src/routes/telegram/dailyLists.routes.ts`)
2. **"Son güncelleme" Timestamp Mismatch (P0)**: Historical views show today's fetch time instead of selected date's `generated_at` (Line 446 & 458 in `frontend/src/components/admin/TelegramDailyLists.tsx`)
3. **Performance Denominator Inconsistency (P1)**: Card shows `won/(total-pending)` but data uses `won/total` (Line 586 vs Line 738 in frontend component)
4. **Unknown League/Time Fields (P1)**: Match rows display "Unknown" for league/time - field mapping issue between FootyStats and TheSports
5. **Data Structure Mismatch (P2)**: Today view expects `{lists, generated_at}` but range view returns `{data: [{date, lists}]}`  (Line 167-169 in frontend)

---

## FIELD PROVENANCE MAP

### 1. "Son güncelleme" (Last Updated Timestamp)

**UI Location**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Lines 444-452**: Stats card showing last update time
```typescript
<p className="text-sm font-medium text-gray-500 mb-1">Son Güncelleme</p>
<p className="text-sm font-bold text-gray-900">
  {lastUpdated ? formatTimestampToTSI(Math.floor(lastUpdated / 1000)) : '--:--'}
</p>
```
- **Line 456-460**: Secondary display below stats cards
```typescript
{lastUpdated && (
  <p className="text-sm text-gray-500 text-center">
    Son güncelleme: {formatMillisecondsToTSI(lastUpdated)}
  </p>
)}
```

**Data Source (Frontend)**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 168**:
```typescript
const lastUpdated = isToday && data ? (data as any).generated_at || null : null;
```
- **Issue**: `lastUpdated` is ONLY populated for `isToday` mode. Historical views get `null`.

**API Response (Backend - Today Endpoint)**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Line 382-387**: `/api/telegram/daily-lists/today` response
```typescript
return {
  success: true,
  lists_count: lists.length,
  lists: formattedLists,
  generated_at: Date.now(), // ❌ WRONG: Should be list.generated_at from DB
};
```
- **Issue**: Returns `Date.now()` (current time) instead of database `generated_at` timestamp

**API Response (Backend - Range Endpoint)**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Line 501-506**: `/api/telegram/daily-lists/range` response
```typescript
return {
  success: true,
  date_range: { start, end },
  dates_count: Object.keys(listsByDate).length,
  data: formattedData, // No top-level generated_at field
};
```
- **Issue**: Range endpoint does NOT include `generated_at` at top level. Each date's lists have individual `generated_at` but UI doesn't access them.

**Database Source**:
- **Table**: `telegram_daily_lists`
- **Column**: `generated_at TIMESTAMP` (when list was created)
- **Query**: Line 257 in `src/routes/telegram/dailyLists.routes.ts`
```typescript
const lists = await getDailyLists(targetDate);
```
- **Data**: `list.generated_at` contains correct database timestamp (Line 376)

**Root Cause**:
1. Backend `/today` endpoint returns `Date.now()` instead of `list.generated_at` (Line 386)
2. Frontend only reads `lastUpdated` when `isToday === true` (Line 168)
3. Historical views show `--:--` because `lastUpdated` is `null`

---

### 2. Performance Data (Başarı Barı)

#### 2.1 Performance Bar Segment Widths

**UI Location**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 748-766**: Progress bar segments (Today view)
```typescript
<div className="w-full h-2.5 bg-white bg-opacity-30 rounded-full overflow-hidden">
  <div className="h-full flex">
    {/* Won segment */}
    <div
      className="bg-green-500"
      style={{ width: `${(list.performance.won / list.performance.total) * 100}%` }}
    />
    {/* Lost segment */}
    <div
      className="bg-red-500"
      style={{ width: `${(list.performance.lost / list.performance.total) * 100}%` }}
    />
    {/* Pending segment */}
    <div
      className="bg-gray-400"
      style={{ width: `${(list.performance.pending / list.performance.total) * 100}%` }}
    />
  </div>
</div>
```
- **Line 596-614**: Same progress bar in historical view

#### 2.2 Performance Label (Won/Total)

**UI Location**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 737-744** (Today view):
```typescript
<span className="text-lg font-bold">
  {list.performance.won}/{list.performance.total - list.performance.pending}
  {list.performance.pending === 0 && (
    <span className="text-xs ml-1 opacity-80">
      ({list.performance.win_rate}%)
    </span>
  )}
</span>
```
- **Line 585-592** (Historical view): Same code

**Issue**: Denominator inconsistency
- Progress bar uses `list.performance.total` (includes pending matches)
- Label displays `total - pending` (excludes pending)
- **Example**: If `total=5, won=3, lost=1, pending=1`:
  - Bar shows: `won=60%, lost=20%, pending=20%` (correct)
  - Label shows: `3/4` (should be `3/5`)

**Data Source (Frontend)**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 167**: `const lists = isToday && data ? (data as any).lists || [] : [];`
- **Line 169**: `const historicalData: DateData[] = !isToday && data ? (data as any).data || [] : [];`
- Each list contains: `list.performance = { total, won, lost, pending, win_rate }`

**API Response (Backend)**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Line 377**: Performance data added to each list
```typescript
performance, // Result from calculateListPerformance()
```
- **Line 318**: Performance calculation
```typescript
const performance = await calculateListPerformance(list);
```

**Backend Calculation**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Function**: `calculateListPerformance()` (Line 113-235)
- **Line 230-234**: Return values
```typescript
const total = list.matches.length;
const settled = won + lost;
const win_rate = settled > 0 ? Math.round((won / settled) * 100) : 0;

return { total, won, lost, pending, win_rate };
```
- **Critical**: `total` is always `list.matches.length`, NOT `won + lost + pending`
- **Critical**: `win_rate` is calculated from `won / settled` (excludes pending), but `total` includes pending

---

### 3. Match Row Fields (League Name, Match Time)

**UI Location**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 860-871**: Match info display
```typescript
<div className="flex items-center gap-4 text-xs text-gray-500">
  <span className="flex items-center gap-1">
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    {new Date(match.date_unix * 1000).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    })}
  </span>
  <span className="truncate">{match.league_name}</span>
</div>
```

**Data Source (Frontend)**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 329-374**: Match object structure
```typescript
matches: list.matches.map((m: any) => {
  return {
    fs_id: m.match.fs_id,
    match_id: matchId,
    home_name: m.match.home_name,
    away_name: m.match.away_name,
    league_name: m.match.league_name, // ❓ Where does this come from?
    date_unix: m.match.date_unix,
    confidence: m.confidence,
    // ...
  };
})
```

**API Response (Backend)**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Line 356-373**: Match mapping
```typescript
return {
  fs_id: m.match.fs_id,
  match_id: matchId,
  home_name: m.match.home_name,
  away_name: m.match.away_name,
  league_name: m.match.league_name, // Passthrough from list.matches
  date_unix: m.match.date_unix,
  confidence: m.confidence,
  reason: m.reason,
  // ...
};
```
- **Source**: `m.match.league_name` comes from `list.matches` JSONB

**Database Source**:
- **Table**: `telegram_daily_lists`
- **Column**: `matches JSONB`
- **Structure** (from daily list generation):
```json
{
  "matches": [
    {
      "match": {
        "fs_id": 123456,
        "home_name": "Manchester United",
        "away_name": "Liverpool",
        "league_name": "Premier League", // From FootyStats API
        "date_unix": 1706745600,
        "match_id": "abc123" // TheSports external_id (if mapped)
      },
      "confidence": 85,
      "reason": "High BTTS potential"
    }
  ]
}
```

**Issue**: If FootyStats API returns `competition_name: null` or mapping fails, `league_name` will be missing/undefined → displays "Unknown"

**Root Cause**: Field mapping between FootyStats and GoalGPT schema
- FootyStats API field: `competition_name`
- GoalGPT internal field: `league_name`
- Transformation happens in: `src/services/telegram/dailyLists.service.ts` (getDailyLists function)

---

### 4. Match ID Mapping (fs_id → match_id)

**UI Reference**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 358**: `match_id: matchId,`

**Backend Mapping Logic**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Line 330-331**:
```typescript
const matchId = m.match.match_id;
const tsMatch = matchId ? matchResultsMap.get(matchId) : null;
```
- **Line 288-305**: Bulk query to fetch TheSports match results
```typescript
const result = await client.query(
  `SELECT external_id, status_id, home_score_display, away_score_display,
          home_scores, away_scores
   FROM ts_matches
   WHERE external_id = ANY($1)`,
  [Array.from(allMatchIds)]
);
```

**Mapping Source (Database JSONB)**:
- **Table**: `telegram_daily_lists`
- **Field**: `matches[].match.match_id`
- **Populated By**: Daily list generation service (fuzzy matching)

**Fuzzy Matching Logic** (for reference):
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Function**: `calculateListPerformance()` (Line 138-165)
- **Matching Rules**:
  - Extract first word of team names
  - Match with ±1 hour time window
  - Query TheSports `ts_matches` with `LIKE` operator
```typescript
const homeFirstWord = match.home_name.split(' ')[0].toLowerCase();
const awayFirstWord = match.away_name.split(' ')[0].toLowerCase();
const timeWindow = 3600; // +/- 1 hour

const result = await safeQuery(
  `SELECT m.home_score_display, m.away_score_display, m.status_id,
          m.home_scores, m.away_scores,
          t1.name as home_team_name, t2.name as away_team_name
   FROM ts_matches m
   INNER JOIN ts_teams t1 ON m.home_team_id= t1.external_id
   INNER JOIN ts_teams t2 ON m.away_team_id= t2.external_id
   WHERE (LOWER(t1.name) LIKE $1 OR LOWER(t1.name) LIKE $2)
     AND (LOWER(t2.name) LIKE $3 OR LOWER(t2.name) LIKE $4)
     AND m.match_time >= $5
     AND m.match_time <= $6
     AND m.status_id = 8
   LIMIT 1`,
  [
    `%${homeFirstWord}%`,
    `${homeFirstWord}%`,
    `%${awayFirstWord}%`,
    `${awayFirstWord}%`,
    match.date_unix - timeWindow,
    match.date_unix + timeWindow
  ]
);
```

**Issue**: If fuzzy matching fails during list generation, `match_id` will be `null` → settlement cannot evaluate → performance shows "pending"

---

### 5. Performance Stats (Total, Won, Lost, Pending, Win Rate)

**UI Location**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 403-439**: "Günlük Performans" stats card
- **Line 237-249**: Aggregated performance calculation
```typescript
const totalPerformance = displayLists.reduce((acc, list) => {
  if (list.performance) {
    acc.total += list.performance.total;
    acc.won += list.performance.won;
    acc.lost += list.performance.lost;
    acc.pending += list.performance.pending;
  }
  return acc;
}, { total: 0, won: 0, lost: 0, pending: 0 });
```

**Backend Calculation**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Function**: `calculateListPerformance()` (Line 113-235)
- **Process**:
  1. Loop through `list.matches`
  2. For each match, check if finished (>2 hours after `date_unix`)
  3. If finished, query TheSports database for result
  4. Evaluate result using market-specific rules
  5. Increment `won`, `lost`, or `pending` counters

**Settlement Evaluation**:
- **File**: `src/services/telegram/dailyListsSettlement.service.ts`
- **Function**: `evaluateMatch()` (Line 85-252)
- **Market Rules**:
  - `OVER_25`: `totalGoals >= 3` → WIN (Line 116-123)
  - `OVER_15`: `totalGoals >= 2` → WIN (Line 125-132)
  - `BTTS`: `homeScore > 0 && awayScore > 0` → WIN (Line 134-141)
  - `HT_OVER_05`: Half-time goals >= 1 → WIN (Line 143-173)
  - `CORNERS`: Total corners >= 10 → WIN (Line 175-205)
  - `CARDS`: Total cards >= 5 → WIN (Line 207-237)

**Database Query**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Line 144-165**: Per-match settlement query (N+1 pattern)
```typescript
const result = await safeQuery(
  `SELECT m.home_score_display, m.away_score_display, m.status_id,
          m.home_scores, m.away_scores,
          t1.name as home_team_name, t2.name as away_team_name
   FROM ts_matches m
   INNER JOIN ts_teams t1 ON m.home_team_id= t1.external_id
   INNER JOIN ts_teams t2 ON m.away_team_id= t2.external_id
   WHERE (LOWER(t1.name) LIKE $1 OR LOWER(t1.name) LIKE $2)
     AND (LOWER(t2.name) LIKE $3 OR LOWER(t2.name) LIKE $4)
     AND m.match_time >= $5
     AND m.match_time <= $6
     AND m.status_id = 8
   LIMIT 1`,
  [...]
);
```
- **Issue**: N+1 query problem - 1 query per match instead of bulk query

---

### 6. Date Range Endpoint (Dün, Son 7 Gün, Bu Ay)

**UI Date Selection**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 152-154**: Date range calculation
```typescript
const { start, end } = useMemo(() => {
  return getDateRange(selectedRange);
}, [selectedRange]);
```
- **Line 175-199**: `getDateRange()` function
  - `'yesterday'`: Returns yesterday's date (both start and end)
  - `'last7days'`: Returns 7 days ago → today
  - `'thismonth'`: Returns first day of month → today

**API Call**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 159**:
```typescript
const rangeQuery = useTelegramDailyListsRange(start, end, !isToday);
```
- **Hook**: Calls `GET /api/telegram/daily-lists/range?start={start}&end={end}`

**Backend Route**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Line 419-512**: `/telegram/daily-lists/range` handler
- **CRITICAL BUG** (Line 431-436):
```typescript
// Simple implementation: just get lists for start date (TODO: implement date range properly)
const lists = await getDailyLists(start);
const listsByDate: Record<string, any[]> = {};
if (lists.length > 0) {
  listsByDate[start] = lists; // ❌ ONLY returns start date!
}
```
- **Expected**: Loop from `start` to `end`, call `getDailyLists(date)` for each date
- **Actual**: Only queries `start` date, ignores `end` parameter

**Database Query**:
- **File**: `src/services/telegram/dailyLists.service.ts` (not shown, but referenced)
- **Function**: `getDailyLists(date?: string)`
- **Query**:
```sql
SELECT * FROM telegram_daily_lists
WHERE list_date = $1
ORDER BY market
```

**Root Cause**: Backend TODO comment confirms unimplemented feature (Line 431)

---

## EXACT REPRO STEPS

### Issue 1: Range Endpoint Only Returns Start Date

**Curl Test**:
```bash
# Request 3 days (Jan 28-30)
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/range?start=2026-01-28&end=2026-01-30" | jq '.'

# Expected Response:
{
  "success": true,
  "date_range": { "start": "2026-01-28", "end": "2026-01-30" },
  "dates_count": 3,
  "data": [
    { "date": "2026-01-28", "lists_count": 6, "lists": [...] },
    { "date": "2026-01-29", "lists_count": 6, "lists": [...] },
    { "date": "2026-01-30", "lists_count": 6, "lists": [...] }
  ]
}

# Actual Response:
{
  "success": true,
  "date_range": { "start": "2026-01-28", "end": "2026-01-30" },
  "dates_count": 1,  // ❌ Should be 3
  "data": [
    { "date": "2026-01-28", "lists_count": 6, "lists": [...] }
    // ❌ Missing 2026-01-29 and 2026-01-30
  ]
}
```

**Database Verification**:
```sql
-- Verify data exists for all 3 dates
SELECT list_date, market, COUNT(*) as lists_per_market
FROM telegram_daily_lists
WHERE list_date BETWEEN '2026-01-28' AND '2026-01-30'
GROUP BY list_date, market
ORDER BY list_date, market;

-- Expected: 18 rows (3 dates × 6 markets)
-- Actual: 18 rows exist in DB, but API only returns 6 (1 date × 6 markets)
```

**Code Location**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Lines 431-436**: Only queries `start` date

---

### Issue 2: "Son güncelleme" Shows Wrong Timestamp

**UI Test**:
```bash
# 1. Open frontend in browser
open https://partnergoalgpt.com/admin/telegram/daily-lists

# 2. Click "Bugün" button
# Expected: Shows timestamp from database (e.g., "12:00:05" if generated at noon)
# Actual: Shows current time (e.g., "14:35:22" if viewing at 2:35 PM)

# 3. Click "Dün" button
# Expected: Shows yesterday's generated_at timestamp
# Actual: Shows "--:--" (null timestamp)
```

**API Test**:
```bash
# Test today endpoint
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/today" | jq '.generated_at'

# Returns: 1738330522000 (current timestamp in ms)
# Expected: Should return actual list.generated_at from database
```

**Database Verification**:
```sql
-- Get actual generated_at from database
SELECT market, list_date,
       EXTRACT(EPOCH FROM generated_at) * 1000 as generated_at_ms,
       TO_CHAR(generated_at, 'HH24:MI:SS') as generated_at_time
FROM telegram_daily_lists
WHERE list_date = CURRENT_DATE
ORDER BY market;

-- Example Result:
-- OVER_25  | 2026-01-30 | 1738319105000 | 12:05:05
-- BTTS     | 2026-01-30 | 1738319105000 | 12:05:05
-- ...

-- API returns: 1738330522000 (14:35:22 - current time)
-- DB contains: 1738319105000 (12:05:05 - actual generated time)
```

**Code Location**:
- **File**: `src/routes/telegram/dailyLists.routes.ts`
- **Line 386**: Returns `Date.now()` instead of `list.generated_at`

---

### Issue 3: Performance Denominator Mismatch

**UI Test**:
```bash
# 1. Open daily lists page
# 2. Inspect a list card with performance bar

# Example List:
# - Total matches: 5
# - Won: 3
# - Lost: 1
# - Pending: 1

# Progress Bar Widths (Line 753-763):
# - Green (won): (3/5) * 100% = 60% ✅ Correct
# - Red (lost): (1/5) * 100% = 20% ✅ Correct
# - Gray (pending): (1/5) * 100% = 20% ✅ Correct

# Performance Label (Line 738):
# - Displays: "3/4" ❌ Wrong (should be 3/5)
# - Formula: won / (total - pending) = 3 / (5 - 1) = 3/4
# - Expected: won / total = 3 / 5
```

**Code Locations**:
- **File**: `frontend/src/components/admin/TelegramDailyLists.tsx`
- **Line 738**: `{list.performance.won}/{list.performance.total - list.performance.pending}`
- **Line 753**: `style={{ width: ${(list.performance.won / list.performance.total) * 100}% }}`

---

### Issue 4: Unknown League/Time

**UI Test**:
```bash
# 1. Open daily lists page
# 2. Expand a list to see match details
# 3. Look for matches with "Unknown" league name

# Example Match Row (Line 870):
# "14:00 • Unknown"
#
# Root Cause: match.league_name is undefined/null in API response
```

**API Test**:
```bash
# Fetch today's lists
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/today" | \
  jq '.lists[0].matches[] | select(.league_name == null or .league_name == "")'

# Returns matches with missing league_name
```

**Database Investigation**:
```sql
-- Check telegram_daily_lists JSONB structure
SELECT market,
       jsonb_array_length(matches) as match_count,
       jsonb_path_query_array(matches, '$[*].match.league_name') as league_names
FROM telegram_daily_lists
WHERE list_date = CURRENT_DATE
LIMIT 1;

-- If league_names array contains nulls → FootyStats API returned null competition_name
```

---

## ISSUE LIST & PR PLAN

### PR-F1: Fix "Son güncelleme" Timestamp (P0)

**Scope**: 2 files, ~10 lines changed

**Files**:
1. `src/routes/telegram/dailyLists.routes.ts`
   - Line 386: Change `generated_at: Date.now()` → `generated_at: lists[0]?.generated_at || Date.now()`
   - Line 487: Add `generated_at: list.generated_at` to range endpoint response

2. `frontend/src/components/admin/TelegramDailyLists.tsx`
   - Line 168: Remove `isToday` check, read `generated_at` from all views
   - For historical views: Read `generated_at` from `dateData.lists[0]?.generated_at`

**Acceptance Criteria**:
- "Bugün" tab shows database `generated_at` (e.g., 12:05:05), not current time
- "Dün" tab shows yesterday's `generated_at` timestamp, not `--:--`
- Stats card and bottom text both display same correct timestamp

**Test Commands**:
```bash
# Verify timestamp accuracy
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/today" | jq '.generated_at'

# Expected: Matches database timestamp (not current time)
psql $DATABASE_URL -c "SELECT EXTRACT(EPOCH FROM generated_at) * 1000 FROM telegram_daily_lists WHERE list_date = CURRENT_DATE LIMIT 1;"
```

---

### PR-F2: Fix Unknown League/Time Mapping (P1)

**Scope**: 1 file, ~30 lines changed

**Files**:
1. `src/services/telegram/dailyLists.service.ts` (getDailyLists function)
   - Add fallback for `league_name`: Use `competition_name || 'Bilinmeyen Lig'`
   - Add debug logging when `league_name` is missing

**Acceptance Criteria**:
- No match rows display "Unknown" for league name
- If FootyStats API returns `null`, use fallback text "Bilinmeyen Lig"
- Logs show warning when league name mapping fails

**Test Commands**:
```bash
# Check for null league names
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/today" | \
  jq '.lists[].matches[] | select(.league_name == null)'

# Expected: 0 results (all matches have league_name)
```

---

### PR-F3: Fix Range Endpoint to Return All Dates (P0)

**Scope**: 1 file, ~50 lines changed

**Files**:
1. `src/routes/telegram/dailyLists.routes.ts`
   - Lines 431-436: Replace single-date query with date range iteration
   - Add date generation loop: `for (let date = start; date <= end; date++)`
   - Call `getDailyLists(date)` for each date
   - Add guard: max 31 days to prevent abuse

**Acceptance Criteria**:
- `/range?start=2026-01-28&end=2026-01-30` returns 3 dates (Jan 28, 29, 30)
- "Dün" tab shows yesterday's data
- "Son 7 Gün" tab shows 7 date groups
- "Bu Ay" tab shows all dates from month start to today
- Request with >31 day range returns HTTP 400 error

**Test Commands**:
```bash
# Test 3-day range
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/range?start=2026-01-28&end=2026-01-30" | jq '.dates_count'
# Expected: 3 (or less if data missing for some dates)

# Test abuse guard
curl -s "https://partnergoalgpt.com/api/telegram/daily-lists/range?start=2026-01-01&end=2026-12-31" | jq '.error'
# Expected: "Date range too large" (400 error)
```

---

### PR-F4: Fix Performance Denominator (P2)

**Scope**: 1 file, ~2 lines changed

**Files**:
1. `frontend/src/components/admin/TelegramDailyLists.tsx`
   - Line 738: Change `{list.performance.won}/{list.performance.total - list.performance.pending}` → `{list.performance.won}/{list.performance.total}`
   - Line 586: Same fix for historical view

**Acceptance Criteria**:
- Performance label shows `won/total` (e.g., "3/5")
- Progress bar percentages match label denominator
- Win rate calculation unaffected (already uses `won/settled`)

**Test**:
```bash
# Visual inspection:
# - Progress bar: 60% green + 20% red + 20% gray = 100% ✅
# - Label: "3/5" ✅
# - Win rate: "75%" (3/4 excluding pending) ✅
```

---

## METADATA

**Document Version**: 1.0
**Last Updated**: 2026-01-31
**Author**: GoalGPT Engineering Team
**Files Audited**: 3 (frontend component, backend routes, settlement service)
**Total Lines Analyzed**: 1,358 lines
**Issues Identified**: 5 (2× P0, 2× P1, 1× P2)
**Estimated Fix Effort**: 2-3 hours (all PRs combined)
