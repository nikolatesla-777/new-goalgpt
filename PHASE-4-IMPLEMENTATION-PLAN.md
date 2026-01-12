# 🤖 PHASE 4: BACKGROUND JOBS & AUTOMATION
# GOALGPT MOBILE APP - AUTOMATED PROCESSES

> **Status:** 📋 PLANNING - Ready for Implementation
> **Dependencies:** Phase 1 ✅ Phase 2 🟡 Phase 3 ✅
> **Start Date:** 2026-01-12
> **Estimated Duration:** 2 weeks
> **Critical:** 🟡 MEDIUM - Required for full feature automation

---

## 📊 EXECUTIVE SUMMARY

### Purpose
Implement automated background jobs and scheduled tasks to handle:
- Badge auto-unlock based on user activities
- Referral reward processing (Tier 2 & 3)
- Partner analytics daily rollup
- Push notification scheduling and delivery
- User engagement automation (streaks, rewards, reminders)
- Database maintenance and cleanup

### Why Phase 4 is Critical
Phase 3 built the gamification systems (Badges, Referrals, Partners, Comments, Daily Rewards) but many features require **automated processing**:
- ✅ Badge unlock conditions are checked manually via API calls
- ✅ Referral Tier 2/3 rewards require admin intervention
- ✅ Partner analytics need daily aggregation
- ✅ Scheduled notifications sit in database unprocessed
- ✅ No automated reminders for daily rewards or streaks
- ✅ No cleanup of expired data

**Phase 4 fixes this** by implementing **cron jobs** and **event-driven automation**.

---

## 🎯 OBJECTIVES

### Primary Goals
1. ✅ **Badge Auto-Unlock System** - Automatically check and unlock badges based on user activities
2. ✅ **Referral Automation** - Auto-process Tier 2 (first login) and Tier 3 (subscription purchase)
3. ✅ **Partner Analytics Rollup** - Daily aggregation of partner metrics
4. ✅ **Scheduled Notification Processor** - Send push notifications from queue
5. ✅ **Daily Reward Reminders** - Notify users who haven't claimed daily reward
6. ✅ **Streak Break Prevention** - Warn users before losing their login streak
7. ✅ **Subscription Expiry Alerts** - Notify VIP users 3 days before expiry
8. ✅ **Database Cleanup Jobs** - Remove expired tokens, old logs, inactive data

### Success Criteria
- All background jobs run reliably on schedule
- Badge unlocks happen within 5 minutes of conditions being met
- Referral rewards processed automatically without admin intervention
- Partner analytics updated daily at midnight
- Scheduled notifications sent on time with >95% delivery rate
- Zero missed daily reward reminders
- Database size optimized (cleanup reduces storage by 20%)

---

## 🗂️ BACKGROUND JOBS BREAKDOWN

### Job Schedule Overview

| Job Name | Schedule | Duration | Critical? | Dependencies |
|----------|----------|----------|-----------|--------------|
| Badge Auto-Unlock | Every 5 min | ~30s | 🔴 HIGH | Phase 3 Badges |
| Referral Tier 2 Processor | Every 1 min | ~10s | 🟡 MEDIUM | Phase 3 Referrals |
| Referral Tier 3 Processor | Every 1 min | ~10s | 🟡 MEDIUM | Phase 3 Referrals |
| Partner Analytics Rollup | Daily 00:05 | ~2 min | 🟢 LOW | Phase 3 Partners |
| Scheduled Notifications | Every 1 min | ~20s | 🔴 HIGH | Phase 1 Tables |
| Daily Reward Reminders | Daily 20:00 | ~1 min | 🟡 MEDIUM | Phase 3 Daily Rewards |
| Streak Break Warnings | Daily 22:00 | ~1 min | 🟡 MEDIUM | Phase 2 XP |
| Subscription Expiry Alerts | Daily 10:00 | ~30s | 🟡 MEDIUM | Existing Subs |
| Dead Token Cleanup | Weekly Sun 03:00 | ~1 min | 🟢 LOW | Existing Tokens |
| Old Logs Cleanup | Monthly 1st 04:00 | ~5 min | 🟢 LOW | Transaction Tables |

---

## 📋 DETAILED JOB SPECIFICATIONS

### 1. Badge Auto-Unlock Job ⭐
**Schedule:** Every 5 minutes (cron: `*/5 * * * *`)
**Purpose:** Check user activities and auto-unlock badges when conditions are met
**Priority:** 🔴 HIGH

#### Logic Flow
```typescript
1. Fetch all active badges with unlock conditions
2. For each badge category:
   - Referrals: Check referral_count from referrals table
   - Predictions: Check correct predictions from ts_prediction_mapped
   - Comments: Check comment_count from match_comments
   - Streaks: Check current_streak_days from customer_xp
   - XP: Check xp_points from customer_xp
3. Find users who meet conditions but don't have badge yet
4. For each qualifying user:
   - Insert into customer_badges
   - Grant XP reward (via grantXP service)
   - Grant credit reward (via grantCredits service)
   - Send push notification: "Yeni rozet kazandın! 🎖️"
5. Log results and errors
```

#### Example Badge Conditions
```typescript
// Referral badges
{ type: 'referrals', count: 1 }   // İlk Arkadaş (First Friend)
{ type: 'referrals', count: 5 }   // Sosyal Kelebek (Social Butterfly)
{ type: 'referrals', count: 10 }  // İletişim Gurusu (Network Guru)

// Prediction badges
{ type: 'predictions', correct_count: 10 }  // Tahmin Ustası
{ type: 'predictions', correct_count: 50 }  // Kahin
{ type: 'predictions', accuracy: 70, min_count: 20 } // %70 Doğruluk

// Comment badges
{ type: 'comments', count: 10 }  // Yorumcu (Commenter)
{ type: 'comments', like_count: 50 } // Popüler Yorum (Popular)

// Streak badges
{ type: 'login_streak', days: 7 }   // 7 Gün Streak
{ type: 'login_streak', days: 30 }  // 30 Gün Streak
{ type: 'login_streak', days: 100 } // 100 Gün Streak

// XP badges
{ type: 'xp_level', level: 'silver' }   // Gümüş Seviye
{ type: 'xp_level', level: 'gold' }     // Altın Seviye
{ type: 'xp_level', level: 'diamond' }  // Elmas Seviye
```

#### Implementation Files
- `src/jobs/badgeAutoUnlock.job.ts` - Main job logic
- `src/services/badges.service.ts` - Add `checkAndUnlockBadges()` function (already exists, enhance it)

---

### 2. Referral Tier 2 Processor ⭐
**Schedule:** Every 1 minute (cron: `* * * * *`)
**Purpose:** Auto-process Tier 2 rewards when referred user logs in for first time
**Priority:** 🟡 MEDIUM

#### Logic Flow
```typescript
1. Find referrals with status='completed' (Tier 1 done) AND tier=1
2. For each referral:
   - Check if referred_user has logged in (check customer_oauth_identities.last_login_at)
   - If logged in recently (within last 2 minutes):
     - Update referral: tier=2, status='rewarded'
     - Grant 50 credits to referrer
     - Grant 10 credits to referred user
     - Send push to both users
3. Log processed referrals
```

#### Rewards
- **Referrer:** 50 credits
- **Referred:** 10 credits
- **Push Notification:**
  - Referrer: "Arkadaşın giriş yaptı! 50 kredi kazandın 💰"
  - Referred: "Hoş geldin! 10 kredi hediyemiz 🎁"

#### Implementation Files
- `src/jobs/referralTier2.job.ts`

---

### 3. Referral Tier 3 Processor ⭐
**Schedule:** Every 1 minute (cron: `* * * * *`)
**Purpose:** Auto-process Tier 3 rewards when referred user subscribes to VIP
**Priority:** 🟡 MEDIUM

#### Logic Flow
```typescript
1. Find referrals with tier=2 AND status='rewarded'
2. For each referral:
   - Check if referred_user has active subscription
   - If subscribed:
     - Update referral: tier=3, referred_subscribed_at=NOW()
     - Grant 200 credits to referrer
     - Grant 500 XP to referrer
     - Update partner commission if subscription used partner code
     - Send push to referrer
3. Log processed referrals
```

#### Rewards
- **Referrer:** 200 credits + 500 XP
- **Push Notification:** "Arkadaşın VIP oldu! 200 kredi + 500 XP kazandın 🎉"

#### Implementation Files
- `src/jobs/referralTier3.job.ts`

---

### 4. Partner Analytics Rollup
**Schedule:** Daily at 00:05 (cron: `5 0 * * *`)
**Purpose:** Aggregate yesterday's partner performance metrics
**Priority:** 🟢 LOW

#### Logic Flow
```typescript
1. Get yesterday's date (UTC)
2. For each active partner:
   a. Count new signups (referrals created yesterday)
   b. Count new subscriptions (subscriptions created yesterday with partner_code)
   c. Calculate revenue (sum of subscription amounts)
   d. Calculate commission (revenue * partner.commission_rate / 100)
   e. Count active subscribers (current active subs with partner_code)
   f. Count churned users (subs expired yesterday)

   INSERT INTO partner_analytics (
     partner_id, date,
     new_signups, new_subscriptions,
     revenue, commission,
     active_subscribers, churn_count
   )
3. Update partner totals:
   - total_referrals += new_signups
   - total_subscriptions += new_subscriptions
   - total_revenue += revenue
   - total_commission += commission
4. Send daily report email to partners (optional)
```

#### Output Example
```sql
partner_analytics:
partner_id | date       | new_signups | new_subscriptions | revenue | commission | active_subscribers | churn_count
uuid-123   | 2026-01-11 | 12          | 3                 | 150.00  | 30.00      | 45                 | 1
```

#### Implementation Files
- `src/jobs/partnerAnalytics.job.ts`

---

### 5. Scheduled Notification Processor ⭐
**Schedule:** Every 1 minute (cron: `* * * * *`)
**Purpose:** Send scheduled push notifications from queue
**Priority:** 🔴 HIGH

#### Logic Flow
```typescript
1. Find notifications with status='pending' AND scheduled_at <= NOW()
2. For each notification:
   a. Update status='sending'
   b. Determine recipient list based on target_audience:
      - 'all': All active users
      - 'vip': Users with active subscriptions
      - 'free': Users without subscriptions
      - 'segment': Apply segment_filter (JSONB query)
   c. Fetch FCM tokens for recipients
   d. Send batch notifications via Firebase Admin SDK
   e. Track success/failure counts
   f. Update notification:
      - status='sent'
      - sent_at=NOW()
      - recipient_count=X
      - success_count=Y
      - failure_count=Z
3. Handle errors gracefully (retry failed sends)
```

#### Target Audience Filters
```typescript
// All users
{ target_audience: 'all' }

// VIP only
{ target_audience: 'vip' }

// Free users only
{ target_audience: 'free' }

// Custom segment (example: users with XP level >= gold)
{
  target_audience: 'segment',
  segment_filter: {
    xp_level: ['gold', 'platinum', 'diamond', 'vip_elite']
  }
}

// Custom segment (example: users with login streak >= 7)
{
  target_audience: 'segment',
  segment_filter: {
    current_streak_days: { gte: 7 }
  }
}
```

#### Implementation Files
- `src/jobs/scheduledNotifications.job.ts`
- `src/services/push.service.ts` - FCM sending logic (create new)

---

### 6. Daily Reward Reminders
**Schedule:** Daily at 20:00 (cron: `0 20 * * *`)
**Purpose:** Remind users who haven't claimed today's daily reward
**Priority:** 🟡 MEDIUM

#### Logic Flow
```typescript
1. Get today's date (midnight UTC)
2. Find users who:
   - Have NOT claimed daily reward today (no record in customer_daily_rewards for today)
   - Have claimed in the last 7 days (active users)
   - Have FCM tokens
3. For each user:
   - Determine their current day number
   - Get reward for that day
   - Send push: "Günlük ödülünü almayı unutma! Bugün {reward.credits} kredi seni bekliyor 🎁"
4. Log reminder count
```

#### Push Notification Template
```typescript
{
  title: "Günlük Ödül",
  body: "Günlük ödülünü almayı unutma! Bugün {credits} kredi seni bekliyor 🎁",
  data: {
    type: "daily_reward",
    day: 3,
    credits: 20,
    xp: 20
  },
  deepLink: "goalgpt://daily-rewards"
}
```

#### Implementation Files
- `src/jobs/dailyRewardReminders.job.ts`

---

### 7. Streak Break Warning
**Schedule:** Daily at 22:00 (cron: `0 22 * * *`)
**Purpose:** Warn users who haven't logged in today (about to break streak)
**Priority:** 🟡 MEDIUM

#### Logic Flow
```typescript
1. Get today's date
2. Find users who:
   - Have current_streak_days >= 3 (invested users)
   - last_activity_date < today (haven't logged in today)
   - Have FCM tokens
3. For each user:
   - Send push: "{current_streak} günlük serini kaybetme! Hemen giriş yap 🔥"
4. Log warning count
```

#### Push Notification Template
```typescript
{
  title: "Streak Uyarısı 🔥",
  body: "{currentStreak} günlük serini kaybetme! Gece yarısına 2 saat kaldı ⏰",
  data: {
    type: "streak_warning",
    currentStreak: 15
  },
  deepLink: "goalgpt://home"
}
```

#### Implementation Files
- `src/jobs/streakBreakWarnings.job.ts`

---

### 8. Subscription Expiry Alerts
**Schedule:** Daily at 10:00 (cron: `0 10 * * *`)
**Purpose:** Notify VIP users 3 days before subscription expires
**Priority:** 🟡 MEDIUM

#### Logic Flow
```typescript
1. Get date 3 days from now
2. Find subscriptions:
   - status='active'
   - expired_at between NOW() and NOW()+3 days
   - User has FCM token
3. For each expiring subscription:
   - Calculate days remaining
   - Send push: "VIP üyeliğin {days} gün sonra sona eriyor. Yenilemeyi unutma! 👑"
4. Log alert count
```

#### Push Notification Template
```typescript
{
  title: "VIP Üyelik Uyarısı 👑",
  body: "VIP üyeliğin {daysRemaining} gün sonra sona eriyor. Yenilemeyi unutma!",
  data: {
    type: "subscription_expiry",
    daysRemaining: 3,
    expiredAt: "2026-01-15T23:59:59Z"
  },
  deepLink: "goalgpt://paywall"
}
```

#### Implementation Files
- `src/jobs/subscriptionExpiryAlerts.job.ts`

---

### 9. Dead Token Cleanup
**Schedule:** Weekly Sunday at 03:00 (cron: `0 3 * * 0`)
**Purpose:** Remove expired/invalid FCM tokens from database
**Priority:** 🟢 LOW

#### Logic Flow
```typescript
1. Find FCM tokens that:
   - Haven't been used in 90 days (updated_at < NOW() - 90 days)
   - OR marked as invalid by FCM (after send failures)
2. Delete tokens
3. Log cleanup count
4. Update database vacuum (optimize storage)
```

#### Implementation Files
- `src/jobs/deadTokenCleanup.job.ts`

---

### 10. Old Logs Cleanup
**Schedule:** Monthly on 1st at 04:00 (cron: `0 4 1 * *`)
**Purpose:** Archive/delete old transaction logs to optimize database
**Priority:** 🟢 LOW

#### Logic Flow
```typescript
1. Archive logs older than 1 year:
   - customer_xp_transactions (keep 1 year)
   - customer_credit_transactions (keep 1 year)
   - customer_ad_views (keep 6 months)
   - match_comment_likes (keep 1 year)
2. Delete logs older than retention period:
   - Move to archive table or external storage (S3/GCS)
   - Delete from main tables
3. Vacuum database
4. Log cleanup stats (rows archived, storage saved)
```

#### Retention Policy
```typescript
const RETENTION_POLICY = {
  customer_xp_transactions: 365,      // 1 year
  customer_credit_transactions: 365,  // 1 year
  customer_ad_views: 180,             // 6 months
  match_comment_likes: 365,           // 1 year
  scheduled_notifications: 90,        // 3 months
};
```

#### Implementation Files
- `src/jobs/oldLogsCleanup.job.ts`

---

## 🛠️ TECHNICAL IMPLEMENTATION

### Job Scheduler: node-cron
We'll use `node-cron` for reliable job scheduling:

```bash
npm install node-cron @types/node-cron
```

### Job Manager Pattern
Create a centralized job manager:

**File:** `src/jobs/jobManager.ts`
```typescript
import cron from 'node-cron';
import { logger } from '../utils/logger';

interface JobDefinition {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

const jobs: JobDefinition[] = [
  {
    name: 'Badge Auto-Unlock',
    schedule: '*/5 * * * *',  // Every 5 minutes
    handler: async () => {
      const { runBadgeAutoUnlock } = await import('./badgeAutoUnlock.job');
      await runBadgeAutoUnlock();
    },
    enabled: true,
  },
  {
    name: 'Referral Tier 2 Processor',
    schedule: '* * * * *',  // Every minute
    handler: async () => {
      const { runReferralTier2 } = await import('./referralTier2.job');
      await runReferralTier2();
    },
    enabled: true,
  },
  {
    name: 'Referral Tier 3 Processor',
    schedule: '* * * * *',  // Every minute
    handler: async () => {
      const { runReferralTier3 } = await import('./referralTier3.job');
      await runReferralTier3();
    },
    enabled: true,
  },
  {
    name: 'Partner Analytics Rollup',
    schedule: '5 0 * * *',  // Daily at 00:05
    handler: async () => {
      const { runPartnerAnalytics } = await import('./partnerAnalytics.job');
      await runPartnerAnalytics();
    },
    enabled: true,
  },
  {
    name: 'Scheduled Notifications',
    schedule: '* * * * *',  // Every minute
    handler: async () => {
      const { runScheduledNotifications } = await import('./scheduledNotifications.job');
      await runScheduledNotifications();
    },
    enabled: true,
  },
  {
    name: 'Daily Reward Reminders',
    schedule: '0 20 * * *',  // Daily at 20:00
    handler: async () => {
      const { runDailyRewardReminders } = await import('./dailyRewardReminders.job');
      await runDailyRewardReminders();
    },
    enabled: true,
  },
  {
    name: 'Streak Break Warnings',
    schedule: '0 22 * * *',  // Daily at 22:00
    handler: async () => {
      const { runStreakBreakWarnings } = await import('./streakBreakWarnings.job');
      await runStreakBreakWarnings();
    },
    enabled: true,
  },
  {
    name: 'Subscription Expiry Alerts',
    schedule: '0 10 * * *',  // Daily at 10:00
    handler: async () => {
      const { runSubscriptionExpiryAlerts } = await import('./subscriptionExpiryAlerts.job');
      await runSubscriptionExpiryAlerts();
    },
    enabled: true,
  },
  {
    name: 'Dead Token Cleanup',
    schedule: '0 3 * * 0',  // Weekly Sunday at 03:00
    handler: async () => {
      const { runDeadTokenCleanup } = await import('./deadTokenCleanup.job');
      await runDeadTokenCleanup();
    },
    enabled: true,
  },
  {
    name: 'Old Logs Cleanup',
    schedule: '0 4 1 * *',  // Monthly 1st at 04:00
    handler: async () => {
      const { runOldLogsCleanup } = await import('./oldLogsCleanup.job');
      await runOldLogsCleanup();
    },
    enabled: true,
  },
];

export function initializeJobs() {
  logger.info('🤖 Initializing background jobs...');

  jobs.forEach((job) => {
    if (!job.enabled) {
      logger.info(`⏸️  Job disabled: ${job.name}`);
      return;
    }

    cron.schedule(job.schedule, async () => {
      const startTime = Date.now();
      logger.info(`🔄 Job started: ${job.name}`);

      try {
        await job.handler();
        const duration = Date.now() - startTime;
        logger.info(`✅ Job completed: ${job.name} (${duration}ms)`);
      } catch (error: any) {
        logger.error(`❌ Job failed: ${job.name}`, {
          error: error.message,
          stack: error.stack,
        });
      }
    });

    logger.info(`✅ Job scheduled: ${job.name} (${job.schedule})`);
  });

  logger.info(`🤖 ${jobs.filter(j => j.enabled).length} background jobs initialized`);
}
```

### Job Template
Each job file follows this pattern:

**File:** `src/jobs/exampleJob.job.ts`
```typescript
import { db } from '../database/kysely';
import { logger } from '../utils/logger';

export async function runExampleJob() {
  const startTime = Date.now();
  let processedCount = 0;

  try {
    // 1. Fetch data to process
    const items = await db
      .selectFrom('table_name')
      .where(/* conditions */)
      .execute();

    // 2. Process each item
    for (const item of items) {
      try {
        // Do work
        processedCount++;
      } catch (itemError: any) {
        logger.error(`Error processing item ${item.id}:`, itemError);
        // Continue with next item
      }
    }

    // 3. Log success
    const duration = Date.now() - startTime;
    logger.info(`Job completed: Processed ${processedCount} items in ${duration}ms`);
  } catch (error: any) {
    logger.error('Job failed:', error);
    throw error;
  }
}
```

### Integration in server.ts
```typescript
import { initializeJobs } from './jobs/jobManager';

// After server start
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  fastify.log.info(`🚀 Server listening at ${address}`);

  // Initialize background jobs
  initializeJobs();
});
```

---

## 📦 PUSH NOTIFICATION SERVICE

### FCM Integration
Create a unified push notification service:

**File:** `src/services/push.service.ts`
```typescript
import admin from 'firebase-admin';
import { db } from '../database/kysely';
import { logger } from '../utils/logger';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  deepLink?: string;
}

export async function sendPushToUser(
  userId: string,
  notification: PushNotification
): Promise<{ success: boolean; tokensUsed: number }> {
  // Get user's FCM tokens
  const tokens = await db
    .selectFrom('customer_push_tokens')
    .select('fcm_token')
    .where('customer_user_id', '=', userId)
    .where('is_active', '=', true)
    .execute();

  if (tokens.length === 0) {
    logger.warn(`No FCM tokens for user ${userId}`);
    return { success: false, tokensUsed: 0 };
  }

  const tokenStrings = tokens.map(t => t.fcm_token);

  try {
    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        ...notification.data,
        deepLink: notification.deepLink || '',
      },
      tokens: tokenStrings,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Handle failures (mark invalid tokens)
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokenStrings[idx]);
        }
      });

      // Mark failed tokens as inactive
      if (failedTokens.length > 0) {
        await db
          .updateTable('customer_push_tokens')
          .set({ is_active: false })
          .where('fcm_token', 'in', failedTokens)
          .execute();
      }
    }

    logger.info(`Push sent to user ${userId}: ${response.successCount}/${tokenStrings.length} delivered`);

    return {
      success: response.successCount > 0,
      tokensUsed: tokenStrings.length,
    };
  } catch (error: any) {
    logger.error('FCM send error:', error);
    return { success: false, tokensUsed: 0 };
  }
}

export async function sendPushToMultipleUsers(
  userIds: string[],
  notification: PushNotification
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  // Process in batches of 100 (FCM limit: 500 tokens per request)
  const BATCH_SIZE = 100;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(userId => sendPushToUser(userId, notification))
    );

    totalSent += results.filter(r => r.success).length;
    totalFailed += results.filter(r => !r.success).length;
  }

  return { totalSent, totalFailed };
}
```

---

## 📊 MONITORING & LOGGING

### Job Execution Logs
Store job execution history:

**Table:** `job_execution_logs`
```sql
CREATE TABLE IF NOT EXISTS job_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    items_processed INT DEFAULT 0,
    error_message TEXT,
    duration_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_logs_name ON job_execution_logs(job_name, started_at DESC);
CREATE INDEX idx_job_logs_status ON job_execution_logs(status, started_at DESC);
```

### Enhanced Job Template with Logging
```typescript
import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';

export async function runExampleJob() {
  const jobName = 'Example Job';
  const startTime = Date.now();
  let processedCount = 0;
  let logId: string | null = null;

  try {
    // Log job start
    const logResult = await db
      .insertInto('job_execution_logs')
      .values({
        job_name: jobName,
        started_at: sql`NOW()`,
        status: 'running',
      })
      .returning('id')
      .executeTakeFirst();

    logId = logResult?.id || null;

    // Do work...
    processedCount = 42;

    // Log job success
    const duration = Date.now() - startTime;
    if (logId) {
      await db
        .updateTable('job_execution_logs')
        .set({
          completed_at: sql`NOW()`,
          status: 'success',
          items_processed: processedCount,
          duration_ms: duration,
        })
        .where('id', '=', logId)
        .execute();
    }

    logger.info(`${jobName}: Processed ${processedCount} items in ${duration}ms`);
  } catch (error: any) {
    // Log job failure
    if (logId) {
      await db
        .updateTable('job_execution_logs')
        .set({
          completed_at: sql`NOW()`,
          status: 'failed',
          items_processed: processedCount,
          error_message: error.message,
          duration_ms: Date.now() - startTime,
        })
        .where('id', '=', logId)
        .execute();
    }

    logger.error(`${jobName} failed:`, error);
    throw error;
  }
}
```

---

## 🚀 IMPLEMENTATION CHECKLIST

### Setup Tasks
- [ ] Install dependencies: `npm install node-cron @types/node-cron`
- [ ] Create `src/jobs/` directory
- [ ] Create `job_execution_logs` table in database
- [ ] Create `src/services/push.service.ts` for FCM integration

### Job Implementation (Priority Order)
1. [ ] **Badge Auto-Unlock** (`src/jobs/badgeAutoUnlock.job.ts`) - 🔴 HIGH
2. [ ] **Scheduled Notifications** (`src/jobs/scheduledNotifications.job.ts`) - 🔴 HIGH
3. [ ] **Referral Tier 2** (`src/jobs/referralTier2.job.ts`) - 🟡 MEDIUM
4. [ ] **Referral Tier 3** (`src/jobs/referralTier3.job.ts`) - 🟡 MEDIUM
5. [ ] **Daily Reward Reminders** (`src/jobs/dailyRewardReminders.job.ts`) - 🟡 MEDIUM
6. [ ] **Streak Break Warnings** (`src/jobs/streakBreakWarnings.job.ts`) - 🟡 MEDIUM
7. [ ] **Subscription Expiry Alerts** (`src/jobs/subscriptionExpiryAlerts.job.ts`) - 🟡 MEDIUM
8. [ ] **Partner Analytics Rollup** (`src/jobs/partnerAnalytics.job.ts`) - 🟢 LOW
9. [ ] **Dead Token Cleanup** (`src/jobs/deadTokenCleanup.job.ts`) - 🟢 LOW
10. [ ] **Old Logs Cleanup** (`src/jobs/oldLogsCleanup.job.ts`) - 🟢 LOW

### Integration Tasks
- [ ] Create `src/jobs/jobManager.ts` with job scheduler
- [ ] Integrate jobManager in `src/server.ts`
- [ ] Add job enable/disable environment variables
- [ ] Create admin API endpoints to view job logs
- [ ] Add monitoring dashboard for job execution

### Testing Tasks
- [ ] Test each job independently
- [ ] Verify job scheduling works correctly
- [ ] Test error handling and retry logic
- [ ] Verify push notifications are sent
- [ ] Load test high-frequency jobs (every minute)
- [ ] Monitor database performance impact

### Deployment Tasks
- [ ] Deploy to staging environment
- [ ] Monitor job execution for 48 hours
- [ ] Fix any bugs or performance issues
- [ ] Deploy to production
- [ ] Monitor production jobs for 1 week
- [ ] Document any issues and resolutions

---

## 📈 SUCCESS METRICS

### Key Performance Indicators (KPIs)

| Metric | Target | Critical? |
|--------|--------|-----------|
| Badge unlock latency | < 5 minutes | 🔴 YES |
| Referral processing time | < 2 minutes | 🟡 MEDIUM |
| Notification delivery rate | > 95% | 🔴 YES |
| Job failure rate | < 1% | 🔴 YES |
| Database query time | < 500ms avg | 🟡 MEDIUM |
| Dead token cleanup | 20% storage saved | 🟢 LOW |

### Monitoring Alerts
Set up alerts for:
- Job failures (send email/Slack notification)
- Job duration exceeds 2x normal time
- Notification delivery rate drops below 90%
- Database query time exceeds 1 second
- Job execution logs show repeated errors

---

## 🎯 PHASE 4 TIMELINE

### Week 1: Core Jobs (High Priority)
- **Day 1-2:** Setup (dependencies, folder structure, jobManager, push service)
- **Day 3-4:** Badge Auto-Unlock Job
- **Day 5:** Scheduled Notifications Processor
- **Day 6-7:** Referral Tier 2 & 3 Processors

### Week 2: Engagement & Cleanup (Medium/Low Priority)
- **Day 8-9:** Daily Reward Reminders + Streak Warnings
- **Day 10:** Subscription Expiry Alerts
- **Day 11:** Partner Analytics Rollup
- **Day 12:** Dead Token Cleanup + Old Logs Cleanup
- **Day 13-14:** Testing, bug fixes, deployment

**Total Duration:** 2 weeks (14 days)

---

## 🔗 DEPENDENCIES

### External Services
- **Firebase Cloud Messaging (FCM)** - Push notifications
- **node-cron** - Job scheduling
- **PostgreSQL** - Database with transaction support

### Phase Dependencies
- ✅ **Phase 1 Complete** - Database tables (customer_push_tokens, scheduled_notifications)
- ✅ **Phase 2 Complete** - XP and Credits services (for rewards)
- ✅ **Phase 3 Complete** - Gamification systems (Badges, Referrals, Partners, Comments, Daily Rewards)

---

## 📝 NOTES

### Performance Considerations
- **High-frequency jobs** (every minute) must complete in < 30 seconds to avoid overlap
- **Badge auto-unlock** checks all badges against all users - optimize with smart queries
- **Notification sending** in batches of 100 users to avoid FCM rate limits
- **Database indexes** critical for job performance (already created in Phase 1)

### Scalability
- All jobs designed to handle 50,000+ users
- Batch processing for large datasets
- Graceful error handling (one user failure doesn't stop entire job)
- Job logs for debugging and performance monitoring

### Future Enhancements (Post-Phase 4)
- Job retry mechanism with exponential backoff
- Job queue system (BullMQ/Redis) for better reliability
- Real-time job monitoring dashboard (admin panel)
- A/B testing for notification timing
- Predictive analytics for optimal notification times per user

---

**Last Updated:** 2026-01-12
**Status:** 📋 Ready for Implementation
**Next Phase:** Phase 5 - Mobile App Project Setup
