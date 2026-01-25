# PHASE-2A: RULE & VALIDATION HARDENING - COMPLETE ✅

**Completion Date:** 2026-01-25
**Engineer:** Senior Backend Engineer + Domain Rules Engineer
**Status:** Ready for Deployment
**Focus:** Correctness of data & outcomes

---

## EXECUTIVE SUMMARY

**Objective:** Prevent invalid publishes and wrong settlements.

**Before Phase-2A:**
- ❌ Can publish LIVE matches
- ❌ Can publish FINISHED matches
- ❌ Can save unsupported market types
- ❌ Settlement logic scattered across job file
- ❌ No safety guards for missing data

**After Phase-2A:**
- ✅ MATCH STATE VALIDATION: Only NOT_STARTED matches can be published
- ✅ PICK VALIDATION: Only supported markets allowed
- ✅ RULE ENGINE: Centralized, testable settlement rules
- ✅ SAFETY GUARDS: Missing data → VOID (never guess)

---

## CHANGES MADE

### 1. Match State Validator ✅

**New File:** `src/services/telegram/validators/matchStateValidator.ts`

**Rules:**
```typescript
RULE 1: Match must be NOT_STARTED (status_id = 1)
  → Allow publish

RULE 2: Match is LIVE (status_id = 2,3,4,5,7)
  → REJECT: "Match is already {FIRST_HALF|HALF_TIME|SECOND_HALF|OVERTIME|PENALTY_SHOOTOUT}"

RULE 3: Match is FINISHED (status_id = 8,12)
  → REJECT: "Match is {FINISHED|CANCELLED}"

RULE 4: Match is DELAYED/INTERRUPTED/etc (status_id = 0,9,10,11,13)
  → REJECT: "Match is {ABNORMAL|DELAYED|INTERRUPTED|CUT_IN_HALF|TO_BE_DETERMINED}"

RULE 5: Unknown state
  → REJECT: "Unknown match state"
```

**Function:**
```typescript
validateMatchStateForPublish(statusId: number, matchId: string)
  → { valid: boolean, error?: string, errorCode?: string }
```

**Error Codes:**
- `MATCH_LIVE` - Match is currently being played
- `MATCH_FINISHED` - Match already finished
- `MATCH_INVALID_STATE` - Match in abnormal state
- `MATCH_UNKNOWN_STATE` - Unknown status_id

**Data Source (Phase-2A):**
```
CURRENT: Uses database status_id (fast, local)
LIMITATION: DB status can be slightly stale (updated by sync job)
```

**RECOMMENDATION for Phase-2B:**
```
PRODUCTION SCALE IMPROVEMENT:
- On publish, fetch fresh status_id from TheSports API
- Use API as primary source (most current)
- Fallback to DB only if API fails
- This prevents edge case: DB shows NOT_STARTED, but match just kicked off
```

---

### 2. Pick Validator ✅

**New File:** `src/services/telegram/validators/pickValidator.ts`

**Supported Markets:**
```typescript
const SUPPORTED_MARKETS = [
  'BTTS_YES',      // Both Teams To Score
  'O25_OVER',      // Over 2.5 Goals
  'O15_OVER',      // Over 1.5 Goals
  'HT_O05_OVER',   // Half-Time Over 0.5 Goals
] as const;
```

**Validation Rules:**
```typescript
RULE 1: At least one pick required
  → If picks.length === 0, REJECT

RULE 2: Market type must be supported
  → If market_type not in SUPPORTED_MARKETS, REJECT

RULE 3: No duplicate picks
  → If same market_type appears twice, REJECT

RULE 4: Odds validation (OPTIONAL but must be valid if provided)
  → Odds are displayed in Telegram messages as @1.85
  → If odds === null or undefined: ALLOWED (shows no odds)
  → If odds provided: must be numeric and 1.01-100.00
  → Reject: negative, zero, NaN, strings, out of range
```

**Function:**
```typescript
validatePicks(picks: Pick[], postId?: string)
  → { valid: boolean, error?: string, invalidPicks?: string[] }
```

**Example Validation Errors:**
```json
// Multiple validation errors
{
  "error": "Invalid picks",
  "details": "Unsupported market: O35_OVER; Duplicate markets: BTTS_YES",
  "invalid_picks": [
    "Unsupported market: O35_OVER",
    "Duplicate markets: BTTS_YES"
  ],
  "supported_markets": ["BTTS_YES", "O25_OVER", "O15_OVER", "HT_O05_OVER"]
}

// Odds validation error
{
  "error": "Invalid picks",
  "details": "Invalid odds for BTTS_YES: -1.5 (must be 1.01-100.00)",
  "invalid_picks": [
    "Invalid odds for BTTS_YES: -1.5 (must be 1.01-100.00)"
  ]
}
```

---

### 3. Settlement Rule Engine ✅

**New File:** `src/services/telegram/rules/settlementRules.ts`

**Purpose:** Centralized, rule-based settlement evaluation.

**Function:**
```typescript
evaluateSettlement(
  marketType: SupportedMarketType,
  scores: MatchScoreData,
  pickId?: string
) → SettlementResult
```

**Input:**
```typescript
interface MatchScoreData {
  home_score: number;
  away_score: number;
  ht_home_score?: number | null;
  ht_away_score?: number | null;
}
```

**Output:**
```typescript
interface SettlementResult {
  outcome: 'WON' | 'LOST' | 'VOID';
  rule: string;              // Human-readable rule explanation
  reason?: string;           // Reason for VOID
  data: Record<string, any>; // Score data used
}
```

---

### 4. Settlement Rules (Market by Market)

#### BTTS (Both Teams To Score)

**Rule:**
```
WIN:  home_score > 0 AND away_score > 0
LOSE: home_score == 0 OR away_score == 0
VOID: Never (FT score always available)
```

**Safety Guards:**
- If home_score < 0 or away_score < 0 → VOID (invalid data)

**Example:**
```typescript
// Input: { home_score: 2, away_score: 1 }
// Output: { outcome: 'WON', rule: 'BTTS: Both teams score (home: 2, away: 1)' }

// Input: { home_score: 3, away_score: 0 }
// Output: { outcome: 'LOST', rule: 'BTTS: Both teams score (home: 3, away: 0)' }
```

---

#### O2.5 (Over 2.5 Goals)

**Rule:**
```
WIN:  total_goals >= 3
LOSE: total_goals < 3
VOID: Never (FT score always available)
```

**Safety Guards:**
- If home_score < 0 or away_score < 0 → VOID (invalid data)

**Example:**
```typescript
// Input: { home_score: 2, away_score: 1 }
// Output: { outcome: 'WON', rule: 'O2.5: Total goals >= 3 (total: 3)' }

// Input: { home_score: 1, away_score: 1 }
// Output: { outcome: 'LOST', rule: 'O2.5: Total goals >= 3 (total: 2)' }
```

---

#### O1.5 (Over 1.5 Goals)

**Rule:**
```
WIN:  total_goals >= 2
LOSE: total_goals < 2
VOID: Never (FT score always available)
```

**Safety Guards:**
- If home_score < 0 or away_score < 0 → VOID (invalid data)

**Example:**
```typescript
// Input: { home_score: 1, away_score: 1 }
// Output: { outcome: 'WON', rule: 'O1.5: Total goals >= 2 (total: 2)' }

// Input: { home_score: 1, away_score: 0 }
// Output: { outcome: 'LOST', rule: 'O1.5: Total goals >= 2 (total: 1)' }
```

---

#### HT O0.5 (Half-Time Over 0.5 Goals)

**Rule:**
```
WIN:  ht_total_goals >= 1
LOSE: ht_total_goals == 0
VOID: If HT data missing (null, undefined, NaN)
```

**Safety Guards (CRITICAL):**
- If ht_home_score === null → VOID
- If ht_home_score === undefined → VOID
- If isNaN(ht_home_score) → VOID
- If ht_away_score === null → VOID
- If ht_away_score === undefined → VOID
- If isNaN(ht_away_score) → VOID
- If ht_home_score < 0 or ht_away_score < 0 → VOID (invalid data)

**Example:**
```typescript
// Input: { home_score: 2, away_score: 1, ht_home_score: 1, ht_away_score: 0 }
// Output: { outcome: 'WON', rule: 'HT O0.5: HT total goals >= 1 (HT total: 1)' }

// Input: { home_score: 2, away_score: 1, ht_home_score: 0, ht_away_score: 0 }
// Output: { outcome: 'LOST', rule: 'HT O0.5: HT total goals >= 1 (HT total: 0)' }

// Input: { home_score: 2, away_score: 1, ht_home_score: null, ht_away_score: null }
// Output: { outcome: 'VOID', rule: 'HT O0.5: Half-time data missing', reason: 'HT_DATA_MISSING' }
```

**CRITICAL:** NEVER guess HT scores. If data missing, ALWAYS mark VOID.

---

## INTEGRATION CHANGES

### Publish Endpoint (`telegram.routes.ts`)

**New Steps Added:**
```
4. PHASE-2A: PICK VALIDATION
   → Validate picks before processing
   → Return 400 if unsupported markets or duplicates

5. PHASE-2A: MATCH STATE VALIDATION
   → Query database for match status_id
   → Validate match is NOT_STARTED
   → Return 400 if LIVE, FINISHED, or invalid state
```

**Flow:**
```
OLD:
1. Validate inputs
2. Check bot config
3. Idempotency check
4. Fetch match data
5. Create draft
6. Send to Telegram
7. Save picks

NEW:
1. Validate inputs
2. Check bot config
3. Idempotency check
4. ✨ PICK VALIDATION (new)
5. ✨ MATCH STATE VALIDATION (new)
6. Fetch match data
7. Create draft
8. Send to Telegram
9. Save picks
```

**Error Response (Match State):**
```json
{
  "error": "Invalid match state",
  "details": "Match is already FIRST_HALF. Cannot publish predictions for live matches.",
  "error_code": "MATCH_LIVE",
  "match_status_id": 2
}
```

**Error Response (Pick Validation):**
```json
{
  "error": "Invalid picks",
  "details": "Unsupported market: O35_OVER",
  "invalid_picks": ["Unsupported market: O35_OVER"],
  "supported_markets": ["BTTS_YES", "O25_OVER", "O15_OVER", "HT_O05_OVER"]
}
```

---

### Settlement Job (`telegramSettlement.job.ts`)

**Changes:**
```
OLD:
- Settlement logic scattered in switch statement
- Hard-coded market labels
- Inconsistent VOID handling

NEW:
- Uses evaluateSettlement() rule engine
- Centralized market labels (getMarketLabelTurkish)
- Consistent VOID handling for all markets
- All evaluations logged with rule used
```

**Flow:**
```
for each pick:
  1. Call evaluateSettlement(market_type, score_data, pick_id)
  2. Get outcome (WON/LOST/VOID) + rule explanation
  3. Save to database with settlement.data
  4. Log outcome with rule
```

**Database Changes:**
```sql
-- result_data now contains structured data from rule engine
{
  "home_score": 2,
  "away_score": 1,
  "total_goals": 3  // For O2.5/O1.5
}

-- Or for HT O0.5:
{
  "ht_home_score": 1,
  "ht_away_score": 0,
  "ht_total_goals": 1
}

-- Or for VOID:
{
  "reason": "HT_DATA_MISSING"
}
```

---

## TESTING EXAMPLES

### Test 1: Publish LIVE Match (Should Reject)

**Request:**
```bash
POST /api/telegram/publish/match/8200594
{
  "match_id": "live-match-123",
  "picks": [{"market_type": "BTTS_YES"}]
}
```

**Response:**
```json
{
  "error": "Invalid match state",
  "details": "Match is already FIRST_HALF. Cannot publish predictions for live matches.",
  "error_code": "MATCH_LIVE",
  "match_status_id": 2
}
```

---

### Test 2: Publish with Unsupported Market (Should Reject)

**Request:**
```bash
POST /api/telegram/publish/match/8200594
{
  "match_id": "match-123",
  "picks": [
    {"market_type": "BTTS_YES"},
    {"market_type": "O35_OVER"}  // NOT SUPPORTED
  ]
}
```

**Response:**
```json
{
  "error": "Invalid picks",
  "details": "Unsupported market: O35_OVER",
  "invalid_picks": ["Unsupported market: O35_OVER"],
  "supported_markets": ["BTTS_YES", "O25_OVER", "O15_OVER", "HT_O05_OVER"]
}
```

---

### Test 3: Settlement with Missing HT Data (Should VOID)

**Database State:**
```sql
-- Match: 2-1 FT, but HT data NULL
home_score: 2
away_score: 1
ht_home_score: NULL
ht_away_score: NULL
```

**Settlement Result:**
```typescript
// Pick: HT_O05_OVER
evaluateSettlement('HT_O05_OVER', {
  home_score: 2,
  away_score: 1,
  ht_home_score: null,
  ht_away_score: null
})

// Output:
{
  outcome: 'VOID',
  rule: 'HT O0.5: Half-time data missing',
  reason: 'HT_DATA_MISSING',
  data: {
    home_score: 2,
    away_score: 1,
    ht_home_score: null,
    ht_away_score: null
  }
}
```

**Telegram Reply:**
```
✅ Sonuç: 2-1

📊 Tahmin Durumu: 0/0

⚪ İY Üst 0.5 (VOID)
```

---

### Test 4: Settlement with Complete Data (Should Evaluate)

**Database State:**
```sql
-- Match: 3-1 FT, HT: 1-0
home_score: 3
away_score: 1
ht_home_score: 1
ht_away_score: 0
```

**Picks:**
```typescript
BTTS_YES   → evaluates to WON (both teams scored: home=3, away=1)
O25_OVER   → evaluates to WON (4 goals >= 3)
O15_OVER   → evaluates to WON (4 goals >= 2)
HT_O05_OVER → evaluates to WON (1 HT goal >= 1)
```

**Telegram Reply:**
```
✅ Sonuç: 3-1

📊 Tahmin Durumu: 4/4

✅ BTTS
✅ Üst 2.5
✅ Üst 1.5
✅ İY Üst 0.5
```

---

## DEPLOYMENT INSTRUCTIONS

### No Migration Required

Phase-2A is **code-only** - no database changes.

### Deploy Steps

```bash
# Local Development
npm run dev

# Production VPS
ssh root@142.93.103.128
cd /var/www/goalgpt
git pull
npm install
npm run build
pm2 restart goalgpt
```

### Verify Deployment

#### Test 1: Try to Publish LIVE Match

```bash
# Find a live match
SELECT external_id, status_id FROM ts_matches WHERE status_id IN (2,3,4,5,7) LIMIT 1;

# Try to publish it (should REJECT)
curl -X POST http://localhost:3000/api/telegram/publish/match/{fsMatchId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "match_id": "{external_id}",
    "picks": [{"market_type": "BTTS_YES"}]
  }'

# Expected: 400 error with "Match is already {LIVE_STATE}"
```

#### Test 2: Try Unsupported Market

```bash
curl -X POST http://localhost:3000/api/telegram/publish/match/{fsMatchId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "match_id": "match-123",
    "picks": [{"market_type": "CORNERS_9.5"}]
  }'

# Expected: 400 error with "Unsupported market"
```

#### Test 3: Check Settlement Logs

```bash
# Check logs for rule engine usage
grep "SettlementRules" logs/backend.log

# Should see:
# [SettlementRules] 🎯 Evaluating settlement
# [SettlementRules] BTTS evaluation: WON
# [SettlementRules] ✅ Settlement evaluated
```

---

## GUARANTEES PROVIDED

### 1. MATCH STATE VALIDATION ✅

**Guarantee:** Cannot publish LIVE, FINISHED, or invalid matches.

**Mechanism:**
- Query database for match status_id
- Validate against MatchState enum
- Reject if not NOT_STARTED

**Test:**
```bash
# Try to publish live match → 400 MATCH_LIVE
# Try to publish finished match → 400 MATCH_FINISHED
# Try to publish cancelled match → 400 MATCH_FINISHED
```

---

### 2. PICK VALIDATION ✅

**Guarantee:** Only supported markets can be saved.

**Mechanism:**
- Validate picks before DB write
- Check against SUPPORTED_MARKETS constant
- Detect duplicates

**Test:**
```bash
# Try unsupported market → 400 INVALID_PICKS
# Try duplicate market → 400 INVALID_PICKS
```

---

### 3. RULE ENGINE ✅

**Guarantee:** Settlement logic is centralized, testable, and auditable.

**Mechanism:**
- Single evaluateSettlement() function
- Explicit rules for each market
- Returns outcome + rule explanation

**Test:**
```bash
# Check settlement logs → See rule explanations
# Query result_data → See structured settlement data
```

---

### 4. SAFETY GUARDS ✅

**Guarantee:** Missing data → VOID (never guess).

**Mechanism:**
- Explicit null/undefined/NaN checks
- Negative score validation
- VOID on any invalid data

**Test:**
```bash
# Match with missing HT data → HT_O05_OVER marked VOID
# Match with negative score → All picks marked VOID
```

---

## MONITORING QUERIES

### Check Rejected Publishes (Match State)

```bash
# Check logs for match state rejections
grep "Match state validation failed" logs/backend.log

# Should show:
# [Telegram] ❌ Match state validation failed
#   { match_id: 'xyz', status_id: 2, error: 'Match is already FIRST_HALF' }
```

### Check Rejected Publishes (Pick Validation)

```bash
# Check logs for pick validation failures
grep "Pick validation failed" logs/backend.log

# Should show:
# [PickValidator] ❌ Pick validation failed
#   { invalid_picks: ['Unsupported market: O35_OVER'] }
```

### Check Settlement Rule Usage

```sql
-- Check settlement results
SELECT
  market_type,
  status,
  result_data->>'rule' as rule_used,
  COUNT(*)
FROM telegram_picks
WHERE settled_at > NOW() - INTERVAL '7 days'
GROUP BY market_type, status, result_data->>'rule'
ORDER BY market_type, status;
```

### Check VOID Rate

```sql
-- Check VOID rate by market
SELECT
  market_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'void' THEN 1 END) as void_count,
  ROUND(100.0 * COUNT(CASE WHEN status = 'void' THEN 1 END) / COUNT(*), 2) as void_pct
FROM telegram_picks
WHERE settled_at > NOW() - INTERVAL '30 days'
GROUP BY market_type
ORDER BY void_pct DESC;
```

Expected: HT_O05_OVER should have highest VOID% (due to missing HT data).

---

## FILES CHANGED

### New Files (3)
- `src/services/telegram/validators/matchStateValidator.ts` (148 lines)
- `src/services/telegram/validators/pickValidator.ts` (145 lines)
- `src/services/telegram/rules/settlementRules.ts` (347 lines)

### Modified Files (2)
- `src/routes/telegram.routes.ts` (~50 lines changed - added validations)
- `src/jobs/telegramSettlement.job.ts` (~40 lines changed - rule engine integration)

### Documentation (1)
- `PHASE-2A-RULES.md` (This file)

**Total:** ~730 lines added/changed

---

## COMMIT MESSAGES

Recommended commit strategy:

```bash
git add src/services/telegram/validators/
git commit -m "rules: Add match state and pick validators (Phase-2A)"

git add src/services/telegram/rules/
git commit -m "rules: Add settlement rule engine with safety guards (Phase-2A)"

git add src/routes/telegram.routes.ts
git commit -m "rules: Integrate validators into publish endpoint (Phase-2A)"

git add src/jobs/telegramSettlement.job.ts
git commit -m "rules: Integrate rule engine into settlement job (Phase-2A)"

git add PHASE-2A-RULES.md
git commit -m "rules: Add Phase-2A documentation"
```

---

## WHAT'S NEXT: PHASE-2B

**Phase-2A Score Improvement:** 5.0/10 → 6.0/10 (Estimated)

**Still Missing (PHASE-2B):**
- Corners and cards settlement markets
- FootyStats confidence grading
- Advanced monitoring dashboard
- Manual override tools
- Timezone handling

**Timeline:** PHASE-2B estimated at 2-3 weeks

See: `ACTIONABLE-TODO.md` for full task list.

---

## ROLLBACK PLAN

If issues are detected after deployment:

### Revert Code

```bash
# On VPS
cd /var/www/goalgpt
git revert HEAD~4..HEAD  # Revert last 4 commits (Phase-2A)
npm install
npm run build
pm2 restart goalgpt
```

**Impact:** System reverts to Phase-1 behavior (no validation, scattered settlement logic).

---

## SUCCESS CRITERIA

Phase-2A is considered successful if:

- [x] Cannot publish LIVE matches (400 MATCH_LIVE)
- [x] Cannot publish FINISHED matches (400 MATCH_FINISHED)
- [x] Cannot publish unsupported markets (400 INVALID_PICKS)
- [x] HT O0.5 with missing data → VOID
- [x] Settlement logs show rule explanations
- [x] TypeScript compiles with 0 errors
- [x] No regressions (existing publishes still work)

---

## SIGN-OFF

> **Phase-2A Rule & Validation Hardening is COMPLETE and ready for production deployment.**

As Senior Backend Engineer + Domain Rules Engineer, I certify:

1. ✅ All 4 Phase-2A objectives completed
2. ✅ MATCH STATE VALIDATION: Only NOT_STARTED matches allowed
3. ✅ PICK VALIDATION: Only supported markets allowed
4. ✅ RULE ENGINE: Centralized, testable settlement logic
5. ✅ SAFETY GUARDS: Missing data → VOID (never guess)
6. ✅ No breaking changes
7. ✅ Phase-1 guarantees preserved
8. ✅ Deployment instructions provided
9. ✅ Rollback plan documented

**Risk Level:** MEDIUM → LOW
**Recommendation:** DEPLOY to production
**Next Step:** Deploy, verify, monitor for 48 hours, then proceed to PHASE-2B

---

**Phase-2A Complete** ✅
**Date:** 2026-01-25
**Status:** Ready for Deployment
