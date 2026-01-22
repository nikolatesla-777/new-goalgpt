/**
 * Announcements Service - Admin Popup Management
 * 
 * Features:
 * - Create/Update/Delete announcements from admin panel
 * - Fetch active announcements for mobile app
 * - Target specific user groups (all, vip, free)
 * - Schedule announcements with start/end dates
 * - Track dismissals per user
 */

import { db } from '../database/kysely';
import { sql } from 'kysely';

// ============================================================================
// TYPES
// ============================================================================

export type AnnouncementTarget = 'all' | 'vip' | 'free' | 'new_users';
export type AnnouncementType = 'popup' | 'banner' | 'fullscreen';
export type AnnouncementStatus = 'draft' | 'active' | 'scheduled' | 'expired';

export interface Announcement {
    id: string;
    title: string;
    message: string;
    image_url: string | null;
    button_text: string | null;
    button_url: string | null;
    button_action: 'url' | 'screen' | 'dismiss' | null;
    target_audience: AnnouncementTarget;
    announcement_type: AnnouncementType;
    status: AnnouncementStatus;
    priority: number;
    show_once: boolean;
    start_date: Date | null;
    end_date: Date | null;
    created_by: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateAnnouncementInput {
    title: string;
    message: string;
    image_url?: string;
    button_text?: string;
    button_url?: string;
    button_action?: 'url' | 'screen' | 'dismiss';
    target_audience?: AnnouncementTarget;
    announcement_type?: AnnouncementType;
    priority?: number;
    show_once?: boolean;
    start_date?: Date | string;
    end_date?: Date | string;
}

export interface UpdateAnnouncementInput extends Partial<CreateAnnouncementInput> {
    status?: AnnouncementStatus;
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Create a new announcement
 */
export async function createAnnouncement(
    input: CreateAnnouncementInput,
    adminUserId?: string
): Promise<Announcement> {
    const now = new Date();

    // Determine status based on dates
    let status: AnnouncementStatus = 'draft';
    if (input.start_date) {
        const startDate = new Date(input.start_date);
        if (startDate <= now) {
            status = 'active';
        } else {
            status = 'scheduled';
        }
    }

    const announcement = await db
        .insertInto('announcements')
        .values({
            title: input.title,
            message: input.message,
            image_url: input.image_url || null,
            button_text: input.button_text || null,
            button_url: input.button_url || null,
            button_action: input.button_action || null,
            target_audience: input.target_audience || 'all',
            announcement_type: input.announcement_type || 'popup',
            status,
            priority: input.priority || 0,
            show_once: input.show_once ?? true,
            start_date: input.start_date ? new Date(input.start_date) : null,
            end_date: input.end_date ? new Date(input.end_date) : null,
            created_by: adminUserId || null,
            created_at: now,
            updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return announcement as Announcement;
}

/**
 * Update an announcement
 */
export async function updateAnnouncement(
    id: string,
    input: UpdateAnnouncementInput
): Promise<Announcement | null> {
    const updateData: Record<string, any> = {
        updated_at: new Date(),
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.message !== undefined) updateData.message = input.message;
    if (input.image_url !== undefined) updateData.image_url = input.image_url;
    if (input.button_text !== undefined) updateData.button_text = input.button_text;
    if (input.button_url !== undefined) updateData.button_url = input.button_url;
    if (input.button_action !== undefined) updateData.button_action = input.button_action;
    if (input.target_audience !== undefined) updateData.target_audience = input.target_audience;
    if (input.announcement_type !== undefined) updateData.announcement_type = input.announcement_type;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.show_once !== undefined) updateData.show_once = input.show_once;
    if (input.start_date !== undefined) updateData.start_date = input.start_date ? new Date(input.start_date) : null;
    if (input.end_date !== undefined) updateData.end_date = input.end_date ? new Date(input.end_date) : null;

    const result = await db
        .updateTable('announcements')
        .set(updateData)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

    return result as Announcement | null;
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(id: string): Promise<boolean> {
    const result = await db
        .deleteFrom('announcements')
        .where('id', '=', id)
        .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
}

/**
 * Get all announcements (admin)
 */
export async function getAllAnnouncements(
    limit: number = 50,
    offset: number = 0
): Promise<Announcement[]> {
    const announcements = await db
        .selectFrom('announcements')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();

    return announcements as Announcement[];
}

/**
 * Get announcement by ID
 */
export async function getAnnouncementById(id: string): Promise<Announcement | null> {
    const announcement = await db
        .selectFrom('announcements')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();

    return announcement as Announcement | null;
}

// ============================================================================
// MOBILE APP FUNCTIONS
// ============================================================================

/**
 * Get active announcements for a user
 */
export async function getActiveAnnouncementsForUser(
    userId: string,
    isVip: boolean = false
): Promise<Announcement[]> {
    const now = new Date();

    // Determine target audiences based on user status
    const targets: AnnouncementTarget[] = ['all'];
    if (isVip) {
        targets.push('vip');
    } else {
        targets.push('free');
    }

    // Get announcements that:
    // 1. Are active
    // 2. Match user's target audience
    // 3. Are within date range (if specified)
    // 4. Haven't been dismissed by user (if show_once)
    const announcements = await db
        .selectFrom('announcements as a')
        .leftJoin('announcement_dismissals as ad', (join) =>
            join
                .onRef('ad.announcement_id', '=', 'a.id')
                .on('ad.user_id', '=', userId)
        )
        .selectAll('a')
        .where('a.status', '=', 'active')
        .where('a.target_audience', 'in', targets)
        .where((eb) =>
            eb.or([
                eb('a.start_date', 'is', null),
                eb('a.start_date', '<=', now),
            ])
        )
        .where((eb) =>
            eb.or([
                eb('a.end_date', 'is', null),
                eb('a.end_date', '>=', now),
            ])
        )
        .where((eb) =>
            eb.or([
                eb('a.show_once', '=', false),
                eb('ad.id', 'is', null), // Not dismissed yet
            ])
        )
        .orderBy('a.priority', 'desc')
        .orderBy('a.created_at', 'desc')
        .execute();

    return announcements as Announcement[];
}

/**
 * Dismiss an announcement for a user
 */
export async function dismissAnnouncement(
    userId: string,
    announcementId: string
): Promise<boolean> {
    try {
        await db
            .insertInto('announcement_dismissals')
            .values({
                user_id: userId,
                announcement_id: announcementId,
                dismissed_at: sql`NOW()`,
            })
            .onConflict((oc) =>
                oc.columns(['user_id', 'announcement_id']).doNothing()
            )
            .execute();

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Update announcement statuses (cron job)
 * - Activate scheduled announcements
 * - Expire ended announcements
 */
export async function updateAnnouncementStatuses(): Promise<{
    activated: number;
    expired: number;
}> {
    const now = new Date();

    // Activate scheduled announcements
    const activatedResult = await db
        .updateTable('announcements')
        .set({ status: 'active', updated_at: now })
        .where('status', '=', 'scheduled')
        .where('start_date', '<=', now)
        .executeTakeFirst();

    // Expire ended announcements
    const expiredResult = await db
        .updateTable('announcements')
        .set({ status: 'expired', updated_at: now })
        .where('status', '=', 'active')
        .where('end_date', '<', now)
        .executeTakeFirst();

    return {
        activated: Number(activatedResult.numUpdatedRows || 0),
        expired: Number(expiredResult.numUpdatedRows || 0),
    };
}

/**
 * Get announcement statistics
 */
export async function getAnnouncementStats() {
    const stats = await db
        .selectFrom('announcements')
        .select([
            sql<number>`COUNT(*)`.as('total'),
            sql<number>`COUNT(*) FILTER (WHERE status = 'active')`.as('active'),
            sql<number>`COUNT(*) FILTER (WHERE status = 'scheduled')`.as('scheduled'),
            sql<number>`COUNT(*) FILTER (WHERE status = 'draft')`.as('draft'),
            sql<number>`COUNT(*) FILTER (WHERE status = 'expired')`.as('expired'),
        ])
        .executeTakeFirst();

    const dismissalStats = await db
        .selectFrom('announcement_dismissals')
        .select([
            sql<number>`COUNT(DISTINCT user_id)`.as('unique_users'),
            sql<number>`COUNT(*)`.as('total_dismissals'),
        ])
        .executeTakeFirst();

    return {
        total: Number(stats?.total || 0),
        active: Number(stats?.active || 0),
        scheduled: Number(stats?.scheduled || 0),
        draft: Number(stats?.draft || 0),
        expired: Number(stats?.expired || 0),
        uniqueUsersDismissed: Number(dismissalStats?.unique_users || 0),
        totalDismissals: Number(dismissalStats?.total_dismissals || 0),
    };
}
