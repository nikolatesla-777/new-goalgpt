/**
 * Error Handling Utilities
 *
 * Type-safe error handling helpers to replace `error: any` patterns
 */

/**
 * Extract error message from unknown error type
 * Use this instead of `error: any` in catch blocks
 *
 * @example
 * try {
 *   // ... code
 * } catch (error: unknown) {
 *   const message = getErrorMessage(error);
 *   logger.error('Operation failed:', message);
 * }
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unknown error occurred';
}

/**
 * Extract error stack from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Check if error has a specific property
 */
export function hasErrorProperty<K extends string>(
  error: unknown,
  property: K
): error is { [key in K]: unknown } {
  return error !== null && typeof error === 'object' && property in error;
}

/**
 * Extract HTTP status code from error if available
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (hasErrorProperty(error, 'statusCode')) {
    return typeof error.statusCode === 'number' ? error.statusCode : undefined;
  }
  if (hasErrorProperty(error, 'status')) {
    return typeof error.status === 'number' ? error.status : undefined;
  }
  return undefined;
}

/**
 * Create a standardized error object
 */
export function createError(message: string, code?: string, details?: Record<string, unknown>): Error & { code?: string; details?: Record<string, unknown> } {
  const error = new Error(message) as Error & { code?: string; details?: Record<string, unknown> };
  if (code) error.code = code;
  if (details) error.details = details;
  return error;
}

/**
 * Type guard to check if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Safely stringify an error for logging
 */
export function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
