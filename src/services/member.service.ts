/**
 * Member Service
 * Business logic for member detail data
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

export interface MemberDetail {
    user: {
        id: string;
        email: string;
        fullName: string;
        phone: string;
        platform: string;
        createdAt: string;
        isVip: boolean;
        username: string;
    };
    ltv: {
        total: number;
        change: number;
        transactionCount: number;
    };
    subscription: {
        planName: string;
        status: string;
        expiresAt: string | null;
        startedAt: string | null;
        autoRenew: boolean;
        platform: string;
    } | null;
    segment: string;
    activity: {
        lastSeen: string | null;
        lastLoginIp: string | null;
        loginCount: number;
    };
    transactions: Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        planName: string;
        platform: string;
        createdAt: string;
    }>;
    timeline: Array<{
        type: string;
        title: string;
        description: string;
        date: string;
        icon: string;
    }>;
    notes: Array<{
        type: 'warning' | 'info' | 'success';
        message: string;
    }>;
}

export async function getMemberDetail(userId: string): Promise<MemberDetail | null> {
    const client = await pool.connect();

    try {
        // Get user basic info
        const userResult = await client.query(`
      SELECT 
        id, email, full_name, phone, registration_platform,
        created_at, is_vip, username, last_seen_at, last_login_ip
      FROM customer_users
      WHERE id = $1 OR public_id = $1
    `, [userId]);

        if (userResult.rows.length === 0) {
            return null;
        }

        const user = userResult.rows[0];

        // Get subscription info
        const subscriptionResult = await client.query(`
      SELECT 
        s.id, s.status, s.started_at, s.expired_at, s.platform,
        s.auto_renew_enabled, s.amount, s.currency,
        p.name as plan_name
      FROM customer_subscriptions s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.customer_user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [user.id]);

        const subscription = subscriptionResult.rows[0];

        // Get LTV (total spent)
        const ltvResult = await client.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as transaction_count
      FROM customer_subscriptions
      WHERE customer_user_id = $1
        AND status NOT IN ('canceled', 'expired', 'trialing', 'trial')
    `, [user.id]);

        const ltv = ltvResult.rows[0];

        // Get all transactions
        const transactionsResult = await client.query(`
      SELECT 
        s.id, s.amount, s.currency, s.status, s.platform, s.created_at,
        p.name as plan_name
      FROM customer_subscriptions s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.customer_user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 20
    `, [user.id]);

        // Get login count from sessions
        const sessionsResult = await client.query(`
      SELECT COUNT(*) as login_count
      FROM customer_sessions
      WHERE customer_user_id = $1
    `, [user.id]);

        // Determine segment
        let segment = 'new_user';
        if (subscription) {
            if (subscription.status === 'active') {
                segment = 'active_subscriber';
            } else if (subscription.status === 'trialing' || subscription.status === 'trial') {
                segment = 'trial';
            } else if (subscription.status === 'canceled') {
                segment = 'churned';
            } else if (subscription.status === 'expired') {
                segment = 'expired';
            }
        }

        // Check if first purchase
        const firstPurchaseCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM customer_subscriptions
      WHERE customer_user_id = $1
        AND status NOT IN ('trialing', 'trial')
    `, [user.id]);

        if (parseInt(firstPurchaseCheck.rows[0]?.count || 0) === 1 && subscription?.status === 'active') {
            segment = 'first_sale';
        }

        // Build timeline
        const timeline: MemberDetail['timeline'] = [];

        // Registration
        timeline.push({
            type: 'registration',
            title: 'Kayıt Oldu',
            description: `${user.registration_platform || 'Unknown'} platformunda kayıt tamamlandı`,
            date: user.created_at,
            icon: '👤'
        });

        // Add subscription events to timeline
        const allSubsResult = await client.query(`
      SELECT status, started_at, canceled_at, expired_at, created_at,
             (SELECT name FROM subscription_plans WHERE id = plan_id) as plan_name
      FROM customer_subscriptions
      WHERE customer_user_id = $1
      ORDER BY created_at ASC
    `, [user.id]);

        for (const sub of allSubsResult.rows) {
            if (sub.status === 'trialing' || sub.status === 'trial') {
                timeline.push({
                    type: 'trial',
                    title: 'Deneme Başladı',
                    description: `${sub.plan_name || 'Premium'} deneme sürümü başlatıldı`,
                    date: sub.started_at || sub.created_at,
                    icon: '🎯'
                });
            } else if (sub.status === 'active') {
                timeline.push({
                    type: 'purchase',
                    title: 'Satın Alma',
                    description: `${sub.plan_name || 'Premium'} aboneliği satın alındı`,
                    date: sub.started_at || sub.created_at,
                    icon: '💳'
                });
            }

            if (sub.canceled_at) {
                timeline.push({
                    type: 'cancellation',
                    title: 'İptal',
                    description: 'Abonelik iptal edildi',
                    date: sub.canceled_at,
                    icon: '❌'
                });
            }
        }

        // Build notes/warnings
        const notes: MemberDetail['notes'] = [];

        // Check for billing errors
        const billingErrorsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM customer_subscriptions
      WHERE customer_user_id = $1
        AND (status = 'billing_error' OR status = 'past_due')
    `, [user.id]);

        const billingErrors = parseInt(billingErrorsResult.rows[0]?.count || 0);
        if (billingErrors > 0) {
            notes.push({
                type: 'warning',
                message: `Bu kullanıcının ${billingErrors} ödeme hatası bulunmaktadır.`
            });
        }

        // VIP note
        if (user.is_vip) {
            notes.push({
                type: 'success',
                message: 'VIP kullanıcı'
            });
        }

        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name || '',
                phone: user.phone || '',
                platform: user.registration_platform || 'unknown',
                createdAt: user.created_at,
                isVip: user.is_vip || false,
                username: user.username || ''
            },
            ltv: {
                total: parseFloat(ltv?.total || 0),
                change: 0, // Would need historical data
                transactionCount: parseInt(ltv?.transaction_count || 0)
            },
            subscription: subscription ? {
                planName: subscription.plan_name || 'Premium',
                status: subscription.status,
                expiresAt: subscription.expired_at,
                startedAt: subscription.started_at,
                autoRenew: subscription.auto_renew_enabled || false,
                platform: subscription.platform || 'unknown'
            } : null,
            segment,
            activity: {
                lastSeen: user.last_seen_at,
                lastLoginIp: user.last_login_ip,
                loginCount: parseInt(sessionsResult.rows[0]?.login_count || 0)
            },
            transactions: transactionsResult.rows.map(t => ({
                id: t.id,
                amount: parseFloat(t.amount || 0),
                currency: t.currency || 'TRY',
                status: t.status,
                planName: t.plan_name || 'Premium',
                platform: t.platform || 'unknown',
                createdAt: t.created_at
            })),
            timeline: timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
            notes
        };
    } catch (error) {
        logger.error('Error fetching member detail:', error);
        throw error;
    } finally {
        client.release();
    }
}

export async function getMemberActivityLogs(userId: string, limit: number = 50): Promise<any[]> {
    const client = await pool.connect();

    try {
        // Get user ID first
        const userResult = await client.query(`
      SELECT id FROM customer_users WHERE id = $1 OR public_id = $1
    `, [userId]);

        if (userResult.rows.length === 0) {
            return [];
        }

        const internalUserId = userResult.rows[0].id;

        // Get session logs
        const sessionsResult = await client.query(`
      SELECT 
        id, created_at, ip_address, user_agent, device_type
      FROM customer_sessions
      WHERE customer_user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [internalUserId, limit]);

        return sessionsResult.rows.map(s => ({
            id: s.id,
            type: 'session',
            title: 'Giriş Yapıldı',
            description: `${s.device_type || 'Unknown'} cihazından giriş`,
            ip: s.ip_address,
            userAgent: s.user_agent,
            createdAt: s.created_at
        }));
    } catch (error) {
        logger.error('Error fetching member activity logs:', error);
        return [];
    } finally {
        client.release();
    }
}
