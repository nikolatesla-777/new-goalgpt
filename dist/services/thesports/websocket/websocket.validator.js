"use strict";
/**
 * WebSocket Validator
 *
 * Validates WebSocket messages using Joi schemas
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketValidator = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../../../utils/logger");
class WebSocketValidator {
    /**
     * Validate score message
     */
    validateScoreMessage(message) {
        try {
            const schema = joi_1.default.object({
                id: joi_1.default.string().required(),
                score: joi_1.default.array().length(6).required(),
            });
            const { error } = schema.validate(message);
            if (error) {
                logger_1.logger.warn('Invalid score message:', error.message);
                return false;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Validate stats message
     */
    validateStatsMessage(message) {
        try {
            const schema = joi_1.default.object({
                id: joi_1.default.string().required(),
                stats: joi_1.default.array().items(joi_1.default.object({
                    type: joi_1.default.number().required(),
                    home: joi_1.default.number().required(),
                    away: joi_1.default.number().required(),
                })).required(),
            });
            const { error } = schema.validate(message);
            if (error) {
                logger_1.logger.warn('Invalid stats message:', error.message);
                return false;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Validate incident message
     */
    validateIncidentMessage(message) {
        try {
            const schema = joi_1.default.object({
                id: joi_1.default.string().required(),
                incidents: joi_1.default.array().items(joi_1.default.object({
                    type: joi_1.default.number().required(),
                    position: joi_1.default.number().valid(0, 1, 2).required(),
                    time: joi_1.default.number().required(),
                }).unknown(true) // Allow optional fields
                ).required(),
            });
            const { error } = schema.validate(message);
            if (error) {
                logger_1.logger.warn('Invalid incident message:', error.message);
                return false;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Validate tlive message
     */
    validateTliveMessage(message) {
        try {
            const schema = joi_1.default.object({
                id: joi_1.default.string().required(),
                tlive: joi_1.default.array().items(joi_1.default.object({
                    time: joi_1.default.string().required(),
                    data: joi_1.default.string().required(),
                    position: joi_1.default.number().valid(0, 1, 2).required(),
                })).required(),
            });
            const { error } = schema.validate(message);
            if (error) {
                logger_1.logger.warn('Invalid tlive message:', error.message);
                return false;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Type guard: Check if message is score
     * CRITICAL FIX: Must check for non-empty array to avoid treating empty score arrays as score messages
     */
    isScoreMessage(message) {
        return message && Array.isArray(message.score) && message.score.length > 0;
    }
    /**
     * Type guard: Check if message is stats
     * CRITICAL FIX: Must check for non-empty array to avoid treating empty stats arrays as stats messages
     */
    isStatsMessage(message) {
        return message && Array.isArray(message.stats) && message.stats.length > 0;
    }
    /**
     * Type guard: Check if message is incidents
     * CRITICAL FIX: Must check for non-empty array to avoid treating empty incidents arrays as incident messages
     */
    isIncidentsMessage(message) {
        return message && Array.isArray(message.incidents) && message.incidents.length > 0;
    }
    /**
     * Type guard: Check if message is tlive
     * CRITICAL FIX: Must check for non-empty array to avoid treating empty tlive arrays as tlive messages
     */
    isTliveMessage(message) {
        return message && Array.isArray(message.tlive) && message.tlive.length > 0;
    }
}
exports.WebSocketValidator = WebSocketValidator;
