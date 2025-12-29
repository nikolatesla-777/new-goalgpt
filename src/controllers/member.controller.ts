/**
 * Member Controller
 * Handles member detail API requests
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

export async function getMemberDetailHandler(
    request: FastifyRequest<{ Params: MemberParams }>,
    reply: FastifyReply
) {
    try {
        const { id } = request.params;
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
