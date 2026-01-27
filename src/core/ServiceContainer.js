"use strict";
/**
 * ServiceContainer - Dependency Injection Container
 *
 * Centralized service registry for the GoalGPT application.
 * Provides lazy initialization and type-safe service access.
 *
 * Benefits:
 * - Single point of truth for all services
 * - Lazy loading (services created only when needed)
 * - Easy testing (can mock services)
 * - Clear dependency graph
 *
 * Usage:
 *   import { services } from '../core/ServiceContainer';
 *   const result = await services.matchDetail.getMatchDetail(uuid);
 *
 * @author GoalGPT Team
 * @version 2.0.0 - DI Architecture
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedServiceAccessor = exports.ServiceContainer = exports.services = exports.container = void 0;
var logger_1 = require("../utils/logger");
var TheSportsAPIManager_1 = require("./TheSportsAPIManager");
// ============================================================================
// SERVICE CONTAINER
// ============================================================================
var ServiceContainer = /** @class */ (function () {
    function ServiceContainer() {
        this.services = new Map();
        this.factories = new Map();
        this.initializationOrder = [];
        logger_1.logger.info('[ServiceContainer] Initializing...');
    }
    /**
     * Get singleton instance
     */
    ServiceContainer.getInstance = function () {
        if (!ServiceContainer.instance) {
            ServiceContainer.instance = new ServiceContainer();
        }
        return ServiceContainer.instance;
    };
    /**
     * Register a service factory
     */
    ServiceContainer.prototype.register = function (name, factory) {
        this.factories.set(name, factory);
        logger_1.logger.debug("[ServiceContainer] Registered factory: ".concat(name));
    };
    /**
     * Get or create a service instance
     * Lazy initialization - only creates when first accessed
     */
    ServiceContainer.prototype.get = function (name) {
        // Return existing instance
        if (this.services.has(name)) {
            return this.services.get(name);
        }
        // Create from factory
        var factory = this.factories.get(name);
        if (!factory) {
            throw new Error("[ServiceContainer] Service not registered: ".concat(name));
        }
        var service = factory();
        this.services.set(name, service);
        this.initializationOrder.push(name);
        logger_1.logger.info("[ServiceContainer] Created service: ".concat(name));
        return service;
    };
    /**
     * Check if a service is registered
     */
    ServiceContainer.prototype.has = function (name) {
        return this.factories.has(name);
    };
    /**
     * Check if a service has been instantiated
     */
    ServiceContainer.prototype.isInstantiated = function (name) {
        return this.services.has(name);
    };
    /**
     * Get all registered service names
     */
    ServiceContainer.prototype.getRegisteredServices = function () {
        return Array.from(this.factories.keys());
    };
    /**
     * Get instantiated service names (in order)
     */
    ServiceContainer.prototype.getInstantiatedServices = function () {
        return __spreadArray([], this.initializationOrder, true);
    };
    /**
     * Clear all services (for testing)
     */
    ServiceContainer.prototype.clear = function () {
        this.services.clear();
        this.initializationOrder = [];
        logger_1.logger.info('[ServiceContainer] Cleared all service instances');
    };
    /**
     * Reset container completely (for testing)
     */
    ServiceContainer.reset = function () {
        if (ServiceContainer.instance) {
            ServiceContainer.instance.clear();
            ServiceContainer.instance = null;
        }
    };
    /**
     * Get container health status
     */
    ServiceContainer.prototype.getHealth = function () {
        return {
            registeredCount: this.factories.size,
            instantiatedCount: this.services.size,
            services: this.getInstantiatedServices(),
        };
    };
    ServiceContainer.instance = null;
    return ServiceContainer;
}());
exports.ServiceContainer = ServiceContainer;
// ============================================================================
// TYPED SERVICE ACCESSORS
// ============================================================================
/**
 * Typed service accessor for better DX
 * Auto-imports and lazy-loads services
 */
var TypedServiceAccessor = /** @class */ (function () {
    function TypedServiceAccessor() {
        this.container = ServiceContainer.getInstance();
        this.registerCoreServices();
    }
    /**
     * Register all core services with factories
     */
    TypedServiceAccessor.prototype.registerCoreServices = function () {
        // TheSports API (already singleton)
        this.container.register('theSportsAPI', function () { return TheSportsAPIManager_1.theSportsAPI; });
        // Match Services
        this.container.register('matchDetailLive', function () {
            var MatchDetailLiveService = require('../services/thesports/match/matchDetailLive.service').MatchDetailLiveService;
            return new MatchDetailLiveService(TheSportsAPIManager_1.theSportsAPI);
        });
        this.container.register('matchRecent', function () {
            var MatchRecentService = require('../services/thesports/match/matchRecent.service').MatchRecentService;
            return new MatchRecentService(TheSportsAPIManager_1.theSportsAPI);
        });
        this.container.register('matchDetail', function () {
            var MatchDetailService = require('../services/thesports/match/matchDetail.service').MatchDetailService;
            return new MatchDetailService(TheSportsAPIManager_1.theSportsAPI);
        });
        // Team Services
        this.container.register('teamInfo', function () {
            var TeamInfoService = require('../services/thesports/team/teamInfo.service').TeamInfoService;
            return new TeamInfoService(TheSportsAPIManager_1.theSportsAPI);
        });
        // League Services
        this.container.register('leagueInfo', function () {
            var LeagueInfoService = require('../services/thesports/league/leagueInfo.service').LeagueInfoService;
            return new LeagueInfoService(TheSportsAPIManager_1.theSportsAPI);
        });
        logger_1.logger.info('[ServiceContainer] Core services registered');
    };
    Object.defineProperty(TypedServiceAccessor.prototype, "api", {
        // ============================================================================
        // TYPED GETTERS
        // ============================================================================
        /**
         * TheSports API Singleton
         */
        get: function () {
            return this.container.get('theSportsAPI');
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TypedServiceAccessor.prototype, "matchDetailLive", {
        /**
         * Match Detail Live Service
         */
        get: function () {
            return this.container.get('matchDetailLive');
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TypedServiceAccessor.prototype, "matchRecent", {
        /**
         * Match Recent Service
         */
        get: function () {
            return this.container.get('matchRecent');
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TypedServiceAccessor.prototype, "matchDetail", {
        /**
         * Match Detail Service
         */
        get: function () {
            return this.container.get('matchDetail');
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TypedServiceAccessor.prototype, "teamInfo", {
        /**
         * Team Info Service
         */
        get: function () {
            return this.container.get('teamInfo');
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TypedServiceAccessor.prototype, "leagueInfo", {
        /**
         * League Info Service
         */
        get: function () {
            return this.container.get('leagueInfo');
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Get container health
     */
    TypedServiceAccessor.prototype.getHealth = function () {
        return {
            api: TheSportsAPIManager_1.TheSportsAPIManager.getInstance().getHealth(),
            container: this.container.getHealth(),
        };
    };
    return TypedServiceAccessor;
}());
exports.TypedServiceAccessor = TypedServiceAccessor;
// ============================================================================
// EXPORTS
// ============================================================================
// Container instance
exports.container = ServiceContainer.getInstance();
// Typed accessor
exports.services = new TypedServiceAccessor();
