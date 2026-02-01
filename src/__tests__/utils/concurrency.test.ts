import { mapWithConcurrency } from '../../utils/concurrency';

describe('mapWithConcurrency', () => {
  it('should process all items and return results in order', async () => {
    const items = [1, 2, 3, 4, 5];
    const worker = async (item: number) => item * 2;

    const results = await mapWithConcurrency(items, 2, worker);

    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('should respect concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let activeCount = 0;
    let maxActiveCount = 0;

    const worker = async (item: number) => {
      activeCount++;
      maxActiveCount = Math.max(maxActiveCount, activeCount);

      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 10));

      activeCount--;
      return item * 2;
    };

    await mapWithConcurrency(items, 3, worker);

    expect(maxActiveCount).toBeLessThanOrEqual(3);
  });

  it('should handle empty array', async () => {
    const results = await mapWithConcurrency([], 5, async (x: number) => x);
    expect(results).toEqual([]);
  });

  it('should handle errors and reject the promise', async () => {
    const items = [1, 2, 3];
    const worker = async (item: number) => {
      if (item === 2) {
        throw new Error('Test error');
      }
      return item;
    };

    await expect(mapWithConcurrency(items, 2, worker)).rejects.toThrow('Test error');
  });

  it('should preserve item index in results', async () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const worker = async (item: string, index: number) => `${item}-${index}`;

    const results = await mapWithConcurrency(items, 2, worker);

    expect(results).toEqual(['a-0', 'b-1', 'c-2', 'd-3', 'e-4']);
  });
});
