"use strict";
/**
 * TheSports API Endpoints Configuration
 *
 * Centralized configuration for all TheSports API endpoints
 * This file ensures "Zero Error Margin" by maintaining a single source of truth
 * for all API URLs, frequencies, and sync methods.
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
exports.API_ENDPOINTS = exports.BASIC_DATA_ENDPOINTS = exports.BASIC_INFO_ENDPOINTS = exports.MQTT_CONFIG = exports.THESPORTS_BASE_URL = void 0;
exports.getEndpointUrl = getEndpointUrl;
exports.getEndpointConfig = getEndpointConfig;
exports.getFrequencyInMs = getFrequencyInMs;
/**
 * Base URL for TheSports API
 */
exports.THESPORTS_BASE_URL = 'https://api.thesports.com/v1/football';
/**
 * MQTT Configuration
 */
exports.MQTT_CONFIG = {
    host: 'mqtt://mq.thesports.com',
    topic: 'thesports/football/match/v1',
};
/**
 * A - Basic Info API Endpoints
 * These endpoints provide foundational data (categories, countries, competitions, teams, etc.)
 */
exports.BASIC_INFO_ENDPOINTS = {
    // 1. Category List
    category: {
        url: '/category/list',
        frequency: { value: 1, unit: 'day' },
        syncMethod: 'static',
        description: 'Return all categories (World, England, etc.)',
        notes: 'Data rarely changes, recommended request frequency: 1 day/time',
    },
    // 2. Country List
    country: {
        url: '/country/list',
        frequency: { value: 1, unit: 'day' },
        syncMethod: 'static',
        description: 'Return all countries/regions',
        notes: 'Data rarely changes, recommended request frequency: 1 day/time',
    },
    // 3. Competition List
    competition: {
        url: '/competition/additional/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Return full competition data, obtain new or changed data according to time query increment',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter',
        supportsPagination: true,
        supportsTimeIncrement: true,
    },
    // 4. Team List
    team: {
        url: '/team/additional/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Return full team data, obtain new or changed data according to time',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter',
        supportsPagination: true,
        supportsTimeIncrement: true,
    },
    // 5. Player List
    player: {
        url: '/player/with_stat/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Return full player data, obtain new or changed data according to time',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter. High volume data.',
        supportsPagination: true,
        supportsTimeIncrement: true,
    },
    // 6. Coach List
    coach: {
        url: '/coach/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Return full coach data, obtain new or changed data according to time',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter',
        supportsPagination: true,
        supportsTimeIncrement: true,
    },
    // 7. Referee List
    referee: {
        url: '/referee/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Return full referee data, obtain new or changed data according to time',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter',
        supportsPagination: true,
        supportsTimeIncrement: true,
    },
    // 8. Venue List
    venue: {
        url: '/venue/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Return full venue data, obtain new or changed data according to time',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter',
        supportsPagination: true,
        supportsTimeIncrement: true,
    },
    // 9. Season List
    season: {
        url: '/season/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Return full season data, obtain new or changed data according to time',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter',
        supportsPagination: true,
        supportsTimeIncrement: true,
    },
    // 10. Stage List
    stage: {
        url: '/stage/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Return full stage data, obtain new or changed data according to time',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter',
        supportsPagination: true,
        supportsTimeIncrement: true,
    },
    // 11. Data Update
    dataUpdate: {
        url: '/data/update',
        frequency: { value: 20, unit: 'second' },
        syncMethod: 'realtime',
        description: 'Returns the data changed in the last 120 seconds, which can be updated on the corresponding interface',
        notes: 'Needs to be synchronized regularly. Recommended request frequency: 20 seconds/time',
    },
};
/**
 * B - Basic Data API Endpoints
 * These endpoints provide match data, statistics, and real-time information
 */
exports.BASIC_DATA_ENDPOINTS = {
    // 1. Match Recent List
    matchRecent: {
        url: '/match/recent/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Return full match data (Request limit: starting 30 days before today), obtain new or changed data according to time',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter',
        supportsPagination: true,
        supportsTimeIncrement: true,
        timeLimit: { before: 30 },
    },
    // 2. Match Diary
    matchDiary: {
        url: '/match/diary',
        frequency: { value: 10, unit: 'minute' }, // For today's schedule
        syncMethod: 'full',
        description: 'Schedule and Results - date query. Returns full schedule results data within 24 hours after request timestamp or full schedule results data of whole day after request date',
        notes: 'Today\'s schedule: 10 minutes/time (Full update). Tomorrow and beyond: 30 minutes/time (Full update). Request limit: from 30 days before today to 30 days after. Real-time data is obtained through real-time data interface.',
        timeLimit: { before: 30, after: 30 },
    },
    // 3. Match Season Recent
    matchSeasonRecent: {
        url: '/match/season/recent',
        frequency: { value: 1, unit: 'hour' },
        syncMethod: 'full',
        description: 'Schedule and Results - season query (newest season). Returns full schedule and result data of the query season (Restriction: newest season)',
        notes: 'Request times: 120 times/min. Get the full data of the match interface, this interface does not need to be obtained again',
        rateLimit: 120,
    },
    // 4. Match Detail Live
    matchDetailLive: {
        url: '/match/detail_live',
        frequency: { value: 2, unit: 'second' },
        syncMethod: 'realtime',
        description: 'Real-time data. Return the score, match incidents, and technical statistics data in the last 120 minutes (full update)',
        notes: 'The match data beyond 120 minutes is updated and will be returned synchronously. Suggested request frequency: 2 seconds/time. Includes: corner, yellow card, red card, penalty, shots on target, shots off target, blocked shots, attacks, dangerous attack, ball possession, incidents (goal, assist, substitution, VAR, etc.)',
    },
    // 5. Match Trend Live
    matchTrendLive: {
        url: '/match/trend/live',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'realtime',
        description: 'Real-time match trends. Returns home and away team trend details for real-time matches',
        notes: 'The home team is a positive number and the away team is a negative number, and it changes by the number of minutes (there is overtime, and the change in overtime minutes is added to the second half list)',
    },
    // 6. Match Trend Detail
    matchTrendDetail: {
        url: '/match/trend/detail',
        frequency: { value: 1, unit: 'hour' },
        syncMethod: 'full',
        description: 'Match trends. Return to the match\'s home and away team trend details',
        notes: 'Request limit: Matches within 30 days before today. Request times: 120 times/min. Real-time match trend data is obtained through the real-time trend interface. If match trend data is missing or not obtained, you can use this interface to check for any gaps.',
        rateLimit: 120,
        timeLimit: { before: 30 },
    },
    // 7. Match Lineup Detail
    matchLineupDetail: {
        url: '/match/lineup/detail',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'full',
        description: 'Single match lineup. Return the lineup data of a single match (judge whether to call this interface according to the "Is there a lineup" field in the "Schedule and Results Interface"), including player incidents',
        notes: 'Request times: 120 times/min. Request limit: Matches within 30 days before today. Coordinate description: Home team coordinate origin: Upper left (x-axis right, y-axis down); Away team coordinate origin: Lower right (x-axis left, y-axis up). PS: Get the changed match id through the \'data update\' interface',
        rateLimit: 120,
        timeLimit: { before: 30 },
    },
    // 8. Match Player Stats List
    matchPlayerStatsList: {
        url: '/match/player_stats/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'realtime',
        description: 'Match player statistics. Returns the player statistics of the match where the player statistics have changed in the last 120 seconds (full update)',
        notes: 'Suggested request frequency: 1min/time',
    },
    // 9. Match Team Stats List
    matchTeamStatsList: {
        url: '/match/team_stats/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'realtime',
        description: 'Match team statistics. Returns the team statistics of the match where the team statistics have changed in the last 120 seconds (full update)',
        notes: 'Suggested request frequency: 1min/time',
    },
    // 10. Match Team Half-Time Stats List
    matchTeamHalfStatsList: {
        url: '/match/half/team_stats/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'realtime',
        description: 'Match team half-time statistics. Returns the team half-time statistics of the match where the team half-time statistics have changed in the last 120 seconds (full update)',
        notes: 'Suggested request frequency: 1min/time',
    },
    // 11. Match Analysis
    matchAnalysis: {
        url: '/match/analysis',
        frequency: { value: 1, unit: 'hour' },
        syncMethod: 'static',
        description: 'H2H. Return to match analysis statistics (historical confrontation/recent results, future matches, goal distribution)',
        notes: 'This interface is used to request data such as historical matchups of matches that have not started before the match. Most of them are historical data and change infrequently. Request limit: Matches within 30 days before today. Request times: 60 times/min',
        rateLimit: 60,
        timeLimit: { before: 30 },
    },
    // 12. Season Standing Detail
    seasonStandingDetail: {
        url: '/season/recent/table/detail',
        frequency: { value: 5, unit: 'minute' },
        syncMethod: 'full',
        description: 'Season standing (newest season). Return to season rankings data details (Restriction: newest season)',
        notes: 'Request times: 120 times/min. PS: Get the changed season id through the \'data update\' interface',
        rateLimit: 120,
    },
    // 13. Match Live History
    matchLiveHistory: {
        url: '/match/live/history',
        frequency: { value: 1, unit: 'hour' },
        syncMethod: 'full',
        description: 'Statistical data (historical matches). Return statistics for completed historical matches (score, match incidents, technical statistics)',
        notes: 'Request limit: Matches within 30 days before today. Request times: 120 times/min',
        rateLimit: 120,
        timeLimit: { before: 30 },
    },
    // 14. Match Player Stats Detail
    matchPlayerStatsDetail: {
        url: '/match/player_stats/detail',
        frequency: { value: 1, unit: 'hour' },
        syncMethod: 'full',
        description: 'Player statistics (historical matches). Return player statistics for completed historical matches',
        notes: 'Request limit: Matches within 30 days before today. Request times: 120 times/min',
        rateLimit: 120,
        timeLimit: { before: 30 },
    },
    // 15. Match Team Stats Detail
    matchTeamStatsDetail: {
        url: '/match/team_stats/detail',
        frequency: { value: 1, unit: 'hour' },
        syncMethod: 'full',
        description: 'Team statistics (historical matches). Return team statistics for completed historical matches',
        notes: 'Request limit: Matches within 30 days before today. Request times: 120 times/min',
        rateLimit: 120,
        timeLimit: { before: 30 },
    },
    // 16. Match Team Half-Time Stats Detail
    matchTeamHalfStatsDetail: {
        url: '/match/half/team_stats/detail',
        frequency: { value: 1, unit: 'hour' },
        syncMethod: 'full',
        description: 'Team half-time statistics. Return team half-time statistics for matches',
        notes: 'Request times: 120 times/min',
        rateLimit: 120,
    },
    // 17. Compensation List
    compensationList: {
        url: '/compensation/list',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'incremental',
        description: 'Historical compensation. This interface returns the statistics (historical confrontation, recent record, and historical same compensation) for the match not started within 30 days, and obtain new or changed data according to the time',
        notes: 'Full update for first time (pagination), subsequent incremental update with time parameter',
        supportsPagination: true,
        supportsTimeIncrement: true,
        timeLimit: { after: 30 },
    },
    // 18. Table Live
    tableLive: {
        url: '/table/live',
        frequency: { value: 1, unit: 'minute' }, // Using 1 minute as middle value
        syncMethod: 'realtime',
        description: 'Real-time standings. Returns the real-time changes in the season standings data within the last 10 minutes (full update)',
        notes: 'Suggested request frequency: 1~5min/time',
    },
    // 19. Match Goal Line Detail
    matchGoalLineDetail: {
        url: '/match/goal/line/detail',
        frequency: { value: 1, unit: 'minute' },
        syncMethod: 'full',
        description: 'Match Goal Line. Returns goal line data for a single match',
        notes: 'Request times: 120 times/min. PS: Get the changed match id through the \'data update\' interface',
        rateLimit: 120,
    },
    // 20. Deleted Data
    deleted: {
        url: '/deleted',
        frequency: { value: 1, unit: 'minute' }, // Using 1 minute as middle value
        syncMethod: 'full',
        description: 'Return data id (match, team, player, competition, season, stage) deleted within 24 hours, need to be synchronized regularly',
        notes: 'Suggested request frequency: 1~5min/time',
    },
};
/**
 * Combined API Endpoints Configuration
 * All endpoints in one object for easy access
 */
exports.API_ENDPOINTS = __assign(__assign({}, exports.BASIC_INFO_ENDPOINTS), exports.BASIC_DATA_ENDPOINTS);
/**
 * Get full URL for an endpoint
 */
function getEndpointUrl(endpointKey) {
    var endpoint = exports.API_ENDPOINTS[endpointKey];
    if (!endpoint) {
        throw new Error("Endpoint \"".concat(endpointKey, "\" not found in API_ENDPOINTS"));
    }
    return "".concat(exports.THESPORTS_BASE_URL).concat(endpoint.url);
}
/**
 * Get endpoint configuration by key
 */
function getEndpointConfig(endpointKey) {
    var endpoint = exports.API_ENDPOINTS[endpointKey];
    if (!endpoint) {
        throw new Error("Endpoint \"".concat(endpointKey, "\" not found in API_ENDPOINTS"));
    }
    return endpoint;
}
/**
 * Get frequency in milliseconds for scheduling
 */
function getFrequencyInMs(endpointKey) {
    var endpoint = exports.API_ENDPOINTS[endpointKey];
    if (!endpoint) {
        throw new Error("Endpoint \"".concat(endpointKey, "\" not found in API_ENDPOINTS"));
    }
    var _a = endpoint.frequency, value = _a.value, unit = _a.unit;
    switch (unit) {
        case 'second':
            return value * 1000;
        case 'minute':
            return value * 60 * 1000;
        case 'hour':
            return value * 60 * 60 * 1000;
        case 'day':
            return value * 24 * 60 * 60 * 1000;
        default:
            throw new Error("Unknown frequency unit: ".concat(unit));
    }
}
