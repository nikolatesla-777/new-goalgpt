"use strict";
/**
 * TheSports API Client
 *
 * Enhanced API client with retry logic, circuit breaker, and rate limiting.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TheSportsClient = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../../utils/logger");
const config_1 = require("../../../config");
const providerResilience_1 = require("../../../utils/providerResilience");
const circuitBreaker_1 = require("../../../utils/circuitBreaker");
const rate_limiter_1 = require("./rate-limiter");
const error_handler_1 = require("../../../utils/thesports/error-handler");
class TheSportsClient {
    constructor(clientConfig) {
        this.config = {
            baseUrl: clientConfig?.baseUrl ||
                config_1.config.thesports?.baseUrl ||
                'https://api.thesports.com/v1/football',
            user: clientConfig?.user || config_1.config.thesports?.user || '',
            secret: clientConfig?.secret || config_1.config.thesports?.secret || '',
            timeout: clientConfig?.timeout || 30000,
        };
        this.axiosInstance = this.createAxiosInstance();
        this.circuitBreaker = new circuitBreaker_1.CircuitBreaker('thesports-http');
        this.rateLimiter = new rate_limiter_1.RateLimiter();
        this.setupInterceptors();
    }
    /**
     * Create Axios instance
     */
    createAxiosInstance() {
        return axios_1.default.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout || 30000, // Increased from 5s to 30s for stability
            headers: {
                Accept: 'application/json',
                'User-Agent': 'GoalGPT/1.0',
            },
        });
    }
    /**
     * Setup request/response interceptors
     */
    setupInterceptors() {
        // Request interceptor
        this.axiosInstance.interceptors.request.use((cfg) => {
            logger_1.logger.debug(`TheSports API Request: ${cfg.method?.toUpperCase()} ${cfg.url}`);
            return cfg;
        }, (error) => {
            logger_1.logger.error('TheSports API Request Error:', error);
            return Promise.reject(error);
        });
        // Response interceptor
        this.axiosInstance.interceptors.response.use((response) => response, (error) => {
            const formattedError = (0, error_handler_1.formatTheSportsError)(error);
            (0, error_handler_1.logTheSportsError)(formattedError, 'Interceptor');
            return Promise.reject(error);
        });
    }
    /**
     * Build query parameters with authentication
     */
    buildQueryParams(params = {}) {
        const queryParams = new URLSearchParams({
            user: this.config.user,
            secret: this.config.secret,
            ...params,
        });
        return queryParams;
    }
    /**
     * Execute GET request with all protections
     */
    async get(endpoint, params = {}, requestConfig) {
        // Rate limiting
        await this.rateLimiter.acquire(endpoint);
        // Phase 4-2: Circuit breaker + Retry with structured logging
        return this.circuitBreaker.execute(async () => {
            return (0, providerResilience_1.withRetry)(async () => {
                const queryParams = this.buildQueryParams(params);
                const url = `${endpoint}?${queryParams.toString()}`;
                const response = await this.axiosInstance.get(url, requestConfig);
                return response.data;
            }, endpoint // Pass endpoint for logging
            );
        });
    }
    /**
     * Execute POST request with all protections
     */
    async post(endpoint, data, requestConfig) {
        await this.rateLimiter.acquire(endpoint);
        return this.circuitBreaker.execute(async () => {
            return (0, providerResilience_1.withRetry)(async () => {
                const queryParams = this.buildQueryParams();
                const url = `${endpoint}?${queryParams.toString()}`;
                const response = await this.axiosInstance.post(url, data, requestConfig);
                return response.data;
            }, endpoint // Pass endpoint for logging
            );
        });
    }
    /**
     * Get circuit breaker state
     */
    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }
}
exports.TheSportsClient = TheSportsClient;
