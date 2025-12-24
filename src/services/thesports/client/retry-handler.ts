/**
 * Retry Handler with Exponential Backoff
 * 
 * Handles retry logic for TheSports API requests with exponential backoff strategy.
 */

import { AxiosError } from 'axios';
import { logger } from '../../../utils/logger';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Check if error is retryable
 */
export function isRetryableError(error: AxiosError): boolean {
  // Retry on network errors or 5xx server errors
  if (!error.response) {
    return true; // Network error
  }

  const status = error.response.status;
  return status >= 500 && status < 600; // Server errors
}

/**
 * Calculate delay for retry attempt
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (!isRetryableError(error as AxiosError)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      logger.warn(
        `Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms`,
        { error: (error as Error).message }
      );
      await sleep(delay);
    }
  }

  throw lastError!;
}

