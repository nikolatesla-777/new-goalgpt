"use strict";
/**
 * TheSports API Enums - Central Export
 *
 * All enum types used for TheSports API data mapping
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Match & Game State
__exportStar(require("./MatchState.enum"), exports);
__exportStar(require("./StageMode.enum"), exports);
// Statistics
__exportStar(require("./TechnicalStatistics.enum"), exports);
__exportStar(require("./HalfTimeStatistics.enum"), exports);
// Events
__exportStar(require("./EventReason.enum"), exports);
__exportStar(require("./VARReason.enum"), exports);
__exportStar(require("./VARResult.enum"), exports);
// Data Updates
__exportStar(require("./DataUpdateType.enum"), exports);
// Competition & Team
__exportStar(require("./CompetitionType.enum"), exports);
__exportStar(require("./Gender.enum"), exports);
// Player
__exportStar(require("./PlayerPosition.enum"), exports);
__exportStar(require("./PlayerDetailedPosition.enum"), exports);
__exportStar(require("./PlayerAbilityType.enum"), exports);
__exportStar(require("./PlayerCharacteristics.enum"), exports);
__exportStar(require("./PreferredFoot.enum"), exports);
// Coach
__exportStar(require("./CoachType.enum"), exports);
