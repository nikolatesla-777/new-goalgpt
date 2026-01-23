"use strict";
/**
 * Telegram Alert Service
 *
 * Sends critical system alerts to Telegram chat for production monitoring.
 * Use this for OOM crashes, high sync gaps, worker failures, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertCritical = exports.alertWarning = exports.alertInfo = void 0;
exports.sendTelegramAlert = sendTelegramAlert;
exports.sendStartupAlert = sendStartupAlert;
exports.sendShutdownAlert = sendShutdownAlert;
exports.checkSyncGapAlert = checkSyncGapAlert;
const logger_1 = require("./logger");
// Configure via environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const ALERTS_ENABLED = process.env.ALERTS_ENABLED === 'true';
const SEVERITY_EMOJI = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
};
/**
 * Send an alert to Telegram
 */
async function sendTelegramAlert(payload) {
    if (!ALERTS_ENABLED) {
        logger_1.logger.debug('[TelegramAlert] Alerts disabled, skipping');
        return false;
    }
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        logger_1.logger.warn('[TelegramAlert] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
        return false;
    }
    const { severity, title, message, data } = payload;
    const emoji = SEVERITY_EMOJI[severity];
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    // Format message for Telegram
    let text = `${emoji} *GoalGPT Alert*\n\n`;
    text += `*${title}*\n`;
    text += `${message}\n`;
    if (data && Object.keys(data).length > 0) {
        text += '\n📊 *Details:*\n';
        for (const [key, value] of Object.entries(data)) {
            text += `• ${key}: \`${value}\`\n`;
        }
    }
    text += `\n🕐 ${timestamp}`;
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text,
                parse_mode: 'Markdown',
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            logger_1.logger.error('[TelegramAlert] Failed to send:', errorText);
            return false;
        }
        logger_1.logger.info(`[TelegramAlert] Sent ${severity} alert: ${title}`);
        return true;
    }
    catch (error) {
        logger_1.logger.error('[TelegramAlert] Error sending alert:', error.message);
        return false;
    }
}
// Convenience functions
const alertInfo = (title, message, data) => sendTelegramAlert({ severity: 'info', title, message, data });
exports.alertInfo = alertInfo;
const alertWarning = (title, message, data) => sendTelegramAlert({ severity: 'warning', title, message, data });
exports.alertWarning = alertWarning;
const alertCritical = (title, message, data) => sendTelegramAlert({ severity: 'critical', title, message, data });
exports.alertCritical = alertCritical;
// Send startup alert
async function sendStartupAlert() {
    const memUsage = process.memoryUsage();
    await (0, exports.alertInfo)('Backend Started', 'GoalGPT backend has started successfully.', {
        nodeVersion: process.version,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        platform: process.platform,
    });
}
// Send shutdown alert (call in graceful shutdown handler)
async function sendShutdownAlert(reason) {
    await (0, exports.alertWarning)('Backend Shutting Down', `Reason: ${reason}`, {
        uptime: `${Math.round(process.uptime())}s`,
    });
}
// Monitor sync gap periodically
async function checkSyncGapAlert(apiCount, dbCount) {
    const gap = apiCount - dbCount;
    if (gap >= 30) {
        await (0, exports.alertCritical)('Critical Sync Gap', `${gap} live matches missing from database!`, { apiMatches: apiCount, dbMatches: dbCount, gap });
    }
    else if (gap >= 15) {
        await (0, exports.alertWarning)('High Sync Gap', `${gap} live matches missing from database.`, { apiMatches: apiCount, dbMatches: dbCount, gap });
    }
}
