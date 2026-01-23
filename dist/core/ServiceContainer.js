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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedServiceAccessor = exports.ServiceContainer = exports.services = exports.container = void 0;
const logger_1 = require("../utils/logger");
const TheSportsAPIManager_1 = require("./TheSportsAPIManager");
// ============================================================================
// SERVICE CONTAINER
// ============================================================================
class ServiceContainer {
    constructor() {
        this.services = new Map();
        this.factories = new Map();
        this.initializationOrder = [];
        logger_1.logger.info('[ServiceContainer] Initializing...');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ServiceContainer.instance) {
            ServiceContainer.instance = new ServiceContainer();
        }
        return ServiceContainer.instance;
    }
    /**
     * Register a service factory
     */
    register(name, factory) {
        this.factories.set(name, factory);
        logger_1.logger.debug(`[ServiceContainer] Registered factory: ${name}`);
    }
    /**
     * Get or create a service instance
     * Lazy initialization - only creates when first accessed
     */
    get(name) {
        // Return existing instance
        if (this.services.has(name)) {
            return this.services.get(name);
        }
        // Create from factory
        const factory = this.factories.get(name);
        if (!factory) {
            throw new Error(`[ServiceContainer] Service not registered: ${name}`);
        }
        const service = factory();
        this.services.set(name, service);
        this.initializationOrder.push(name);
        logger_1.logger.info(`[ServiceContainer] Created service: ${name}`);
        return service;
    }
    /**
     * Check if a service is registered
     */
    has(name) {
        return this.factories.has(name);
    }
    /**
     * Check if a service has been instantiated
     */
    isInstantiated(name) {
        return this.services.has(name);
    }
    /**
     * Get all registered service names
     */
    getRegisteredServices() {
        return Array.from(this.factories.keys());
    }
    /**
     * Get instantiated service names (in order)
     */
    getInstantiatedServices() {
        return [...this.initializationOrder];
    }
    /**
     * Clear all services (for testing)
     */
    clear() {
        this.services.clear();
        this.initializationOrder = [];
        logger_1.logger.info('[ServiceContainer] Cleared all service instances');
    }
    /**
     * Reset container completely (for testing)
     */
    static reset() {
        if (ServiceContainer.instance) {
            ServiceContainer.instance.clear();
            ServiceContainer.instance = null;
        }
    }
    /**
     * Get container health status
     */
    getHealth() {
        return {
            registeredCount: this.factories.size,
            instantiatedCount: this.services.size,
            services: this.getInstantiatedServices(),
        };
    }
}
exports.ServiceContainer = ServiceContainer;
ServiceContainer.instance = null;
// ============================================================================
// TYPED SERVICE ACCESSORS
// ============================================================================
/**
 * Typed service accessor for better DX
 * Auto-imports and lazy-loads services
 */
class TypedServiceAccessor {
    constructor() {
        this.container = ServiceContainer.getInstance();
        this.registerCoreServices();
    }
    /**
     * Register all core services with factories
     */
    registerCoreServices() {
        // TheSports API (already singleton)
        this.container.register('theSportsAPI', () => TheSportsAPIManager_1.theSportsAPI);
        // Match Services
        this.container.register('matchDetailLive', () => {
            const { MatchDetailLiveService } = require('../services/thesports/match/matchDetailLive.service');
            return new MatchDetailLiveService(TheSportsAPIManager_1.theSportsAPI);
        });
        this.container.register('matchRecent', () => {
            const { MatchRecentService } = require('../services/thesports/match/matchRecent.service');
            return new MatchRecentService(TheSportsAPIManager_1.theSportsAPI);
        });
        this.container.register('matchDetail', () => {
            const { MatchDetailService } = require('../services/thesports/match/matchDetail.service');
            return new MatchDetailService(TheSportsAPIManager_1.theSportsAPI);
        });
        // Team Services
        this.container.register('teamInfo', () => {
            const { TeamInfoService } = require('../services/thesports/team/teamInfo.service');
            return new TeamInfoService(TheSportsAPIManager_1.theSportsAPI);
        });
        // League Services
        this.container.register('leagueInfo', () => {
            const { LeagueInfoService } = require('../services/thesports/league/leagueInfo.service');
            return new LeagueInfoService(TheSportsAPIManager_1.theSportsAPI);
        });
        logger_1.logger.info('[ServiceContainer] Core services registered');
    }
    // ============================================================================
    // TYPED GETTERS
    // ============================================================================
    /**
     * TheSports API Singleton
     */
    get api() {
        return this.container.get('theSportsAPI');
    }
    /**
     * Match Detail Live Service
     */
    get matchDetailLive() {
        return this.container.get('matchDetailLive');
    }
    /**
     * Match Recent Service
     */
    get matchRecent() {
        return this.container.get('matchRecent');
    }
    /**
     * Match Detail Service
     */
    get matchDetail() {
        return this.container.get('matchDetail');
    }
    /**
     * Team Info Service
     */
    get teamInfo() {
        return this.container.get('teamInfo');
    }
    /**
     * League Info Service
     */
    get leagueInfo() {
        return this.container.get('leagueInfo');
    }
    /**
     * Get container health
     */
    getHealth() {
        return {
            api: TheSportsAPIManager_1.TheSportsAPIManager.getInstance().getHealth(),
            container: this.container.getHealth(),
        };
    }
}
exports.TypedServiceAccessor = TypedServiceAccessor;
// ============================================================================
// EXPORTS
// ============================================================================
// Container instance
exports.container = ServiceContainer.getInstance();
// Typed accessor
exports.services = new TypedServiceAccessor();
