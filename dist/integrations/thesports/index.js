"use strict";
/**
 * TheSports Integration Module
 *
 * Centralized exports for TheSports API client.
 *
 * PR-5: TheSports Client Hardening
 *
 * Usage:
 *   // New hardened client (recommended)
 *   import { theSportsClient } from '../integrations/thesports';
 *   const data = await theSportsClient.get('/match/detail', { uuid: matchId });
 *
 *   // Backward-compatible adapter for legacy code
 *   import { theSportsAPIAdapter } from '../integrations/thesports';
 *   const data = await theSportsAPIAdapter.get('/match/detail', { uuid: matchId });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.theSportsAPIAdapter = exports.TheSportsClientAdapter = exports.CircuitState = exports.TheSportsClientClass = exports.TheSportsClient = exports.theSportsClient = void 0;
var TheSportsClient_1 = require("./TheSportsClient");
Object.defineProperty(exports, "theSportsClient", { enumerable: true, get: function () { return TheSportsClient_1.theSportsClient; } });
Object.defineProperty(exports, "TheSportsClient", { enumerable: true, get: function () { return TheSportsClient_1.TheSportsClient; } });
Object.defineProperty(exports, "TheSportsClientClass", { enumerable: true, get: function () { return TheSportsClient_1.TheSportsClientClass; } });
Object.defineProperty(exports, "CircuitState", { enumerable: true, get: function () { return TheSportsClient_1.CircuitState; } });
var TheSportsClientAdapter_1 = require("./TheSportsClientAdapter");
Object.defineProperty(exports, "TheSportsClientAdapter", { enumerable: true, get: function () { return TheSportsClientAdapter_1.TheSportsClientAdapter; } });
Object.defineProperty(exports, "theSportsAPIAdapter", { enumerable: true, get: function () { return TheSportsClientAdapter_1.theSportsAPIAdapter; } });
