"use strict";
/**
 * Event Detector
 *
 * Detects events (goals, cards, substitutions) from WebSocket messages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDetector = void 0;
const logger_1 = require("../../../utils/logger");
const enums_1 = require("../../../types/thesports/enums");
class EventDetector {
    constructor() {
        this.processedEvents = new Map(); // Event ID -> timestamp
    }
    /**
     * Detect goal from incident
     */
    detectGoalFromIncident(matchId, incident, previousScore) {
        if (!incident.isGoal) {
            return null;
        }
        const eventId = `${matchId}:GOAL:${incident.time}:${incident.playerId || 'unknown'}`;
        // Deduplication: Check if event was processed in last 5 seconds
        const lastProcessed = this.processedEvents.get(eventId);
        if (lastProcessed && Date.now() - lastProcessed < 5000) {
            logger_1.logger.debug(`Duplicate goal event ignored: ${eventId}`);
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
    detectCardFromIncident(matchId, incident) {
        if (!incident.isCard) {
            return null;
        }
        const cardType = incident.type === enums_1.TechnicalStatistics.YELLOW_CARD ? 'YELLOW' : 'RED';
        const eventId = `${matchId}:CARD:${incident.time}:${incident.playerId || 'unknown'}`;
        const lastProcessed = this.processedEvents.get(eventId);
        if (lastProcessed && Date.now() - lastProcessed < 5000) {
            logger_1.logger.debug(`Duplicate card event ignored: ${eventId}`);
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
    detectSubstitutionFromIncident(matchId, incident) {
        if (!incident.isSubstitution) {
            return null;
        }
        const eventId = `${matchId}:SUBSTITUTION:${incident.time}:${incident.playerId || 'unknown'}`;
        const lastProcessed = this.processedEvents.get(eventId);
        if (lastProcessed && Date.now() - lastProcessed < 5000) {
            logger_1.logger.debug(`Duplicate substitution event ignored: ${eventId}`);
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
    detectScoreChange(matchId, currentScore, previousScore) {
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
    cleanupOldEvents(maxAge = 5 * 60 * 1000) {
        const now = Date.now();
        for (const [eventId, timestamp] of this.processedEvents.entries()) {
            if (now - timestamp > maxAge) {
                this.processedEvents.delete(eventId);
            }
        }
    }
}
exports.EventDetector = EventDetector;
