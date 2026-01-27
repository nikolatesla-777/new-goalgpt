"use strict";
/**
 * Observability Logger Helper
 *
 * Provides structured logging with canonical event format for Phase 4 observability contract.
 * All logs must include: service, component, event, ts, level
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = logEvent;
var logger_1 = require("./logger");
/**
 * Derive component from event name
 * Examples:
 * - worker.started -> "worker"
 * - dataupdate.changed -> "dataupdate"
 * - websocket.connected -> "websocket"
 */
function deriveComponent(event) {
    var parts = event.split('.');
    return parts[0] || 'unknown';
}
/**
 * Phase 4-5 WS3: Redact secret fields from log output
 * Keys containing secret patterns are replaced with [REDACTED]
 */
var SECRET_PATTERNS = ['secret', 'password', 'token', 'api_key', 'apikey', 'auth'];
function sanitizeFields(fields) {
    var sanitized = {};
    var _loop_1 = function (key, value) {
        var lowerKey = key.toLowerCase();
        if (SECRET_PATTERNS.some(function (pattern) { return lowerKey.includes(pattern); })) {
            sanitized[key] = '[REDACTED]';
        }
        else {
            sanitized[key] = value;
        }
    };
    for (var _i = 0, _a = Object.entries(fields); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        _loop_1(key, value);
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
function logEvent(level, event, fields) {
    if (fields === void 0) { fields = {}; }
    var component = deriveComponent(event);
    var ts = Math.floor(Date.now() / 1000);
    // Base fields (required)
    var baseFields = {
        service: 'goalgpt-dashboard',
        component: component,
        event: event,
        ts: ts,
        level: level,
    };
    // Phase 4-5 WS3: Sanitize fields to prevent secret leakage
    var sanitizedFields = sanitizeFields(fields);
    // Merge with provided fields
    var allFields = __assign(__assign({}, baseFields), sanitizedFields);
    // Log using Winston logger
    logger_1.logger[level](event, allFields);
}
