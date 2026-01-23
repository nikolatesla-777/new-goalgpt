/**
 * Member Controller
 * Handles member detail API requests
 *
 * SECURITY: IDOR protection - users can only access their own data
 * Admins can access any member data
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getMemberDetail, getMemberActivityLogs } from '../services/member.service';
import { logger } from '../utils/logger';

interface MemberParams {
    id: string;
}

interface ActivityQuerystring {
    limit?: string;
}

// Type for authenticated request with user info
interface AuthenticatedRequest extends FastifyRequest<{ Params: MemberParams }> {
    user?: {
        userId: string;
        role?: string;
    };
}

/**
 * Check if user has access to member data (IDOR protection)
 * - User can access own data
 * - Admin can access any data
 */
function hasAccessToMember(request: AuthenticatedRequest, memberId: string): boolean {
    const user = request.user;
    if (!user) return false;

    // Admin can access any member
    if (user.role === 'admin') return true;

    // User can only access own data
    return user.userId === memberId;
}

export async function getMemberDetailHandler(
    request: FastifyRequest<{ Params: MemberParams }>,
    reply: FastifyReply
) {
    try {
        const { id } = request.params;
        const authRequest = request as AuthenticatedRequest;

        // SECURITY: IDOR check - verify user has access to this member
        if (!hasAccessToMember(authRequest, id)) {
            logger.warn(`IDOR attempt: User ${authRequest.user?.userId} tried to access member ${id}`);
            return reply.status(403).send({
                success: false,
                error: 'Forbidden',
                message: 'You can only access your own member data'
            });
        }

        const memberDetail = await getMemberDetail(id);

        if (!memberDetail) {
            return reply.status(404).send({
                success: false,
                error: 'Member not found'
            });
        }

        return reply.send({
            success: true,
            data: memberDetail
        });
    } catch (error: any) {
        logger.error('Member detail error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch member detail',
            message: error.message
        });
    }
}

export async function getMemberActivityHandler(
    request: FastifyRequest<{ Params: MemberParams; Querystring: ActivityQuerystring }>,
    reply: FastifyReply
) {
    try {
        const { id } = request.params;
        const authRequest = request as AuthenticatedRequest;

        // SECURITY: IDOR check - verify user has access to this member's activity
        if (!hasAccessToMember(authRequest, id)) {
            logger.warn(`IDOR attempt: User ${authRequest.user?.userId} tried to access activity of member ${id}`);
            return reply.status(403).send({
                success: false,
                error: 'Forbidden',
                message: 'You can only access your own activity logs'
            });
        }

        const limit = parseInt(request.query.limit || '50');
        const logs = await getMemberActivityLogs(id, limit);

        return reply.send({
            success: true,
            data: logs,
            total: logs.length
        });
    } catch (error: any) {
        logger.error('Member activity error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch member activity',
            message: error.message
        });
    }
}
