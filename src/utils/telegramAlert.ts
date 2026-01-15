/**
 * Telegram Alert Service
 * 
 * Sends critical system alerts to Telegram chat for production monitoring.
 * Use this for OOM crashes, high sync gaps, worker failures, etc.
 */

import { logger } from './logger';

// Configure via environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const ALERTS_ENABLED = process.env.ALERTS_ENABLED === 'true';

type AlertSeverity = 'info' | 'warning' | 'critical';

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
};

interface AlertPayload {
    severity: AlertSeverity;
    title: string;
    message: string;
    data?: Record<string, any>;
}

/**
 * Send an alert to Telegram
 */
export async function sendTelegramAlert(payload: AlertPayload): Promise<boolean> {
    if (!ALERTS_ENABLED) {
        logger.debug('[TelegramAlert] Alerts disabled, skipping');
        return false;
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        logger.warn('[TelegramAlert] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
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
            logger.error('[TelegramAlert] Failed to send:', errorText);
            return false;
        }

        logger.info(`[TelegramAlert] Sent ${severity} alert: ${title}`);
        return true;
    } catch (error: any) {
        logger.error('[TelegramAlert] Error sending alert:', error.message);
        return false;
    }
}

// Convenience functions
export const alertInfo = (title: string, message: string, data?: Record<string, any>) =>
    sendTelegramAlert({ severity: 'info', title, message, data });

export const alertWarning = (title: string, message: string, data?: Record<string, any>) =>
    sendTelegramAlert({ severity: 'warning', title, message, data });

export const alertCritical = (title: string, message: string, data?: Record<string, any>) =>
    sendTelegramAlert({ severity: 'critical', title, message, data });

// Send startup alert
export async function sendStartupAlert(): Promise<void> {
    const memUsage = process.memoryUsage();
    await alertInfo(
        'Backend Started',
        'GoalGPT backend has started successfully.',
        {
            nodeVersion: process.version,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            platform: process.platform,
        }
    );
}

// Send shutdown alert (call in graceful shutdown handler)
export async function sendShutdownAlert(reason: string): Promise<void> {
    await alertWarning(
        'Backend Shutting Down',
        `Reason: ${reason}`,
        {
            uptime: `${Math.round(process.uptime())}s`,
        }
    );
}

// Monitor sync gap periodically
export async function checkSyncGapAlert(apiCount: number, dbCount: number): Promise<void> {
    const gap = apiCount - dbCount;

    if (gap >= 30) {
        await alertCritical(
            'Critical Sync Gap',
            `${gap} live matches missing from database!`,
            { apiMatches: apiCount, dbMatches: dbCount, gap }
        );
    } else if (gap >= 15) {
        await alertWarning(
            'High Sync Gap',
            `${gap} live matches missing from database.`,
            { apiMatches: apiCount, dbMatches: dbCount, gap }
        );
    }
}
