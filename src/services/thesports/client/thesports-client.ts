/**
 * TheSports API Client
 *
 * Enhanced API client with retry logic, circuit breaker, and rate limiting.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../../../utils/logger';
import { config } from '../../../config';
import { withRetry, isRetryableError } from '../../../utils/providerResilience';
import { CircuitBreaker } from '../../../utils/circuitBreaker';
import { RateLimiter } from './rate-limiter';
import { formatTheSportsError, logTheSportsError } from '../../../utils/thesports/error-handler';

export interface TheSportsClientConfig {
  baseUrl: string;
  user: string;
  secret: string;
  timeout?: number;
}

export class TheSportsClient {
  private axiosInstance: AxiosInstance;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private config: TheSportsClientConfig;

  constructor(clientConfig?: Partial<TheSportsClientConfig>) {
    this.config = {
      baseUrl:
        clientConfig?.baseUrl ||
        config.thesports?.baseUrl ||
        'https://api.thesports.com/v1/football',
      user: clientConfig?.user || config.thesports?.user || '',
      secret: clientConfig?.secret || config.thesports?.secret || '',
      timeout: clientConfig?.timeout || 30000,
    };

    this.axiosInstance = this.createAxiosInstance();
    this.circuitBreaker = new CircuitBreaker('thesports-http');
    this.rateLimiter = new RateLimiter();
    this.setupInterceptors();
  }

  /**
   * Create Axios instance
   */
  private createAxiosInstance(): AxiosInstance {
    return axios.create({
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
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (cfg) => {
        logger.debug(`TheSports API Request: ${cfg.method?.toUpperCase()} ${cfg.url}`);
        return cfg;
      },
      (error) => {
        logger.error('TheSports API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        const formattedError = formatTheSportsError(error);
        logTheSportsError(formattedError, 'Interceptor');
        return Promise.reject(error);
      }
    );
  }

  /**
   * Build query parameters with authentication
   */
  private buildQueryParams(params: Record<string, any> = {}): URLSearchParams {
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
  async get<T>(
    endpoint: string,
    params: Record<string, any> = {},
    requestConfig?: AxiosRequestConfig
  ): Promise<T> {
    // Rate limiting
    await this.rateLimiter.acquire(endpoint);

    // Phase 4-2: Circuit breaker + Retry with structured logging
    return this.circuitBreaker.execute(async () => {
      return withRetry(
        async () => {
          const queryParams = this.buildQueryParams(params);
          const url = `${endpoint}?${queryParams.toString()}`;
          const response: AxiosResponse<T> = await this.axiosInstance.get(url, requestConfig);
          return response.data;
        },
        endpoint // Pass endpoint for logging
      );
    });
  }

  /**
   * Execute POST request with all protections
   */
  async post<T>(
    endpoint: string,
    data?: any,
    requestConfig?: AxiosRequestConfig
  ): Promise<T> {
    await this.rateLimiter.acquire(endpoint);

    return this.circuitBreaker.execute(async () => {
      return withRetry(
        async () => {
          const queryParams = this.buildQueryParams();
          const url = `${endpoint}?${queryParams.toString()}`;
          const response: AxiosResponse<T> = await this.axiosInstance.post(url, data, requestConfig);
          return response.data;
        },
        endpoint // Pass endpoint for logging
      );
    });
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}
