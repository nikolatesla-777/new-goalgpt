"use strict";
/**
 * Event Detector
 *
 * Detects events (goals, cards, substitutions) from WebSocket messages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDetector = void 0;
var logger_1 = require("../../../utils/logger");
var enums_1 = require("../../../types/thesports/enums");
var EventDetector = /** @class */ (function () {
    function EventDetector() {
        this.processedEvents = new Map(); // Event ID -> timestamp
    }
    /**
     * Detect goal from incident
     */
    EventDetector.prototype.detectGoalFromIncident = function (matchId, incident, previousScore) {
        var _a, _b, _c, _d;
        if (!incident.isGoal) {
            return null;
        }
        var eventId = "".concat(matchId, ":GOAL:").concat(incident.time, ":").concat(incident.playerId || 'unknown');
        // Deduplication: Check if event was processed in last 5 seconds
        var lastProcessed = this.processedEvents.get(eventId);
        if (lastProcessed && Date.now() - lastProcessed < 5000) {
            logger_1.logger.debug("Duplicate goal event ignored: ".concat(eventId));
            return null;
        }
        this.processedEvents.set(eventId, Date.now());
        return {
            type: 'GOAL',
            matchId: matchId,
            playerId: incident.playerId,
            playerName: incident.playerName,
            homeScore: ((_b = (_a = incident.homeScore) !== null && _a !== void 0 ? _a : previousScore === null || previousScore === void 0 ? void 0 : previousScore.home.score) !== null && _b !== void 0 ? _b : 0),
            awayScore: ((_d = (_c = incident.awayScore) !== null && _c !== void 0 ? _c : previousScore === null || previousScore === void 0 ? void 0 : previousScore.away.score) !== null && _d !== void 0 ? _d : 0),
            time: incident.time,
            timestamp: Date.now(),
        };
    };
    /**
     * Detect card from incident
     */
    EventDetector.prototype.detectCardFromIncident = function (matchId, incident) {
        if (!incident.isCard) {
            return null;
        }
        var cardType = incident.type === enums_1.TechnicalStatistics.YELLOW_CARD ? 'YELLOW' : 'RED';
        var eventId = "".concat(matchId, ":CARD:").concat(incident.time, ":").concat(incident.playerId || 'unknown');
        var lastProcessed = this.processedEvents.get(eventId);
        if (lastProcessed && Date.now() - lastProcessed < 5000) {
            logger_1.logger.debug("Duplicate card event ignored: ".concat(eventId));
            return null;
        }
        this.processedEvents.set(eventId, Date.now());
        return {
            type: 'CARD',
            matchId: matchId,
            cardType: cardType,
            playerId: incident.playerId,
            playerName: incident.playerName,
            time: incident.time,
            timestamp: Date.now(),
        };
    };
    /**
     * Detect substitution from incident
     */
    EventDetector.prototype.detectSubstitutionFromIncident = function (matchId, incident) {
        if (!incident.isSubstitution) {
            return null;
        }
        var eventId = "".concat(matchId, ":SUBSTITUTION:").concat(incident.time, ":").concat(incident.playerId || 'unknown');
        var lastProcessed = this.processedEvents.get(eventId);
        if (lastProcessed && Date.now() - lastProcessed < 5000) {
            logger_1.logger.debug("Duplicate substitution event ignored: ".concat(eventId));
            return null;
        }
        this.processedEvents.set(eventId, Date.now());
        return {
            type: 'SUBSTITUTION',
            matchId: matchId,
            inPlayerId: incident.playerId, // Will be set from incident data
            inPlayerName: incident.playerName,
            outPlayerId: undefined, // Will be set from incident data
            outPlayerName: undefined,
            time: incident.time,
            timestamp: Date.now(),
        };
    };
    /**
     * Detect score change
     */
    EventDetector.prototype.detectScoreChange = function (matchId, currentScore, previousScore) {
        if (!previousScore) {
            return null;
        }
        // If score goes backwards, treat as a cancelled goal (VAR / correction)
        var homeDecreased = currentScore.home.score < previousScore.home.score;
        var awayDecreased = currentScore.away.score < previousScore.away.score;
        if (homeDecreased || awayDecreased) {
            var eventId_1 = "".concat(matchId, ":GOAL_CANCELLED:").concat(previousScore.home.score, "-").concat(previousScore.away.score, "->").concat(currentScore.home.score, "-").concat(currentScore.away.score);
            var lastProcessed_1 = this.processedEvents.get(eventId_1);
            if (lastProcessed_1 && Date.now() - lastProcessed_1 < 5000) {
                return null;
            }
            this.processedEvents.set(eventId_1, Date.now());
            return {
                type: 'GOAL_CANCELLED',
                matchId: matchId,
                homeScore: currentScore.home.score,
                awayScore: currentScore.away.score,
                previousHomeScore: previousScore.home.score,
                previousAwayScore: previousScore.away.score,
                timestamp: Date.now(),
            };
        }
        var homeScoreChanged = currentScore.home.score !== previousScore.home.score;
        var awayScoreChanged = currentScore.away.score !== previousScore.away.score;
        if (!homeScoreChanged && !awayScoreChanged) {
            return null;
        }
        var eventId = "".concat(matchId, ":SCORE_CHANGE:").concat(previousScore.home.score, "-").concat(previousScore.away.score, "->").concat(currentScore.home.score, "-").concat(currentScore.away.score);
        var lastProcessed = this.processedEvents.get(eventId);
        if (lastProcessed && Date.now() - lastProcessed < 5000) {
            return null;
        }
        this.processedEvents.set(eventId, Date.now());
        return {
            type: 'SCORE_CHANGE',
            matchId: matchId,
            homeScore: currentScore.home.score,
            awayScore: currentScore.away.score,
            timestamp: Date.now(),
        };
    };
    /**
     * Clean old processed events (prevent memory leak)
     */
    EventDetector.prototype.cleanupOldEvents = function (maxAge) {
        if (maxAge === void 0) { maxAge = 5 * 60 * 1000; }
        var now = Date.now();
        for (var _i = 0, _a = this.processedEvents.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], eventId = _b[0], timestamp = _b[1];
            if (now - timestamp > maxAge) {
                this.processedEvents.delete(eventId);
            }
        }
    };
    return EventDetector;
}());
exports.EventDetector = EventDetector;
