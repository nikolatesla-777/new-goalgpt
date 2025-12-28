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
