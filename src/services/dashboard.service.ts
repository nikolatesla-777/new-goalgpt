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
    activeSubscribers: number;
    subscribersChange: number;
    salesCount: number;
    salesChange: number;
    billingErrors: number;
    errorsChange: number;
  };
  // Edinim & Büyüme
  acquisition: {
    newSignups: number;
    signupsChange: number;
    trials: number;
    trialsChange: number;
    firstPurchase: number;
    firstPurchaseChange: number;
    conversionRate: number;
    conversionChange: number;
  };
  // Tutundurma & Kayıp
  retention: {
    cancellations: number;
    cancellationsChange: number;
    churnRate: number;
    churnChange: number;
    totalMembers: number;
    membersChange: number;
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
    // Financial Stats
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN created_at >= $1 THEN amount ELSE 0 END), 0) as current_revenue,
        COALESCE(SUM(CASE WHEN created_at >= $2 AND created_at < $1 THEN amount ELSE 0 END), 0) as previous_revenue
      FROM customer_subscriptions
      WHERE status NOT IN ('canceled', 'expired')
    `;
    const revenueResult = await pool.query(revenueQuery, [periodStart, previous]);
    const currentRevenue = parseFloat(revenueResult.rows[0]?.current_revenue || 0);
    const previousRevenue = parseFloat(revenueResult.rows[0]?.previous_revenue || 0);

    const subscribersQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'active' AND created_at >= $1 THEN 1 END) as new_active
      FROM customer_subscriptions
    `;
    const subscribersResult = await pool.query(subscribersQuery, [periodStart]);
    const activeSubscribers = parseInt(subscribersResult.rows[0]?.active_count || 0);

    const salesQuery = `
      SELECT 
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as current_sales,
        COUNT(CASE WHEN created_at >= $2 AND created_at < $1 THEN 1 END) as previous_sales
      FROM customer_subscriptions
    `;
    const salesResult = await pool.query(salesQuery, [periodStart, previous]);
    const currentSales = parseInt(salesResult.rows[0]?.current_sales || 0);
    const previousSales = parseInt(salesResult.rows[0]?.previous_sales || 0);

    const errorsQuery = `
      SELECT COUNT(*) as error_count
      FROM customer_subscriptions
      WHERE status = 'billing_error' OR status = 'past_due'
    `;
    const errorsResult = await pool.query(errorsQuery);
    const billingErrors = parseInt(errorsResult.rows[0]?.error_count || 0);

    // Acquisition Stats
    const signupsQuery = `
      SELECT 
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as current_signups,
        COUNT(CASE WHEN created_at >= $2 AND created_at < $1 THEN 1 END) as previous_signups
      FROM customer_users
      WHERE deleted_at IS NULL
    `;
    const signupsResult = await pool.query(signupsQuery, [periodStart, previous]);
    const currentSignups = parseInt(signupsResult.rows[0]?.current_signups || 0);
    const previousSignups = parseInt(signupsResult.rows[0]?.previous_signups || 0);

    const trialsQuery = `
      SELECT COUNT(*) as trial_count
      FROM customer_subscriptions
      WHERE status = 'trialing' OR status = 'trial'
    `;
    const trialsResult = await pool.query(trialsQuery);
    const trials = parseInt(trialsResult.rows[0]?.trial_count || 0);

    const firstPurchaseQuery = `
      SELECT COUNT(DISTINCT customer_user_id) as first_purchase_count
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

    const conversionRate = currentSignups > 0 ? Math.round((firstPurchase / currentSignups) * 100) : 0;

    // Retention Stats
    const cancellationsQuery = `
      SELECT 
        COUNT(CASE WHEN canceled_at >= $1 THEN 1 END) as current_cancellations,
        COUNT(CASE WHEN canceled_at >= $2 AND canceled_at < $1 THEN 1 END) as previous_cancellations
      FROM customer_subscriptions
      WHERE canceled_at IS NOT NULL
    `;
    const cancellationsResult = await pool.query(cancellationsQuery, [periodStart, previous]);
    const currentCancellations = parseInt(cancellationsResult.rows[0]?.current_cancellations || 0);
    const previousCancellations = parseInt(cancellationsResult.rows[0]?.previous_cancellations || 0);

    const churnRate = activeSubscribers > 0 ? Math.round((currentCancellations / activeSubscribers) * 100) : 0;

    const totalMembersQuery = `
      SELECT COUNT(*) as total_members
      FROM customer_users
      WHERE deleted_at IS NULL
    `;
    const totalMembersResult = await pool.query(totalMembersQuery);
    const totalMembers = parseInt(totalMembersResult.rows[0]?.total_members || 0);

    return {
      financial: {
        totalRevenue: currentRevenue,
        revenueChange: calculateChange(currentRevenue, previousRevenue),
        activeSubscribers,
        subscribersChange: 0, // Would need historical data
        salesCount: currentSales,
        salesChange: calculateChange(currentSales, previousSales),
        billingErrors,
        errorsChange: 0,
      },
      acquisition: {
        newSignups: currentSignups,
        signupsChange: calculateChange(currentSignups, previousSignups),
        trials,
        trialsChange: 0,
        firstPurchase,
        firstPurchaseChange: 0,
        conversionRate,
        conversionChange: 0,
      },
      retention: {
        cancellations: currentCancellations,
        cancellationsChange: calculateChange(currentCancellations, previousCancellations),
        churnRate,
        churnChange: 0,
        totalMembers,
        membersChange: 0,
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

