/**
 * Dashboard Service
 * Business logic for calculating dashboard metrics
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

export interface DashboardStats {
  // Finansal Sağlık
  financial: {
    totalRevenue: number;
    revenueChange: number;
    revenueIos: number;
    revenueAndroid: number;
    activeSubscribers: number;
    subscribersChange: number;
    subscribersIos: number;
    subscribersAndroid: number;
    salesCount: number;
    salesChange: number;
    salesIos: number;
    salesAndroid: number;
    billingErrors: number;
    errorsChange: number;
    errorsIos: number;
    errorsAndroid: number;
  };
  // Edinim & Büyüme
  acquisition: {
    newSignups: number;
    signupsChange: number;
    signupsIos: number;
    signupsAndroid: number;
    trials: number;
    trialsChange: number;
    trialsIos: number;
    trialsAndroid: number;
    firstPurchase: number;
    firstPurchaseChange: number;
    firstPurchaseIos: number;
    firstPurchaseAndroid: number;
    conversionRate: number;
    conversionChange: number;
    conversionIos: number;
    conversionAndroid: number;
  };
  // Tutundurma & Kayıp
  retention: {
    cancellations: number;
    cancellationsChange: number;
    cancellationsIos: number;
    cancellationsAndroid: number;
    churnRate: number;
    churnChange: number;
    totalMembers: number;
    membersChange: number;
    membersIos: number;
    membersAndroid: number;
  };
}

export type PeriodFilter = 'today' | 'week' | 'month' | 'year';

function getPeriodDates(period: PeriodFilter): { current: Date; previous: Date; periodStart: Date } {
  const now = new Date();
  let periodStart: Date;
  let previousStart: Date;

  switch (period) {
    case 'today':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      previousStart = new Date(periodStart);
      previousStart.setDate(previousStart.getDate() - 1);
      break;
    case 'week':
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 7);
      previousStart = new Date(periodStart);
      previousStart.setDate(previousStart.getDate() - 7);
      break;
    case 'month':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStart = new Date(periodStart);
      previousStart.setMonth(previousStart.getMonth() - 1);
      break;
    case 'year':
      periodStart = new Date(now.getFullYear(), 0, 1);
      previousStart = new Date(periodStart);
      previousStart.setFullYear(previousStart.getFullYear() - 1);
      break;
  }

  return { current: now, previous: previousStart, periodStart };
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getDashboardStats(period: PeriodFilter = 'month'): Promise<DashboardStats> {
  const { periodStart, previous } = getPeriodDates(period);

  try {
    // Financial Stats - Revenue with platform breakdown
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN created_at >= $1 THEN amount ELSE 0 END), 0) as current_revenue,
        COALESCE(SUM(CASE WHEN created_at >= $2 AND created_at < $1 THEN amount ELSE 0 END), 0) as previous_revenue,
        COALESCE(SUM(CASE WHEN created_at >= $1 AND platform = 'ios' THEN amount ELSE 0 END), 0) as revenue_ios,
        COALESCE(SUM(CASE WHEN created_at >= $1 AND platform = 'android' THEN amount ELSE 0 END), 0) as revenue_android
      FROM customer_subscriptions
      WHERE status NOT IN ('canceled', 'expired')
    `;
    const revenueResult = await pool.query(revenueQuery, [periodStart, previous]);
    const currentRevenue = parseFloat(revenueResult.rows[0]?.current_revenue || 0);
    const previousRevenue = parseFloat(revenueResult.rows[0]?.previous_revenue || 0);
    const revenueIos = parseFloat(revenueResult.rows[0]?.revenue_ios || 0);
    const revenueAndroid = parseFloat(revenueResult.rows[0]?.revenue_android || 0);

    // Active Subscribers with platform breakdown
    const subscribersQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'active' AND platform = 'ios' THEN 1 END) as active_ios,
        COUNT(CASE WHEN status = 'active' AND platform = 'android' THEN 1 END) as active_android,
        COUNT(CASE WHEN status = 'active' AND created_at >= $1 THEN 1 END) as new_active
      FROM customer_subscriptions
    `;
    const subscribersResult = await pool.query(subscribersQuery, [periodStart]);
    const activeSubscribers = parseInt(subscribersResult.rows[0]?.active_count || 0);
    const subscribersIos = parseInt(subscribersResult.rows[0]?.active_ios || 0);
    const subscribersAndroid = parseInt(subscribersResult.rows[0]?.active_android || 0);

    // Sales with platform breakdown
    const salesQuery = `
      SELECT 
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as current_sales,
        COUNT(CASE WHEN created_at >= $2 AND created_at < $1 THEN 1 END) as previous_sales,
        COUNT(CASE WHEN created_at >= $1 AND platform = 'ios' THEN 1 END) as sales_ios,
        COUNT(CASE WHEN created_at >= $1 AND platform = 'android' THEN 1 END) as sales_android
      FROM customer_subscriptions
    `;
    const salesResult = await pool.query(salesQuery, [periodStart, previous]);
    const currentSales = parseInt(salesResult.rows[0]?.current_sales || 0);
    const previousSales = parseInt(salesResult.rows[0]?.previous_sales || 0);
    const salesIos = parseInt(salesResult.rows[0]?.sales_ios || 0);
    const salesAndroid = parseInt(salesResult.rows[0]?.sales_android || 0);

    // Billing errors with platform breakdown
    const errorsQuery = `
      SELECT 
        COUNT(*) as error_count,
        COUNT(CASE WHEN platform = 'ios' THEN 1 END) as errors_ios,
        COUNT(CASE WHEN platform = 'android' THEN 1 END) as errors_android
      FROM customer_subscriptions
      WHERE status = 'billing_error' OR status = 'past_due'
    `;
    const errorsResult = await pool.query(errorsQuery);
    const billingErrors = parseInt(errorsResult.rows[0]?.error_count || 0);
    const errorsIos = parseInt(errorsResult.rows[0]?.errors_ios || 0);
    const errorsAndroid = parseInt(errorsResult.rows[0]?.errors_android || 0);

    // Acquisition Stats - Signups with platform breakdown
    const signupsQuery = `
      SELECT 
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as current_signups,
        COUNT(CASE WHEN created_at >= $2 AND created_at < $1 THEN 1 END) as previous_signups,
        COUNT(CASE WHEN created_at >= $1 AND registration_platform = 'ios' THEN 1 END) as signups_ios,
        COUNT(CASE WHEN created_at >= $1 AND registration_platform = 'android' THEN 1 END) as signups_android
      FROM customer_users
      WHERE deleted_at IS NULL
    `;
    const signupsResult = await pool.query(signupsQuery, [periodStart, previous]);
    const currentSignups = parseInt(signupsResult.rows[0]?.current_signups || 0);
    const previousSignups = parseInt(signupsResult.rows[0]?.previous_signups || 0);
    const signupsIos = parseInt(signupsResult.rows[0]?.signups_ios || 0);
    const signupsAndroid = parseInt(signupsResult.rows[0]?.signups_android || 0);

    // Trials with platform breakdown
    const trialsQuery = `
      SELECT 
        COUNT(*) as trial_count,
        COUNT(CASE WHEN platform = 'ios' THEN 1 END) as trials_ios,
        COUNT(CASE WHEN platform = 'android' THEN 1 END) as trials_android
      FROM customer_subscriptions
      WHERE status = 'trialing' OR status = 'trial'
    `;
    const trialsResult = await pool.query(trialsQuery);
    const trials = parseInt(trialsResult.rows[0]?.trial_count || 0);
    const trialsIos = parseInt(trialsResult.rows[0]?.trials_ios || 0);
    const trialsAndroid = parseInt(trialsResult.rows[0]?.trials_android || 0);

    // First purchase with platform breakdown
    const firstPurchaseQuery = `
      SELECT 
        COUNT(DISTINCT customer_user_id) as first_purchase_count,
        COUNT(DISTINCT CASE WHEN platform = 'ios' THEN customer_user_id END) as first_purchase_ios,
        COUNT(DISTINCT CASE WHEN platform = 'android' THEN customer_user_id END) as first_purchase_android
      FROM customer_subscriptions
      WHERE created_at >= $1
      AND customer_user_id NOT IN (
        SELECT DISTINCT customer_user_id 
        FROM customer_subscriptions 
        WHERE created_at < $1
      )
    `;
    const firstPurchaseResult = await pool.query(firstPurchaseQuery, [periodStart]);
    const firstPurchase = parseInt(firstPurchaseResult.rows[0]?.first_purchase_count || 0);
    const firstPurchaseIos = parseInt(firstPurchaseResult.rows[0]?.first_purchase_ios || 0);
    const firstPurchaseAndroid = parseInt(firstPurchaseResult.rows[0]?.first_purchase_android || 0);

    const conversionRate = currentSignups > 0 ? Math.round((firstPurchase / currentSignups) * 100) : 0;
    const conversionIos = signupsIos > 0 ? Math.round((firstPurchaseIos / signupsIos) * 100) : 0;
    const conversionAndroid = signupsAndroid > 0 ? Math.round((firstPurchaseAndroid / signupsAndroid) * 100) : 0;

    // Retention Stats - Cancellations with platform breakdown
    const cancellationsQuery = `
      SELECT 
        COUNT(CASE WHEN canceled_at >= $1 THEN 1 END) as current_cancellations,
        COUNT(CASE WHEN canceled_at >= $2 AND canceled_at < $1 THEN 1 END) as previous_cancellations,
        COUNT(CASE WHEN canceled_at >= $1 AND platform = 'ios' THEN 1 END) as cancellations_ios,
        COUNT(CASE WHEN canceled_at >= $1 AND platform = 'android' THEN 1 END) as cancellations_android
      FROM customer_subscriptions
      WHERE canceled_at IS NOT NULL
    `;
    const cancellationsResult = await pool.query(cancellationsQuery, [periodStart, previous]);
    const currentCancellations = parseInt(cancellationsResult.rows[0]?.current_cancellations || 0);
    const previousCancellations = parseInt(cancellationsResult.rows[0]?.previous_cancellations || 0);
    const cancellationsIos = parseInt(cancellationsResult.rows[0]?.cancellations_ios || 0);
    const cancellationsAndroid = parseInt(cancellationsResult.rows[0]?.cancellations_android || 0);

    const churnRate = activeSubscribers > 0 ? Math.round((currentCancellations / activeSubscribers) * 100) : 0;

    // Total members with platform breakdown
    const totalMembersQuery = `
      SELECT 
        COUNT(*) as total_members,
        COUNT(CASE WHEN registration_platform = 'ios' THEN 1 END) as members_ios,
        COUNT(CASE WHEN registration_platform = 'android' THEN 1 END) as members_android
      FROM customer_users
      WHERE deleted_at IS NULL
    `;
    const totalMembersResult = await pool.query(totalMembersQuery);
    const totalMembers = parseInt(totalMembersResult.rows[0]?.total_members || 0);
    const membersIos = parseInt(totalMembersResult.rows[0]?.members_ios || 0);
    const membersAndroid = parseInt(totalMembersResult.rows[0]?.members_android || 0);

    return {
      financial: {
        totalRevenue: currentRevenue,
        revenueChange: calculateChange(currentRevenue, previousRevenue),
        revenueIos,
        revenueAndroid,
        activeSubscribers,
        subscribersChange: 0,
        subscribersIos,
        subscribersAndroid,
        salesCount: currentSales,
        salesChange: calculateChange(currentSales, previousSales),
        salesIos,
        salesAndroid,
        billingErrors,
        errorsChange: 0,
        errorsIos,
        errorsAndroid,
      },
      acquisition: {
        newSignups: currentSignups,
        signupsChange: calculateChange(currentSignups, previousSignups),
        signupsIos,
        signupsAndroid,
        trials,
        trialsChange: 0,
        trialsIos,
        trialsAndroid,
        firstPurchase,
        firstPurchaseChange: 0,
        firstPurchaseIos,
        firstPurchaseAndroid,
        conversionRate,
        conversionChange: 0,
        conversionIos,
        conversionAndroid,
      },
      retention: {
        cancellations: currentCancellations,
        cancellationsChange: calculateChange(currentCancellations, previousCancellations),
        cancellationsIos,
        cancellationsAndroid,
        churnRate,
        churnChange: 0,
        totalMembers,
        membersChange: 0,
        membersIos,
        membersAndroid,
      },
    };
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

export async function getRevenueChart(period: PeriodFilter = 'month'): Promise<{ date: string; revenue: number }[]> {
  try {
    let interval: string;
    let limit: number;

    switch (period) {
      case 'today':
        interval = 'hour';
        limit = 24;
        break;
      case 'week':
        interval = 'day';
        limit = 7;
        break;
      case 'month':
        interval = 'day';
        limit = 30;
        break;
      case 'year':
        interval = 'month';
        limit = 12;
        break;
    }

    const query = `
      SELECT 
        DATE_TRUNC($1, created_at) as date,
        COALESCE(SUM(amount), 0) as revenue
      FROM customer_subscriptions
      WHERE created_at >= NOW() - INTERVAL '${limit} ${interval}s'
      GROUP BY DATE_TRUNC($1, created_at)
      ORDER BY date ASC
    `;

    const result = await pool.query(query, [interval]);
    return result.rows.map(row => ({
      date: row.date.toISOString(),
      revenue: parseFloat(row.revenue),
    }));
  } catch (error) {
    logger.error('Error fetching revenue chart:', error);
    return [];
  }
}

// ==========================================
// DRILL-DOWN APIs - Trend Data (for charts)
// ==========================================

export interface TrendDataPoint {
  date: string;
  total: number;
  ios: number;
  android: number;
}

async function getTrendData(
  tableName: string,
  valueColumn: string,
  dateColumn: string,
  period: PeriodFilter,
  whereClause: string = ''
): Promise<TrendDataPoint[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    const query = `
            SELECT 
                DATE_TRUNC('day', ${dateColumn}) as date,
                COALESCE(${valueColumn === 'COUNT' ? 'COUNT(*)' : `SUM(${valueColumn})`}, 0) as total,
                COALESCE(${valueColumn === 'COUNT' ? "COUNT(CASE WHEN LOWER(platform) = 'ios' THEN 1 END)" : `SUM(CASE WHEN LOWER(platform) = 'ios' THEN ${valueColumn} ELSE 0 END)`}, 0) as ios,
                COALESCE(${valueColumn === 'COUNT' ? "COUNT(CASE WHEN LOWER(platform) IN ('android', 'google') THEN 1 END)" : `SUM(CASE WHEN LOWER(platform) IN ('android', 'google') THEN ${valueColumn} ELSE 0 END)`}, 0) as android
            FROM ${tableName}
            WHERE ${dateColumn} >= $1
            ${whereClause}
            GROUP BY DATE_TRUNC('day', ${dateColumn})
            ORDER BY date ASC
        `;

    const result = await pool.query(query, [periodStart]);
    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      total: parseFloat(row.total) || 0,
      ios: parseFloat(row.ios) || 0,
      android: parseFloat(row.android) || 0,
    }));
  } catch (error) {
    logger.error(`Error fetching trend data for ${tableName}:`, error);
    return [];
  }
}

export async function getRevenueTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  return getTrendData('customer_subscriptions', 'amount', 'created_at', period);
}

export async function getSubscribersTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  return getTrendData('customer_subscriptions', 'COUNT', 'created_at', period, "AND status = 'active'");
}

export async function getSalesTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  return getTrendData('customer_subscriptions', 'COUNT', 'created_at', period);
}

export async function getBillingErrorsTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  return getTrendData('customer_subscriptions', 'COUNT', 'updated_at', period, "AND status IN ('billing_error', 'past_due')");
}

export async function getSignupsTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    const query = `
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as total,
                COUNT(CASE WHEN LOWER(registration_platform) = 'ios' THEN 1 END) as ios,
                COUNT(CASE WHEN LOWER(registration_platform) IN ('android', 'google') THEN 1 END) as android
            FROM customer_users
            WHERE created_at >= $1 AND deleted_at IS NULL
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date ASC
        `;

    const result = await pool.query(query, [periodStart]);
    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      total: parseInt(row.total) || 0,
      ios: parseInt(row.ios) || 0,
      android: parseInt(row.android) || 0,
    }));
  } catch (error) {
    logger.error('Error fetching signups trend:', error);
    return [];
  }
}

export async function getTrialsTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  return getTrendData('customer_subscriptions', 'COUNT', 'started_at', period, "AND status IN ('trialing', 'trial')");
}

export async function getCancellationsTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  return getTrendData('customer_subscriptions', 'COUNT', 'canceled_at', period, 'AND canceled_at IS NOT NULL');
}

export async function getChurnTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  return getTrendData('customer_subscriptions', 'COUNT', 'expired_at', period, "AND status = 'expired'");
}

// ==========================================
// DRILL-DOWN APIs - Detail Data (for tables)
// ==========================================

export interface UserDetail {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  platform: string;
  created_at: string;
}

export interface SubscriptionDetail {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  platform: string;
  plan_name: string;
  amount: number;
  status: string;
  started_at: string;
  expired_at: string;
  canceled_at: string;
  days_remaining: number;
  total_spent: number;
  transaction_count: number;
}

export async function getRevenueDetails(period: PeriodFilter, limit: number = 100): Promise<SubscriptionDetail[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    const query = `
            SELECT 
                cs.id,
                cu.id as user_id,
                cu.email,
                cu.full_name,
                cu.phone,
                cs.platform,
                sp.name as plan_name,
                cs.amount,
                cs.status,
                cs.started_at,
                cs.expired_at,
                cs.canceled_at,
                GREATEST(0, EXTRACT(DAY FROM (cs.expired_at - NOW()))) as days_remaining,
                (SELECT COALESCE(SUM(amount), 0) FROM customer_subscriptions WHERE customer_user_id = cu.id) as total_spent,
                (SELECT COUNT(*) FROM customer_subscriptions WHERE customer_user_id = cu.id) as transaction_count
            FROM customer_subscriptions cs
            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id
            LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
            WHERE cs.created_at >= $1
            ORDER BY cs.created_at DESC
            LIMIT $2
        `;

    const result = await pool.query(query, [periodStart, limit]);
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      plan_name: row.plan_name || 'Unknown',
      amount: parseFloat(row.amount) || 0,
      status: row.status || 'unknown',
      started_at: row.started_at?.toISOString() || '',
      expired_at: row.expired_at?.toISOString() || '',
      canceled_at: row.canceled_at?.toISOString() || '',
      days_remaining: parseInt(row.days_remaining) || 0,
      total_spent: parseFloat(row.total_spent) || 0,
      transaction_count: parseInt(row.transaction_count) || 0,
    }));
  } catch (error) {
    logger.error('Error fetching revenue details:', error);
    return [];
  }
}

export async function getActiveSubscribersDetails(period: PeriodFilter, limit: number = 100): Promise<SubscriptionDetail[]> {
  try {
    const query = `
            SELECT 
                cs.id,
                cu.id as user_id,
                cu.email,
                cu.full_name,
                cu.phone,
                cs.platform,
                sp.name as plan_name,
                cs.amount,
                cs.status,
                cs.auto_renew_enabled,
                cs.started_at,
                cs.expired_at,
                cs.canceled_at,
                GREATEST(0, EXTRACT(DAY FROM (cs.expired_at - NOW()))) as days_remaining,
                (SELECT COALESCE(SUM(amount), 0) FROM customer_subscriptions WHERE customer_user_id = cu.id) as total_spent,
                (SELECT COUNT(*) FROM customer_subscriptions WHERE customer_user_id = cu.id) as transaction_count
            FROM customer_subscriptions cs
            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id
            LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
            WHERE cs.status = 'active'
            ORDER BY cs.started_at DESC
            LIMIT $1
        `;

    const result = await pool.query(query, [limit]);
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      plan_name: row.plan_name || 'Unknown',
      amount: parseFloat(row.amount) || 0,
      status: row.status || 'unknown',
      auto_renew: row.auto_renew_enabled || false,
      started_at: row.started_at?.toISOString() || '',
      expired_at: row.expired_at?.toISOString() || '',
      canceled_at: row.canceled_at?.toISOString() || '',
      days_remaining: parseInt(row.days_remaining) || 0,
      total_spent: parseFloat(row.total_spent) || 0,
      transaction_count: parseInt(row.transaction_count) || 0,
    }));
  } catch (error) {
    logger.error('Error fetching active subscribers details:', error);
    return [];
  }
}

export async function getSignupsDetails(period: PeriodFilter, limit: number = 100): Promise<UserDetail[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    const query = `
            SELECT 
                id,
                email,
                full_name,
                phone,
                registration_platform as platform,
                created_at
            FROM customer_users
            WHERE created_at >= $1 AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $2
        `;

    const result = await pool.query(query, [periodStart, limit]);
    return result.rows.map(row => ({
      id: row.id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      created_at: row.created_at?.toISOString() || '',
    }));
  } catch (error) {
    logger.error('Error fetching signups details:', error);
    return [];
  }
}

export async function getTrialsDetails(period: PeriodFilter, limit: number = 100): Promise<SubscriptionDetail[]> {
  try {
    const query = `
            SELECT 
                cs.id,
                cu.id as user_id,
                cu.email,
                cu.full_name,
                cu.phone,
                cs.platform,
                sp.name as plan_name,
                cs.status,
                cs.started_at,
                cs.expired_at,
                GREATEST(0, EXTRACT(DAY FROM (cs.expired_at - NOW()))) as days_remaining
            FROM customer_subscriptions cs
            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id
            LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
            WHERE cs.status IN ('trialing', 'trial')
            ORDER BY cs.started_at DESC
            LIMIT $1
        `;

    const result = await pool.query(query, [limit]);
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      plan_name: row.plan_name || 'Unknown',
      amount: 0,
      status: 'trial',
      started_at: row.started_at?.toISOString() || '',
      expired_at: row.expired_at?.toISOString() || '',
      canceled_at: '',
      days_remaining: parseInt(row.days_remaining) || 0,
      total_spent: 0,
      transaction_count: 0,
    }));
  } catch (error) {
    logger.error('Error fetching trials details:', error);
    return [];
  }
}

export async function getCancellationsDetails(period: PeriodFilter, limit: number = 100): Promise<SubscriptionDetail[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    const query = `
            SELECT 
                cs.id,
                cu.id as user_id,
                cu.email,
                cu.full_name,
                cu.phone,
                cs.platform,
                sp.name as plan_name,
                cs.status,
                cs.canceled_at,
                cs.expired_at,
                GREATEST(0, EXTRACT(DAY FROM (cs.expired_at - NOW()))) as days_remaining
            FROM customer_subscriptions cs
            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id
            LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
            WHERE cs.canceled_at >= $1 AND cs.canceled_at IS NOT NULL
            ORDER BY cs.canceled_at DESC
            LIMIT $2
        `;

    const result = await pool.query(query, [periodStart, limit]);
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      plan_name: row.plan_name || 'Unknown',
      amount: 0,
      status: row.status || 'canceled',
      started_at: '',
      expired_at: row.expired_at?.toISOString() || '',
      canceled_at: row.canceled_at?.toISOString() || '',
      days_remaining: parseInt(row.days_remaining) || 0,
      total_spent: 0,
      transaction_count: 0,
    }));
  } catch (error) {
    logger.error('Error fetching cancellations details:', error);
    return [];
  }
}

export async function getChurnDetails(period: PeriodFilter, limit: number = 100): Promise<SubscriptionDetail[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    const query = `
            SELECT 
                cs.id,
                cu.id as user_id,
                cu.email,
                cu.full_name,
                cu.phone,
                cs.platform,
                cs.status,
                cs.expired_at,
                cu.last_seen_at
            FROM customer_subscriptions cs
            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id
            WHERE cs.status = 'expired' AND cs.expired_at >= $1
            ORDER BY cs.expired_at DESC
            LIMIT $2
        `;

    const result = await pool.query(query, [periodStart, limit]);
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      plan_name: '',
      amount: 0,
      status: 'churned',
      started_at: '',
      expired_at: row.expired_at?.toISOString() || '',
      canceled_at: '',
      days_remaining: 0,
      total_spent: 0,
      transaction_count: 0,
      last_seen_at: row.last_seen_at?.toISOString() || '',
    }));
  } catch (error) {
    logger.error('Error fetching churn details:', error);
    return [];
  }
}

export async function getBillingErrorsDetails(period: PeriodFilter, limit: number = 100): Promise<SubscriptionDetail[]> {
  try {
    const query = `
            SELECT 
                cs.id,
                cu.id as user_id,
                cu.email,
                cu.full_name,
                cu.phone,
                cs.platform,
                cs.status,
                cu.last_seen_at
            FROM customer_subscriptions cs
            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id
            WHERE cs.status IN ('billing_error', 'past_due')
            ORDER BY cs.updated_at DESC
            LIMIT $1
        `;

    const result = await pool.query(query, [limit]);
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      plan_name: '',
      amount: 0,
      status: 'billing_error',
      started_at: '',
      expired_at: '',
      canceled_at: '',
      days_remaining: 0,
      total_spent: 0,
      transaction_count: 0,
      last_seen_at: row.last_seen_at?.toISOString() || '',
    }));
  } catch (error) {
    logger.error('Error fetching billing errors details:', error);
    return [];
  }
}

// ============ FIRST PURCHASE ============
export async function getFirstPurchaseTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    const query = `
      SELECT 
        DATE(cs.created_at) as date,
        COUNT(*) as total,
        COUNT(CASE WHEN cs.platform IN ('ios', 'apple') THEN 1 END) as ios,
        COUNT(CASE WHEN cs.platform IN ('android', 'google') THEN 1 END) as android
      FROM customer_subscriptions cs
      LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id
      WHERE cs.created_at >= $1
        AND cs.created_at = (
          SELECT MIN(cs2.created_at) 
          FROM customer_subscriptions cs2 
          WHERE cs2.customer_user_id = cs.customer_user_id
        )
      GROUP BY DATE(cs.created_at)
      ORDER BY date ASC
    `;
    const result = await pool.query(query, [periodStart]);
    return result.rows.map(row => ({
      date: row.date?.toISOString()?.split('T')[0] || '',
      total: parseInt(row.total) || 0,
      ios: parseInt(row.ios) || 0,
      android: parseInt(row.android) || 0,
    }));
  } catch (error) {
    logger.error('Error fetching first purchase trend:', error);
    return [];
  }
}

export async function getFirstPurchaseDetails(period: PeriodFilter, limit: number = 100): Promise<SubscriptionDetail[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    const query = `
      SELECT 
        cs.id,
        cu.id as user_id,
        cu.email,
        cu.full_name,
        cu.phone,
        cs.platform,
        sp.plan_name,
        cs.amount,
        cs.status,
        cs.created_at as started_at
      FROM customer_subscriptions cs
      LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id
      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
      WHERE cs.created_at >= $1
        AND cs.created_at = (
          SELECT MIN(cs2.created_at) 
          FROM customer_subscriptions cs2 
          WHERE cs2.customer_user_id = cs.customer_user_id
        )
      ORDER BY cs.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [periodStart, limit]);
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      plan_name: row.plan_name || 'Unknown',
      amount: parseFloat(row.amount) || 0,
      status: row.status || '',
      started_at: row.started_at?.toISOString() || '',
      expired_at: '',
      canceled_at: '',
      days_remaining: 0,
      total_spent: parseFloat(row.amount) || 0,
      transaction_count: 1,
    }));
  } catch (error) {
    logger.error('Error fetching first purchase details:', error);
    return [];
  }
}

// ============ CONVERSION RATE ============
export async function getConversionTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    // Get daily signups and first purchases to calculate conversion
    const query = `
      WITH daily_stats AS (
        SELECT 
          d.date,
          COALESCE(signups.count, 0) as signups,
          COALESCE(conversions.count, 0) as conversions,
          COALESCE(signups_ios.count, 0) as signups_ios,
          COALESCE(conversions_ios.count, 0) as conversions_ios,
          COALESCE(signups_android.count, 0) as signups_android,
          COALESCE(conversions_android.count, 0) as conversions_android
        FROM (
          SELECT generate_series($1::date, CURRENT_DATE, '1 day'::interval)::date as date
        ) d
        LEFT JOIN (
          SELECT DATE(created_at) as date, COUNT(*) as count 
          FROM customer_users 
          WHERE created_at >= $1
          GROUP BY DATE(created_at)
        ) signups ON signups.date = d.date
        LEFT JOIN (
          SELECT DATE(cs.created_at) as date, COUNT(*) as count 
          FROM customer_subscriptions cs
          WHERE cs.created_at >= $1 AND cs.status NOT IN ('trial')
          GROUP BY DATE(cs.created_at)
        ) conversions ON conversions.date = d.date
        LEFT JOIN (
          SELECT DATE(created_at) as date, COUNT(*) as count 
          FROM customer_users 
          WHERE created_at >= $1 AND platform IN ('ios', 'apple')
          GROUP BY DATE(created_at)
        ) signups_ios ON signups_ios.date = d.date
        LEFT JOIN (
          SELECT DATE(cs.created_at) as date, COUNT(*) as count 
          FROM customer_subscriptions cs
          WHERE cs.created_at >= $1 AND cs.status NOT IN ('trial') AND cs.platform IN ('ios', 'apple')
          GROUP BY DATE(cs.created_at)
        ) conversions_ios ON conversions_ios.date = d.date
        LEFT JOIN (
          SELECT DATE(created_at) as date, COUNT(*) as count 
          FROM customer_users 
          WHERE created_at >= $1 AND platform IN ('android', 'google')
          GROUP BY DATE(created_at)
        ) signups_android ON signups_android.date = d.date
        LEFT JOIN (
          SELECT DATE(cs.created_at) as date, COUNT(*) as count 
          FROM customer_subscriptions cs
          WHERE cs.created_at >= $1 AND cs.status NOT IN ('trial') AND cs.platform IN ('android', 'google')
          GROUP BY DATE(cs.created_at)
        ) conversions_android ON conversions_android.date = d.date
      )
      SELECT 
        date,
        CASE WHEN signups > 0 THEN ROUND((conversions::numeric / signups::numeric) * 100, 1) ELSE 0 END as total,
        CASE WHEN signups_ios > 0 THEN ROUND((conversions_ios::numeric / signups_ios::numeric) * 100, 1) ELSE 0 END as ios,
        CASE WHEN signups_android > 0 THEN ROUND((conversions_android::numeric / signups_android::numeric) * 100, 1) ELSE 0 END as android
      FROM daily_stats
      ORDER BY date ASC
    `;
    const result = await pool.query(query, [periodStart]);
    return result.rows.map(row => ({
      date: row.date?.toISOString()?.split('T')[0] || '',
      total: parseFloat(row.total) || 0,
      ios: parseFloat(row.ios) || 0,
      android: parseFloat(row.android) || 0,
    }));
  } catch (error) {
    logger.error('Error fetching conversion trend:', error);
    return [];
  }
}

export async function getConversionDetails(period: PeriodFilter, limit: number = 100): Promise<SubscriptionDetail[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    // Get users who signed up and then made a purchase
    const query = `
      SELECT 
        cu.id as user_id,
        cu.email,
        cu.full_name,
        cu.phone,
        cu.platform,
        cu.created_at as signup_at,
        cs.created_at as conversion_at,
        sp.plan_name,
        cs.amount,
        EXTRACT(DAY FROM (cs.created_at - cu.created_at)) as days_to_convert
      FROM customer_users cu
      INNER JOIN customer_subscriptions cs ON cs.customer_user_id = cu.id
      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
      WHERE cu.created_at >= $1
        AND cs.status NOT IN ('trial')
        AND cs.created_at = (
          SELECT MIN(cs2.created_at) 
          FROM customer_subscriptions cs2 
          WHERE cs2.customer_user_id = cu.id AND cs2.status NOT IN ('trial')
        )
      ORDER BY cs.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [periodStart, limit]);
    return result.rows.map(row => ({
      id: row.user_id,
      user_id: row.user_id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      plan_name: row.plan_name || 'Unknown',
      amount: parseFloat(row.amount) || 0,
      status: 'converted',
      started_at: row.conversion_at?.toISOString() || '',
      expired_at: '',
      canceled_at: '',
      days_remaining: parseInt(row.days_to_convert) || 0, // Days to convert
      total_spent: parseFloat(row.amount) || 0,
      transaction_count: 1,
      created_at: row.signup_at?.toISOString() || '',
    }));
  } catch (error) {
    logger.error('Error fetching conversion details:', error);
    return [];
  }
}

// ============ TOTAL MEMBERS ============
export async function getTotalMembersTrend(period: PeriodFilter): Promise<TrendDataPoint[]> {
  const { periodStart } = getPeriodDates(period);

  try {
    // Get cumulative member count over time
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as daily_new,
        COUNT(CASE WHEN platform IN ('ios', 'apple') THEN 1 END) as ios,
        COUNT(CASE WHEN platform IN ('android', 'google') THEN 1 END) as android
      FROM customer_users
      WHERE created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    const result = await pool.query(query, [periodStart]);

    // Calculate cumulative total
    let runningTotal = 0;
    let runningIos = 0;
    let runningAndroid = 0;

    // Get the initial count before periodStart
    const baseQuery = `SELECT COUNT(*) as count FROM customer_users WHERE created_at < $1`;
    const baseResult = await pool.query(baseQuery, [periodStart]);
    runningTotal = parseInt(baseResult.rows[0]?.count) || 0;

    return result.rows.map(row => {
      runningTotal += parseInt(row.daily_new) || 0;
      runningIos += parseInt(row.ios) || 0;
      runningAndroid += parseInt(row.android) || 0;
      return {
        date: row.date?.toISOString()?.split('T')[0] || '',
        total: runningTotal,
        ios: runningIos,
        android: runningAndroid,
      };
    });
  } catch (error) {
    logger.error('Error fetching total members trend:', error);
    return [];
  }
}

export async function getTotalMembersDetails(period: PeriodFilter, limit: number = 100): Promise<SubscriptionDetail[]> {
  try {
    // Get all members with their subscription info
    const query = `
      SELECT 
        cu.id as user_id,
        cu.email,
        cu.full_name,
        cu.phone,
        cu.platform,
        cu.created_at,
        cu.last_seen_at,
        COALESCE(subs.total_spent, 0) as total_spent,
        COALESCE(subs.transaction_count, 0) as transaction_count,
        subs.latest_plan
      FROM customer_users cu
      LEFT JOIN (
        SELECT 
          customer_user_id,
          SUM(amount) as total_spent,
          COUNT(*) as transaction_count,
          MAX(plan_id) as latest_plan
        FROM customer_subscriptions
        WHERE status != 'trial'
        GROUP BY customer_user_id
      ) subs ON subs.customer_user_id = cu.id
      ORDER BY cu.created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows.map(row => ({
      id: row.user_id,
      user_id: row.user_id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
      platform: row.platform || 'unknown',
      plan_name: '',
      amount: 0,
      status: row.total_spent > 0 ? 'paying' : 'free',
      started_at: '',
      expired_at: '',
      canceled_at: '',
      days_remaining: 0,
      total_spent: parseFloat(row.total_spent) || 0,
      transaction_count: parseInt(row.transaction_count) || 0,
      created_at: row.created_at?.toISOString() || '',
      last_seen_at: row.last_seen_at?.toISOString() || '',
    }));
  } catch (error) {
    logger.error('Error fetching total members details:', error);
    return [];
  }
}

