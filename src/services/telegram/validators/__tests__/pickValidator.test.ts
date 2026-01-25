/**
 * PHASE-2A: Pick Validator Unit Tests
 *
 * Purpose: Verify pick validation logic
 */

import { validatePicks, isSupportedMarket, SUPPORTED_MARKETS } from '../pickValidator';

describe('Pick Validator - Supported Markets', () => {
  test('BTTS_YES is supported', () => {
    expect(isSupportedMarket('BTTS_YES')).toBe(true);
  });

  test('O25_OVER is supported', () => {
    expect(isSupportedMarket('O25_OVER')).toBe(true);
  });

  test('O15_OVER is supported', () => {
    expect(isSupportedMarket('O15_OVER')).toBe(true);
  });

  test('HT_O05_OVER is supported', () => {
    expect(isSupportedMarket('HT_O05_OVER')).toBe(true);
  });

  test('O35_OVER is NOT supported', () => {
    expect(isSupportedMarket('O35_OVER')).toBe(false);
  });

  test('CORNERS_9.5 is NOT supported', () => {
    expect(isSupportedMarket('CORNERS_9.5')).toBe(false);
  });

  test('Unsupported markets list has 4 items', () => {
    expect(SUPPORTED_MARKETS).toHaveLength(4);
  });
});

describe('Pick Validator - Valid Picks', () => {
  test('Single valid pick should pass', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: 1.85 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('Multiple valid picks should pass', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: 1.85 },
      { market_type: 'O25_OVER', odds: 1.92 },
      { market_type: 'O15_OVER', odds: 1.50 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(true);
  });

  test('Valid pick without odds should pass (odds optional)', () => {
    const picks = [
      { market_type: 'BTTS_YES' },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(true);
  });

  test('All 4 supported markets should pass', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: 1.85 },
      { market_type: 'O25_OVER', odds: 1.92 },
      { market_type: 'O15_OVER', odds: 1.50 },
      { market_type: 'HT_O05_OVER', odds: 1.70 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(true);
  });
});

describe('Pick Validator - Invalid Picks', () => {
  test('Empty picks array should fail', () => {
    const picks: any[] = [];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('At least one pick is required');
    expect(result.errorCode).toBe('NO_PICKS');
  });

  test('Unsupported market type should fail', () => {
    const picks = [
      { market_type: 'O35_OVER', odds: 2.10 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported market: O35_OVER');
    expect(result.errorCode).toBe('INVALID_PICKS');
    expect(result.invalidPicks).toContain('Unsupported market: O35_OVER');
  });

  test('Multiple unsupported markets should fail', () => {
    const picks = [
      { market_type: 'O35_OVER' },
      { market_type: 'CORNERS_9.5' },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.invalidPicks).toHaveLength(2);
  });

  test('Duplicate market types should fail', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: 1.85 },
      { market_type: 'BTTS_YES', odds: 1.90 }, // DUPLICATE
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Duplicate markets: BTTS_YES');
    expect(result.invalidPicks).toContain('Duplicate markets: BTTS_YES');
  });

  test('Missing market_type should fail', () => {
    const picks = [
      { odds: 1.85 } as any, // Missing market_type
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing market_type');
  });

  test('Mix of valid and invalid should fail', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: 1.85 }, // VALID
      { market_type: 'CORNERS_9.5' },          // INVALID
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.invalidPicks).toContain('Unsupported market: CORNERS_9.5');
  });
});

describe('Pick Validator - Edge Cases', () => {
  test('Null picks should fail gracefully', () => {
    const result = validatePicks(null as any);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('NO_PICKS');
  });

  test('Undefined picks should fail gracefully', () => {
    const result = validatePicks(undefined as any);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('NO_PICKS');
  });

  test('Picks with null odds should pass (odds optional)', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: null },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(true);
  });

  test('Case-sensitive market type should fail', () => {
    const picks = [
      { market_type: 'btts_yes' }, // Lowercase - not matching
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported market: btts_yes');
  });
});

describe('Pick Validator - Odds Validation', () => {
  test('Valid odds should pass (1.85)', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: 1.85 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(true);
  });

  test('Valid odds should pass (edge case: 1.01)', () => {
    const picks = [
      { market_type: 'O25_OVER', odds: 1.01 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(true);
  });

  test('Valid odds should pass (edge case: 100.00)', () => {
    const picks = [
      { market_type: 'O15_OVER', odds: 100.0 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(true);
  });

  test('Undefined odds should pass (odds optional)', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: undefined },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(true);
  });

  test('Invalid odds: negative should fail', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: -1.5 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid odds');
    expect(result.error).toContain('must be 1.01-100.00');
  });

  test('Invalid odds: zero should fail', () => {
    const picks = [
      { market_type: 'O25_OVER', odds: 0 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be 1.01-100.00');
  });

  test('Invalid odds: too low (1.00) should fail', () => {
    const picks = [
      { market_type: 'O15_OVER', odds: 1.0 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be 1.01-100.00');
  });

  test('Invalid odds: too high (101.00) should fail', () => {
    const picks = [
      { market_type: 'HT_O05_OVER', odds: 101.0 },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be 1.01-100.00');
  });

  test('Invalid odds: NaN should fail', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: NaN },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a number');
  });

  test('Invalid odds: string should fail', () => {
    const picks = [
      { market_type: 'O25_OVER', odds: '1.85' as any },
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a number');
  });

  test('Mix of valid and invalid odds should fail', () => {
    const picks = [
      { market_type: 'BTTS_YES', odds: 1.85 },    // VALID
      { market_type: 'O25_OVER', odds: -2.0 },    // INVALID
    ];

    const result = validatePicks(picks);

    expect(result.valid).toBe(false);
    expect(result.invalidPicks).toContain('Invalid odds for O25_OVER: -2 (must be 1.01-100.00)');
  });
});
