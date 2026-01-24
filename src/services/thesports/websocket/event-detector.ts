/**
 * Event Detector
 * 
 * Detects events (goals, cards, substitutions) from WebSocket messages
 */

import { logger } from '../../../utils/logger';
import { ParsedScore, ParsedIncident } from '../../../types/thesports/websocket/websocket.types';
import { TechnicalStatistics } from '../../../types/thesports/enums';

export interface GoalEvent {
  type: 'GOAL';
  matchId: string;
  playerId?: string;
  playerName?: string;
  assist1Id?: string;
  assist2Id?: string;
  homeScore: number;
  awayScore: number;
  time: number;
  timestamp: number;
}

export interface CardEvent {
  type: 'CARD';
  matchId: string;
  cardType: 'YELLOW' | 'RED';
  playerId?: string;
  playerName?: string;
  time: number;
  timestamp: number;
}

export interface SubstitutionEvent {
  type: 'SUBSTITUTION';
  matchId: string;
  inPlayerId?: string;
  inPlayerName?: string;
  outPlayerId?: string;
  outPlayerName?: string;
  time: number;
  timestamp: number;
}

export interface GoalCancelledEvent {
  type: 'GOAL_CANCELLED';
  matchId: string;
  homeScore: number;
  awayScore: number;
  previousHomeScore: number;
  previousAwayScore: number;
  timestamp: number;
}

export interface ScoreChangeEvent {
  type: 'SCORE_CHANGE';
  matchId: string;
  homeScore: number;
  awayScore: number;
  minute?: number | null;
  statusId?: number | null;
  timestamp: number;
}

export interface DangerAlertEvent {
  type: 'DANGER_ALERT';
  matchId: string;
  alertType: 'DANGEROUS_ATTACK' | 'SHOT_ATTEMPT' | 'SHOT_SAVED' | 'HIT_POST' | 'PENALTY_SITUATION';
  team: 'home' | 'away' | 'unknown';
  time: string;
  message: string;
  timestamp: number;
}

export interface MatchStateChangeEvent {
  type: 'MATCH_STATE_CHANGE';
  matchId: string;
  statusId: number;
  timestamp: number;
}

export interface MinuteUpdateEvent {
  type: 'MINUTE_UPDATE';
  matchId: string;
  minute: number;
  statusId: number;
  timestamp: number;
}

export interface PredictionCreatedEvent {
  type: 'PREDICTION_CREATED';
  predictionId: string;
  botName: string;
  matchId: string; // Empty string if not matched yet
  prediction: string;
  accessType: 'VIP' | 'FREE';
  timestamp: number;
}

export interface PredictionUpdatedEvent {
  type: 'PREDICTION_UPDATED';
  matchId: string;
  predictionId: string;
  fields: string[];
  timestamp: number;
}

export interface PredictionDeletedEvent {
  type: 'PREDICTION_DELETED';
  matchId: string;
  predictionId: string;
  timestamp: number;
}

export type MatchEvent = GoalEvent | CardEvent | SubstitutionEvent | GoalCancelledEvent | ScoreChangeEvent | DangerAlertEvent | MatchStateChangeEvent | MinuteUpdateEvent | PredictionCreatedEvent | PredictionUpdatedEvent | PredictionDeletedEvent;

export class EventDetector {
  private processedEvents = new Map<string, number>(); // Event ID -> timestamp

  /**
   * Detect goal from incident
   */
  detectGoalFromIncident(
    matchId: string,
    incident: ParsedIncident,
    previousScore?: ParsedScore
  ): GoalEvent | null {
    if (!incident.isGoal) {
      return null;
    }

    const eventId = `${matchId}:GOAL:${incident.time}:${incident.playerId || 'unknown'}`;
    
    // Deduplication: Check if event was processed in last 5 seconds
    const lastProcessed = this.processedEvents.get(eventId);
    if (lastProcessed && Date.now() - lastProcessed < 5000) {
      logger.debug(`Duplicate goal event ignored: ${eventId}`);
      return null;
    }

    this.processedEvents.set(eventId, Date.now());

    return {
      type: 'GOAL',
      matchId,
      playerId: incident.playerId,
      playerName: incident.playerName,
      homeScore: (incident.homeScore ?? previousScore?.home.score ?? 0),
      awayScore: (incident.awayScore ?? previousScore?.away.score ?? 0),
      time: incident.time,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect card from incident
   */
  detectCardFromIncident(matchId: string, incident: ParsedIncident): CardEvent | null {
    if (!incident.isCard) {
      return null;
    }

    const cardType = incident.type === TechnicalStatistics.YELLOW_CARD ? 'YELLOW' : 'RED';
    const eventId = `${matchId}:CARD:${incident.time}:${incident.playerId || 'unknown'}`;

    const lastProcessed = this.processedEvents.get(eventId);
    if (lastProcessed && Date.now() - lastProcessed < 5000) {
      logger.debug(`Duplicate card event ignored: ${eventId}`);
      return null;
    }

    this.processedEvents.set(eventId, Date.now());

    return {
      type: 'CARD',
      matchId,
      cardType,
      playerId: incident.playerId,
      playerName: incident.playerName,
      time: incident.time,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect substitution from incident
   */
  detectSubstitutionFromIncident(matchId: string, incident: ParsedIncident): SubstitutionEvent | null {
    if (!incident.isSubstitution) {
      return null;
    }

    const eventId = `${matchId}:SUBSTITUTION:${incident.time}:${incident.playerId || 'unknown'}`;

    const lastProcessed = this.processedEvents.get(eventId);
    if (lastProcessed && Date.now() - lastProcessed < 5000) {
      logger.debug(`Duplicate substitution event ignored: ${eventId}`);
      return null;
    }

    this.processedEvents.set(eventId, Date.now());

    return {
      type: 'SUBSTITUTION',
      matchId,
      inPlayerId: incident.playerId, // Will be set from incident data
      inPlayerName: incident.playerName,
      outPlayerId: undefined, // Will be set from incident data
      outPlayerName: undefined,
      time: incident.time,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect score change
   */
  detectScoreChange(
    matchId: string,
    currentScore: ParsedScore,
    previousScore?: ParsedScore
  ): MatchEvent | null {
    if (!previousScore) {
      return null;
    }

    // If score goes backwards, treat as a cancelled goal (VAR / correction)
    const homeDecreased = currentScore.home.score < previousScore.home.score;
    const awayDecreased = currentScore.away.score < previousScore.away.score;
    if (homeDecreased || awayDecreased) {
      const eventId = `${matchId}:GOAL_CANCELLED:${previousScore.home.score}-${previousScore.away.score}->${currentScore.home.score}-${currentScore.away.score}`;
      const lastProcessed = this.processedEvents.get(eventId);
      if (lastProcessed && Date.now() - lastProcessed < 5000) {
        return null;
      }
      this.processedEvents.set(eventId, Date.now());

      return {
        type: 'GOAL_CANCELLED',
        matchId,
        homeScore: currentScore.home.score,
        awayScore: currentScore.away.score,
        previousHomeScore: previousScore.home.score,
        previousAwayScore: previousScore.away.score,
        timestamp: Date.now(),
      };
    }

    const homeScoreChanged = currentScore.home.score !== previousScore.home.score;
    const awayScoreChanged = currentScore.away.score !== previousScore.away.score;

    if (!homeScoreChanged && !awayScoreChanged) {
      return null;
    }

    const eventId = `${matchId}:SCORE_CHANGE:${previousScore.home.score}-${previousScore.away.score}->${currentScore.home.score}-${currentScore.away.score}`;
    const lastProcessed = this.processedEvents.get(eventId);
    if (lastProcessed && Date.now() - lastProcessed < 5000) {
      return null;
    }

    this.processedEvents.set(eventId, Date.now());

    return {
      type: 'SCORE_CHANGE',
      matchId,
      homeScore: currentScore.home.score,
      awayScore: currentScore.away.score,
      timestamp: Date.now(),
    };
  }

  /**
   * Clean old processed events (prevent memory leak)
   */
  cleanupOldEvents(maxAge: number = 5 * 60 * 1000): void {
    const now = Date.now();
    for (const [eventId, timestamp] of this.processedEvents.entries()) {
      if (now - timestamp > maxAge) {
        this.processedEvents.delete(eventId);
      }
    }
  }
}
