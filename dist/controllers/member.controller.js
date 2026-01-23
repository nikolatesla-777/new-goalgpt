"use strict";
/**
 * Member Controller
 * Handles member detail API requests
 *
 * SECURITY: IDOR protection - users can only access their own data
 * Admins can access any member data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemberDetailHandler = getMemberDetailHandler;
exports.getMemberActivityHandler = getMemberActivityHandler;
const member_service_1 = require("../services/member.service");
const logger_1 = require("../utils/logger");
/**
 * Check if user has access to member data (IDOR protection)
 * - User can access own data
 * - Admin can access any data
 */
function hasAccessToMember(request, memberId) {
    const user = request.user;
    if (!user)
        return false;
    // Admin can access any member
    if (user.role === 'admin')
        return true;
    // User can only access own data
    return user.userId === memberId;
}
async function getMemberDetailHandler(request, reply) {
    try {
        const { id } = request.params;
        const authRequest = request;
        // SECURITY: IDOR check - verify user has access to this member
        if (!hasAccessToMember(authRequest, id)) {
            logger_1.logger.warn(`IDOR attempt: User ${authRequest.user?.userId} tried to access member ${id}`);
            return reply.status(403).send({
                success: false,
                error: 'Forbidden',
                message: 'You can only access your own member data'
            });
        }
        const memberDetail = await (0, member_service_1.getMemberDetail)(id);
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
    }
    catch (error) {
        logger_1.logger.error('Member detail error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch member detail',
            message: error.message
        });
    }
}
async function getMemberActivityHandler(request, reply) {
    try {
        const { id } = request.params;
        const authRequest = request;
        // SECURITY: IDOR check - verify user has access to this member's activity
        if (!hasAccessToMember(authRequest, id)) {
            logger_1.logger.warn(`IDOR attempt: User ${authRequest.user?.userId} tried to access activity of member ${id}`);
            return reply.status(403).send({
                success: false,
                error: 'Forbidden',
                message: 'You can only access your own activity logs'
            });
        }
        const limit = parseInt(request.query.limit || '50');
        const logs = await (0, member_service_1.getMemberActivityLogs)(id, limit);
        return reply.send({
            success: true,
            data: logs,
            total: logs.length
        });
    }
    catch (error) {
        logger_1.logger.error('Member activity error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch member activity',
            message: error.message
        });
    }
}
