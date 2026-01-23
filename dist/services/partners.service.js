"use strict";
/**
 * Partners Service - Partner/Bayi Program Management
 *
 * Partner program for business affiliates:
 * - 20% commission on subscriptions from their referral code
 * - Dedicated partner dashboard
 * - Monthly payouts
 * - Analytics tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyForPartnership = applyForPartnership;
exports.approvePartner = approvePartner;
exports.rejectPartner = rejectPartner;
exports.suspendPartner = suspendPartner;
exports.reactivatePartner = reactivatePartner;
exports.getPartnerByUserId = getPartnerByUserId;
exports.getPartnerById = getPartnerById;
exports.getPartnerByReferralCode = getPartnerByReferralCode;
exports.getAllPartners = getAllPartners;
exports.getPartnerAnalytics = getPartnerAnalytics;
exports.getPartnerStats = getPartnerStats;
exports.trackPartnerSubscription = trackPartnerSubscription;
exports.updateCommissionRate = updateCommissionRate;
exports.getPendingApplications = getPendingApplications;
const kysely_1 = require("../database/kysely");
const kysely_2 = require("kysely");
const referrals_service_1 = require("./referrals.service");
/**
 * Apply for partnership program
 */
async function applyForPartnership(data) {
    return kysely_1.db.transaction().execute(async (trx) => {
        // 1. Check if user already has a partner account
        const existingPartner = await trx
            .selectFrom('partners')
            .select('id')
            .where('customer_user_id', '=', data.userId)
            .executeTakeFirst();
        if (existingPartner) {
            throw new Error('User already has a partner account');
        }
        // 2. Generate unique partner referral code
        let partnerCode;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
            partnerCode = `PARTNER-${(0, referrals_service_1.generateReferralCode)().split('-')[1]}`; // e.g., PARTNER-A3B7K
            const existing = await trx
                .selectFrom('partners')
                .select('id')
                .where('referral_code', '=', partnerCode)
                .executeTakeFirst();
            if (!existing) {
                isUnique = true;
                break;
            }
            attempts++;
        }
        if (!isUnique) {
            throw new Error('Failed to generate unique partner code');
        }
        // 3. Create partner record
        const partner = await trx
            .insertInto('partners')
            .values({
            customer_user_id: data.userId,
            business_name: data.businessName,
            tax_id: data.taxId || null,
            phone: data.phone,
            email: data.email,
            address: data.address || null,
            status: 'pending',
            commission_rate: 20.0, // Default 20%
            referral_code: partnerCode,
            total_referrals: 0,
            total_subscriptions: 0,
            total_revenue: 0.0,
            total_commission: 0.0,
            last_payout_at: null,
            approved_at: null,
            approved_by: null,
            rejection_reason: null,
            notes: data.notes || null,
            created_at: (0, kysely_2.sql) `NOW()`,
            updated_at: (0, kysely_2.sql) `NOW()`,
        })
            .returning([
            'id',
            'customer_user_id',
            'business_name',
            'phone',
            'email',
            'status',
            'referral_code',
            'created_at',
        ])
            .executeTakeFirstOrThrow();
        return partner;
    });
}
/**
 * Approve partner application
 */
async function approvePartner(partnerId, approvedBy, notes) {
    const partner = await kysely_1.db
        .updateTable('partners')
        .set({
        status: 'approved',
        approved_at: (0, kysely_2.sql) `NOW()`,
        approved_by: approvedBy,
        notes: notes || (0, kysely_2.sql) `notes`,
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', partnerId)
        .where('status', '=', 'pending')
        .returning(['id', 'customer_user_id', 'business_name', 'status', 'referral_code'])
        .executeTakeFirst();
    if (!partner) {
        throw new Error('Partner not found or already processed');
    }
    // TODO: Send approval email/notification
    return partner;
}
/**
 * Reject partner application
 */
async function rejectPartner(partnerId, rejectedBy, reason) {
    const result = await kysely_1.db
        .updateTable('partners')
        .set({
        status: 'rejected',
        rejection_reason: reason,
        notes: (0, kysely_2.sql) `CONCAT(COALESCE(notes, ''), '\nRejected by: ', ${rejectedBy}, ' - ', ${reason})`,
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', partnerId)
        .where('status', '=', 'pending')
        .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
        throw new Error('Partner not found or already processed');
    }
    // TODO: Send rejection email/notification
}
/**
 * Suspend partner account
 */
async function suspendPartner(partnerId, reason) {
    const result = await kysely_1.db
        .updateTable('partners')
        .set({
        status: 'suspended',
        notes: (0, kysely_2.sql) `CONCAT(COALESCE(notes, ''), '\nSuspended: ', ${reason})`,
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', partnerId)
        .where('status', '=', 'approved')
        .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
        throw new Error('Partner not found or not approved');
    }
}
/**
 * Reactivate suspended partner
 */
async function reactivatePartner(partnerId) {
    const result = await kysely_1.db
        .updateTable('partners')
        .set({
        status: 'approved',
        notes: (0, kysely_2.sql) `CONCAT(COALESCE(notes, ''), '\nReactivated at: ', NOW())`,
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', partnerId)
        .where('status', '=', 'suspended')
        .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
        throw new Error('Partner not found or not suspended');
    }
}
/**
 * Get partner profile by user ID
 */
async function getPartnerByUserId(userId) {
    const partner = await kysely_1.db
        .selectFrom('partners')
        .selectAll()
        .where('customer_user_id', '=', userId)
        .executeTakeFirst();
    return partner;
}
/**
 * Get partner profile by ID
 */
async function getPartnerById(partnerId) {
    const partner = await kysely_1.db
        .selectFrom('partners')
        .selectAll()
        .where('id', '=', partnerId)
        .executeTakeFirst();
    return partner;
}
/**
 * Get partner profile by referral code
 */
async function getPartnerByReferralCode(code) {
    const partner = await kysely_1.db
        .selectFrom('partners')
        .selectAll()
        .where('referral_code', '=', code)
        .executeTakeFirst();
    return partner;
}
/**
 * Get all partners (admin)
 */
async function getAllPartners(status, limit = 50, offset = 0) {
    let query = kysely_1.db
        .selectFrom('partners as p')
        .innerJoin('customer_users as cu', 'cu.id', 'p.customer_user_id')
        .select([
        'p.id',
        'p.business_name',
        'p.phone',
        'p.email',
        'p.status',
        'p.commission_rate',
        'p.referral_code',
        'p.total_referrals',
        'p.total_subscriptions',
        'p.total_revenue',
        'p.total_commission',
        'p.created_at',
        'p.approved_at',
        'cu.full_name as owner_name',
    ])
        .orderBy('p.created_at', 'desc')
        .limit(limit)
        .offset(offset);
    if (status) {
        query = query.where('p.status', '=', status);
    }
    return await query.execute();
}
/**
 * Get partner analytics (daily breakdown)
 */
async function getPartnerAnalytics(partnerId, startDate, endDate) {
    const analytics = await kysely_1.db
        .selectFrom('partner_analytics')
        .selectAll()
        .where('partner_id', '=', partnerId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date', 'desc')
        .execute();
    return analytics.map((a) => ({
        date: a.date,
        newSignups: a.new_signups,
        newSubscriptions: a.new_subscriptions,
        revenue: Number(a.revenue),
        commission: Number(a.commission),
        activeSubscribers: a.active_subscribers,
        churnCount: a.churn_count,
    }));
}
/**
 * Get partner summary statistics
 */
async function getPartnerStats(partnerId) {
    const partner = await getPartnerById(partnerId);
    if (!partner) {
        throw new Error('Partner not found');
    }
    // Get this month's stats
    const thisMonth = await kysely_1.db
        .selectFrom('partner_analytics')
        .select([
        (0, kysely_2.sql) `SUM(new_signups)`.as('signups'),
        (0, kysely_2.sql) `SUM(new_subscriptions)`.as('subscriptions'),
        (0, kysely_2.sql) `SUM(revenue)`.as('revenue'),
        (0, kysely_2.sql) `SUM(commission)`.as('commission'),
    ])
        .where('partner_id', '=', partnerId)
        .where('date', '>=', new Date(new Date().getFullYear(), new Date().getMonth(), 1))
        .executeTakeFirst();
    // Get last month's stats
    const lastMonth = await kysely_1.db
        .selectFrom('partner_analytics')
        .select([
        (0, kysely_2.sql) `SUM(new_signups)`.as('signups'),
        (0, kysely_2.sql) `SUM(new_subscriptions)`.as('subscriptions'),
        (0, kysely_2.sql) `SUM(revenue)`.as('revenue'),
        (0, kysely_2.sql) `SUM(commission)`.as('commission'),
    ])
        .where('partner_id', '=', partnerId)
        .where('date', '>=', new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1))
        .where('date', '<', new Date(new Date().getFullYear(), new Date().getMonth(), 1))
        .executeTakeFirst();
    return {
        lifetime: {
            totalReferrals: partner.total_referrals,
            totalSubscriptions: partner.total_subscriptions,
            totalRevenue: Number(partner.total_revenue),
            totalCommission: Number(partner.total_commission),
        },
        thisMonth: {
            signups: Number(thisMonth?.signups || 0),
            subscriptions: Number(thisMonth?.subscriptions || 0),
            revenue: Number(thisMonth?.revenue || 0),
            commission: Number(thisMonth?.commission || 0),
        },
        lastMonth: {
            signups: Number(lastMonth?.signups || 0),
            subscriptions: Number(lastMonth?.subscriptions || 0),
            revenue: Number(lastMonth?.revenue || 0),
            commission: Number(lastMonth?.commission || 0),
        },
        commissionRate: Number(partner.commission_rate),
        lastPayoutAt: partner.last_payout_at,
    };
}
/**
 * Track partner subscription (called when subscription created with partner code)
 */
async function trackPartnerSubscription(partnerCode, subscriptionRevenue) {
    const partner = await getPartnerByReferralCode(partnerCode);
    if (!partner) {
        throw new Error('Partner not found');
    }
    const commission = (subscriptionRevenue * partner.commission_rate) / 100;
    // Update partner totals
    await kysely_1.db
        .updateTable('partners')
        .set({
        total_subscriptions: (0, kysely_2.sql) `total_subscriptions + 1`,
        total_revenue: (0, kysely_2.sql) `total_revenue + ${subscriptionRevenue}`,
        total_commission: (0, kysely_2.sql) `total_commission + ${commission}`,
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', partner.id)
        .execute();
    // Update today's analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await kysely_1.db
        .insertInto('partner_analytics')
        .values({
        partner_id: partner.id,
        date: today,
        new_signups: 0,
        new_subscriptions: 1,
        revenue: subscriptionRevenue,
        commission,
        active_subscribers: 0,
        churn_count: 0,
        created_at: (0, kysely_2.sql) `NOW()`,
    })
        .onConflict((oc) => oc.columns(['partner_id', 'date']).doUpdateSet({
        new_subscriptions: (0, kysely_2.sql) `partner_analytics.new_subscriptions + 1`,
        revenue: (0, kysely_2.sql) `partner_analytics.revenue + ${subscriptionRevenue}`,
        commission: (0, kysely_2.sql) `partner_analytics.commission + ${commission}`,
    }))
        .execute();
}
/**
 * Update partner commission rate (admin)
 */
async function updateCommissionRate(partnerId, newRate) {
    if (newRate < 0 || newRate > 100) {
        throw new Error('Commission rate must be between 0 and 100');
    }
    const result = await kysely_1.db
        .updateTable('partners')
        .set({
        commission_rate: newRate,
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', partnerId)
        .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
        throw new Error('Partner not found');
    }
}
/**
 * Get pending partner applications (admin)
 */
async function getPendingApplications(limit = 50) {
    return await kysely_1.db
        .selectFrom('partners as p')
        .innerJoin('customer_users as cu', 'cu.id', 'p.customer_user_id')
        .select([
        'p.id',
        'p.business_name',
        'p.tax_id',
        'p.phone',
        'p.email',
        'p.address',
        'p.notes',
        'p.created_at',
        'cu.full_name as owner_name',
        'cu.username',
    ])
        .where('p.status', '=', 'pending')
        .orderBy('p.created_at', 'asc')
        .limit(limit)
        .execute();
}
