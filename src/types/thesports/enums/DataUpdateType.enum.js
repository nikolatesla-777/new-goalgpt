"use strict";
/**
 * Data Update Type Enum
 *
 * Represents types of data updates from TheSports API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataUpdateType = void 0;
var DataUpdateType;
(function (DataUpdateType) {
    DataUpdateType[DataUpdateType["SINGLE_MATCH_LINEUP"] = 1] = "SINGLE_MATCH_LINEUP";
    DataUpdateType[DataUpdateType["BRACKET"] = 2] = "BRACKET";
    DataUpdateType[DataUpdateType["SEASON_STANDING"] = 3] = "SEASON_STANDING";
    DataUpdateType[DataUpdateType["SEASON_TEAM_STATISTICS"] = 4] = "SEASON_TEAM_STATISTICS";
    DataUpdateType[DataUpdateType["SEASON_PLAYER_STATISTICS"] = 5] = "SEASON_PLAYER_STATISTICS";
    DataUpdateType[DataUpdateType["SEASON_TOP_SCORER"] = 6] = "SEASON_TOP_SCORER";
    DataUpdateType[DataUpdateType["FIFA_MEN"] = 7] = "FIFA_MEN";
    DataUpdateType[DataUpdateType["FIFA_WOMEN"] = 8] = "FIFA_WOMEN";
    DataUpdateType[DataUpdateType["WORLD_CLUBS_RANKING"] = 9] = "WORLD_CLUBS_RANKING";
    DataUpdateType[DataUpdateType["MATCH_INCIDENT_GIF"] = 10] = "MATCH_INCIDENT_GIF";
    DataUpdateType[DataUpdateType["MATCH_GOAL_LINE"] = 11] = "MATCH_GOAL_LINE"; // match goal line
})(DataUpdateType || (exports.DataUpdateType = DataUpdateType = {}));
