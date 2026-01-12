/**
 * Partners Service - Partner/Bayi Program Management
 *
 * Partner program for business affiliates:
 * - 20% commission on subscriptions from their referral code
 * - Dedicated partner dashboard
 * - Monthly payouts
 * - Analytics tracking
 */

import { db } from '../database/kysely';
import { sql } from 'kysely';
import { generateReferralCode } from './referrals.service';

// Partner status types
export type PartnerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

// Partner interface
export interface Partner {
  id: string;
  customer_user_id: string;
  business_name: string;
  tax_id: string | null;
  phone: string;
  email: string;
  address: string | null;
  status: PartnerStatus;
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

// Partner application data
export interface PartnerApplicationData {
  userId: string;
  businessName: string;
  taxId?: string;
  phone: string;
  email: string;
  address?: string;
  notes?: string;
}

// Partner analytics
export interface PartnerAnalytics {
  date: Date;
  newSignups: number;
  newSubscriptions: number;
  revenue: number;
  commission: number;
  activeSubscribers: number;
  churnCount: number;
}

/**
 * Apply for partnership program
 */
export async function applyForPartnership(data: PartnerApplicationData): Promise<Partner> {
  return db.transaction().execute(async (trx) => {
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
    let partnerCode: string;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      partnerCode = `PARTNER-${generateReferralCode().split('-')[1]}`; // e.g., PARTNER-A3B7K

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
        referral_code: partnerCode!,
        total_referrals: 0,
        total_subscriptions: 0,
        total_revenue: 0.0,
        total_commission: 0.0,
        last_payout_at: null,
        approved_at: null,
        approved_by: null,
        rejection_reason: null,
        notes: data.notes || null,
        created_at: sql`NOW()`,
        updated_at: sql`NOW()`,
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

    return partner as any;
  });
}

/**
 * Approve partner application
 */
export async function approvePartner(
  partnerId: string,
  approvedBy: string,
  notes?: string
): Promise<Partner> {
  const partner = await db
    .updateTable('partners')
    .set({
      status: 'approved',
      approved_at: sql`NOW()`,
      approved_by: approvedBy,
      notes: notes || sql`notes`,
      updated_at: sql`NOW()`,
    })
    .where('id', '=', partnerId)
    .where('status', '=', 'pending')
    .returning(['id', 'customer_user_id', 'business_name', 'status', 'referral_code'])
    .executeTakeFirst();

  if (!partner) {
    throw new Error('Partner not found or already processed');
  }

  // TODO: Send approval email/notification

  return partner as any;
}

/**
 * Reject partner application
 */
export async function rejectPartner(
  partnerId: string,
  rejectedBy: string,
  reason: string
): Promise<void> {
  const result = await db
    .updateTable('partners')
    .set({
      status: 'rejected',
      rejection_reason: reason,
      notes: sql`CONCAT(COALESCE(notes, ''), '\nRejected by: ', ${rejectedBy}, ' - ', ${reason})`,
      updated_at: sql`NOW()`,
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
export async function suspendPartner(partnerId: string, reason: string): Promise<void> {
  const result = await db
    .updateTable('partners')
    .set({
      status: 'suspended',
      notes: sql`CONCAT(COALESCE(notes, ''), '\nSuspended: ', ${reason})`,
      updated_at: sql`NOW()`,
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
export async function reactivatePartner(partnerId: string): Promise<void> {
  const result = await db
    .updateTable('partners')
    .set({
      status: 'approved',
      notes: sql`CONCAT(COALESCE(notes, ''), '\nReactivated at: ', NOW())`,
      updated_at: sql`NOW()`,
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
export async function getPartnerByUserId(userId: string): Promise<Partner | undefined> {
  const partner = await db
    .selectFrom('partners')
    .selectAll()
    .where('customer_user_id', '=', userId)
    .executeTakeFirst();

  return partner as Partner | undefined;
}

/**
 * Get partner profile by ID
 */
export async function getPartnerById(partnerId: string): Promise<Partner | undefined> {
  const partner = await db
    .selectFrom('partners')
    .selectAll()
    .where('id', '=', partnerId)
    .executeTakeFirst();

  return partner as Partner | undefined;
}

/**
 * Get partner profile by referral code
 */
export async function getPartnerByReferralCode(code: string): Promise<Partner | undefined> {
  const partner = await db
    .selectFrom('partners')
    .selectAll()
    .where('referral_code', '=', code)
    .executeTakeFirst();

  return partner as Partner | undefined;
}

/**
 * Get all partners (admin)
 */
export async function getAllPartners(
  status?: PartnerStatus,
  limit: number = 50,
  offset: number = 0
) {
  let query = db
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
export async function getPartnerAnalytics(
  partnerId: string,
  startDate: Date,
  endDate: Date
): Promise<PartnerAnalytics[]> {
  const analytics = await db
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
export async function getPartnerStats(partnerId: string) {
  const partner = await getPartnerById(partnerId);
  if (!partner) {
    throw new Error('Partner not found');
  }

  // Get this month's stats
  const thisMonth = await db
    .selectFrom('partner_analytics')
    .select([
      sql<number>`SUM(new_signups)`.as('signups'),
      sql<number>`SUM(new_subscriptions)`.as('subscriptions'),
      sql<number>`SUM(revenue)`.as('revenue'),
      sql<number>`SUM(commission)`.as('commission'),
    ])
    .where('partner_id', '=', partnerId)
    .where('date', '>=', new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    .executeTakeFirst();

  // Get last month's stats
  const lastMonth = await db
    .selectFrom('partner_analytics')
    .select([
      sql<number>`SUM(new_signups)`.as('signups'),
      sql<number>`SUM(new_subscriptions)`.as('subscriptions'),
      sql<number>`SUM(revenue)`.as('revenue'),
      sql<number>`SUM(commission)`.as('commission'),
    ])
    .where('partner_id', '=', partnerId)
    .where(
      'date',
      '>=',
      new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    )
    .where(
      'date',
      '<',
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    )
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
export async function trackPartnerSubscription(
  partnerCode: string,
  subscriptionRevenue: number
): Promise<void> {
  const partner = await getPartnerByReferralCode(partnerCode);
  if (!partner) {
    throw new Error('Partner not found');
  }

  const commission = (subscriptionRevenue * partner.commission_rate) / 100;

  // Update partner totals
  await db
    .updateTable('partners')
    .set({
      total_subscriptions: sql`total_subscriptions + 1`,
      total_revenue: sql`total_revenue + ${subscriptionRevenue}`,
      total_commission: sql`total_commission + ${commission}`,
      updated_at: sql`NOW()`,
    })
    .where('id', '=', partner.id)
    .execute();

  // Update today's analytics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db
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
      created_at: sql`NOW()`,
    })
    .onConflict((oc) =>
      oc.columns(['partner_id', 'date']).doUpdateSet({
        new_subscriptions: sql`partner_analytics.new_subscriptions + 1`,
        revenue: sql`partner_analytics.revenue + ${subscriptionRevenue}`,
        commission: sql`partner_analytics.commission + ${commission}`,
      })
    )
    .execute();
}

/**
 * Update partner commission rate (admin)
 */
export async function updateCommissionRate(
  partnerId: string,
  newRate: number
): Promise<void> {
  if (newRate < 0 || newRate > 100) {
    throw new Error('Commission rate must be between 0 and 100');
  }

  const result = await db
    .updateTable('partners')
    .set({
      commission_rate: newRate,
      updated_at: sql`NOW()`,
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
export async function getPendingApplications(limit: number = 50) {
  return await db
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
