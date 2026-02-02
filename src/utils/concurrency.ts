/**
 * Concurrency Control Utilities
 *
 * PR-P1C: Prevents pool exhaustion and fire-and-forget crashes
 * by enforcing bounded concurrency limits across the application.
 */

/**
 * Execute an array of items with controlled concurrency
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent operations
 * @param worker - Async function to process each item
 * @returns Array of results in the same order as input items
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let activeCount = 0;
  let currentIndex = 0;

  return new Promise((resolve, reject) => {
    const processNext = () => {
      while (activeCount < limit && currentIndex < items.length) {
        const index = currentIndex++;
        activeCount++;

        worker(items[index], index)
          .then((result) => {
            results[index] = result;
            activeCount--;

            if (currentIndex >= items.length && activeCount === 0) {
              resolve(results);
            } else {
              processNext();
            }
          })
          .catch((error) => {
            reject(error);
          });
      }
    };

    if (items.length === 0) {
      resolve(results);
    } else {
      processNext();
    }
  });
}

/**
 * Execute an array of items with controlled concurrency (no return values)
 * Useful for side-effects only (database writes, notifications, etc.)
 *
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent operations
 * @param worker - Async function to process each item
 */
export async function forEachWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  await mapWithConcurrency(items, limit, worker);
}

/**
 * ConcurrencyLimiter class for reusable bounded concurrency
 *
 * Example usage:
 * ```typescript
 * const limiter = new ConcurrencyLimiter(10);
 * const results = await limiter.map(users, async (user) => {
 *   return await processUser(user);
 * });
 * ```
 */
export class ConcurrencyLimiter {
  constructor(private readonly limit: number) {
    if (limit <= 0) {
      throw new Error('Concurrency limit must be greater than 0');
    }
  }

  /**
   * Map items with bounded concurrency
   */
  async map<T, R>(
    items: T[],
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    return mapWithConcurrency(items, this.limit, worker);
  }

  /**
   * ForEach with bounded concurrency (no return values)
   */
  async forEach<T>(
    items: T[],
    worker: (item: T, index: number) => Promise<void>
  ): Promise<void> {
    await forEachWithConcurrency(items, this.limit, worker);
  }

  /**
   * Get current concurrency limit
   */
  getLimit(): number {
    return this.limit;
  }
}
