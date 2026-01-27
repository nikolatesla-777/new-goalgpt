"use strict";
/**
 * Core Module - Application Foundation
 *
 * This module provides the core infrastructure for GoalGPT:
 * - TheSportsAPIManager: Singleton for all TheSports API calls
 * - ServiceContainer: Dependency injection container
 *
 * Usage:
 *   import { theSportsAPI, services } from '../core';
 *
 * @author GoalGPT Team
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedServiceAccessor = exports.ServiceContainer = exports.services = exports.container = exports.TheSportsAPIManager = exports.theSportsAPI = void 0;
// TheSports API Singleton
var TheSportsAPIManager_1 = require("./TheSportsAPIManager");
Object.defineProperty(exports, "theSportsAPI", { enumerable: true, get: function () { return TheSportsAPIManager_1.theSportsAPI; } });
Object.defineProperty(exports, "TheSportsAPIManager", { enumerable: true, get: function () { return TheSportsAPIManager_1.TheSportsAPIManager; } });
// Service Container (DI)
var ServiceContainer_1 = require("./ServiceContainer");
Object.defineProperty(exports, "container", { enumerable: true, get: function () { return ServiceContainer_1.container; } });
Object.defineProperty(exports, "services", { enumerable: true, get: function () { return ServiceContainer_1.services; } });
Object.defineProperty(exports, "ServiceContainer", { enumerable: true, get: function () { return ServiceContainer_1.ServiceContainer; } });
Object.defineProperty(exports, "TypedServiceAccessor", { enumerable: true, get: function () { return ServiceContainer_1.TypedServiceAccessor; } });
