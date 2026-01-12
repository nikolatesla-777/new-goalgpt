# Phase 3 Implementation Plan: Advanced Gamification

> **Backend API - Badges, Referrals, Partners, Match Comments, Daily Rewards**
> **Estimated Duration:** 3-4 weeks
> **Target:** Complete gamification ecosystem
> **Dependencies:** Phase 1 (✅ Complete), Phase 2 (✅ Complete)

---

## 📊 PHASE 3 OVERVIEW

### Objectives
Implement advanced gamification features that drive user engagement, retention, and viral growth:

1. **Badges System** - Achievement-based rewards
2. **Referrals System** - Viral growth mechanism
3. **Partners System** - Bayi/affiliate program
4. **Match Comments** - Social engagement
5. **Daily Rewards** - Daily gift wheel

### Success Metrics
- User retention: +15% (badges unlock)
- Referral signups: 5,000+ in first month
- Partner signups: 100+ bayis
- Match comments: 10,000+ per week
- Daily active users: +20% (daily rewards)

### Key Features
- 50+ badge definitions across 4 rarities
- 3-tier referral reward system
- Partner dashboard with analytics
- Match forum with likes and moderation
- 7-day rotating daily gift wheel

---

## 🏗️ ARCHITECTURE OVERVIEW

### Database Tables (Already Created in Phase 1)
- `badges` - Badge definitions
- `customer_badges` - User badge unlocks
- `referrals` - Referral tracking
- `partners` - Partner/Bayi accounts
- `partner_analytics` - Daily partner stats
- `match_comments` - Match forum comments
- `match_comment_likes` - Comment likes
- `customer_daily_rewards` - Daily gift claims

### Services to Build
1. `badges.service.ts` - Badge unlock logic
2. `referrals.service.ts` - Referral tracking and rewards
3. `partners.service.ts` - Partner management and commissions
4. `comments.service.ts` - Match comments and moderation
5. `dailyRewards.service.ts` - Daily gift wheel

### API Routes to Build
1. `/api/badges` - Badge endpoints (7 endpoints)
2. `/api/referrals` - Referral endpoints (5 endpoints)
3. `/api/partners` - Partner endpoints (8 endpoints)
4. `/api/comments` - Comment endpoints (6 endpoints)
5. `/api/daily-rewards` - Daily reward endpoints (3 endpoints)

**Total: 29 new API endpoints**

---

## 🎯 IMPLEMENTATION PLAN

## Feature 1: Badges System

### Overview
Achievement-based rewards system with 50+ unique badges across 4 rarity tiers:
- **Common** (5 XP, 5 credits reward)
- **Rare** (25 XP, 25 credits reward)
- **Epic** (50 XP, 50 credits reward)
- **Legendary** (100 XP, 100 credits reward)

### Badge Categories
1. **Achievement Badges** - Specific actions (first referral, 10 correct predictions)
2. **Milestone Badges** - Cumulative progress (100 matches watched, level 10 reached)
3. **Special Badges** - Limited time or exclusive (beta tester, founding member)
4. **Seasonal Badges** - Event-based (World Cup, Champions League final)

### Database Schema (Already Created)
```sql
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    name_tr VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    description_tr TEXT,
    description_en TEXT,
    icon_url TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- achievement, milestone, special, seasonal
    rarity VARCHAR(20) NOT NULL, -- common, rare, epic, legendary
    unlock_condition JSONB NOT NULL,
    reward_xp INT DEFAULT 0,
    reward_credits INT DEFAULT 0,
    reward_vip_days INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    total_unlocks INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE customer_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_user_id UUID NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    is_displayed BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    UNIQUE(customer_user_id, badge_id)
);
```

### Service: `badges.service.ts`

**Functions to Implement:**

```typescript
// Badge management
export async function getBadges(filters?: { category?: string; rarity?: string; isActive?: boolean })
export async function getBadgeById(badgeId: string)
export async function createBadge(data: CreateBadgeInput)
export async function updateBadge(badgeId: string, data: UpdateBadgeInput)
export async function deleteBadge(badgeId: string)

// User badge operations
export async function getUserBadges(userId: string)
export async function checkAndUnlockBadges(userId: string, trigger: BadgeTrigger)
export async function unlockBadge(userId: string, badgeId: string)
export async function claimBadge(userId: string, badgeId: string)
export async function displayBadge(userId: string, badgeId: string, display: boolean)

// Badge progress tracking
export async function getBadgeProgress(userId: string, badgeId: string)
export async function getBadgeLeaderboard(badgeId: string, limit: number)

// Badge unlock conditions
export function evaluateBadgeCondition(condition: BadgeCondition, userStats: UserStats): boolean
```

**Badge Unlock Triggers:**
```typescript
export enum BadgeTrigger {
  REFERRAL_SIGNUP = 'referral_signup',
  REFERRAL_SUBSCRIPTION = 'referral_subscription',
  PREDICTION_CORRECT = 'prediction_correct',
  MATCH_COMMENT = 'match_comment',
  LOGIN_STREAK = 'login_streak',
  XP_LEVEL_UP = 'xp_level_up',
  CREDITS_SPENT = 'credits_spent',
  SUBSCRIPTION_PURCHASE = 'subscription_purchase',
}
```

**Badge Condition Examples:**
```typescript
// First referral badge
{
  "type": "referrals",
  "count": 1
}

// Prediction master badge
{
  "type": "predictions",
  "correct_count": 10,
  "min_accuracy": 70
}

// Login streak badge
{
  "type": "login_streak",
  "days": 7
}

// Level milestone badge
{
  "type": "xp_level",
  "level": "gold"
}
```

### API Routes: `/api/badges`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/badges` | Public | Get all active badges (with filters) |
| GET | `/api/badges/:id` | Public | Get badge details |
| POST | `/api/badges` | Admin | Create new badge |
| PUT | `/api/badges/:id` | Admin | Update badge |
| DELETE | `/api/badges/:id` | Admin | Delete badge |
| GET | `/api/badges/me` | Required | Get user's badges |
| POST | `/api/badges/:id/claim` | Required | Claim badge reward |

### Sample Badge Definitions (Seed Data)

```sql
-- Common Badges
INSERT INTO badges (slug, name_tr, name_en, description_tr, icon_url, category, rarity, unlock_condition, reward_xp, reward_credits) VALUES
('first_referral', 'İlk Arkadaş', 'First Friend', 'İlk arkadaşını davet et', '/badges/first_referral.png', 'milestone', 'common', '{"type": "referrals", "count": 1}', 50, 10),
('first_comment', 'İlk Yorum', 'First Comment', 'İlk maç yorumunu yap', '/badges/first_comment.png', 'milestone', 'common', '{"type": "match_comments", "count": 1}', 50, 10),
('streak_3', '3 Gün Streak', '3 Day Streak', '3 gün üst üste giriş yap', '/badges/streak_3.png', 'milestone', 'common', '{"type": "login_streak", "days": 3}', 50, 10);

-- Rare Badges
INSERT INTO badges (slug, name_tr, name_en, description_tr, icon_url, category, rarity, unlock_condition, reward_xp, reward_credits) VALUES
('prediction_master', 'Tahmin Ustası', 'Prediction Master', '10 doğru tahmin yap', '/badges/prediction_master.png', 'achievement', 'rare', '{"type": "predictions", "correct_count": 10}', 200, 50),
('silver_level', 'Gümüş Seviye', 'Silver Level', 'Silver seviyesine ulaş', '/badges/silver_level.png', 'milestone', 'rare', '{"type": "xp_level", "level": "silver"}', 200, 50);

-- Epic Badges
INSERT INTO badges (slug, name_tr, name_en, description_tr, icon_url, category, rarity, unlock_condition, reward_xp, reward_credits) VALUES
('referral_champion', 'Referans Şampiyonu', 'Referral Champion', '10 arkadaş davet et', '/badges/referral_champion.png', 'achievement', 'epic', '{"type": "referrals", "count": 10}', 500, 100),
('gold_level', 'Altın Seviye', 'Gold Level', 'Gold seviyesine ulaş', '/badges/gold_level.png', 'milestone', 'epic', '{"type": "xp_level", "level": "gold"}', 500, 100);

-- Legendary Badges
INSERT INTO badges (slug, name_tr, name_en, description_tr, icon_url, category, rarity, unlock_condition, reward_xp, reward_credits) VALUES
('founding_member', 'Kurucu Üye', 'Founding Member', 'İlk 1000 kullanıcıdan biri ol', '/badges/founding_member.png', 'special', 'legendary', '{"type": "special", "manual": true}', 1000, 500),
('vip_elite_level', 'VIP Elite', 'VIP Elite', 'VIP Elite seviyesine ulaş', '/badges/vip_elite_level.png', 'milestone', 'legendary', '{"type": "xp_level", "level": "vip_elite"}', 1000, 500);
```

### Implementation Tasks

- [ ] Create `src/services/badges.service.ts` (est. 400 lines)
- [ ] Create `src/routes/badges.routes.ts` (est. 200 lines)
- [ ] Create badge seed data SQL (50+ badges)
- [ ] Implement badge unlock checking logic
- [ ] Integrate badge triggers in XP/Credits/Referrals services
- [ ] Create badge admin panel endpoints
- [ ] Write unit tests for badge unlock logic

**Estimated Time:** 4-5 days

---

## Feature 2: Referrals System

### Overview
3-tier referral reward system to drive viral growth:
- **Tier 1 (Signup):** Referrer gets 50 XP + 10 credits
- **Tier 2 (First Login):** Referrer gets +50 credits
- **Tier 3 (Subscription):** Referrer gets +200 credits

### Referral Flow
1. User shares referral code (GOAL-XXXXX)
2. Friend signs up using code
3. Referrer instantly gets Tier 1 rewards
4. When friend logs in first time, Tier 2 rewards granted
5. When friend subscribes, Tier 3 rewards granted + badge unlock

### Database Schema (Already Created)
```sql
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_user_id UUID NOT NULL REFERENCES customer_users(id),
    referred_user_id UUID NOT NULL REFERENCES customer_users(id),
    referral_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, rewarded, expired
    tier INT DEFAULT 1, -- 1=signup, 2=login, 3=subscription
    referrer_reward_xp INT DEFAULT 0,
    referrer_reward_credits INT DEFAULT 0,
    referred_reward_xp INT DEFAULT 0,
    referred_reward_credits INT DEFAULT 0,
    referred_subscribed_at TIMESTAMPTZ,
    reward_claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    UNIQUE(referred_user_id),
    CHECK(referrer_user_id != referred_user_id)
);
```

### Service: `referrals.service.ts`

**Functions to Implement:**

```typescript
// Referral creation
export async function createReferral(referrerCode: string, referredUserId: string)

// Referral rewards
export async function processReferralSignup(referralCode: string, referredUserId: string)
export async function processReferralFirstLogin(referredUserId: string)
export async function processReferralSubscription(referredUserId: string)

// Referral tracking
export async function getUserReferrals(userId: string)
export async function getReferralStats(userId: string)
export async function getReferralLeaderboard(limit: number)

// Referral validation
export async function validateReferralCode(code: string)
export async function isReferralCodeAvailable(code: string)
export async function generateUniqueReferralCode(): Promise<string>
```

**Referral Reward Configuration:**
```typescript
export const REFERRAL_REWARDS = {
  tier1_signup: {
    referrer: { xp: 50, credits: 10 },
    referred: { xp: 25, credits: 5 }
  },
  tier2_first_login: {
    referrer: { xp: 0, credits: 50 },
    referred: { xp: 50, credits: 10 }
  },
  tier3_subscription: {
    referrer: { xp: 100, credits: 200 },
    referred: { xp: 0, credits: 0 }
  }
};
```

### API Routes: `/api/referrals`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/referrals/me` | Required | Get user's referrals |
| GET | `/api/referrals/stats` | Required | Get referral stats (total, active, earnings) |
| GET | `/api/referrals/leaderboard` | Public | Get top referrers |
| POST | `/api/referrals/validate` | Public | Validate referral code |
| GET | `/api/referrals/code/available` | Public | Check if code is available |

### Integration Points

**In Authentication Controllers:**
```typescript
// In googleAuth.controller.ts, appleAuth.controller.ts, phoneAuth.controller.ts
if (isNewUser && referralCode) {
  await processReferralSignup(referralCode, newUser.id);
}
```

**In Auth Routes:**
```typescript
// In /api/auth/me endpoint
if (isFirstLogin) {
  await processReferralFirstLogin(userId);
}
```

**In Subscription Service:**
```typescript
// When subscription is created
await processReferralSubscription(userId);
```

### Implementation Tasks

- [ ] Create `src/services/referrals.service.ts` (est. 350 lines)
- [ ] Create `src/routes/referrals.routes.ts` (est. 150 lines)
- [ ] Integrate referral signup in auth controllers
- [ ] Integrate first login detection in auth
- [ ] Integrate subscription trigger (future)
- [ ] Create referral leaderboard endpoint
- [ ] Write unit tests for 3-tier reward system

**Estimated Time:** 3-4 days

---

## Feature 3: Partners System (Bayi Program)

### Overview
Affiliate/reseller program where partners earn 20% commission on subscriptions:
- Partners get unique referral code
- Track signups and subscriptions from partner codes
- Calculate daily commissions
- Partner dashboard with analytics
- Admin approval workflow

### Database Schema (Already Created)
```sql
CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_user_id UUID NOT NULL UNIQUE REFERENCES customer_users(id),
    business_name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, suspended
    commission_rate DECIMAL(5,2) DEFAULT 20.00,
    referral_code VARCHAR(20) NOT NULL UNIQUE,
    total_referrals INT DEFAULT 0,
    total_subscriptions INT DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    total_commission DECIMAL(10,2) DEFAULT 0.00,
    last_payout_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES customer_users(id),
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE partner_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES partners(id),
    date DATE NOT NULL,
    new_signups INT DEFAULT 0,
    new_subscriptions INT DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0.00,
    commission DECIMAL(10,2) DEFAULT 0.00,
    active_subscribers INT DEFAULT 0,
    churn_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(partner_id, date)
);
```

### Service: `partners.service.ts`

**Functions to Implement:**

```typescript
// Partner registration
export async function registerPartner(data: PartnerRegistrationInput)
export async function approvePartner(partnerId: string, approverId: string)
export async function rejectPartner(partnerId: string, reason: string)
export async function suspendPartner(partnerId: string, reason: string)

// Partner profile
export async function getPartnerProfile(userId: string)
export async function updatePartnerProfile(partnerId: string, data: UpdatePartnerInput)

// Analytics
export async function getPartnerAnalytics(partnerId: string, startDate: Date, endDate: Date)
export async function calculateDailyAnalytics(partnerId: string, date: Date)
export async function getAllPartnersAnalytics(date: Date)

// Commission tracking
export async function trackPartnerSignup(referralCode: string, userId: string)
export async function trackPartnerSubscription(userId: string, amount: number)
export async function calculatePartnerCommission(partnerId: string, revenue: number)

// Admin functions
export async function getPendingPartners()
export async function getAllPartners(filters?: PartnerFilters)
export async function getPartnerLeaderboard(limit: number)
```

### API Routes: `/api/partners`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/partners/register` | Required | Register as partner/bayi |
| GET | `/api/partners/me` | Required + Partner | Get partner profile |
| PUT | `/api/partners/me` | Required + Partner | Update partner profile |
| GET | `/api/partners/analytics` | Required + Partner | Get partner analytics |
| GET | `/api/partners` | Admin | Get all partners |
| GET | `/api/partners/pending` | Admin | Get pending approvals |
| POST | `/api/partners/:id/approve` | Admin | Approve partner |
| POST | `/api/partners/:id/reject` | Admin | Reject partner |

### Partner Middleware

```typescript
export async function requirePartner(request, reply) {
  await requireAuth(request, reply);

  const partner = await db
    .selectFrom('partners')
    .where('customer_user_id', '=', request.user!.userId)
    .where('status', '=', 'approved')
    .executeTakeFirst();

  if (!partner) {
    return reply.status(403).send({ error: 'PARTNER_REQUIRED' });
  }

  request.partner = partner;
}
```

### Implementation Tasks

- [ ] Create `src/services/partners.service.ts` (est. 450 lines)
- [ ] Create `src/routes/partners.routes.ts` (est. 250 lines)
- [ ] Create `src/middleware/partner.middleware.ts` (est. 50 lines)
- [ ] Implement daily analytics calculation cron job
- [ ] Create partner registration form validation
- [ ] Create partner admin approval endpoints
- [ ] Integrate partner tracking in subscription service
- [ ] Write unit tests for commission calculation

**Estimated Time:** 5-6 days

---

## Feature 4: Match Comments System

### Overview
Social match forum where users can:
- Comment on matches (before, during, after)
- Reply to comments (nested threads)
- Like comments
- Report inappropriate comments
- Moderator tools (pin, hide, delete)

### Database Schema (Already Created)
```sql
CREATE TABLE match_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id INT NOT NULL,
    customer_user_id UUID NOT NULL REFERENCES customer_users(id),
    parent_comment_id UUID REFERENCES match_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (LENGTH(content) >= 3 AND LENGTH(content) <= 1000),
    like_count INT DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_reported BOOLEAN DEFAULT FALSE,
    report_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- active, hidden, deleted, flagged
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE match_comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES match_comments(id) ON DELETE CASCADE,
    customer_user_id UUID NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, customer_user_id)
);
```

### Service: `comments.service.ts`

**Functions to Implement:**

```typescript
// Comment CRUD
export async function createComment(userId: string, matchId: number, content: string, parentId?: string)
export async function getMatchComments(matchId: number, options?: CommentQueryOptions)
export async function updateComment(commentId: string, userId: string, content: string)
export async function deleteComment(commentId: string, userId: string)

// Comment interactions
export async function likeComment(commentId: string, userId: string)
export async function unlikeComment(commentId: string, userId: string)
export async function reportComment(commentId: string, userId: string, reason: string)

// Comment moderation (admin)
export async function pinComment(commentId: string, adminId: string)
export async function unpinComment(commentId: string, adminId: string)
export async function hideComment(commentId: string, adminId: string, reason: string)
export async function getFlaggedComments()

// User comments
export async function getUserComments(userId: string)
export async function getUserCommentStats(userId: string)
```

**Comment Moderation Rules:**
- 3 reports → automatically flagged for review
- Max 1000 characters per comment
- Rate limit: 10 comments per hour per user
- XP reward: 5 XP per comment (max 50 XP/day)

### API Routes: `/api/comments`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/comments/match/:matchId` | Public | Get match comments |
| POST | `/api/comments` | Required | Create comment |
| PUT | `/api/comments/:id` | Required | Update own comment |
| DELETE | `/api/comments/:id` | Required | Delete own comment |
| POST | `/api/comments/:id/like` | Required | Like comment |
| DELETE | `/api/comments/:id/like` | Required | Unlike comment |
| POST | `/api/comments/:id/report` | Required | Report comment |
| GET | `/api/comments/me` | Required | Get user's comments |

**Admin Endpoints:**
- POST `/api/comments/:id/pin` - Pin comment
- POST `/api/comments/:id/hide` - Hide comment
- GET `/api/comments/flagged` - Get flagged comments

### Integration with XP System

```typescript
// In comments.service.ts createComment()
if (commentCreated) {
  await grantXP({
    userId,
    amount: XP_REWARDS.match_comment, // 5 XP
    transactionType: XPTransactionType.MATCH_COMMENT,
    description: `Maç yorumu yaptın`,
    referenceId: commentId,
    referenceType: 'match_comment'
  });
}
```

### Implementation Tasks

- [ ] Create `src/services/comments.service.ts` (est. 400 lines)
- [ ] Create `src/routes/comments.routes.ts` (est. 200 lines)
- [ ] Implement comment rate limiting middleware
- [ ] Implement auto-flagging on 3 reports
- [ ] Create moderation admin endpoints
- [ ] Integrate XP rewards for comments
- [ ] Write unit tests for comment CRUD and moderation

**Estimated Time:** 4-5 days

---

## Feature 5: Daily Rewards System

### Overview
7-day rotating daily gift wheel:
- Day 1-6: 10-50 credits
- Day 7: 100 credits + special surprise (badge, VIP day)
- Resets every 7 days
- Missed day resets progress

### Reward Schedule
```typescript
export const DAILY_REWARDS = {
  day1: { credits: 10, xp: 0, vip_days: 0 },
  day2: { credits: 15, xp: 0, vip_days: 0 },
  day3: { credits: 20, xp: 0, vip_days: 0 },
  day4: { credits: 25, xp: 0, vip_days: 0 },
  day5: { credits: 30, xp: 0, vip_days: 0 },
  day6: { credits: 40, xp: 0, vip_days: 0 },
  day7: { credits: 100, xp: 100, vip_days: 1, badge: 'weekly_warrior' }
};
```

### Database Schema (Already Created)
```sql
CREATE TABLE customer_daily_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_user_id UUID NOT NULL REFERENCES customer_users(id),
    reward_date DATE NOT NULL,
    day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 7),
    reward_type VARCHAR(50) NOT NULL, -- credits, xp, vip_day, special
    reward_amount INT NOT NULL,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_user_id, reward_date)
);
```

### Service: `dailyRewards.service.ts`

**Functions to Implement:**

```typescript
// Daily reward claim
export async function getDailyRewardStatus(userId: string)
export async function claimDailyReward(userId: string)
export async function resetDailyRewardStreak(userId: string)

// Reward configuration
export function getDailyRewardForDay(dayNumber: number): DailyReward
export function calculateNextReward(userId: string): Promise<DailyReward>

// Stats
export async function getDailyRewardStats(userId: string)
export async function getTotalRewardsClaimed(userId: string)
```

**Daily Reward Status Response:**
```typescript
interface DailyRewardStatus {
  canClaim: boolean;
  currentDay: number; // 1-7
  nextReward: DailyReward;
  lastClaimedDate: Date | null;
  streak: number; // Days claimed this week
  missedDays: number;
}
```

### API Routes: `/api/daily-rewards`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/daily-rewards/status` | Required | Get daily reward status |
| POST | `/api/daily-rewards/claim` | Required | Claim today's reward |
| GET | `/api/daily-rewards/stats` | Required | Get reward stats |

### Implementation Tasks

- [ ] Create `src/services/dailyRewards.service.ts` (est. 250 lines)
- [ ] Create `src/routes/dailyRewards.routes.ts` (est. 100 lines)
- [ ] Implement streak calculation logic
- [ ] Implement day 7 special rewards
- [ ] Integrate with credits and XP services
- [ ] Create daily reward badge unlock
- [ ] Write unit tests for streak reset logic

**Estimated Time:** 2-3 days

---

## 📊 PHASE 3 SUMMARY

### Total Implementation Effort

| Feature | Service Lines | Route Lines | Tests | Est. Days |
|---------|--------------|-------------|-------|-----------|
| Badges | 400 | 200 | 50 | 4-5 |
| Referrals | 350 | 150 | 40 | 3-4 |
| Partners | 450 | 250 | 60 | 5-6 |
| Comments | 400 | 200 | 50 | 4-5 |
| Daily Rewards | 250 | 100 | 30 | 2-3 |
| **TOTAL** | **1,850** | **900** | **230** | **18-23 days** |

### API Endpoints

- **Badges:** 7 endpoints
- **Referrals:** 5 endpoints
- **Partners:** 8 endpoints
- **Comments:** 6 endpoints (+ 3 admin)
- **Daily Rewards:** 3 endpoints
**Total: 29 new API endpoints**

### Dependencies

**Required from Phase 2:**
- ✅ XP service (for badge rewards)
- ✅ Credits service (for referral/daily rewards)
- ✅ Authentication (for protected endpoints)
- ✅ JWT middleware (for route protection)

**New Dependencies:**
- Cron job for partner analytics (daily)
- Rate limiting for match comments
- Image upload for badge icons (future)
- Push notifications for badge unlocks (future)

### Testing Strategy

1. **Unit Tests:** Each service function
2. **Integration Tests:** Full workflows (referral 3-tier, badge unlock)
3. **Load Tests:** Match comments under high traffic
4. **Admin Tests:** Partner approval, comment moderation

### Success Criteria

**Code Quality:**
- [ ] All TypeScript compilation successful
- [ ] No eslint errors
- [ ] Test coverage > 70%
- [ ] All services documented

**Functionality:**
- [ ] All 29 endpoints working
- [ ] Badge unlock triggers working
- [ ] Referral 3-tier system working
- [ ] Partner commission calculation accurate
- [ ] Comment moderation working
- [ ] Daily reward streak logic correct

**Performance:**
- [ ] Comment endpoint < 200ms (high traffic)
- [ ] Badge check < 50ms
- [ ] Leaderboard queries < 500ms
- [ ] No N+1 database queries

**Integration:**
- [ ] Badge unlocks trigger on XP/referral events
- [ ] Referral rewards grant correctly
- [ ] Partner commissions calculate daily
- [ ] XP rewards granted for comments

---

## 🚀 NEXT STEPS

### Phase 3 Kickoff (Week 1)

**Day 1-2: Badges System**
- Create badges.service.ts
- Create badges.routes.ts
- Seed 50+ badge definitions
- Implement unlock logic

**Day 3-4: Referrals System**
- Create referrals.service.ts
- Create referrals.routes.ts
- Integrate 3-tier reward system
- Test referral flow end-to-end

**Day 5: Testing & Review**
- Write unit tests
- Integration testing
- Code review

### Week 2: Partners & Comments

**Day 6-8: Partners System**
- Create partners.service.ts
- Create partners.routes.ts
- Implement analytics calculation
- Create admin approval endpoints

**Day 9-10: Match Comments**
- Create comments.service.ts
- Create comments.routes.ts
- Implement moderation logic
- Add rate limiting

### Week 3: Daily Rewards & Polish

**Day 11-12: Daily Rewards**
- Create dailyRewards.service.ts
- Create dailyRewards.routes.ts
- Implement 7-day wheel logic

**Day 13-14: Integration Testing**
- End-to-end testing all features
- Performance testing
- Bug fixes

**Day 15: Deployment**
- Staging deployment
- Production deployment
- Monitoring

---

## 📝 IMPLEMENTATION CHECKLIST

### Badges System
- [ ] Create badges.service.ts
- [ ] Create badges.routes.ts
- [ ] Seed badge data (50+ badges)
- [ ] Implement unlock triggers
- [ ] Integrate with XP service
- [ ] Add badge leaderboard
- [ ] Write tests

### Referrals System
- [ ] Create referrals.service.ts
- [ ] Create referrals.routes.ts
- [ ] Implement 3-tier rewards
- [ ] Integrate with auth controllers
- [ ] Add referral leaderboard
- [ ] Write tests

### Partners System
- [ ] Create partners.service.ts
- [ ] Create partners.routes.ts
- [ ] Create partner middleware
- [ ] Implement analytics cron job
- [ ] Create admin approval flow
- [ ] Add partner dashboard endpoints
- [ ] Write tests

### Match Comments System
- [ ] Create comments.service.ts
- [ ] Create comments.routes.ts
- [ ] Implement rate limiting
- [ ] Add moderation endpoints
- [ ] Integrate with XP service
- [ ] Add comment reporting
- [ ] Write tests

### Daily Rewards System
- [ ] Create dailyRewards.service.ts
- [ ] Create dailyRewards.routes.ts
- [ ] Implement streak logic
- [ ] Add day 7 special rewards
- [ ] Integrate with credits service
- [ ] Write tests

### Documentation
- [ ] Update API documentation
- [ ] Update MASTER-APP-GOALGPT-PLAN.md
- [ ] Create Phase 3 testing guide
- [ ] Create Phase 3 deployment checklist

---

**Plan Created By:** Claude Code (Development Agent)
**Date:** 2026-01-12
**Version:** Phase 3 Implementation Plan v1.0
**Status:** ✅ Ready for Implementation
