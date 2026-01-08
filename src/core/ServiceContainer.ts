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

import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';
import { TheSportsAPIManager, theSportsAPI } from './TheSportsAPIManager';

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Base interface for all services
 */
interface BaseService {
  readonly serviceName: string;
  isInitialized(): boolean;
}

/**
 * Service factory function type
 */
type ServiceFactory<T> = () => T;

// ============================================================================
// SERVICE CONTAINER
// ============================================================================

class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  private services: Map<string, any> = new Map();
  private factories: Map<string, ServiceFactory<any>> = new Map();
  private initializationOrder: string[] = [];

  private constructor() {
    logger.info('[ServiceContainer] Initializing...');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * Register a service factory
   */
  register<T>(name: string, factory: ServiceFactory<T>): void {
    this.factories.set(name, factory);
    logger.debug(`[ServiceContainer] Registered factory: ${name}`);
  }

  /**
   * Get or create a service instance
   * Lazy initialization - only creates when first accessed
   */
  get<T>(name: string): T {
    // Return existing instance
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    // Create from factory
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`[ServiceContainer] Service not registered: ${name}`);
    }

    const service = factory();
    this.services.set(name, service);
    this.initializationOrder.push(name);

    logger.info(`[ServiceContainer] Created service: ${name}`);
    return service as T;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.factories.has(name);
  }

  /**
   * Check if a service has been instantiated
   */
  isInstantiated(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Get instantiated service names (in order)
   */
  getInstantiatedServices(): string[] {
    return [...this.initializationOrder];
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear();
    this.initializationOrder = [];
    logger.info('[ServiceContainer] Cleared all service instances');
  }

  /**
   * Reset container completely (for testing)
   */
  static reset(): void {
    if (ServiceContainer.instance) {
      ServiceContainer.instance.clear();
      ServiceContainer.instance = null;
    }
  }

  /**
   * Get container health status
   */
  getHealth(): {
    registeredCount: number;
    instantiatedCount: number;
    services: string[];
  } {
    return {
      registeredCount: this.factories.size,
      instantiatedCount: this.services.size,
      services: this.getInstantiatedServices(),
    };
  }
}

// ============================================================================
// TYPED SERVICE ACCESSORS
// ============================================================================

/**
 * Typed service accessor for better DX
 * Auto-imports and lazy-loads services
 */
class TypedServiceAccessor {
  private container: ServiceContainer;

  constructor() {
    this.container = ServiceContainer.getInstance();
    this.registerCoreServices();
  }

  /**
   * Register all core services with factories
   */
  private registerCoreServices(): void {
    // TheSports API (already singleton)
    this.container.register('theSportsAPI', () => theSportsAPI);

    // Match Services
    this.container.register('matchDetailLive', () => {
      const { MatchDetailLiveService } = require('../services/thesports/match/matchDetailLive.service');
      return new MatchDetailLiveService(theSportsAPI);
    });

    this.container.register('matchRecent', () => {
      const { MatchRecentService } = require('../services/thesports/match/matchRecent.service');
      return new MatchRecentService(theSportsAPI);
    });

    this.container.register('matchDetail', () => {
      const { MatchDetailService } = require('../services/thesports/match/matchDetail.service');
      return new MatchDetailService(theSportsAPI);
    });

    // Team Services
    this.container.register('teamInfo', () => {
      const { TeamInfoService } = require('../services/thesports/team/teamInfo.service');
      return new TeamInfoService(theSportsAPI);
    });

    // League Services
    this.container.register('leagueInfo', () => {
      const { LeagueInfoService } = require('../services/thesports/league/leagueInfo.service');
      return new LeagueInfoService(theSportsAPI);
    });

    logger.info('[ServiceContainer] Core services registered');
  }

  // ============================================================================
  // TYPED GETTERS
  // ============================================================================

  /**
   * TheSports API Singleton
   */
  get api(): typeof theSportsAPI {
    return this.container.get('theSportsAPI');
  }

  /**
   * Match Detail Live Service
   */
  get matchDetailLive(): any {
    return this.container.get('matchDetailLive');
  }

  /**
   * Match Recent Service
   */
  get matchRecent(): any {
    return this.container.get('matchRecent');
  }

  /**
   * Match Detail Service
   */
  get matchDetail(): any {
    return this.container.get('matchDetail');
  }

  /**
   * Team Info Service
   */
  get teamInfo(): any {
    return this.container.get('teamInfo');
  }

  /**
   * League Info Service
   */
  get leagueInfo(): any {
    return this.container.get('leagueInfo');
  }

  /**
   * Get container health
   */
  getHealth() {
    return {
      api: TheSportsAPIManager.getInstance().getHealth(),
      container: this.container.getHealth(),
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Container instance
export const container = ServiceContainer.getInstance();

// Typed accessor
export const services = new TypedServiceAccessor();

// Re-export classes for advanced usage
export { ServiceContainer, TypedServiceAccessor };
