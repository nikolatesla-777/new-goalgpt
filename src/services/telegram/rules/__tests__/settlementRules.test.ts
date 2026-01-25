/**
 * PHASE-2A: Settlement Rules Unit Tests
 *
 * Purpose: Verify correctness of settlement evaluation logic
 *
 * CRITICAL: These tests ensure picks are settled correctly.
 * Any failure here is a BLOCKER for deployment.
 */

import { evaluateSettlement, outcomeToStatus } from '../settlementRules';
import type { MatchScoreData } from '../settlementRules';

describe('Settlement Rules - BTTS (Both Teams To Score)', () => {
  test('BTTS: 3-1 should be WON (both teams scored)', () => {
    const scores: MatchScoreData = {
      home_score: 3,
      away_score: 1,
    };

    const result = evaluateSettlement('BTTS_YES', scores);

    expect(result.outcome).toBe('WON');
    expect(result.rule).toContain('Both teams score');
    expect(result.data.home_score).toBe(3);
    expect(result.data.away_score).toBe(1);
  });

  test('BTTS: 2-1 should be WON (both teams scored)', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: 1,
    };

    const result = evaluateSettlement('BTTS_YES', scores);

    expect(result.outcome).toBe('WON');
  });

  test('BTTS: 1-0 should be LOST (away did not score)', () => {
    const scores: MatchScoreData = {
      home_score: 1,
      away_score: 0,
    };

    const result = evaluateSettlement('BTTS_YES', scores);

    expect(result.outcome).toBe('LOST');
    expect(result.rule).toContain('Both teams score');
  });

  test('BTTS: 0-2 should be LOST (home did not score)', () => {
    const scores: MatchScoreData = {
      home_score: 0,
      away_score: 2,
    };

    const result = evaluateSettlement('BTTS_YES', scores);

    expect(result.outcome).toBe('LOST');
  });

  test('BTTS: 0-0 should be LOST (neither team scored)', () => {
    const scores: MatchScoreData = {
      home_score: 0,
      away_score: 0,
    };

    const result = evaluateSettlement('BTTS_YES', scores);

    expect(result.outcome).toBe('LOST');
  });

  test('BTTS: negative score should be VOID (invalid data)', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: -1,
    };

    const result = evaluateSettlement('BTTS_YES', scores);

    expect(result.outcome).toBe('VOID');
    expect(result.rule).toContain('Invalid negative scores');
  });
});

describe('Settlement Rules - O2.5 (Over 2.5 Goals)', () => {
  test('O2.5: 2-1 should be WON (3 goals >= 3)', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: 1,
    };

    const result = evaluateSettlement('O25_OVER', scores);

    expect(result.outcome).toBe('WON');
    expect(result.rule).toContain('Total goals >= 3');
    expect(result.data.total_goals).toBe(3);
  });

  test('O2.5: 3-2 should be WON (5 goals >= 3)', () => {
    const scores: MatchScoreData = {
      home_score: 3,
      away_score: 2,
    };

    const result = evaluateSettlement('O25_OVER', scores);

    expect(result.outcome).toBe('WON');
    expect(result.data.total_goals).toBe(5);
  });

  test('O2.5: 1-1 should be LOST (2 goals < 3)', () => {
    const scores: MatchScoreData = {
      home_score: 1,
      away_score: 1,
    };

    const result = evaluateSettlement('O25_OVER', scores);

    expect(result.outcome).toBe('LOST');
    expect(result.data.total_goals).toBe(2);
  });

  test('O2.5: 0-0 should be LOST (0 goals < 3)', () => {
    const scores: MatchScoreData = {
      home_score: 0,
      away_score: 0,
    };

    const result = evaluateSettlement('O25_OVER', scores);

    expect(result.outcome).toBe('LOST');
    expect(result.data.total_goals).toBe(0);
  });

  test('O2.5: negative score should be VOID', () => {
    const scores: MatchScoreData = {
      home_score: -1,
      away_score: 1,
    };

    const result = evaluateSettlement('O25_OVER', scores);

    expect(result.outcome).toBe('VOID');
  });
});

describe('Settlement Rules - O1.5 (Over 1.5 Goals)', () => {
  test('O1.5: 2-1 should be WON (3 goals >= 2)', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: 1,
    };

    const result = evaluateSettlement('O15_OVER', scores);

    expect(result.outcome).toBe('WON');
    expect(result.data.total_goals).toBe(3);
  });

  test('O1.5: 1-1 should be WON (2 goals >= 2)', () => {
    const scores: MatchScoreData = {
      home_score: 1,
      away_score: 1,
    };

    const result = evaluateSettlement('O15_OVER', scores);

    expect(result.outcome).toBe('WON');
    expect(result.data.total_goals).toBe(2);
  });

  test('O1.5: 1-0 should be LOST (1 goal < 2)', () => {
    const scores: MatchScoreData = {
      home_score: 1,
      away_score: 0,
    };

    const result = evaluateSettlement('O15_OVER', scores);

    expect(result.outcome).toBe('LOST');
    expect(result.data.total_goals).toBe(1);
  });

  test('O1.5: 0-0 should be LOST (0 goals < 2)', () => {
    const scores: MatchScoreData = {
      home_score: 0,
      away_score: 0,
    };

    const result = evaluateSettlement('O15_OVER', scores);

    expect(result.outcome).toBe('LOST');
    expect(result.data.total_goals).toBe(0);
  });
});

describe('Settlement Rules - HT O0.5 (Half-Time Over 0.5)', () => {
  test('HT O0.5: HT 1-0 should be WON (1 HT goal >= 1)', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: 1,
      ht_home_score: 1,
      ht_away_score: 0,
    };

    const result = evaluateSettlement('HT_O05_OVER', scores);

    expect(result.outcome).toBe('WON');
    expect(result.rule).toContain('HT total goals >= 1');
    expect(result.data.ht_total_goals).toBe(1);
  });

  test('HT O0.5: HT 2-1 should be WON (3 HT goals >= 1)', () => {
    const scores: MatchScoreData = {
      home_score: 3,
      away_score: 2,
      ht_home_score: 2,
      ht_away_score: 1,
    };

    const result = evaluateSettlement('HT_O05_OVER', scores);

    expect(result.outcome).toBe('WON');
    expect(result.data.ht_total_goals).toBe(3);
  });

  test('HT O0.5: HT 0-0 should be LOST (0 HT goals < 1)', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: 1,
      ht_home_score: 0,
      ht_away_score: 0,
    };

    const result = evaluateSettlement('HT_O05_OVER', scores);

    expect(result.outcome).toBe('LOST');
    expect(result.data.ht_total_goals).toBe(0);
  });

  test('HT O0.5: null HT data should be VOID (data missing)', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: 1,
      ht_home_score: null,
      ht_away_score: null,
    };

    const result = evaluateSettlement('HT_O05_OVER', scores);

    expect(result.outcome).toBe('VOID');
    expect(result.rule).toContain('Half-time data missing');
    expect(result.reason).toBe('HT_DATA_MISSING');
  });

  test('HT O0.5: undefined HT data should be VOID', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: 1,
      ht_home_score: undefined,
      ht_away_score: undefined,
    };

    const result = evaluateSettlement('HT_O05_OVER', scores);

    expect(result.outcome).toBe('VOID');
    expect(result.reason).toBe('HT_DATA_MISSING');
  });

  test('HT O0.5: NaN HT data should be VOID', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: 1,
      ht_home_score: NaN,
      ht_away_score: 0,
    };

    const result = evaluateSettlement('HT_O05_OVER', scores);

    expect(result.outcome).toBe('VOID');
  });

  test('HT O0.5: negative HT score should be VOID (invalid data)', () => {
    const scores: MatchScoreData = {
      home_score: 2,
      away_score: 1,
      ht_home_score: -1,
      ht_away_score: 0,
    };

    const result = evaluateSettlement('HT_O05_OVER', scores);

    expect(result.outcome).toBe('VOID');
    expect(result.rule).toContain('Invalid negative HT scores');
  });
});

describe('Settlement Rules - Outcome to Status Conversion', () => {
  test('WON outcome converts to "won" status', () => {
    expect(outcomeToStatus('WON')).toBe('won');
  });

  test('LOST outcome converts to "lost" status', () => {
    expect(outcomeToStatus('LOST')).toBe('lost');
  });

  test('VOID outcome converts to "void" status', () => {
    expect(outcomeToStatus('VOID')).toBe('void');
  });
});

describe('Settlement Rules - Edge Cases', () => {
  test('Should handle high scores correctly', () => {
    const scores: MatchScoreData = {
      home_score: 7,
      away_score: 3,
    };

    const bttsResult = evaluateSettlement('BTTS_YES', scores);
    const o25Result = evaluateSettlement('O25_OVER', scores);
    const o15Result = evaluateSettlement('O15_OVER', scores);

    expect(bttsResult.outcome).toBe('WON');
    expect(o25Result.outcome).toBe('WON');
    expect(o15Result.outcome).toBe('WON');
    expect(o25Result.data.total_goals).toBe(10);
  });

  test('Should handle exactly threshold values', () => {
    // O2.5: exactly 3 goals
    const o25Result = evaluateSettlement('O25_OVER', {
      home_score: 2,
      away_score: 1,
    });
    expect(o25Result.outcome).toBe('WON'); // >= 3

    // O1.5: exactly 2 goals
    const o15Result = evaluateSettlement('O15_OVER', {
      home_score: 1,
      away_score: 1,
    });
    expect(o15Result.outcome).toBe('WON'); // >= 2

    // HT O0.5: exactly 1 goal
    const htResult = evaluateSettlement('HT_O05_OVER', {
      home_score: 2,
      away_score: 1,
      ht_home_score: 1,
      ht_away_score: 0,
    });
    expect(htResult.outcome).toBe('WON'); // >= 1
  });
});
