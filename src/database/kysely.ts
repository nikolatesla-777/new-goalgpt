import { Kysely, PostgresDialect, Generated } from 'kysely';
import { pool } from './connection';

/**
 * Kysely Database Instance
 * Type-safe SQL query builder for TypeScript
 * Uses existing pg Pool from connection.ts
 */

// Database schema interface (will be expanded as we build features)
export interface Database {
  customer_users: CustomerUser;
  customer_oauth_identities: CustomerOAuthIdentity;
  customer_xp: CustomerXP;
  customer_xp_transactions: CustomerXPTransaction;
  customer_credits: CustomerCredits;
  customer_credit_transactions: CustomerCreditTransaction;
  customer_push_tokens: CustomerPushToken;
  customer_subscriptions: CustomerSubscription;
  badges: Badge;
  customer_badges: CustomerBadge;
  referrals: Referral;
  partners: Partner;
  partner_analytics: PartnerAnalytics;
  match_comments: MatchComment;
  match_comment_likes: MatchCommentLike;
  customer_daily_rewards: CustomerDailyReward;
  blog_posts: BlogPost;
  notification_templates: NotificationTemplate;
  scheduled_notifications: ScheduledNotification;
  customer_ad_views: CustomerAdView;
}

// Table interfaces
export interface CustomerUser {
  id: Generated<string>;
  email: string | null;
  name: string | null;
  phone: string | null;
  google_id: string | null;
  apple_id: string | null;
  username: string | null;
  referral_code: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CustomerOAuthIdentity {
  id: Generated<string>;
  customer_user_id: string;
  provider: 'google' | 'apple' | 'phone';
  provider_user_id: string;
  email: string | null;
  display_name: string | null;
  profile_photo_url: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: Date | null;
  linked_at: Date;
  last_login_at: Date | null;
  is_primary: boolean;
  metadata: any; // JSONB
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CustomerXP {
  id: Generated<string>;
  customer_user_id: string;
  xp_points: number;
  level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'vip_elite';
  level_progress: number;
  total_earned: number;
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date: Date | null;
  next_level_xp: number | null;
  achievements_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerXPTransaction {
  id: Generated<string>;
  customer_user_id: string;
  xp_amount: number;
  transaction_type: string;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  metadata: any; // JSONB
  created_at: Date;
}

export interface CustomerCredits {
  id: Generated<string>;
  customer_user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerCreditTransaction {
  id: Generated<string>;
  customer_user_id: string;
  amount: number;
  transaction_type: string;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  balance_before: number;
  balance_after: number;
  metadata: any; // JSONB
  created_at: Date;
}

export interface CustomerPushToken {
  id: Generated<string>;
  customer_user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  device_id: string;
  app_version: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerSubscription {
  id: Generated<string>;
  customer_user_id: string;
  status: string;
  expired_at: Date | null;
  partner_id: string | null;
  referral_code: string | null;
  referral_source: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Badge {
  id: Generated<string>;
  slug: string;
  name_tr: string;
  name_en: string;
  description_tr: string | null;
  description_en: string | null;
  icon_url: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlock_condition: any; // JSONB
  reward_xp: number;
  reward_credits: number;
  reward_vip_days: number;
  is_active: boolean;
  display_order: number;
  total_unlocks: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CustomerBadge {
  id: Generated<string>;
  customer_user_id: string;
  badge_id: string;
  unlocked_at: Date;
  claimed_at: Date | null;
  is_displayed: boolean;
  metadata: any; // JSONB
}

export interface Referral {
  id: Generated<string>;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  status: string;
  tier: number;
  referrer_reward_xp: number;
  referrer_reward_credits: number;
  referred_reward_xp: number;
  referred_reward_credits: number;
  referred_subscribed_at: Date | null;
  reward_claimed_at: Date | null;
  created_at: Date;
  expires_at: Date;
}

export interface Partner {
  id: Generated<string>;
  customer_user_id: string;
  business_name: string;
  tax_id: string | null;
  phone: string;
  email: string;
  address: string | null;
  status: string;
  commission_rate: number;
  referral_code: string;
  total_referrals: number;
  total_subscriptions: number;
  total_revenue: number;
  total_commission: number;
  last_payout_at: Date | null;
  approved_at: Date | null;
  approved_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PartnerAnalytics {
  id: Generated<string>;
  partner_id: string;
  date: Date;
  new_signups: number;
  new_subscriptions: number;
  revenue: number;
  commission: number;
  active_subscribers: number;
  churn_count: number;
  created_at: Date;
}

export interface MatchComment {
  id: Generated<string>;
  match_id: number;
  customer_user_id: string;
  parent_comment_id: string | null;
  content: string;
  like_count: number;
  is_pinned: boolean;
  is_reported: boolean;
  report_count: number;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface MatchCommentLike {
  id: Generated<string>;
  comment_id: string;
  customer_user_id: string;
  created_at: Date;
}

export interface CustomerDailyReward {
  id: Generated<string>;
  customer_user_id: string;
  reward_date: Date;
  day_number: number;
  reward_type: string;
  reward_amount: number;
  claimed_at: Date;
}

export interface BlogPost {
  id: Generated<string>;
  slug: string;
  title_tr: string;
  title_en: string | null;
  content_tr: string;
  content_en: string | null;
  excerpt_tr: string | null;
  excerpt_en: string | null;
  cover_image_url: string | null;
  category: string | null;
  tags: string[] | null;
  author_id: string | null;
  status: string;
  view_count: number;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface NotificationTemplate {
  id: Generated<string>;
  name: string;
  title_tr: string;
  title_en: string | null;
  body_tr: string;
  body_en: string | null;
  deep_link_type: string | null;
  deep_link_params: any; // JSONB
  icon_url: string | null;
  image_url: string | null;
  target_audience: string;
  segment_filter: any; // JSONB
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ScheduledNotification {
  id: Generated<string>;
  template_id: string | null;
  title_tr: string;
  title_en: string | null;
  body_tr: string;
  body_en: string | null;
  deep_link_url: string | null;
  image_url: string | null;
  target_audience: string;
  segment_filter: any; // JSONB
  scheduled_at: Date;
  sent_at: Date | null;
  status: string;
  recipient_count: number | null;
  success_count: number;
  failure_count: number;
  created_by: string | null;
  created_at: Date;
}

export interface CustomerAdView {
  id: Generated<string>;
  customer_user_id: string;
  ad_network: string;
  ad_unit_id: string;
  ad_type: string;
  reward_amount: number;
  reward_granted: boolean;
  device_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  completed_at: Date;
  metadata: any; // JSONB
}

// Create and export Kysely instance
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

// Export for convenience
export default db;
