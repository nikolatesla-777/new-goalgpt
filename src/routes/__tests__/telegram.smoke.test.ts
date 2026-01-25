/**
 * PHASE-2A: E2E Smoke Tests
 *
 * Purpose: Verify critical rejection scenarios work end-to-end
 *
 * These are MINIMAL smoke tests to verify:
 * 1. LIVE match rejection
 * 2. Unsupported market rejection
 * 3. Duplicate picks rejection
 * 4. Invalid odds rejection
 *
 * NOT full integration tests - just critical path verification
 */

import { validateMatchStateForPublish } from '../../services/telegram/validators/matchStateValidator';
import { validatePicks } from '../../services/telegram/validators/pickValidator';

describe('PHASE-2A Smoke Tests - Critical Rejections', () => {
  describe('Smoke Test 1: LIVE Match Rejection', () => {
    test('Should reject FIRST_HALF match (status_id = 2)', () => {
      const result = validateMatchStateForPublish(2, 'match-123'); // 2 = FIRST_HALF

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MATCH_LIVE');
      expect(result.error).toContain('FIRST_HALF');
      expect(result.error).toContain('Cannot publish predictions for live matches');
    });

    test('Should reject SECOND_HALF match (status_id = 4)', () => {
      const result = validateMatchStateForPublish(4, 'match-456'); // 4 = SECOND_HALF

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MATCH_LIVE');
      expect(result.error).toContain('SECOND_HALF');
    });

    test('Should reject OVERTIME match (status_id = 5)', () => {
      const result = validateMatchStateForPublish(5, 'match-789'); // 5 = OVERTIME

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MATCH_LIVE');
    });
  });

  describe('Smoke Test 2: Unsupported Market Rejection', () => {
    test('Should reject O35_OVER (not in supported list)', () => {
      const picks = [
        { market_type: 'O35_OVER', odds: 2.10 },
      ];

      const result = validatePicks(picks, 'post-123');

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PICKS');
      expect(result.error).toContain('Unsupported market: O35_OVER');
      expect(result.invalidPicks).toContain('Unsupported market: O35_OVER');
    });

    test('Should reject CORNERS_9.5 (not in supported list)', () => {
      const picks = [
        { market_type: 'CORNERS_9.5' },
      ];

      const result = validatePicks(picks, 'post-456');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported market: CORNERS_9.5');
    });

    test('Should reject multiple unsupported markets', () => {
      const picks = [
        { market_type: 'O35_OVER' },
        { market_type: 'CARDS_3.5' },
      ];

      const result = validatePicks(picks);

      expect(result.valid).toBe(false);
      expect(result.invalidPicks?.length).toBe(2);
    });
  });

  describe('Smoke Test 3: Duplicate Picks Rejection', () => {
    test('Should reject duplicate BTTS_YES picks', () => {
      const picks = [
        { market_type: 'BTTS_YES', odds: 1.85 },
        { market_type: 'BTTS_YES', odds: 1.90 }, // DUPLICATE
      ];

      const result = validatePicks(picks, 'post-789');

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PICKS');
      expect(result.error).toContain('Duplicate markets: BTTS_YES');
      expect(result.invalidPicks).toContain('Duplicate markets: BTTS_YES');
    });

    test('Should reject duplicate O25_OVER picks', () => {
      const picks = [
        { market_type: 'O25_OVER', odds: 1.92 },
        { market_type: 'O25_OVER', odds: 2.00 }, // DUPLICATE
      ];

      const result = validatePicks(picks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Duplicate markets: O25_OVER');
    });
  });

  describe('Smoke Test 4: Invalid Odds Rejection', () => {
    test('Should reject negative odds', () => {
      const picks = [
        { market_type: 'BTTS_YES', odds: -1.5 },
      ];

      const result = validatePicks(picks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid odds');
      expect(result.error).toContain('must be 1.01-100.00');
    });

    test('Should reject odds below minimum (1.00)', () => {
      const picks = [
        { market_type: 'O25_OVER', odds: 1.0 },
      ];

      const result = validatePicks(picks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('1.01-100.00');
    });

    test('Should reject odds above maximum (101.00)', () => {
      const picks = [
        { market_type: 'O15_OVER', odds: 101.0 },
      ];

      const result = validatePicks(picks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('1.01-100.00');
    });

    test('Should reject NaN odds', () => {
      const picks = [
        { market_type: 'HT_O05_OVER', odds: NaN },
      ];

      const result = validatePicks(picks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a number');
    });
  });

  describe('Smoke Test 5: Valid Scenarios (Happy Path)', () => {
    test('Should accept NOT_STARTED match (status_id = 1)', () => {
      const result = validateMatchStateForPublish(1, 'match-123'); // 1 = NOT_STARTED

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('Should accept valid supported markets', () => {
      const picks = [
        { market_type: 'BTTS_YES', odds: 1.85 },
        { market_type: 'O25_OVER', odds: 1.92 },
        { market_type: 'O15_OVER', odds: 1.50 },
        { market_type: 'HT_O05_OVER', odds: 1.70 },
      ];

      const result = validatePicks(picks);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('Should accept picks without odds (optional)', () => {
      const picks = [
        { market_type: 'BTTS_YES' },
        { market_type: 'O25_OVER', odds: null },
        { market_type: 'O15_OVER', odds: undefined },
      ];

      const result = validatePicks(picks);

      expect(result.valid).toBe(true);
    });

    test('Should accept edge case odds (1.01 and 100.00)', () => {
      const picks = [
        { market_type: 'BTTS_YES', odds: 1.01 },
        { market_type: 'O25_OVER', odds: 100.0 },
      ];

      const result = validatePicks(picks);

      expect(result.valid).toBe(true);
    });
  });
});

describe('PHASE-2A Smoke Tests - Combined Scenarios', () => {
  test('Should reject mix of valid and invalid picks', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: 1.85 },    // VALID
      { market_type: 'O35_OVER', odds: 2.10 },    // INVALID (unsupported)
      { market_type: 'O25_OVER', odds: -1.5 },    // INVALID (negative odds)
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.invalidPicks?.length).toBeGreaterThan(0);
  });

  test('Should handle empty picks array', () => {
    const picks: any[] = [];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('NO_PICKS');
    expect(result.error).toContain('At least one pick is required');
  });

  test('Should handle null picks gracefully', () => {
    const result = validatePicks(null as any);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('NO_PICKS');
  });

  test('Should reject FINISHED match', () => {
    const result = validateMatchStateForPublish(8, 'match-finished'); // 8 = ENDED

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('MATCH_FINISHED');
  });
});
