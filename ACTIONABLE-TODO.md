# ACTIONABLE TODO - GoalGPT Telegram System Hardening

**Generated:** 2026-01-25
**Priority Framework:** NOW (this week) | SOON (this month) | LATER (nice-to-have)
**Effort Scale:** XS (1-2h) | S (2-4h) | M (1 day) | L (2-3 days) | XL (1 week+)

---

## 🔴 NOW (Week 1 - Must Have Before ANY Scaling)

### N1. Add Idempotency Protection
**Priority:** 🔴 CRITICAL
**Effort:** S (2-3 hours)
**File:** `src/routes/telegram.routes.ts:146-155`

**Changes:**
```sql
-- Change from:
ON CONFLICT (match_id, channel_id) DO UPDATE
SET telegram_message_id = EXCLUDED.telegram_message_id

-- To:
ON CONFLICT (match_id, channel_id) DO NOTHING
RETURNING id, telegram_message_id,
  (xmax = 0) AS is_new_post
```

**Additional:**
- Return error if post already exists
- Add UI indicator "Already Published"
- Add endpoint GET `/telegram/posts/:matchId/status`

**Testing:**
- Try publishing same match twice
- Verify second attempt returns error
- Verify picks not duplicated

---

### N2. Implement Telegram API Retry Logic
**Priority:** 🔴 CRITICAL
**Effort:** M (6-8 hours)
**File:** `src/services/telegram/telegram.client.ts`

**Implementation:**
```typescript
// Install: npm install axios-retry
import axiosRetry from 'axios-retry';

// In constructor:
axiosRetry(this.axiosInstance, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error)
      || error.response?.status === 429  // Rate limit
      || error.response?.status === 503; // Service unavailable
  }
});
```

**Additional:**
- Log retry attempts
- Add circuit breaker (use `opossum` library)
- Return retry metadata in response

**Testing:**
- Mock Telegram API failure
- Verify 3 retries with backoff
- Verify circuit breaker opens after 5 failures

---

### N3. Wrap Publish in Database Transaction
**Priority:** 🔴 CRITICAL
**Effort:** M (6 hours)
**File:** `src/routes/telegram.routes.ts:44-183`

**Implementation:**
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1. Send to Telegram FIRST
  const telegramResult = await telegramBot.sendMessage(...);

  if (!telegramResult.ok) {
    await client.query('ROLLBACK');
    return reply.status(500).send({ error: 'Telegram send failed' });
  }

  // 2. THEN save to database
  await client.query(`INSERT INTO telegram_posts...`);
  await client.query(`INSERT INTO telegram_picks...`);

  await client.query('COMMIT');

} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**Testing:**
- Mock DB failure after Telegram success
- Verify rollback prevents orphaned posts
- Verify transaction isolation

---

### N4. Add Match State Validation
**Priority:** 🔴 CRITICAL
**Effort:** S (3-4 hours)
**File:** `src/routes/telegram.routes.ts:44-70`

**Implementation:**
```typescript
// Before publishing, check:
const match = await safeQuery(
  `SELECT status_id, date, time
   FROM ts_matches
   WHERE external_id = $1`,
  [match_id]
);

if (!match[0]) {
  return reply.status(404).send({
    error: 'Match not found in TheSports database'
  });
}

const INVALID_STATUSES = [9, 10]; // POSTPONED, CANCELLED
if (INVALID_STATUSES.includes(match[0].status_id)) {
  return reply.status(400).send({
    error: `Match is ${match[0].status_id === 9 ? 'POSTPONED' : 'CANCELLED'}`
  });
}

const IN_PROGRESS_STATUSES = [2, 3, 4, 5, 7]; // Playing statuses
if (IN_PROGRESS_STATUSES.includes(match[0].status_id)) {
  return reply.status(400).send({
    error: 'Match already started - cannot publish'
  });
}

// Check if match is too far in future (>7 days)
const matchDate = new Date(match[0].date + ' ' + match[0].time);
const daysUntilMatch = (matchDate - Date.now()) / (1000 * 60 * 60 * 24);
if (daysUntilMatch > 7) {
  return reply.status(400).send({
    error: 'Match is more than 7 days away'
  });
}
```

**Testing:**
- Try publishing started match
- Try publishing cancelled match
- Try publishing match >7 days away

---

### N5. Implement Pick Validation
**Priority:** 🔴 CRITICAL
**Effort:** S (3 hours)
**File:** `src/routes/telegram.routes.ts:160-167`

**Implementation:**
```typescript
const VALID_MARKETS = ['BTTS_YES', 'O25_OVER', 'O15_OVER', 'HT_O05_OVER'];
const MAX_PICKS = 5;

// Validation
if (picks.length > MAX_PICKS) {
  return reply.status(400).send({
    error: `Maximum ${MAX_PICKS} picks allowed`
  });
}

const marketTypes = new Set();
for (const pick of picks) {
  // Check valid market
  if (!VALID_MARKETS.includes(pick.market_type)) {
    return reply.status(400).send({
      error: `Invalid market type: ${pick.market_type}`
    });
  }

  // Check duplicate
  if (marketTypes.has(pick.market_type)) {
    return reply.status(400).send({
      error: `Duplicate pick: ${pick.market_type}`
    });
  }
  marketTypes.add(pick.market_type);

  // Check odds range
  if (pick.odds) {
    if (pick.odds < 1.01 || pick.odds > 100.00) {
      return reply.status(400).send({
        error: `Invalid odds: ${pick.odds} (must be 1.01 - 100.00)`
      });
    }
  }
}
```

**Testing:**
- Try publishing >5 picks
- Try duplicate market types
- Try invalid market type
- Try invalid odds

---

### N6. Add Settlement Max Retry Limit
**Priority:** 🔴 CRITICAL
**Effort:** S (2-3 hours)
**File:** `src/jobs/telegramSettlement.job.ts`

**Changes:**
```typescript
// Add retry tracking to telegram_posts
// Migration:
ALTER TABLE telegram_posts
ADD COLUMN settlement_retries INTEGER DEFAULT 0,
ADD COLUMN settlement_last_error TEXT;

// In settlement job:
const MAX_RETRIES = 5;

// Filter posts with retries < MAX_RETRIES
WHERE p.settlement_retries < $1

// On failure:
await client.query(
  `UPDATE telegram_posts
   SET settlement_retries = settlement_retries + 1,
       settlement_last_error = $1
   WHERE id = $2`,
  [err.message, post.id]
);

// Separate query to find stuck posts
const stuckPosts = await client.query(`
  SELECT * FROM telegram_posts
  WHERE settlement_retries >= $1
    AND settled_at IS NULL
`, [MAX_RETRIES]);

// Alert admin about stuck posts
if (stuckPosts.rows.length > 0) {
  logger.error(`[Settlement] ${stuckPosts.rows.length} posts stuck after ${MAX_RETRIES} retries`);
  // TODO: Send alert (email, Telegram, etc.)
}
```

**Testing:**
- Mock Telegram API failure
- Verify retry counter increments
- Verify post excluded after 5 retries

---

### N7. Add Basic Operational Monitoring
**Priority:** 🟡 HIGH
**Effort:** M (1 day)
**File:** NEW - `src/services/monitoring/metrics.service.ts`

**Implementation:**
```typescript
// Simple in-memory metrics (upgrade to Prometheus later)
class MetricsService {
  private metrics = {
    telegram_publishes_total: 0,
    telegram_publishes_failed: 0,
    settlement_runs_total: 0,
    settlement_posts_settled: 0,
    settlement_failures: 0,
  };

  increment(metric: string, value = 1) {
    this.metrics[metric] = (this.metrics[metric] || 0) + value;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

export const metricsService = new MetricsService();

// Add endpoint
fastify.get('/metrics', async () => {
  return {
    ...metricsService.getMetrics(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
});
```

**Instrument:**
- Publish success/failure
- Settlement runs
- Settlement success/failure
- API call duration

**Testing:**
- Publish a match
- Check `/metrics` endpoint
- Verify counters incremented

---

## 🟡 SOON (Month 1 - Required for Production)

### S1. Implement State Machine
**Priority:** 🟡 HIGH
**Effort:** L (2 days)

**States:**
- `draft` - Created but not published
- `pending_review` - Awaiting admin approval
- `approved` - Ready to publish
- `publishing` - In progress
- `published` - Successfully published
- `settled` - Picks settled
- `failed` - Publish failed
- `cancelled` - Manually cancelled

**Implementation:**
- Add `status` enum type to DB
- Add `published_at` timestamp
- Add state transition function with validation
- Add audit log of state changes

**Effort Breakdown:**
- DB migration: 1 hour
- State transition logic: 4 hours
- API endpoints: 3 hours
- Testing: 4 hours

---

### S2. Add Corners and Cards Settlement
**Priority:** 🟡 HIGH
**Effort:** M (4-6 hours)
**File:** `src/jobs/telegramSettlement.job.ts`

**New Markets:**
```typescript
case 'CORNERS_85_OVER':
  // Need corners data from TheSports
  const totalCorners = await getMatchCorners(post.match_id);
  won = totalCorners >= 9;
  break;

case 'CORNERS_95_OVER':
  won = totalCorners >= 10;
  break;

case 'CORNERS_105_OVER':
  won = totalCorners >= 11;
  break;

case 'CARDS_45_OVER':
  const totalCards = await getMatchCards(post.match_id);
  won = totalCards >= 5;
  break;

case 'CARDS_55_OVER':
  won = totalCards >= 6;
  break;
```

**Prereq:**
- Verify TheSports API provides corner/card data
- Add corners/cards to match statistics

---

### S3. Implement FootyStats Confidence Grading
**Priority:** 🟡 HIGH
**Effort:** L (1-2 days)
**File:** NEW - `src/services/footystats/confidence.service.ts`

**Grading Criteria:**
```typescript
interface LeagueConfidence {
  league_id: number;
  tier: 'A' | 'B' | 'C' | 'D';
  data_completeness: number; // 0-100%
  sample_size: number;
  historical_accuracy: number;
  last_updated: Date;
}

function calculateConfidence(league: FootyStatsLeague): LeagueConfidence {
  let tier: 'A' | 'B' | 'C' | 'D' = 'D';

  // Tier A: Top leagues (Premier League, La Liga, etc.)
  const TOP_LEAGUES = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1'];
  if (TOP_LEAGUES.includes(league.name)) {
    tier = 'A';
  }

  // Tier B: Second-tier leagues
  const SECOND_TIER = ['Championship', 'Eredivisie', 'Liga Portugal'];
  if (SECOND_TIER.includes(league.name)) {
    tier = 'B';
  }

  // Data completeness check
  const hasAllFields = checkDataCompleteness(league);
  const completeness = hasAllFields ? 100 : calculateCompleteness(league);

  // Adjust tier based on completeness
  if (completeness < 50) {
    tier = 'D'; // Force to lowest tier
  }

  return {
    league_id: league.id,
    tier,
    data_completeness: completeness,
    sample_size: league.season?.[0]?.total_matches || 0,
    historical_accuracy: 0, // TODO: Calculate from past predictions
    last_updated: new Date(),
  };
}
```

**Integration:**
- Add warning in UI for tier C/D leagues
- Block publishing for tier D leagues (configurable)
- Display confidence score in message

---

### S4. Add Timezone Handling
**Priority:** 🟡 HIGH
**Effort:** S (3-4 hours)
**File:** `src/services/telegram/turkish.formatter.ts`

**Implementation:**
```typescript
import { DateTime } from 'luxon';

// Explicitly convert to TSI (UTC+3)
const matchDateTime = DateTime.fromSeconds(date_unix, { zone: 'UTC' })
  .setZone('Europe/Istanbul'); // TSI = Europe/Istanbul

const timeStr = matchDateTime.toFormat('HH:mm');
const dateStr = matchDateTime.toFormat('dd.MM');

// Add timezone to message
message += `🕐 ${dateStr} ${timeStr} TSİ\n\n`;
```

**Testing:**
- Verify UTC conversion
- Test with different timezones
- Verify daylight saving time

---

### S5. Implement Manual Override Tools
**Priority:** 🟡 HIGH
**Effort:** M (1 day)
**Files:** NEW endpoints

**Endpoints:**
```typescript
// Manually settle a pick
POST /admin/telegram/picks/:pickId/settle
Body: { status: 'won' | 'lost' | 'void', reason: string }

// Manually void a pick
POST /admin/telegram/picks/:pickId/void
Body: { reason: string }

// Re-run settlement for match
POST /admin/telegram/posts/:postId/retry-settlement

// Cancel settlement (mark as settled without reply)
POST /admin/telegram/posts/:postId/cancel-settlement
Body: { reason: string }
```

**Auth:** Require admin + confirmation

---

### S6. Add Settlement Data Validation
**Priority:** 🟡 HIGH
**Effort:** S (3 hours)
**File:** `src/jobs/telegramSettlement.job.ts:84-86`

**Implementation:**
```typescript
// Validate scores
if (isNaN(homeScore) || isNaN(awayScore) ||
    homeScore < 0 || awayScore < 0 ||
    homeScore > 20 || awayScore > 20) {
  logger.error(`[Settlement] Invalid scores for post ${post.id}: ${homeScore}-${awayScore}`);

  // VOID all picks
  await client.query(`
    UPDATE telegram_picks
    SET status = 'void',
        settled_at = NOW(),
        result_data = $1
    WHERE post_id = $2
  `, [JSON.stringify({ reason: 'INVALID_SCORES' }), post.id]);

  // Mark post as settled (don't retry)
  await client.query(`
    UPDATE telegram_posts SET settled_at = NOW() WHERE id = $1
  `, [post.id]);

  continue; // Skip Telegram reply
}

// Similar validation for HT scores
if (pick.market_type.startsWith('HT_')) {
  if (isNaN(htHomeScore) || isNaN(htAwayScore) ||
      htHomeScore > homeScore || htAwayScore > awayScore) {
    // VOID HT picks
  }
}
```

---

### S7. Add Dead Letter Queue
**Priority:** 🟡 HIGH
**Effort:** M (1 day)
**File:** NEW - `telegram_failed_publishes` table

**Schema:**
```sql
CREATE TABLE telegram_failed_publishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id VARCHAR(50) NOT NULL,
  fs_match_id INTEGER,
  picks JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  failed_at TIMESTAMPTZ DEFAULT NOW(),
  last_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100)
);
```

**Usage:**
- On publish failure (after retries), insert into DLQ
- Admin UI to view DLQ
- Admin can manually retry or mark as resolved

---

### S8. Implement Rate Limit Queue
**Priority:** 🟡 HIGH
**Effort:** L (2 days)
**File:** NEW - `src/services/telegram/publish-queue.service.ts`

**Implementation:**
```typescript
// Use Bull queue for rate limiting
import Queue from 'bull';

const publishQueue = new Queue('telegram-publish', {
  redis: { host: 'localhost', port: 6379 }
});

// Rate limit: 30 messages/second
publishQueue.process(30, async (job) => {
  const { match_id, picks } = job.data;
  return await telegramBot.sendMessage(...);
});

// Add to queue instead of direct send
publishQueue.add({ match_id, picks }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});
```

**Requires:** Redis

---

## 📅 LATER (Month 2+ - Nice to Have)

### L1. Multi-language Support
**Priority:** 🟢 MEDIUM
**Effort:** XL (1 week)

**Implementation:**
- Extract all Turkish strings to i18n files
- Support EN, DE, TR
- Detect user language from Telegram API

---

### L2. Scheduled Publishing
**Priority:** 🟢 MEDIUM
**Effort:** M (1 day)

**Features:**
- Schedule publish for specific time
- Auto-publish at kickoff -1h
- Batch schedule for day/week

---

### L3. Batch Publish API
**Priority:** 🟢 MEDIUM
**Effort:** M (1 day)

**Endpoint:**
```typescript
POST /telegram/publish/batch
Body: {
  matches: [
    { match_id, fs_match_id, picks },
    { match_id, fs_match_id, picks },
  ]
}
```

**Returns:** Job ID for progress tracking

---

### L4. Advanced Metrics & Analytics
**Priority:** 🟢 MEDIUM
**Effort:** L (2-3 days)

**Features:**
- Win rate by market
- Win rate by league
- Win rate by odds range
- ROI calculation
- Confidence intervals

---

### L5. A/B Testing Framework
**Priority:** ⚪ LOW
**Effort:** L (2 days)

**Features:**
- Test different message formats
- Test different pick strategies
- Measure engagement (replies, reactions)

---

### L6. Webhook Integration
**Priority:** ⚪ LOW
**Effort:** M (1 day)

**Features:**
- Notify external services on publish
- Notify on settlement
- Custom webhooks per channel

---

### L7. Message Template Builder
**Priority:** ⚪ LOW
**Effort:** XL (1 week)

**Features:**
- Visual template editor
- Custom field selection
- Preview before publish

---

## EFFORT SUMMARY

### NOW (Week 1)
| Task | Effort | Priority |
|------|--------|----------|
| N1 - Idempotency | S (2h) | 🔴 |
| N2 - Retry Logic | M (6h) | 🔴 |
| N3 - Transactions | M (6h) | 🔴 |
| N4 - Match Validation | S (3h) | 🔴 |
| N5 - Pick Validation | S (3h) | 🔴 |
| N6 - Retry Limit | S (2h) | 🔴 |
| N7 - Monitoring | M (8h) | 🟡 |
| **Total** | **~30 hours (4-5 days)** | |

### SOON (Month 1)
| Task | Effort | Priority |
|------|--------|----------|
| S1 - State Machine | L (16h) | 🟡 |
| S2 - Corners/Cards | M (6h) | 🟡 |
| S3 - Confidence Grade | L (16h) | 🟡 |
| S4 - Timezone | S (4h) | 🟡 |
| S5 - Manual Override | M (8h) | 🟡 |
| S6 - Data Validation | S (3h) | 🟡 |
| S7 - Dead Letter Queue | M (8h) | 🟡 |
| S8 - Rate Limit Queue | L (16h) | 🟡 |
| **Total** | **~77 hours (~10 days)** | |

### LATER (Month 2+)
| Task | Effort | Priority |
|------|--------|----------|
| L1 - Multi-language | XL (40h) | 🟢 |
| L2 - Scheduling | M (8h) | 🟢 |
| L3 - Batch API | M (8h) | 🟢 |
| L4 - Analytics | L (20h) | 🟢 |
| **Total** | **~76 hours (~10 days)** | |

---

## RECOMMENDED EXECUTION ORDER

### Sprint 1 (Week 1) - Critical Fixes
1. N1 - Idempotency (prevent duplicates)
2. N4 - Match Validation (prevent invalid publishes)
3. N5 - Pick Validation (prevent bad data)
4. N2 - Retry Logic (handle Telegram failures)
5. N3 - Transactions (ensure data consistency)
6. N6 - Retry Limit (prevent infinite loops)
7. N7 - Monitoring (visibility)

**Outcome:** System is safe for limited production use

### Sprint 2 (Week 2-3) - Production Hardening
1. S1 - State Machine (proper workflow)
2. S6 - Data Validation (prevent bad settlements)
3. S5 - Manual Override (operational control)
4. S7 - Dead Letter Queue (failed publish recovery)

**Outcome:** System can handle errors gracefully

### Sprint 3 (Week 4) - Scale Preparation
1. S8 - Rate Limit Queue (handle bulk)
2. S2 - Corners/Cards (expand markets)
3. S3 - Confidence Grading (quality control)
4. S4 - Timezone (correctness)

**Outcome:** System ready for scale

---

## DEPENDENCIES

### External Libraries to Install
```bash
npm install axios-retry    # N2 - Retry logic
npm install opossum        # N2 - Circuit breaker
npm install luxon          # S4 - Timezone handling
npm install bull           # S8 - Queue (requires Redis)
npm install i18next        # L1 - Multi-language
```

### Infrastructure Requirements
- Redis (for S8 - Rate limit queue)
- Monitoring dashboard (for N7 - metrics display)
- Alert system (email/Telegram for critical failures)

---

## RISK MITIGATION

**If you ONLY do NOW tasks:**
- ✅ System won't create duplicates
- ✅ System won't crash on Telegram errors
- ✅ System won't publish invalid matches
- ❌ But no state management
- ❌ But no recovery tools
- ❌ But limited markets

**If you do NOW + SOON:**
- ✅ Full workflow management
- ✅ Error recovery
- ✅ Manual controls
- ✅ All major markets
- ✅ Can handle bulk publishes
- ✅ Production-ready

**If you do ALL:**
- ✅ Enterprise-grade system
- ✅ Multi-language
- ✅ Advanced analytics
- ✅ A/B testing
- ✅ Full automation

---

**END OF ACTIONABLE TODO**
