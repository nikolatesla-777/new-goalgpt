# SYSTEM GAP REPORT - GoalGPT Telegram Publishing System

**Report Date:** 2026-01-25
**Auditor:** Senior Project Manager & Delivery Auditor
**Scope:** End-to-end Telegram publishing and settlement system
**Severity Scale:** 🔴 CRITICAL | 🟡 HIGH | 🟢 MEDIUM | ⚪ LOW

---

## EXECUTIVE SUMMARY

**Overall Readiness:** ❌ NOT READY FOR SCALE
**Critical Blockers:** 7
**High Priority Gaps:** 12
**Medium Priority Gaps:** 8

**Bottom Line:** The system works in happy path scenarios but has ZERO resilience for edge cases, errors, or scale. Multiple single points of failure exist. No operational monitoring or recovery mechanisms in place.

---

## 🔴 CRITICAL GAPS (System Killers)

### 1. NO IDEMPOTENCY PROTECTION

**File:** `src/routes/telegram.routes.ts:146-155`

**Issue:**
```sql
ON CONFLICT (match_id, channel_id) DO UPDATE
SET telegram_message_id = EXCLUDED.telegram_message_id
```

**Problem:**
- Same match can be published TWICE
- Second publish OVERWRITES first message_id
- Old picks become orphaned
- Settlement breaks (targets wrong message)

**Impact:**
- User confusion (duplicate messages)
- Lost settlement tracking
- Incorrect win/loss statistics

**Missing:**
```typescript
// Should be:
ON CONFLICT (match_id, channel_id) DO NOTHING
RETURNING id, telegram_message_id,
  (xmax = 0) AS is_new_post  -- PostgreSQL way to detect conflict
```

---

### 2. NO ERROR RECOVERY MECHANISM

**File:** `src/services/telegram/telegram.client.ts:103-106`

**Issue:**
```typescript
async sendMessage(message: TelegramMessage): Promise<TelegramResponse<MessageResult>> {
  this.requestCount++;
  const response = await this.axiosInstance.post('/sendMessage', message);
  return response.data;
}
```

**Problems:**
- NO retry logic
- NO exponential backoff
- NO circuit breaker
- Telegram API errors kill entire publish operation

**Impact:**
- Temporary Telegram outage = lost publish (no retry)
- Rate limit = crash (no backoff)
- Network glitch = data written to DB without Telegram post

**Missing:**
```typescript
// Should have:
- Retry with exponential backoff (3 attempts)
- Circuit breaker pattern
- Dead letter queue for failed messages
- Rollback DB transaction on Telegram failure
```

---

### 3. NO DRAFT/PUBLISHED STATE MACHINE

**File:** `src/database/migrations/004-create-telegram-tables.ts:24`

**Issue:**
```typescript
.addColumn('status', 'varchar(20)', col => col.defaultTo('active'))
```

**Problem:**
- Only ONE status: 'active'
- Published immediately
- NO way to save draft
- NO way to schedule publish
- NO way to cancel publish in-flight

**Impact:**
- Cannot prepare posts in advance
- Cannot review before publish
- Cannot implement approval workflow
- Mistakes go live immediately

**Missing State Machine:**
```
draft → pending_review → approved → publishing → published → settled
   ↓         ↓             ↓           ↓            ↓
cancelled  rejected     scheduled   failed      error
```

---

### 4. INCOMPLETE SETTLEMENT RULES

**File:** `src/jobs/telegramSettlement.job.ts:96-122`

**Supported Markets:** ONLY 4
- ✅ BTTS_YES
- ✅ O25_OVER
- ✅ O15_OVER
- ✅ HT_O05_OVER

**Missing Markets:** (mentioned in docs but not implemented)
- ❌ Corners 8.5+ / 9.5+ / 10.5+
- ❌ Cards 4.5+ / 5.5+
- ❌ O35_OVER
- ❌ BTTS_VAR variants
- ❌ Asian Handicaps
- ❌ Both halves over 0.5

**Impact:**
- Cannot publish corner/card predictions
- Limited market coverage
- Manual settlement required
- Scalability blocked

---

### 5. NO VALIDATION OF MATCH STATE

**File:** `src/routes/telegram.routes.ts:44-70`

**Missing Checks:**
```typescript
// ❌ NOT CHECKED:
- Is match already started?
- Is match postponed?
- Is match cancelled?
- Does match exist in TheSports?
- Is match time > 2 hours in future?
- Are team names matching between FootyStats and TheSports?
```

**Impact:**
- Can publish match that's already playing
- Can publish cancelled match
- Data inconsistency between systems
- Settlement fails (match not found)

---

### 6. NO TRANSACTION ROLLBACK ON FAILURE

**File:** `src/routes/telegram.routes.ts:131-168`

**Issue:**
```typescript
// 4. Send to Telegram
const result = await telegramBot.sendMessage(...);

if (!result.ok) {
  return reply.status(500).send({ error: 'Failed to send to Telegram' });
}

// 5. Save to database (AFTER Telegram send)
await safeQuery(`INSERT INTO telegram_posts...`);
```

**Problem:**
- If Telegram succeeds but DB insert fails → Message sent, no tracking
- If Telegram fails → Already returned error, no cleanup
- NO database transaction wrapping both operations

**Impact:**
- Data inconsistency
- Lost messages
- Cannot retry safely

---

### 7. ZERO OPERATIONAL MONITORING

**Missing Entirely:**

**No Monitoring:**
- ❌ Failed Telegram sends
- ❌ Settlement failures
- ❌ Orphaned picks
- ❌ Duplicate posts
- ❌ API rate limits hit
- ❌ Job execution time
- ❌ Error rates

**No Alerting:**
- ❌ Telegram API down
- ❌ Settlement job stuck
- ❌ Database connection loss
- ❌ FootyStats API failure

**No Audit Logs:**
- ❌ Who published what when
- ❌ Manual vs automated publishes
- ❌ Settlement overrides
- ❌ System state changes

**Impact:**
- Blind operation
- Cannot debug production issues
- Cannot measure SLA
- Cannot detect anomalies

---

## 🟡 HIGH PRIORITY GAPS

### H1. FootyStats Data Reliability - NO CONFIDENCE GRADING

**File:** `src/services/footystats/footystats.client.ts`

**Problem:**
- All leagues treated equally
- NO quality score for data
- NO "trusted leagues" vs "risky leagues"
- NO handling of missing data fields

**Missing:**
```typescript
interface DataQuality {
  league_tier: 'A' | 'B' | 'C' | 'D';
  data_completeness: number; // 0-100%
  historical_accuracy: number; // 0-100%
  sample_size: number; // matches in dataset
  confidence: 'high' | 'medium' | 'low';
}
```

**Impact:**
- Publishing low-quality predictions
- No way to filter unreliable data
- User trust damage from bad picks

---

### H2. NO RATE LIMIT HANDLING

**File:** `src/services/telegram/telegram.client.ts:103-106`

**Problem:**
- Telegram API: 30 msg/second limit
- NO tracking of sends per second
- NO queue for batch publishing
- Will hit rate limit on bulk publish

**Impact:**
- Bulk publish fails after 30 messages
- Partial publish (some succeed, some fail)
- No way to resume failed batch

---

### H3. SETTLEMENT JOB - NO MAX RETRY LIMIT

**File:** `src/jobs/telegramSettlement.job.ts:178-184`

**Problem:**
```typescript
} catch (err) {
  logger.error(`[TelegramSettlement] Failed to reply for post ${post.id}:`, err);
  // Do NOT mark as settled if reply failed
}
```

**Issue:**
- Job retries FOREVER
- NO backoff strategy
- NO max retry count
- NO dead letter queue

**Impact:**
- Single bad post blocks queue
- Infinite retry loop
- Resource exhaustion

---

### H4. NO PICK VALIDATION

**File:** `src/routes/telegram.routes.ts:160-167`

**Problem:**
```typescript
for (const pick of picks) {
  await safeQuery(
    `INSERT INTO telegram_picks (post_id, market_type, odds, status)
     VALUES ($1, $2, $3, 'pending')`,
    [postId, pick.market_type, pick.odds || null]
  );
}
```

**Missing Validation:**
- ❌ Is market_type valid enum?
- ❌ Are odds reasonable (1.01 - 100.00)?
- ❌ Are picks duplicated?
- ❌ Maximum picks per post?
- ❌ Conflicting picks (O2.5 + U2.5)?

**Impact:**
- Invalid picks saved
- Settlement fails
- Cannot detect typos

---

### H5. NO TIMEZONE HANDLING

**File:** `src/services/telegram/turkish.formatter.ts:48-50`

**Problem:**
```typescript
const matchDate = new Date(date_unix * 1000);
const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
```

**Issue:**
- Uses user's local timezone
- FootyStats uses UTC
- TheSports uses TSI (UTC+3)
- NO explicit timezone conversion

**Impact:**
- Wrong match time displayed
- Confusion for users
- Matches appear at wrong time

---

### H6. NO MANUAL OVERRIDE CAPABILITY

**Missing:**
- Cannot manually settle a pick
- Cannot void a pick
- Cannot edit published message
- Cannot cancel settlement

**Impact:**
- Stuck in bad state
- Requires direct DB manipulation
- High operational risk

---

### H7. NO REPLAY MECHANISM

**Missing:**
- Cannot re-run settlement for specific match
- Cannot republish failed message
- Cannot bulk retry failed publishes

**Impact:**
- Manual intervention required
- Time-consuming recovery
- Cannot fix at scale

---

### H8. SETTLEMENT ASSUMES COMPLETE DATA

**File:** `src/jobs/telegramSettlement.job.ts:84-86`

**Problem:**
```typescript
const htHomeScore = parseInt(post.ht_home_score);
const htAwayScore = parseInt(post.ht_away_score);
const htTotalGoals = htHomeScore + htAwayScore;
```

**Issue:**
- NO validation of score data
- NaN handled ONLY for HT O0.5
- Other markets assume valid scores

**Missing:**
```typescript
// Should check:
if (isNaN(homeScore) || isNaN(awayScore)) {
  // VOID all picks
}
if (homeScore < 0 || awayScore < 0) {
  // Invalid data
}
```

---

### H9. NO LEAGUE BLACKLIST/WHITELIST

**Missing:**
- Cannot disable specific leagues
- Cannot enable "pro only" leagues
- Cannot warn on low-tier leagues

**Impact:**
- Publishing predictions for unreliable leagues
- Cannot segment by user tier (hobby vs pro)

---

### H10. NO DUPLICATE PICK DETECTION

**File:** `src/routes/telegram.routes.ts:160-167`

**Problem:**
```typescript
for (const pick of picks) {
  await safeQuery(`INSERT INTO telegram_picks...`);
}
```

**Issue:**
- Can insert same market_type multiple times
- NO unique constraint on (post_id, market_type)

**Impact:**
- Duplicate picks saved
- Settlement processes same pick twice
- Confusing results

---

### H11. TURKISH FORMATTER - HARD-CODED STRINGS

**File:** `src/services/telegram/turkish.formatter.ts`

**Problem:**
- All strings hard-coded in Turkish
- NO i18n support
- Cannot support English, German, etc.

**Impact:**
- Single language only
- Cannot expand to other markets
- Maintenance nightmare

---

### H12. NO API REQUEST TIMEOUT HANDLING

**File:** `src/services/footystats/footystats.client.ts:62-65`

**Problem:**
```typescript
this.axiosInstance = axios.create({
  baseURL: `https://api.telegram.org/bot${this.botToken}`,
  timeout: 30000,
```

**Issue:**
- 30 second timeout exists
- BUT no handling of timeout errors
- NO fallback data
- NO cached response

**Impact:**
- Slow API = publish failure
- No degraded mode

---

## 🟢 MEDIUM PRIORITY GAPS

### M1. NO METRICS COLLECTION

**Missing:**
- Publish success rate
- Average publish time
- Settlement success rate
- Pick win rate by market
- Pick win rate by league

---

### M2. NO BATCH PUBLISH CAPABILITY

**Problem:**
- Can only publish one match at a time
- NO API for batch publish
- Frontend would need to loop

---

### M3. NO SCHEDULED PUBLISHING

**Problem:**
- Publish happens immediately
- Cannot schedule for specific time
- Cannot auto-publish at match kickoff -1h

---

### M4. NO CANCELLATION CAPABILITY

**Problem:**
- Once published, cannot cancel
- Cannot delete Telegram message
- Cannot unpublish

---

### M5. NO PICK ODDS VALIDATION

**Problem:**
- Odds saved as DECIMAL(5,2)
- NO validation that odds are reasonable
- Can save odds = 0.00 or 999.99

---

### M6. NO SETTLEMENT NOTIFICATION

**Problem:**
- Settlement happens silently
- NO notification to admin
- NO summary report

---

### M7. SETTLEMENT QUERY - NO INDEX ON settled_at

**File:** `src/database/migrations/004-create-telegram-tables.ts`

**Problem:**
```sql
WHERE p.settled_at IS NULL
```

**Missing:** Index on `settled_at` for performance

---

### M8. NO HEALTH CHECK FOR FOOTYSTATS

**Problem:**
- Telegram has `/telegram/health`
- FootyStats has NO health endpoint
- Cannot verify API is working

---

## ⚪ LOW PRIORITY GAPS

1. NO SOFT DELETE (posts permanently deleted)
2. NO ARCHIVE TABLE (old posts lost)
3. NO COMPRESSION (content field is TEXT)
4. NO PICK HISTORY (cannot see changes)
5. NO A/B TESTING (cannot test message formats)

---

## DEPENDENCY ANALYSIS

### External Service Failures

| Service | Failure Mode | Impact | Mitigation |
|---------|-------------|--------|------------|
| Telegram API | Rate limit | Publish fails | ❌ NONE |
| Telegram API | Downtime | Publish fails | ❌ NONE |
| FootyStats API | Downtime | Publish fails | ❌ NONE |
| FootyStats API | Missing data | Partial message | ⚠️ WARN (logged) |
| TheSports API | Match not found | Settlement fails | ❌ NONE |
| PostgreSQL | Connection loss | All operations fail | ❌ NONE |

**Resilience Score: 0/10**

---

## DATA INTEGRITY RISKS

### 1. Orphaned Picks

**Scenario:**
1. Publish match A (message_id: 100)
2. Publish match A again (message_id: 200, overwrite)
3. Old picks reference message_id 100 (deleted from Telegram)
4. Settlement tries to reply to non-existent message

**Status:** ❌ CAN HAPPEN NOW

---

### 2. Settlement Without Telegram Confirmation

**Scenario:**
1. Telegram reply API call times out
2. Error caught, post NOT marked as settled
3. Job retries forever
4. Eventually times out, but picks already updated

**Status:** ⚠️ PARTIALLY MITIGATED (doesn't mark settled, but picks updated)

---

### 3. Match Score Data Missing

**Scenario:**
1. Match finishes but TheSports doesn't have scores yet
2. Settlement runs with NULL scores
3. All picks marked as LOST (0-0 assumed)

**Status:** ❌ CAN HAPPEN NOW

---

## IMPLICIT ASSUMPTIONS (Dangerous)

1. **"Telegram API is always available"**
   - Reality: Has downtime, rate limits

2. **"FootyStats always has complete data"**
   - Reality: Missing data for lower leagues

3. **"Match will always have HT scores"**
   - Reality: Some leagues don't report HT scores

4. **"One match = one publish"**
   - Reality: Can republish, causing duplicates

5. **"Settlement runs after match is FINAL"**
   - Reality: Runs when status_id = 8, but scores might not be final

6. **"Turkish formatter works for all data"**
   - Reality: Fails gracefully if data is null, but message looks bad

---

## UNWRITTEN RULES (Must Document)

1. **When to publish?**
   - Undefined: 1 hour before? 2 hours before? Same day?

2. **Which leagues are allowed?**
   - Undefined: All? Only top-tier? User choice?

3. **How many picks per match?**
   - Undefined: 1? 5? 10? Unlimited?

4. **Who can publish?**
   - Code says: "admin role"
   - Reality: No role check in code

5. **What happens if match is postponed?**
   - Undefined: Auto-void? Manual intervention?

6. **What if settlement fails?**
   - Undefined: Retry? Manual? Void?

---

## AREAS THAT RELY ON "IT WORKS FOR NOW"

1. **Single-threaded settlement**
   - Works: For <100 matches/day
   - Breaks: At 1000+ matches/day

2. **No queueing**
   - Works: For manual publish (1 at a time)
   - Breaks: For bulk automated publish

3. **No caching**
   - Works: For low traffic
   - Breaks: When FootyStats API is slow

4. **No connection pooling limits**
   - Works: For few concurrent requests
   - Breaks: Under load

5. **Manual error recovery**
   - Works: For 1-2 errors/day
   - Breaks: At 50+ errors/day

---

## MISSING SPECIFICATIONS

### 1. Telegram Publishing State Machine

**Status:** ❌ NOT DEFINED

**Needed:**
- Valid states
- Transitions
- Who can trigger transitions
- Rollback rules

---

### 2. Settlement Rule Specification

**Status:** ⚠️ PARTIALLY DEFINED (only in code comments)

**Needed:**
- Formal spec document
- Edge cases
- VOID scenarios
- Data quality thresholds

---

### 3. Error Handling Strategy

**Status:** ❌ NOT DEFINED

**Needed:**
- Retry policy (attempts, backoff)
- Dead letter queue
- Manual intervention triggers
- Escalation path

---

### 4. Data Quality Standards

**Status:** ❌ NOT DEFINED

**Needed:**
- Minimum data completeness (%)
- League confidence grading
- When to reject publish
- When to add warnings

---

### 5. Operational Runbook

**Status:** ❌ NOT DEFINED

**Needed:**
- How to manually settle a pick
- How to republish failed message
- How to void a settlement
- How to recover from Telegram outage

---

## CRITICAL NEXT ACTIONS

See `ACTIONABLE-TODO.md` for prioritized task list.

---

**Report End**

**Status:** System requires significant hardening before production scale.
**Recommendation:** DO NOT SCALE until Critical + High gaps are addressed.
