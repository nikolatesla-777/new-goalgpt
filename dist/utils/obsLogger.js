"use strict";
/**
 * Observability Logger Helper
 *
 * Provides structured logging with canonical event format for Phase 4 observability contract.
 * All logs must include: service, component, event, ts, level
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = logEvent;
const logger_1 = require("./logger");
/**
 * Derive component from event name
 * Examples:
 * - worker.started -> "worker"
 * - dataupdate.changed -> "dataupdate"
 * - websocket.connected -> "websocket"
 */
function deriveComponent(event) {
    const parts = event.split('.');
    return parts[0] || 'unknown';
}
/**
 * Phase 4-5 WS3: Redact secret fields from log output
 * Keys containing secret patterns are replaced with [REDACTED]
 */
const SECRET_PATTERNS = ['secret', 'password', 'token', 'api_key', 'apikey', 'auth'];
function sanitizeFields(fields) {
    const sanitized = {};
    for (const [key, value] of Object.entries(fields)) {
        const lowerKey = key.toLowerCase();
        if (SECRET_PATTERNS.some(pattern => lowerKey.includes(pattern))) {
            sanitized[key] = '[REDACTED]';
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
/**
 * Log an event with structured fields
 *
 * @param level - Log level: 'info', 'warn', 'error', 'debug'
 * @param event - Event name from Event Catalogue (e.g., 'worker.started')
 * @param fields - Optional fields to include in log
 */
function logEvent(level, event, fields = {}) {
    const component = deriveComponent(event);
    const ts = Math.floor(Date.now() / 1000);
    // Base fields (required)
    const baseFields = {
        service: 'goalgpt-dashboard',
        component,
        event,
        ts,
        level,
    };
    // Phase 4-5 WS3: Sanitize fields to prevent secret leakage
    const sanitizedFields = sanitizeFields(fields);
    // Merge with provided fields
    const allFields = { ...baseFields, ...sanitizedFields };
    // Log using Winston logger
    logger_1.logger[level](event, allFields);
}
