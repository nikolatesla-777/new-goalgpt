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

// TheSports API Singleton
export { theSportsAPI, TheSportsAPIManager } from './TheSportsAPIManager';
export type { TheSportsClientConfig, RateLimitConfig } from './TheSportsAPIManager';

// Service Container (DI)
export { container, services, ServiceContainer, TypedServiceAccessor } from './ServiceContainer';
