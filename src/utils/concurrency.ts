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
  const queue: Array<() => void> = [];

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
