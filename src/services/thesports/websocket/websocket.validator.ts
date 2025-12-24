/**
 * WebSocket Validator
 * 
 * Validates WebSocket messages using Joi schemas
 */

import Joi from 'joi';
import { logger } from '../../../utils/logger';
import { TechnicalStatistics } from '../../../types/thesports/enums';

export class WebSocketValidator {
  /**
   * Validate score message
   */
  validateScoreMessage(message: any): boolean {
    try {
      const schema = Joi.object({
        id: Joi.string().required(),
        score: Joi.array().length(6).required(),
      });

      const { error } = schema.validate(message);
      if (error) {
        logger.warn('Invalid score message:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate stats message
   */
  validateStatsMessage(message: any): boolean {
    try {
      const schema = Joi.object({
        id: Joi.string().required(),
        stats: Joi.array().items(
          Joi.object({
            type: Joi.number().required(),
            home: Joi.number().required(),
            away: Joi.number().required(),
          })
        ).required(),
      });

      const { error } = schema.validate(message);
      if (error) {
        logger.warn('Invalid stats message:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate incident message
   */
  validateIncidentMessage(message: any): boolean {
    try {
      const schema = Joi.object({
        id: Joi.string().required(),
        incidents: Joi.array().items(
          Joi.object({
            type: Joi.number().required(),
            position: Joi.number().valid(0, 1, 2).required(),
            time: Joi.number().required(),
          }).unknown(true) // Allow optional fields
        ).required(),
      });

      const { error } = schema.validate(message);
      if (error) {
        logger.warn('Invalid incident message:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate tlive message
   */
  validateTliveMessage(message: any): boolean {
    try {
      const schema = Joi.object({
        id: Joi.string().required(),
        tlive: Joi.array().items(
          Joi.object({
            time: Joi.string().required(),
            data: Joi.string().required(),
            position: Joi.number().valid(0, 1, 2).required(),
          })
        ).required(),
      });

      const { error } = schema.validate(message);
      if (error) {
        logger.warn('Invalid tlive message:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Type guard: Check if message is score
   */
  isScoreMessage(message: any): message is { score: any[] } {
    return message && Array.isArray(message.score);
  }

  /**
   * Type guard: Check if message is stats
   */
  isStatsMessage(message: any): message is { stats: any[] } {
    return message && Array.isArray(message.stats);
  }

  /**
   * Type guard: Check if message is incidents
   */
  isIncidentsMessage(message: any): message is { incidents: any[] } {
    return message && Array.isArray(message.incidents);
  }

  /**
   * Type guard: Check if message is tlive
   */
  isTliveMessage(message: any): message is { tlive: any[] } {
    return message && Array.isArray(message.tlive);
  }
}

