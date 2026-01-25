/**
 * Match State Fetcher Service Tests (PHASE-2B-B1)
 *
 * Tests for API-primary match state fetching with DB fallback
 */

import { pool } from '../../../database/connection';
import { TheSportsClient } from '../../../integrations/thesports/TheSportsClient';
import {
  fetchMatchStateForPublish,
  clearMatchStateCache,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} from '../matchStateFetcher.service';

// Mock dependencies
jest.mock('../../../database/connection');
jest.mock('../../../integrations/thesports/TheSportsClient');

describe('matchStateFetcher.service', () => {
  let mockTheSportsGet: jest.Mock;
  let mockPoolQuery: jest.Mock;

  beforeEach(() => {
    // Clear cache before each test
    clearMatchStateCache();

    // Reset circuit breaker
    resetCircuitBreaker();

    // Reset mocks
    jest.clearAllMocks();

    // Mock TheSportsClient.get
    mockTheSportsGet = jest.fn();
    (TheSportsClient as jest.MockedClass<typeof TheSportsClient>).mockImplementation(() => ({
      get: mockTheSportsGet,
    } as any));

    // Mock pool.query
    mockPoolQuery = jest.fn();
    (pool as any).query = mockPoolQuery;
  });

  describe('fetchMatchStateForPublish - API Success', () => {
    it('should fetch from TheSports API successfully (PRIMARY)', async () => {
      const matchId = 'test_match_123';
      const expectedStatusId = 1; // NOT_STARTED

      mockTheSportsGet.mockResolvedValue({
        status_id: expectedStatusId,
        id: matchId,
      });

      const result = await fetchMatchStateForPublish(matchId);

      expect(result.statusId).toBe(expectedStatusId);
      expect(result.source).toBe('thesports_api');
      expect(result.isFallback).toBe(false);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.cached).toBe(false);

      // Verify API was called
      expect(mockTheSportsGet).toHaveBeenCalledWith(
        '/match',
        { match_id: matchId },
        { timeoutMs: 1500 }
      );

      // DB should NOT be called
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('should cache API result for 30 seconds', async () => {
      const matchId = 'test_match_cache';
      const expectedStatusId = 1;

      mockTheSportsGet.mockResolvedValue({
        status_id: expectedStatusId,
      });

      // First call - should hit API
      const result1 = await fetchMatchStateForPublish(matchId);
      expect(result1.cached).toBe(false);
      expect(result1.source).toBe('thesports_api');

      // Second call (within 30s) - should hit cache
      const result2 = await fetchMatchStateForPublish(matchId);
      expect(result2.cached).toBe(true);
      expect(result2.statusId).toBe(expectedStatusId);
      expect(result2.source).toBe('thesports_api');

      // API should only be called once
      expect(mockTheSportsGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchMatchStateForPublish - DB Fallback', () => {
    it('should fallback to DB when API times out', async () => {
      const matchId = 'test_match_timeout';
      const expectedStatusId = 1;

      // Mock API timeout
      mockTheSportsGet.mockRejectedValue(new Error('Request timeout'));

      // Mock DB success
      mockPoolQuery.mockResolvedValue({
        rows: [{ status_id: expectedStatusId }],
      });

      const result = await fetchMatchStateForPublish(matchId);

      expect(result.statusId).toBe(expectedStatusId);
      expect(result.source).toBe('db_fallback');
      expect(result.isFallback).toBe(true);
      expect(result.cached).toBe(false);

      // Both API and DB should be called
      expect(mockTheSportsGet).toHaveBeenCalled();
      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT status_id FROM ts_matches WHERE external_id = $1 LIMIT 1',
        [matchId]
      );
    });

    it('should fallback to DB when API returns 429 (rate limit)', async () => {
      const matchId = 'test_match_429';
      const expectedStatusId = 1;

      // Mock API rate limit error
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).statusCode = 429;
      mockTheSportsGet.mockRejectedValue(rateLimitError);

      // Mock DB success
      mockPoolQuery.mockResolvedValue({
        rows: [{ status_id: expectedStatusId }],
      });

      const result = await fetchMatchStateForPublish(matchId);

      expect(result.statusId).toBe(expectedStatusId);
      expect(result.source).toBe('db_fallback');
      expect(result.isFallback).toBe(true);
    });

    it('should fallback to DB when API response missing status_id', async () => {
      const matchId = 'test_match_no_status';
      const expectedStatusId = 1;

      // Mock API response without status_id
      mockTheSportsGet.mockResolvedValue({
        id: matchId,
        // status_id missing
      });

      // Mock DB success
      mockPoolQuery.mockResolvedValue({
        rows: [{ status_id: expectedStatusId }],
      });

      const result = await fetchMatchStateForPublish(matchId);

      expect(result.statusId).toBe(expectedStatusId);
      expect(result.source).toBe('db_fallback');
    });

    it('should cache DB fallback result', async () => {
      const matchId = 'test_match_db_cache';
      const expectedStatusId = 2; // LIVE

      mockTheSportsGet.mockRejectedValue(new Error('API error'));
      mockPoolQuery.mockResolvedValue({
        rows: [{ status_id: expectedStatusId }],
      });

      // First call - should hit DB
      const result1 = await fetchMatchStateForPublish(matchId);
      expect(result1.cached).toBe(false);
      expect(result1.source).toBe('db_fallback');

      // Second call - should hit cache
      const result2 = await fetchMatchStateForPublish(matchId);
      expect(result2.cached).toBe(true);
      expect(result2.source).toBe('db_fallback');

      // DB should only be queried once (after API failure)
      expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchMatchStateForPublish - Error Handling', () => {
    it('should throw error when both API and DB fail', async () => {
      const matchId = 'test_match_both_fail';

      mockTheSportsGet.mockRejectedValue(new Error('API error'));
      mockPoolQuery.mockRejectedValue(new Error('DB error'));

      await expect(fetchMatchStateForPublish(matchId)).rejects.toThrow(
        /Failed to fetch match state from both API and DB/
      );
    });

    it('should throw error when match not found in DB (fallback)', async () => {
      const matchId = 'test_match_not_found';

      mockTheSportsGet.mockRejectedValue(new Error('API error'));
      mockPoolQuery.mockResolvedValue({
        rows: [], // No match found
      });

      await expect(fetchMatchStateForPublish(matchId)).rejects.toThrow();
    });

    it('should throw error when DB status_id is null', async () => {
      const matchId = 'test_match_null_status';

      mockTheSportsGet.mockRejectedValue(new Error('API error'));
      mockPoolQuery.mockResolvedValue({
        rows: [{ status_id: null }],
      });

      await expect(fetchMatchStateForPublish(matchId)).rejects.toThrow(
        /Database status_id is null/
      );
    });
  });

  describe('fetchMatchStateForPublish - Circuit Breaker', () => {
    it('should open circuit breaker after 5 consecutive API failures', async () => {
      const matchId = 'test_match_breaker';

      mockTheSportsGet.mockRejectedValue(new Error('API error'));
      mockPoolQuery.mockResolvedValue({
        rows: [{ status_id: 1 }],
      });

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        clearMatchStateCache(); // Clear cache to force new API call
        await fetchMatchStateForPublish(`${matchId}_${i}`);
      }

      // Check breaker status
      const breakerStatus = getCircuitBreakerStatus();
      expect(breakerStatus.isOpen).toBe(true);
      expect(breakerStatus.consecutiveFailures).toBe(5);
    });

    it('should use DB directly when circuit breaker is open', async () => {
      const matchId = 'test_match_breaker_open';

      // Trigger 5 failures to open breaker
      mockTheSportsGet.mockRejectedValue(new Error('API error'));
      mockPoolQuery.mockResolvedValue({
        rows: [{ status_id: 1 }],
      });

      for (let i = 0; i < 5; i++) {
        clearMatchStateCache();
        await fetchMatchStateForPublish(`${matchId}_trigger_${i}`);
      }

      // Reset mock call counts
      mockTheSportsGet.mockClear();
      mockPoolQuery.mockClear();

      // Now try to fetch - should skip API entirely
      clearMatchStateCache();
      const result = await fetchMatchStateForPublish(matchId);

      expect(result.source).toBe('db_fallback');
      expect(result.isFallback).toBe(true);

      // API should NOT be called (circuit open)
      expect(mockTheSportsGet).not.toHaveBeenCalled();

      // DB should be called directly
      expect(mockPoolQuery).toHaveBeenCalled();
    });

    it('should reset circuit breaker on API success', async () => {
      const matchId = 'test_match_breaker_reset';

      // Trigger 3 failures
      mockTheSportsGet.mockRejectedValue(new Error('API error'));
      mockPoolQuery.mockResolvedValue({
        rows: [{ status_id: 1 }],
      });

      for (let i = 0; i < 3; i++) {
        clearMatchStateCache();
        await fetchMatchStateForPublish(`${matchId}_fail_${i}`);
      }

      let breakerStatus = getCircuitBreakerStatus();
      expect(breakerStatus.consecutiveFailures).toBe(3);

      // Now succeed
      clearMatchStateCache();
      mockTheSportsGet.mockResolvedValue({ status_id: 1 });
      await fetchMatchStateForPublish(`${matchId}_success`);

      // Breaker should be reset
      breakerStatus = getCircuitBreakerStatus();
      expect(breakerStatus.consecutiveFailures).toBe(0);
      expect(breakerStatus.isOpen).toBe(false);
    });
  });

  describe('fetchMatchStateForPublish - Different Status IDs', () => {
    it('should handle NOT_STARTED (status_id = 1)', async () => {
      mockTheSportsGet.mockResolvedValue({ status_id: 1 });

      const result = await fetchMatchStateForPublish('match_not_started');

      expect(result.statusId).toBe(1);
      expect(result.source).toBe('thesports_api');
    });

    it('should handle LIVE match (status_id = 2)', async () => {
      mockTheSportsGet.mockResolvedValue({ status_id: 2 });

      const result = await fetchMatchStateForPublish('match_live');

      expect(result.statusId).toBe(2);
      expect(result.source).toBe('thesports_api');
    });

    it('should handle FINISHED match (status_id = 8)', async () => {
      mockTheSportsGet.mockResolvedValue({ status_id: 8 });

      const result = await fetchMatchStateForPublish('match_finished');

      expect(result.statusId).toBe(8);
      expect(result.source).toBe('thesports_api');
    });
  });
});
