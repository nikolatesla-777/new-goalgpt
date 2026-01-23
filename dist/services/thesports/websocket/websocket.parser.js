"use strict";
/**
 * MQTT Parser (Refactored from WebSocket)
 *
 * Parses MQTT messages from TheSports API
 * MQTT payloads are JSON arrays with specific structure
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketParser = void 0;
const logger_1 = require("../../../utils/logger");
const enums_1 = require("../../../types/thesports/enums");
class WebSocketParser {
    /**
     * Extract matchId from varied MQTT payload shapes.
     * Supports:
     *  - { id: '...' }
     *  - { score: [matchId, ...] } or { score: [[matchId, ...]] }
     *  - [matchId, ...]
     */
    extractMatchIdFromPayload(payload) {
        try {
            if (payload === null || payload === undefined)
                return null;
            // Array format: [matchId, ...]
            if (Array.isArray(payload)) {
                const v = payload[0];
                const s = v === null || v === undefined ? '' : String(v);
                return s.trim() ? s : null;
            }
            // Object format
            if (typeof payload === 'object') {
                // Prefer explicit id
                if ('id' in payload && payload.id !== null && payload.id !== undefined) {
                    const s = String(payload.id);
                    if (s.trim())
                        return s;
                }
                // Score payload sometimes contains matchId even when id is missing
                if ('score' in payload && Array.isArray(payload.score)) {
                    const score = payload.score;
                    const tuple = Array.isArray(score[0]) ? score[0] : score;
                    const v = tuple?.[0];
                    const s = v === null || v === undefined ? '' : String(v);
                    return s.trim() ? s : null;
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Parse MQTT message (JSON array or object)
     * MQTT messages can be:
     * - Arrays: [match_id, status_code, home_data[], away_data[], timestamp]
     * - Objects: {"0": {...}, "1": {...}} (multiple messages in one payload)
     * - Objects: {"id": "...", "stats": [...]} (single message in object format)
     */
    parseMQTTMessage(data) {
        try {
            logger_1.logger.info(`[Parser] parseMQTTMessage called, data type: ${typeof data}, isArray: ${Array.isArray(data)}`);
            // Handle object format: {"0": {...}, "1": {...}}
            // Convert to array of messages
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                // Check if it's a multi-message object with numeric keys
                const keys = Object.keys(data);
                logger_1.logger.info(`[Parser] Object detected, keys: [${keys.join(', ')}]`);
                const numericKeys = keys.filter(k => /^\d+$/.test(k));
                logger_1.logger.info(`[Parser] Numeric keys filtered: [${numericKeys.join(', ')}], count: ${numericKeys.length}`);
                if (numericKeys.length > 0) {
                    // Convert object to array: {"0": msg1, "1": msg2} -> [msg1, msg2]
                    const messages = numericKeys.map(key => data[key]);
                    logger_1.logger.info(`[Parser] parseMQTTMessage detected ${numericKeys.length} numeric keys, unwrapping ${messages.length} messages`);
                    // Parse each message and combine results
                    const result = { score: [], stats: [], incidents: [], tlive: [] };
                    let hasValidMessage = false;
                    for (const msg of messages) {
                        if (!msg || typeof msg !== 'object') {
                            logger_1.logger.warn(`[Parser] Skipping invalid message (not object): ${typeof msg}`);
                            continue;
                        }
                        logger_1.logger.info(`[Parser] Unwrapped message: ${JSON.stringify(msg).slice(0, 150)}...`);
                        // Guard: Check if match_id or id exists
                        const matchId = this.extractMatchIdFromPayload(msg);
                        if (!matchId || matchId.trim() === '') {
                            logger_1.logger.warn('MQTT message missing valid match_id/id, skipping:', msg);
                            continue;
                        }
                        logger_1.logger.info(`[Parser] Match ID extracted: ${matchId}, calling parseSingleMessage`);
                        // Try to parse as score, stats, or incidents
                        const parsed = this.parseSingleMessage(msg);
                        if (parsed) {
                            logger_1.logger.info(`[Parser] parseSingleMessage returned valid result`);
                            if (parsed.score)
                                result.score.push(...parsed.score);
                            if (parsed.stats)
                                result.stats.push(...parsed.stats);
                            if (parsed.incidents)
                                result.incidents.push(...parsed.incidents);
                            if (parsed.tlive)
                                result.tlive.push(...parsed.tlive);
                            hasValidMessage = true;
                        }
                        else {
                            logger_1.logger.warn(`[Parser] parseSingleMessage returned NULL for message`);
                        }
                    }
                    logger_1.logger.info(`[Parser] parseMQTTMessage result: hasValidMessage=${hasValidMessage}`);
                    return hasValidMessage ? result : null;
                }
                // Handle single object format: {"id": "...", "stats": [...]}
                const matchId = this.extractMatchIdFromPayload(data);
                if (!matchId || matchId.trim() === '') {
                    logger_1.logger.warn('MQTT message missing valid match_id/id:', data);
                    return null;
                }
                return this.parseSingleMessage(data);
            }
            // Handle array format
            if (Array.isArray(data)) {
                logger_1.logger.info(`[Parser] Array detected, length: ${data.length}, first element type: ${typeof data[0]}`);
                // Check if it's an array of message objects: [{id: "...", stats: [...]}, ...]
                if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
                    logger_1.logger.info(`[Parser] Array of message objects detected, processing ${data.length} messages`);
                    // Parse each message object and combine results
                    const result = { score: [], stats: [], incidents: [], tlive: [] };
                    let hasValidMessage = false;
                    for (const msg of data) {
                        if (!msg || typeof msg !== 'object') {
                            logger_1.logger.warn(`[Parser] Skipping invalid message in array: ${typeof msg}`);
                            continue;
                        }
                        logger_1.logger.info(`[Parser] Processing array message: ${JSON.stringify(msg).slice(0, 150)}...`);
                        // Guard: Check if match_id or id exists
                        const matchId = this.extractMatchIdFromPayload(msg);
                        if (!matchId || matchId.trim() === '') {
                            logger_1.logger.warn('[Parser] Array message missing valid match_id/id, skipping:', msg);
                            continue;
                        }
                        logger_1.logger.info(`[Parser] Match ID extracted: ${matchId}, calling parseSingleMessage`);
                        // Try to parse as score, stats, or incidents
                        const parsed = this.parseSingleMessage(msg);
                        if (parsed) {
                            logger_1.logger.info(`[Parser] parseSingleMessage returned valid result`);
                            if (parsed.score)
                                result.score.push(...parsed.score);
                            if (parsed.stats)
                                result.stats.push(...parsed.stats);
                            if (parsed.incidents)
                                result.incidents.push(...parsed.incidents);
                            if (parsed.tlive)
                                result.tlive.push(...parsed.tlive);
                            hasValidMessage = true;
                        }
                        else {
                            logger_1.logger.warn(`[Parser] parseSingleMessage returned NULL for array message`);
                        }
                    }
                    logger_1.logger.info(`[Parser] Array processing result: hasValidMessage=${hasValidMessage}`);
                    return hasValidMessage ? result : null;
                }
                // Otherwise, treat as score array: [match_id, status_code, home_data[], away_data[], timestamp]
                logger_1.logger.info(`[Parser] Treating as score array format`);
                const matchId = this.extractMatchIdFromPayload(data);
                if (!matchId || matchId.trim() === '') {
                    logger_1.logger.warn('MQTT array message missing valid match_id, skipping:', data);
                    return null;
                }
                return this.parseSingleMessage(data);
            }
            logger_1.logger.warn('Unknown MQTT message structure:', data);
            return null;
        }
        catch (error) {
            logger_1.logger.error('Failed to parse MQTT message:', error);
            return null;
        }
    }
    /**
     * Parse a single message (array or object format)
     */
    parseSingleMessage(data) {
        // DEBUG: Log type checks
        const isScore = this.isScoreUpdate(data);
        const isStats = this.isStatsUpdate(data);
        const isIncidents = this.isIncidentsUpdate(data);
        const isTlive = this.isTliveUpdate(data);
        logger_1.logger.info(`[Parser] parseSingleMessage checks - score:${isScore}, stats:${isStats}, incidents:${isIncidents}, tlive:${isTlive}`);
        // Check message type based on structure
        // Score update: [match_id, status_code, home_data[], away_data[], timestamp]
        if (isScore) {
            logger_1.logger.info(`[Parser] Parsing as SCORE message`);
            return { score: [this.parseScoreFromArray(data)], stats: [], incidents: [], tlive: [] };
        }
        // Stats update: Different structure
        if (isStats) {
            logger_1.logger.info(`[Parser] Parsing as STATS message`);
            return { score: [], stats: [this.parseStatsFromArray(data)], incidents: [], tlive: [] };
        }
        // Incidents: Different structure
        if (isIncidents) {
            logger_1.logger.info(`[Parser] Parsing as INCIDENTS message`);
            return { score: [], stats: [], incidents: [this.parseIncidentsFromArray(data)], tlive: [] };
        }
        // TLIVE update: match timeline / phase changes (HT/2H/FT etc.)
        if (isTlive) {
            logger_1.logger.info(`[Parser] Parsing as TLIVE message`);
            return { score: [], stats: [], incidents: [], tlive: [this.parseTliveFromArray(data)] };
        }
        logger_1.logger.warn(`[Parser] Unknown message type - returning null`);
        return null;
    }
    /**
     * Check if message is a score update
     * Structure: [match_id, status_code, home_data[], away_data[], timestamp]
     * OR: { id: match_id, score: [match_id, status_code, home_data[], away_data[], timestamp] }
     */
    isScoreUpdate(data) {
        // Array format: [match_id, status_code, home_data[], away_data[], timestamp]
        if (Array.isArray(data)) {
            return (data.length >= 5 &&
                (typeof data[0] === 'string' || typeof data[0] === 'number') && // match_id
                typeof data[1] === 'number' && // status_code
                Array.isArray(data[2]) && // home_data
                Array.isArray(data[3]) && // away_data
                typeof data[4] === 'number' // timestamp
            );
        }
        // Object format: { id: match_id, score: [...] }
        if (data && typeof data === 'object' && 'score' in data && Array.isArray(data.score)) {
            const raw = data.score;
            const scoreArray = Array.isArray(raw[0]) ? raw[0] : raw;
            return (scoreArray.length >= 5 &&
                (typeof scoreArray[0] === 'string' || typeof scoreArray[0] === 'number') && // match_id
                typeof scoreArray[1] === 'number' && // status_code
                Array.isArray(scoreArray[2]) && // home_data
                Array.isArray(scoreArray[3]) && // away_data
                typeof scoreArray[4] === 'number' // timestamp
            );
        }
        return false;
    }
    /**
     * Check if message is a stats update
     * MQTT stats structure: [match_id, stats_array[]]
     * OR: { id: match_id, stats: [...] } (if object format)
     */
    isStatsUpdate(data) {
        // Check if it's an array with match_id and stats array
        if (Array.isArray(data) && data.length >= 2) {
            // Structure: [match_id, stats_array]
            if ((typeof data[0] === 'string' || typeof data[0] === 'number') && Array.isArray(data[1])) {
                // Verify stats array contains objects with type, home, away
                const statsArray = data[1];
                if (statsArray.length === 0)
                    return true;
                const first = statsArray[0];
                if (Array.isArray(first)) {
                    return first.length >= 3;
                }
                if (first && typeof first === 'object') {
                    return 'type' in first && 'home' in first && 'away' in first;
                }
            }
        }
        // Check if it's an object with id and stats
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            return 'id' in data && 'stats' in data && Array.isArray(data.stats);
        }
        return false;
    }
    /**
     * Check if message is an incidents update
     * MQTT incidents structure: [match_id, incidents_array[]]
     * OR: { id: match_id, incidents: [...] } (if object format)
     */
    isIncidentsUpdate(data) {
        // Check if it's an array with match_id and incidents array
        if (Array.isArray(data) && data.length >= 2) {
            // Structure: [match_id, incidents_array]
            if ((typeof data[0] === 'string' || typeof data[0] === 'number') && Array.isArray(data[1])) {
                const arr = data[1];
                const first = arr[0];
                const looksLikeTlive = !!first && typeof first === 'object' && 'data' in first && !('type' in first);
                if (looksLikeTlive)
                    return false;
                if (!first)
                    return true;
                if (Array.isArray(first)) {
                    return first.length >= 3; // type, position, time
                }
                if (typeof first === 'object' && 'type' in first)
                    return true;
                return false;
            }
        }
        // Check if it's an object with id and incidents
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            return 'id' in data && 'incidents' in data && Array.isArray(data.incidents);
        }
        return false;
    }
    /**
     * Check if message is a tlive update
     * MQTT tlive structure: [match_id, tlive_array[]]
     * OR: { id: match_id, tlive: [...] } (if object format)
     */
    isTliveUpdate(data) {
        // Array format: [match_id, tlive_array]
        if (Array.isArray(data) && data.length >= 2) {
            if ((typeof data[0] === 'string' || typeof data[0] === 'number') && Array.isArray(data[1])) {
                const arr = data[1];
                const first = arr[0];
                if (!first)
                    return true;
                if (typeof first === 'object' && first && 'data' in first)
                    return true;
                return false;
            }
        }
        // Object format: { id: match_id, tlive: [...] }
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            return 'id' in data && 'tlive' in data && Array.isArray(data.tlive);
        }
        return false;
    }
    /**
     * Parse score update from MQTT array or object
     * Structure: [match_id, status_code, home_data[], away_data[], timestamp]
     * OR: { id: match_id, score: [match_id, status_code, home_data[], away_data[], timestamp] }
     */
    parseScoreFromArray(data) {
        let matchId;
        let statusCode;
        let homeData;
        let awayData;
        let timestamp;
        // Array format
        if (Array.isArray(data)) {
            matchId = String(data[0] ?? '');
            statusCode = data[1];
            homeData = data[2];
            awayData = data[3];
            timestamp = data[4];
        }
        // Object format: { id: match_id, score: [...] }
        else if (data && typeof data === 'object' && 'score' in data && Array.isArray(data.score)) {
            const raw = data.score;
            const scoreArray = Array.isArray(raw[0]) ? raw[0] : raw;
            matchId = String(data.id ?? scoreArray[0] ?? '');
            statusCode = scoreArray[1];
            homeData = scoreArray[2];
            awayData = scoreArray[3];
            timestamp = scoreArray[4];
        }
        else {
            throw new Error('Invalid score update format');
        }
        // Guard: Validate match_id
        if (!matchId || typeof matchId !== 'string' || matchId.trim() === '') {
            throw new Error('Missing or invalid match_id in score update');
        }
        // Map to WebSocketScoreMessage format
        return {
            id: matchId,
            score: [
                matchId,
                statusCode,
                homeData,
                awayData,
                timestamp, // Message timestamp (NOT kickoff)
            ],
        };
    }
    /**
     * Parse stats update from MQTT array or object
     * Structure: [match_id, stats_array[]]
     * OR: { id: match_id, stats: [...] }
     *
     * Each stat object: { type: number, home: number, away: number }
     */
    parseStatsFromArray(data) {
        let matchId;
        let statsArray;
        // Handle array format: [match_id, stats_array]
        if (Array.isArray(data) && data.length >= 2) {
            matchId = String(data[0] ?? '');
            statsArray = Array.isArray(data[1]) ? data[1] : [];
        }
        // Handle object format: { id: match_id, stats: [...] }
        else if (data && typeof data === 'object' && 'id' in data && 'stats' in data) {
            matchId = String(data.id ?? '');
            statsArray = Array.isArray(data.stats) ? data.stats : [];
        }
        else {
            logger_1.logger.warn('Unknown stats MQTT structure:', data);
            return {
                id: '',
                stats: [],
            };
        }
        // Guard: Validate match_id
        if (!matchId || typeof matchId !== 'string' || matchId.trim() === '') {
            logger_1.logger.warn('Missing or invalid match_id in stats update, skipping');
            return {
                id: '',
                stats: [],
            };
        }
        // Parse stats array
        const parsedStats = statsArray
            .map((stat) => {
            if (Array.isArray(stat)) {
                return {
                    type: Number(stat[0] ?? 0),
                    home: Number(stat[1] ?? 0),
                    away: Number(stat[2] ?? 0),
                };
            }
            if (stat && typeof stat === 'object' && 'type' in stat && 'home' in stat && 'away' in stat) {
                return {
                    type: Number(stat.type ?? 0),
                    home: Number(stat.home ?? 0),
                    away: Number(stat.away ?? 0),
                };
            }
            return null;
        })
            .filter((x) => x !== null);
        return {
            id: matchId,
            stats: parsedStats,
        };
    }
    /**
     * Parse incidents update from MQTT array or object
     * Structure: [match_id, incidents_array[]]
     * OR: { id: match_id, incidents: [...] }
     */
    parseIncidentsFromArray(data) {
        let matchId;
        let incidentsArray;
        // Handle array format: [match_id, incidents_array]
        if (Array.isArray(data) && data.length >= 2) {
            matchId = String(data[0] ?? '');
            incidentsArray = Array.isArray(data[1]) ? data[1] : [];
        }
        // Handle object format: { id: match_id, incidents: [...] }
        else if (data && typeof data === 'object' && 'id' in data && 'incidents' in data) {
            matchId = String(data.id ?? '');
            incidentsArray = Array.isArray(data.incidents) ? data.incidents : [];
        }
        else {
            logger_1.logger.warn('Unknown incidents MQTT structure:', data);
            return {
                id: '',
                incidents: [],
            };
        }
        // Guard: Validate match_id
        if (!matchId || typeof matchId !== 'string' || matchId.trim() === '') {
            logger_1.logger.warn('Missing or invalid match_id in incidents update, skipping');
            return {
                id: '',
                incidents: [],
            };
        }
        // Parse each incident
        const parsedIncidents = incidentsArray.map(incident => {
            try {
                return this.parseIncidentToStructured(matchId, incident);
            }
            catch (error) {
                logger_1.logger.error(`Failed to parse incident:`, error);
                return null;
            }
        }).filter((incident) => incident !== null);
        return {
            id: matchId,
            incidents: parsedIncidents.map(incident => ({
                type: incident.type,
                position: incident.position,
                time: incident.time,
                player_id: incident.playerId,
                player_name: incident.playerName,
                assist1_id: incident.assist1Id,
                assist1_name: incident.assist1Name,
                assist2_id: incident.assist2Id,
                assist2_name: incident.assist2Name,
                in_player_id: incident.inPlayerId,
                in_player_name: incident.inPlayerName,
                out_player_id: incident.outPlayerId,
                out_player_name: incident.outPlayerName,
                home_score: incident.homeScore,
                away_score: incident.awayScore,
                var_reason: incident.varReason,
                var_result: incident.varResult,
                reason_type: incident.reasonType,
            })),
        };
    }
    /**
     * Parse tlive update from MQTT array or object
     * Structure: [match_id, tlive_array[]]
     * OR: { id: match_id, tlive: [...] }
     */
    parseTliveFromArray(data) {
        let matchId;
        let tliveArray;
        // Handle array format: [match_id, tlive_array]
        if (Array.isArray(data) && data.length >= 2) {
            matchId = String(data[0] ?? '');
            tliveArray = Array.isArray(data[1]) ? data[1] : [];
        }
        // Handle object format: { id: match_id, tlive: [...] }
        else if (data && typeof data === 'object' && 'id' in data && 'tlive' in data) {
            matchId = String(data.id ?? '');
            tliveArray = Array.isArray(data.tlive) ? data.tlive : [];
        }
        else {
            logger_1.logger.warn('Unknown tlive MQTT structure:', data);
            return { id: '', tlive: [] };
        }
        // Guard: Validate match_id
        if (!matchId || typeof matchId !== 'string' || matchId.trim() === '') {
            logger_1.logger.warn('Missing or invalid match_id in tlive update, skipping');
            return { id: '', tlive: [] };
        }
        return {
            id: matchId,
            tlive: tliveArray,
        };
    }
    /**
     * Parse raw WebSocket message (legacy support)
     */
    parseMessage(rawMessage) {
        try {
            if (rawMessage.score) {
                return { score: this.parseScore(rawMessage.score), stats: [], incidents: [], tlive: [] };
            }
            if (rawMessage.stats) {
                return { score: [], stats: this.parseStats(rawMessage.stats), incidents: [], tlive: [] };
            }
            if (rawMessage.incidents) {
                return { score: [], stats: [], incidents: this.parseIncidents(rawMessage.incidents), tlive: [] };
            }
            if (rawMessage.tlive) {
                return { score: [], stats: [], incidents: [], tlive: this.parseTlive(rawMessage.tlive) };
            }
            logger_1.logger.warn('Unknown WebSocket message type:', rawMessage);
            return null;
        }
        catch (error) {
            logger_1.logger.error('Failed to parse WebSocket message:', error);
            return null;
        }
    }
    /**
     * Parse score message
     */
    parseScore(scoreData) {
        return scoreData.map(item => ({
            id: item.id,
            score: item.score,
        }));
    }
    /**
     * Parse score to structured format
     * CRITICAL MAPPING: Based on user docs
     * Structure: [match_id, status_code, home_data[], away_data[], message_timestamp]
     *
     * Index Mapping:
     * - data[0] = match_id
     * - data[1] = status_id (MatchState enum)
     * - data[2] = home_data[] [regular_score(0), halftime(1), red(2), yellow(3), corners(4), overtime(5), penalty(6)]
     * - data[3] = away_data[] [regular_score(0), halftime(1), red(2), yellow(3), corners(4), overtime(5), penalty(6)]
     * - data[4] = messageTimestamp (Unix timestamp) - timestamp of this MQTT score update (NOT kickoff)
     *
     * Score Fields:
     * - Index 0: regular_score (90 min score)
     * - Index 5: overtime_score (120 min aggregate score)
     * - Index 6: penalty_score (penalty shootout score)
     */
    parseScoreToStructured(scoreMessage) {
        // NOTE: scoreMessage.score is a tuple but may be typed loosely by upstream serializers.
        // We normalize types here to avoid TS tuple/union errors and runtime edge cases.
        const tuple = scoreMessage.score;
        const matchId = String(tuple[0] ?? '');
        const statusId = Number(tuple[1] ?? 1);
        const homeArray = Array.isArray(tuple[2]) ? tuple[2].map((v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; }) : [];
        const awayArray = Array.isArray(tuple[3]) ? tuple[3].map((v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; }) : [];
        const messageTimestamp = Number(tuple[4] ?? 0);
        // CRITICAL FIX (2026-01-19): Per TheSports API documentation, score[4] IS the kickoff timestamp.
        // Formula: First half minute = (current_timestamp - first_half_kickoff_timestamp) / 60 + 1
        // Where first_half_kickoff_timestamp = score[4]
        // Previous comment was incorrect - score[4] IS the kickoff timestamp for the current half.
        const liveKickoffTime = messageTimestamp > 0 ? messageTimestamp : null;
        if (!matchId || matchId.trim() === '') {
            throw new Error('Missing or invalid match_id in score tuple');
        }
        // Extract score components
        const homeRegularScore = homeArray[0] ?? 0;
        const homeOvertimeScore = homeArray[5] ?? 0;
        const homePenaltyScore = homeArray[6] ?? 0;
        const awayRegularScore = awayArray[0] ?? 0;
        const awayOvertimeScore = awayArray[5] ?? 0;
        const awayPenaltyScore = awayArray[6] ?? 0;
        // Calculate display scores using the algorithm (pass statusId for context)
        const homeDisplayScore = this.calculateDisplayScore(homeRegularScore, homeOvertimeScore, homePenaltyScore, statusId);
        const awayDisplayScore = this.calculateDisplayScore(awayRegularScore, awayOvertimeScore, awayPenaltyScore, statusId);
        // CRITICAL: Calculate minute from messageTimestamp (kickoff_timestamp from TheSportsAPI)
        // Per TheSportsAPI documentation:
        // - First half: messageTimestamp = first half kickoff
        // - Second half: messageTimestamp = second half kickoff (changes when half changes!)
        // Formula:
        // - First half: (now - first_half_kickoff) / 60 + 1
        // - Second half: (now - second_half_kickoff) / 60 + 45 + 1
        let minute = null;
        if (messageTimestamp > 0) {
            const now = Math.floor(Date.now() / 1000);
            if (statusId === 2) {
                // First half: (current - first_half_kickoff) / 60 + 1
                const elapsedMinutes = Math.floor((now - messageTimestamp) / 60);
                minute = Math.max(1, Math.min(45, elapsedMinutes + 1));
            }
            else if (statusId === 3) {
                // Half-time
                minute = 45;
            }
            else if (statusId === 4) {
                // Second half: (current - second_half_kickoff) / 60 + 45 + 1
                const elapsedFromSecondHalfKickoff = Math.floor((now - messageTimestamp) / 60);
                minute = Math.max(46, Math.min(120, elapsedFromSecondHalfKickoff + 45 + 1));
            }
            else if (statusId === 5 || statusId === 7) {
                // Overtime/Penalties
                const elapsedFromKickoff = Math.floor((now - messageTimestamp) / 60);
                minute = Math.max(91, elapsedFromKickoff + 45 + 1);
            }
        }
        return {
            matchId,
            status: statusId,
            statusId: statusId, // Raw status_id from Index 1
            messageTimestamp, // Index 4 from score tuple
            liveKickoffTime, // null here (do not derive from message timestamp)
            minute, // Calculated match minute from messageTimestamp (kickoff)
            home: {
                score: homeDisplayScore, // Calculated display score
                regularScore: homeRegularScore, // Index 0
                overtimeScore: homeOvertimeScore, // Index 5
                penaltyScore: homePenaltyScore, // Index 6
                halftime: homeArray[1] ?? 0,
                redCards: homeArray[2] ?? 0,
                yellowCards: homeArray[3] ?? 0,
                corners: homeArray[4] ?? 0,
                overtime: homeOvertimeScore, // Legacy field
                penalty: homePenaltyScore, // Legacy field
            },
            away: {
                score: awayDisplayScore, // Calculated display score
                regularScore: awayRegularScore, // Index 0
                overtimeScore: awayOvertimeScore, // Index 5
                penaltyScore: awayPenaltyScore, // Index 6
                halftime: awayArray[1] ?? 0,
                redCards: awayArray[2] ?? 0,
                yellowCards: awayArray[3] ?? 0,
                corners: awayArray[4] ?? 0,
                overtime: awayOvertimeScore, // Legacy field
                penalty: awayPenaltyScore, // Legacy field
            },
            kickoffTimestamp: liveKickoffTime, // Legacy field (same as liveKickoffTime)
        };
    }
    /**
     * Calculate display score based on the algorithm
     *
     * Algorithm:
     * - Case A (Overtime exists): If overtime_score is NOT zero:
     *   Display Score = overtime_score + penalty_score
     * - Case B (No Overtime): If overtime_score is zero:
     *   Display Score = regular_score + penalty_score
     *
     * CRITICAL: For Status 5 (Overtime) and Status 7 (Penalty), ensure correct score display
     * - Overtime (5): Show regular + overtime goals (penalty_score = 0 during OT)
     * - Penalty (7): Show regular + overtime + penalty shootout score
     *
     * @param regularScore - Index 0: Regular time score (90 min)
     * @param overtimeScore - Index 5: Overtime score (120 min aggregate)
     * @param penaltyScore - Index 6: Penalty shootout score
     * @param statusId - Match status ID (for context)
     * @returns Display score for UI
     */
    calculateDisplayScore(regularScore, overtimeScore, penaltyScore, statusId) {
        // Case A: Overtime exists (overtime_score is NOT zero)
        if (overtimeScore !== 0) {
            // During Overtime (Status 5), penalty_score is 0, so show overtime_score
            // During Penalty (Status 7), show overtime_score + penalty_score
            return overtimeScore + penaltyScore;
        }
        // Case B: No Overtime (overtime_score is zero)
        // Regular match: regular_score + penalty_score (penalty_score = 0 for regular matches)
        return regularScore + penaltyScore;
    }
    /**
     * Get score display string for UI
     * Handles Overtime and Penalty states correctly
     *
     * @param parsedScore - Parsed score data
     * @returns Display string (e.g., "2-1", "2-1 (3-2)" for penalties)
     */
    getScoreDisplayString(parsedScore) {
        const homeDisplay = parsedScore.home.score;
        const awayDisplay = parsedScore.away.score;
        // If penalty shootout is active (Status 7), show penalty score in brackets
        if (parsedScore.statusId === enums_1.MatchState.PENALTY_SHOOTOUT) {
            const homePenalty = parsedScore.home.penaltyScore ?? 0;
            const awayPenalty = parsedScore.away.penaltyScore ?? 0;
            if (homePenalty > 0 || awayPenalty > 0) {
                // Show: "2-1 (3-2)" format
                return `${homeDisplay}-${awayDisplay} (${homePenalty}-${awayPenalty})`;
            }
        }
        // Regular display: "2-1"
        return `${homeDisplay}-${awayDisplay}`;
    }
    /**
     * Parse stats message (legacy support)
     */
    parseStats(statsData) {
        return statsData.map(item => ({
            id: item.id,
            stats: item.stats,
        }));
    }
    /**
     * Parse stats to structured format (readable JSON object)
     * Maps TechnicalStatistics enum values to readable keys
     *
     * Example output:
     * {
     *   "corners": { "home": 5, "away": 3 },
     *   "possession": { "home": 52, "away": 48 },
     *   "shots_on_target": { "home": 3, "away": 4 }
     * }
     */
    parseStatsToStructured(statsMessage) {
        const statistics = {};
        if (!statsMessage.stats || statsMessage.stats.length === 0) {
            return statistics; // Return empty object if no stats (non-popular match)
        }
        for (const stat of statsMessage.stats) {
            const statKey = this.getStatisticKey(stat.type);
            if (statKey) {
                statistics[statKey] = {
                    home: stat.home ?? 0,
                    away: stat.away ?? 0,
                };
            }
        }
        return statistics;
    }
    /**
     * Map TechnicalStatistics enum value to readable key
     * Returns null for stats that shouldn't be stored (e.g., GOAL, CARD)
     */
    getStatisticKey(type) {
        // Map enum values to readable keys (only for displayable stats)
        const statKeyMap = {
            [enums_1.TechnicalStatistics.CORNER]: 'corners',
            [enums_1.TechnicalStatistics.OFFSIDE]: 'offsides',
            [enums_1.TechnicalStatistics.FREE_KICK]: 'free_kicks',
            [enums_1.TechnicalStatistics.GOAL_KICK]: 'goal_kicks',
            [enums_1.TechnicalStatistics.SHOTS_ON_TARGET]: 'shots_on_target',
            [enums_1.TechnicalStatistics.SHOTS_OFF_TARGET]: 'shots_off_target',
            [enums_1.TechnicalStatistics.ATTACKS]: 'attacks',
            [enums_1.TechnicalStatistics.DANGEROUS_ATTACK]: 'dangerous_attacks',
            [enums_1.TechnicalStatistics.BALL_POSSESSION]: 'possession',
            [enums_1.TechnicalStatistics.BLOCKED_SHOTS]: 'blocked_shots',
        };
        return statKeyMap[type] || null;
    }
    /**
     * Parse incidents message
     */
    parseIncidents(incidentsData) {
        return incidentsData.map(item => ({
            id: item.id,
            incidents: item.incidents,
        }));
    }
    /**
     * Parse incident to structured format
     * Handles: GOAL (1), RED_CARD (4), YELLOW_CARD (3), VAR (28), SUBSTITUTION (9)
     */
    parseIncidentToStructured(matchId, incident) {
        // Support array-form incidents: [type, position, time, player_id?, player_name?, ...]
        if (Array.isArray(incident)) {
            incident = {
                type: incident[0],
                position: incident[1],
                time: incident[2],
                player_id: incident[3],
                player_name: incident[4],
                assist1_id: incident[5],
                assist1_name: incident[6],
                assist2_id: incident[7],
                assist2_name: incident[8],
                in_player_id: incident[9],
                in_player_name: incident[10],
                out_player_id: incident[11],
                out_player_name: incident[12],
                home_score: incident[13],
                away_score: incident[14],
                var_reason: incident[15],
                var_result: incident[16],
                reason_type: incident[17],
            };
        }
        const incidentType = incident.type;
        const isGoal = incidentType === enums_1.TechnicalStatistics.GOAL || incidentType === enums_1.TechnicalStatistics.OWN_GOAL;
        const isCard = incidentType === enums_1.TechnicalStatistics.YELLOW_CARD ||
            incidentType === enums_1.TechnicalStatistics.RED_CARD ||
            incidentType === enums_1.TechnicalStatistics.CARD_UPGRADE_CONFIRMED;
        const isSubstitution = incidentType === enums_1.TechnicalStatistics.SUBSTITUTION;
        const isVAR = incidentType === enums_1.TechnicalStatistics.VAR ||
            incident.var_reason !== undefined ||
            incident.var_result !== undefined;
        // Check if goal is cancelled (VAR result = 2 = GOAL_CANCELLED)
        const isGoalCancelled = incident.var_result === enums_1.VARResult.GOAL_CANCELLED;
        return {
            matchId,
            type: incidentType,
            position: incident.position,
            time: incident.time || 0,
            playerId: incident.player_id,
            playerName: incident.player_name,
            assist1Id: incident.assist1_id,
            assist1Name: incident.assist1_name,
            assist2Id: incident.assist2_id,
            assist2Name: incident.assist2_name,
            inPlayerId: incident.in_player_id,
            inPlayerName: incident.in_player_name,
            outPlayerId: incident.out_player_id,
            outPlayerName: incident.out_player_name,
            homeScore: incident.home_score,
            awayScore: incident.away_score,
            varReason: incident.var_reason,
            varResult: incident.var_result,
            reasonType: incident.reason_type,
            isGoal,
            isCard,
            isSubstitution,
            isVAR,
            isGoalCancelled,
        };
    }
    /**
     * Parse tlive message
     */
    parseTlive(tliveData) {
        return tliveData.map(item => ({
            id: item.id,
            tlive: item.tlive,
        }));
    }
}
exports.WebSocketParser = WebSocketParser;
