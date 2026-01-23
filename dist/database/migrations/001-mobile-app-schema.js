"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
/**
 * Mobile App Schema Migration
 * Creates 17 new tables for mobile app gamification features
 * Alters 3 existing tables (customer_users, customer_subscriptions, ts_prediction_mapped)
 */
async function up(db) {
    console.log('🚀 Starting mobile app schema migration...');
    // Enable UUID extension
    await (0, kysely_1.sql) `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
    // 1. customer_oauth_identities
    console.log('Creating customer_oauth_identities...');
    await db.schema
        .createTable('customer_oauth_identities')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull())
        .addColumn('provider', kysely_1.sql.raw('varchar(20)'), (col) => col.notNull())
        .addColumn('provider_user_id', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull())
        .addColumn('email', kysely_1.sql.raw('varchar(255)'))
        .addColumn('display_name', kysely_1.sql.raw('varchar(255)'))
        .addColumn('profile_photo_url', 'text')
        .addColumn('access_token', 'text')
        .addColumn('refresh_token', 'text')
        .addColumn('token_expires_at', 'timestamptz')
        .addColumn('linked_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('last_login_at', 'timestamptz')
        .addColumn('is_primary', 'boolean', (col) => col.defaultTo(false))
        .addColumn('metadata', 'jsonb', (col) => col.defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('deleted_at', 'timestamptz')
        .execute();
    await db.schema
        .createIndex('idx_oauth_provider_unique')
        .on('customer_oauth_identities')
        .columns(['provider', 'provider_user_id'])
        .unique()
        .execute();
    await db.schema
        .createIndex('idx_oauth_customer_provider_unique')
        .on('customer_oauth_identities')
        .columns(['customer_user_id', 'provider'])
        .unique()
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE customer_oauth_identities
    ADD CONSTRAINT chk_oauth_provider
    CHECK (provider IN ('google', 'apple', 'phone'))
  `.execute(db);
    console.log('✅ customer_oauth_identities created');
    // 2. customer_xp
    console.log('Creating customer_xp...');
    await db.schema
        .createTable('customer_xp')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull().unique())
        .addColumn('xp_points', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('level', kysely_1.sql.raw('varchar(20)'), (col) => col.notNull().defaultTo('bronze'))
        .addColumn('level_progress', kysely_1.sql.raw('decimal(5,2)'), (col) => col.defaultTo(0.00))
        .addColumn('total_earned', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('current_streak_days', 'integer', (col) => col.defaultTo(0))
        .addColumn('longest_streak_days', 'integer', (col) => col.defaultTo(0))
        .addColumn('last_activity_date', 'date')
        .addColumn('next_level_xp', 'integer')
        .addColumn('achievements_count', 'integer', (col) => col.defaultTo(0))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE customer_xp
    ADD CONSTRAINT chk_xp_positive CHECK (xp_points >= 0),
    ADD CONSTRAINT chk_xp_level CHECK (level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'vip_elite')),
    ADD CONSTRAINT chk_xp_earned CHECK (total_earned >= xp_points)
  `.execute(db);
    await db.schema
        .createIndex('idx_xp_leaderboard')
        .on('customer_xp')
        .columns(['xp_points', 'updated_at'])
        .execute();
    console.log('✅ customer_xp created');
    // 3. customer_xp_transactions
    console.log('Creating customer_xp_transactions...');
    await db.schema
        .createTable('customer_xp_transactions')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull())
        .addColumn('xp_amount', 'integer', (col) => col.notNull())
        .addColumn('transaction_type', kysely_1.sql.raw('varchar(50)'), (col) => col.notNull())
        .addColumn('reference_id', 'uuid')
        .addColumn('reference_type', kysely_1.sql.raw('varchar(50)'))
        .addColumn('description', 'text')
        .addColumn('metadata', 'jsonb', (col) => col.defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await db.schema
        .createIndex('idx_xp_trans_user_date')
        .on('customer_xp_transactions')
        .columns(['customer_user_id', 'created_at'])
        .execute();
    console.log('✅ customer_xp_transactions created');
    // 4. badges
    console.log('Creating badges...');
    await db.schema
        .createTable('badges')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('slug', kysely_1.sql.raw('varchar(100)'), (col) => col.notNull().unique())
        .addColumn('name_tr', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull())
        .addColumn('name_en', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull())
        .addColumn('description_tr', 'text')
        .addColumn('description_en', 'text')
        .addColumn('icon_url', 'text', (col) => col.notNull())
        .addColumn('category', kysely_1.sql.raw('varchar(50)'), (col) => col.notNull())
        .addColumn('rarity', kysely_1.sql.raw('varchar(20)'), (col) => col.notNull().defaultTo('common'))
        .addColumn('unlock_condition', 'jsonb', (col) => col.notNull())
        .addColumn('reward_xp', 'integer', (col) => col.defaultTo(0))
        .addColumn('reward_credits', 'integer', (col) => col.defaultTo(0))
        .addColumn('reward_vip_days', 'integer', (col) => col.defaultTo(0))
        .addColumn('is_active', 'boolean', (col) => col.defaultTo(true))
        .addColumn('display_order', 'integer', (col) => col.defaultTo(0))
        .addColumn('total_unlocks', 'integer', (col) => col.defaultTo(0))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('deleted_at', 'timestamptz')
        .execute();
    console.log('✅ badges created');
    // 5. customer_badges
    console.log('Creating customer_badges...');
    await db.schema
        .createTable('customer_badges')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull())
        .addColumn('badge_id', 'uuid', (col) => col.references('badges.id').onDelete('cascade').notNull())
        .addColumn('unlocked_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('claimed_at', 'timestamptz')
        .addColumn('is_displayed', 'boolean', (col) => col.defaultTo(false))
        .addColumn('metadata', 'jsonb', (col) => col.defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
        .execute();
    await db.schema
        .createIndex('idx_customer_badges_unique')
        .on('customer_badges')
        .columns(['customer_user_id', 'badge_id'])
        .unique()
        .execute();
    console.log('✅ customer_badges created');
    // 6. customer_credits
    console.log('Creating customer_credits...');
    await db.schema
        .createTable('customer_credits')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull().unique())
        .addColumn('balance', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('lifetime_earned', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('lifetime_spent', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE customer_credits
    ADD CONSTRAINT chk_balance_positive CHECK (balance >= 0),
    ADD CONSTRAINT chk_lifetime_earned CHECK (lifetime_earned >= lifetime_spent)
  `.execute(db);
    console.log('✅ customer_credits created');
    // 7. customer_credit_transactions
    console.log('Creating customer_credit_transactions...');
    await db.schema
        .createTable('customer_credit_transactions')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull())
        .addColumn('amount', 'integer', (col) => col.notNull())
        .addColumn('transaction_type', kysely_1.sql.raw('varchar(50)'), (col) => col.notNull())
        .addColumn('reference_id', 'uuid')
        .addColumn('reference_type', kysely_1.sql.raw('varchar(50)'))
        .addColumn('description', 'text')
        .addColumn('balance_before', 'integer', (col) => col.notNull())
        .addColumn('balance_after', 'integer', (col) => col.notNull())
        .addColumn('metadata', 'jsonb', (col) => col.defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await db.schema
        .createIndex('idx_credit_trans_user_date')
        .on('customer_credit_transactions')
        .columns(['customer_user_id', 'created_at'])
        .execute();
    console.log('✅ customer_credit_transactions created');
    // 8. customer_ad_views
    console.log('Creating customer_ad_views...');
    await db.schema
        .createTable('customer_ad_views')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull())
        .addColumn('ad_network', kysely_1.sql.raw('varchar(50)'), (col) => col.notNull())
        .addColumn('ad_unit_id', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull())
        .addColumn('ad_type', kysely_1.sql.raw('varchar(50)'), (col) => col.notNull())
        .addColumn('reward_amount', 'integer', (col) => col.notNull())
        .addColumn('reward_granted', 'boolean', (col) => col.defaultTo(false))
        .addColumn('device_id', kysely_1.sql.raw('varchar(255)'))
        .addColumn('ip_address', kysely_1.sql.raw('inet'))
        .addColumn('user_agent', 'text')
        .addColumn('completed_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('metadata', 'jsonb', (col) => col.defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
        .execute();
    await db.schema
        .createIndex('idx_ad_views_user_date')
        .on('customer_ad_views')
        .columns(['customer_user_id', 'completed_at'])
        .execute();
    console.log('✅ customer_ad_views created');
    // 9. referrals
    console.log('Creating referrals...');
    await db.schema
        .createTable('referrals')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('referrer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull())
        .addColumn('referred_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull().unique())
        .addColumn('referral_code', kysely_1.sql.raw('varchar(20)'), (col) => col.notNull())
        .addColumn('status', kysely_1.sql.raw('varchar(20)'), (col) => col.notNull().defaultTo('pending'))
        .addColumn('tier', 'integer', (col) => col.defaultTo(1))
        .addColumn('referrer_reward_xp', 'integer', (col) => col.defaultTo(0))
        .addColumn('referrer_reward_credits', 'integer', (col) => col.defaultTo(0))
        .addColumn('referred_reward_xp', 'integer', (col) => col.defaultTo(0))
        .addColumn('referred_reward_credits', 'integer', (col) => col.defaultTo(0))
        .addColumn('referred_subscribed_at', 'timestamptz')
        .addColumn('reward_claimed_at', 'timestamptz')
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('expires_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW() + INTERVAL '30 days'`))
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE referrals
    ADD CONSTRAINT chk_referral_status CHECK (status IN ('pending', 'completed', 'rewarded', 'expired')),
    ADD CONSTRAINT chk_referral_self CHECK (referrer_user_id != referred_user_id)
  `.execute(db);
    await db.schema
        .createIndex('idx_referrals_referrer')
        .on('referrals')
        .columns(['referrer_user_id', 'created_at'])
        .execute();
    console.log('✅ referrals created');
    // 10. partners
    console.log('Creating partners...');
    await db.schema
        .createTable('partners')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull().unique())
        .addColumn('business_name', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull())
        .addColumn('tax_id', kysely_1.sql.raw('varchar(50)'))
        .addColumn('phone', kysely_1.sql.raw('varchar(20)'), (col) => col.notNull())
        .addColumn('email', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull())
        .addColumn('address', 'text')
        .addColumn('status', kysely_1.sql.raw('varchar(20)'), (col) => col.notNull().defaultTo('pending'))
        .addColumn('commission_rate', kysely_1.sql.raw('decimal(5,2)'), (col) => col.defaultTo(20.00))
        .addColumn('referral_code', kysely_1.sql.raw('varchar(20)'), (col) => col.notNull().unique())
        .addColumn('total_referrals', 'integer', (col) => col.defaultTo(0))
        .addColumn('total_subscriptions', 'integer', (col) => col.defaultTo(0))
        .addColumn('total_revenue', kysely_1.sql.raw('decimal(10,2)'), (col) => col.defaultTo(0.00))
        .addColumn('total_commission', kysely_1.sql.raw('decimal(10,2)'), (col) => col.defaultTo(0.00))
        .addColumn('last_payout_at', 'timestamptz')
        .addColumn('approved_at', 'timestamptz')
        .addColumn('approved_by', 'uuid', (col) => col.references('customer_users.id'))
        .addColumn('rejection_reason', 'text')
        .addColumn('notes', 'text')
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE partners
    ADD CONSTRAINT chk_partner_status CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'))
  `.execute(db);
    console.log('✅ partners created');
    // 11. partner_analytics
    console.log('Creating partner_analytics...');
    await db.schema
        .createTable('partner_analytics')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('partner_id', 'uuid', (col) => col.references('partners.id').onDelete('cascade').notNull())
        .addColumn('date', 'date', (col) => col.notNull())
        .addColumn('new_signups', 'integer', (col) => col.defaultTo(0))
        .addColumn('new_subscriptions', 'integer', (col) => col.defaultTo(0))
        .addColumn('revenue', kysely_1.sql.raw('decimal(10,2)'), (col) => col.defaultTo(0.00))
        .addColumn('commission', kysely_1.sql.raw('decimal(10,2)'), (col) => col.defaultTo(0.00))
        .addColumn('active_subscribers', 'integer', (col) => col.defaultTo(0))
        .addColumn('churn_count', 'integer', (col) => col.defaultTo(0))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await db.schema
        .createIndex('idx_partner_analytics_unique')
        .on('partner_analytics')
        .columns(['partner_id', 'date'])
        .unique()
        .execute();
    console.log('✅ partner_analytics created');
    // 12. match_comments
    console.log('Creating match_comments...');
    await db.schema
        .createTable('match_comments')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('match_id', 'integer', (col) => col.notNull())
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull())
        .addColumn('parent_comment_id', 'uuid', (col) => col.references('match_comments.id').onDelete('cascade'))
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('like_count', 'integer', (col) => col.defaultTo(0))
        .addColumn('is_pinned', 'boolean', (col) => col.defaultTo(false))
        .addColumn('is_reported', 'boolean', (col) => col.defaultTo(false))
        .addColumn('report_count', 'integer', (col) => col.defaultTo(0))
        .addColumn('status', kysely_1.sql.raw('varchar(20)'), (col) => col.defaultTo('active'))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('deleted_at', 'timestamptz')
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE match_comments
    ADD CONSTRAINT chk_comment_length CHECK (LENGTH(content) >= 3 AND LENGTH(content) <= 1000),
    ADD CONSTRAINT chk_comment_status CHECK (status IN ('active', 'hidden', 'deleted', 'flagged'))
  `.execute(db);
    await db.schema
        .createIndex('idx_match_comments_match')
        .on('match_comments')
        .columns(['match_id', 'created_at'])
        .execute();
    console.log('✅ match_comments created');
    // 13. match_comment_likes
    console.log('Creating match_comment_likes...');
    await db.schema
        .createTable('match_comment_likes')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('comment_id', 'uuid', (col) => col.references('match_comments.id').onDelete('cascade').notNull())
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await db.schema
        .createIndex('idx_comment_likes_unique')
        .on('match_comment_likes')
        .columns(['comment_id', 'customer_user_id'])
        .unique()
        .execute();
    console.log('✅ match_comment_likes created');
    // 14. customer_daily_rewards
    console.log('Creating customer_daily_rewards...');
    await db.schema
        .createTable('customer_daily_rewards')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('customer_user_id', 'uuid', (col) => col.references('customer_users.id').onDelete('cascade').notNull())
        .addColumn('reward_date', 'date', (col) => col.notNull())
        .addColumn('day_number', 'integer', (col) => col.notNull())
        .addColumn('reward_type', kysely_1.sql.raw('varchar(50)'), (col) => col.notNull())
        .addColumn('reward_amount', 'integer', (col) => col.notNull())
        .addColumn('claimed_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE customer_daily_rewards
    ADD CONSTRAINT chk_daily_reward_day CHECK (day_number BETWEEN 1 AND 7),
    ADD CONSTRAINT chk_daily_reward_type CHECK (reward_type IN ('credits', 'xp', 'vip_day', 'special'))
  `.execute(db);
    await db.schema
        .createIndex('idx_daily_rewards_unique')
        .on('customer_daily_rewards')
        .columns(['customer_user_id', 'reward_date'])
        .unique()
        .execute();
    console.log('✅ customer_daily_rewards created');
    // 15. blog_posts
    console.log('Creating blog_posts...');
    await db.schema
        .createTable('blog_posts')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('slug', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull().unique())
        .addColumn('title_tr', kysely_1.sql.raw('varchar(500)'), (col) => col.notNull())
        .addColumn('title_en', kysely_1.sql.raw('varchar(500)'))
        .addColumn('content_tr', 'text', (col) => col.notNull())
        .addColumn('content_en', 'text')
        .addColumn('excerpt_tr', kysely_1.sql.raw('varchar(500)'))
        .addColumn('excerpt_en', kysely_1.sql.raw('varchar(500)'))
        .addColumn('cover_image_url', 'text')
        .addColumn('category', kysely_1.sql.raw('varchar(50)'))
        .addColumn('tags', (0, kysely_1.sql) `TEXT[]`)
        .addColumn('author_id', 'uuid', (col) => col.references('customer_users.id'))
        .addColumn('status', kysely_1.sql.raw('varchar(20)'), (col) => col.defaultTo('draft'))
        .addColumn('view_count', 'integer', (col) => col.defaultTo(0))
        .addColumn('published_at', 'timestamptz')
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('deleted_at', 'timestamptz')
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE blog_posts
    ADD CONSTRAINT chk_blog_status CHECK (status IN ('draft', 'published', 'archived')),
    ADD CONSTRAINT chk_blog_category CHECK (category IN ('news', 'tips', 'analysis', 'announcement', 'tutorial'))
  `.execute(db);
    console.log('✅ blog_posts created');
    // 16. notification_templates
    console.log('Creating notification_templates...');
    await db.schema
        .createTable('notification_templates')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('name', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull().unique())
        .addColumn('title_tr', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull())
        .addColumn('title_en', kysely_1.sql.raw('varchar(255)'))
        .addColumn('body_tr', 'text', (col) => col.notNull())
        .addColumn('body_en', 'text')
        .addColumn('deep_link_type', kysely_1.sql.raw('varchar(50)'))
        .addColumn('deep_link_params', 'jsonb', (col) => col.defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
        .addColumn('icon_url', 'text')
        .addColumn('image_url', 'text')
        .addColumn('target_audience', kysely_1.sql.raw('varchar(50)'), (col) => col.defaultTo('all'))
        .addColumn('segment_filter', 'jsonb')
        .addColumn('is_active', 'boolean', (col) => col.defaultTo(true))
        .addColumn('created_by', 'uuid', (col) => col.references('customer_users.id'))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE notification_templates
    ADD CONSTRAINT chk_notif_audience CHECK (target_audience IN ('all', 'vip', 'free', 'segment')),
    ADD CONSTRAINT chk_notif_link_type CHECK (deep_link_type IN ('match', 'prediction', 'paywall', 'blog', 'url', 'none'))
  `.execute(db);
    console.log('✅ notification_templates created');
    // 17. scheduled_notifications
    console.log('Creating scheduled_notifications...');
    await db.schema
        .createTable('scheduled_notifications')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `uuid_generate_v4()`))
        .addColumn('template_id', 'uuid', (col) => col.references('notification_templates.id'))
        .addColumn('title_tr', kysely_1.sql.raw('varchar(255)'), (col) => col.notNull())
        .addColumn('title_en', kysely_1.sql.raw('varchar(255)'))
        .addColumn('body_tr', 'text', (col) => col.notNull())
        .addColumn('body_en', 'text')
        .addColumn('deep_link_url', 'text')
        .addColumn('image_url', 'text')
        .addColumn('target_audience', kysely_1.sql.raw('varchar(50)'), (col) => col.defaultTo('all'))
        .addColumn('segment_filter', 'jsonb')
        .addColumn('scheduled_at', 'timestamptz', (col) => col.notNull())
        .addColumn('sent_at', 'timestamptz')
        .addColumn('status', kysely_1.sql.raw('varchar(20)'), (col) => col.defaultTo('pending'))
        .addColumn('recipient_count', 'integer')
        .addColumn('success_count', 'integer', (col) => col.defaultTo(0))
        .addColumn('failure_count', 'integer', (col) => col.defaultTo(0))
        .addColumn('created_by', 'uuid', (col) => col.references('customer_users.id'))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo((0, kysely_1.sql) `NOW()`))
        .execute();
    await (0, kysely_1.sql) `
    ALTER TABLE scheduled_notifications
    ADD CONSTRAINT chk_sched_notif_status CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled'))
  `.execute(db);
    await db.schema
        .createIndex('idx_sched_notifs_status_time')
        .on('scheduled_notifications')
        .columns(['status', 'scheduled_at'])
        .execute();
    console.log('✅ scheduled_notifications created');
    // ALTER EXISTING TABLES
    console.log('Altering existing tables...');
    // Add referral_code column to customer_users if not exists
    await (0, kysely_1.sql) `
    ALTER TABLE customer_users
    ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE,
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)
  `.execute(db);
    await (0, kysely_1.sql) `
    CREATE INDEX IF NOT EXISTS idx_customer_users_google
    ON customer_users(google_id) WHERE google_id IS NOT NULL
  `.execute(db);
    await (0, kysely_1.sql) `
    CREATE INDEX IF NOT EXISTS idx_customer_users_apple
    ON customer_users(apple_id) WHERE apple_id IS NOT NULL
  `.execute(db);
    await (0, kysely_1.sql) `
    CREATE INDEX IF NOT EXISTS idx_customer_users_referral
    ON customer_users(referral_code) WHERE referral_code IS NOT NULL
  `.execute(db);
    console.log('✅ customer_users altered');
    // Add partner tracking to subscriptions
    await (0, kysely_1.sql) `
    ALTER TABLE customer_subscriptions
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id),
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS referral_source VARCHAR(50)
  `.execute(db);
    await (0, kysely_1.sql) `
    CREATE INDEX IF NOT EXISTS idx_subscriptions_partner
    ON customer_subscriptions(partner_id) WHERE partner_id IS NOT NULL
  `.execute(db);
    console.log('✅ customer_subscriptions altered');
    // Add credit purchase tracking to predictions
    await (0, kysely_1.sql) `
    ALTER TABLE ts_prediction_mapped
    ADD COLUMN IF NOT EXISTS credit_cost INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS purchased_by_user_id UUID REFERENCES customer_users(id),
    ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ
  `.execute(db);
    await (0, kysely_1.sql) `
    CREATE INDEX IF NOT EXISTS idx_predictions_purchased
    ON ts_prediction_mapped(purchased_by_user_id, purchased_at DESC)
    WHERE purchased_by_user_id IS NOT NULL
  `.execute(db);
    console.log('✅ ts_prediction_mapped altered');
    console.log('✅ Schema migration completed successfully!');
    console.log('📊 Summary: 17 tables created, 3 tables altered');
}
async function down(db) {
    console.log('🔄 Rolling back mobile app schema migration...');
    // Drop tables in reverse order (respecting foreign keys)
    const tables = [
        'scheduled_notifications',
        'notification_templates',
        'blog_posts',
        'customer_daily_rewards',
        'match_comment_likes',
        'match_comments',
        'partner_analytics',
        'partners',
        'referrals',
        'customer_ad_views',
        'customer_credit_transactions',
        'customer_credits',
        'customer_badges',
        'badges',
        'customer_xp_transactions',
        'customer_xp',
        'customer_oauth_identities'
    ];
    for (const table of tables) {
        await db.schema.dropTable(table).ifExists().cascade().execute();
        console.log(`  ✅ Dropped table: ${table}`);
    }
    // Revert ALTER TABLE changes
    await (0, kysely_1.sql) `
    ALTER TABLE customer_users
    DROP COLUMN IF EXISTS google_id,
    DROP COLUMN IF EXISTS apple_id,
    DROP COLUMN IF EXISTS username,
    DROP COLUMN IF EXISTS referral_code
  `.execute(db);
    await (0, kysely_1.sql) `
    ALTER TABLE customer_subscriptions
    DROP COLUMN IF EXISTS partner_id,
    DROP COLUMN IF EXISTS referral_code,
    DROP COLUMN IF EXISTS referral_source
  `.execute(db);
    await (0, kysely_1.sql) `
    ALTER TABLE ts_prediction_mapped
    DROP COLUMN IF EXISTS credit_cost,
    DROP COLUMN IF EXISTS purchased_by_user_id,
    DROP COLUMN IF EXISTS purchased_at
  `.execute(db);
    console.log('✅ Rollback completed');
}
