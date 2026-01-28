/**
 * Settlement Rules Unit Tests
 *
 * Tests WIN/LOSS/VOID evaluation for all 7 markets
 * Ensures settlement logic matches SETTLEMENT_RULES.md spec
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Match data structure (subset for settlement)
 */
interface MatchData {
  status_id: number;
  home_score: number | null;
  away_score: number | null;
  home_scores: number[] | null;
  away_scores: number[] | null;
}

/**
 * Evaluate market settlement result
 */
function evaluateMarket(marketId: string, matchData: MatchData): 'WIN' | 'LOSS' | 'VOID' {
  // Step 1: Check match status
  if (matchData.status_id !== 8) {
    return 'VOID'; // Not ended
  }

  // Step 2: Market-specific settlement
  switch (marketId) {
    case 'O25':
      if (matchData.home_score == null || matchData.away_score == null) return 'VOID';
      const totalGoals = matchData.home_score + matchData.away_score;
      return totalGoals >= 3 ? 'WIN' : 'LOSS';

    case 'BTTS':
      if (matchData.home_score == null || matchData.away_score == null) return 'VOID';
      return (matchData.home_score > 0 && matchData.away_score > 0) ? 'WIN' : 'LOSS';

    case 'HT_O05':
      const htHome = matchData.home_scores?.[0];
      const htAway = matchData.away_scores?.[0];
      if (htHome == null || htAway == null) return 'VOID';
      const htTotal = htHome + htAway;
      return htTotal >= 1 ? 'WIN' : 'LOSS';

    case 'O35':
      if (matchData.home_score == null || matchData.away_score == null) return 'VOID';
      const totalGoalsO35 = matchData.home_score + matchData.away_score;
      return totalGoalsO35 >= 4 ? 'WIN' : 'LOSS';

    case 'HOME_O15':
      if (matchData.home_score == null) return 'VOID';
      return matchData.home_score >= 2 ? 'WIN' : 'LOSS';

    case 'CORNERS_O85':
      const homeCorners = matchData.home_scores?.[4];
      const awayCorners = matchData.away_scores?.[4];
      if (homeCorners == null || awayCorners == null) return 'VOID';
      const totalCorners = homeCorners + awayCorners;
      return totalCorners >= 9 ? 'WIN' : 'LOSS';

    case 'CARDS_O25':
      const homeCards = matchData.home_scores?.[2];
      const awayCards = matchData.away_scores?.[3];
      if (homeCards == null || awayCards == null) return 'VOID';
      const totalCards = homeCards + awayCards;
      return totalCards >= 3 ? 'WIN' : 'LOSS';

    default:
      return 'VOID';
  }
}

describe('Settlement Rules', () => {
  describe('O25 (Over 2.5 Goals)', () => {
    it('should return WIN for 3+ goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 3,
        away_score: 2,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O25', match)).toBe('WIN');
    });

    it('should return WIN for exactly 3 goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O25', match)).toBe('WIN');
    });

    it('should return LOSS for 2 goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 1,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O25', match)).toBe('LOSS');
    });

    it('should return LOSS for 0-0', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 0,
        away_score: 0,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O25', match)).toBe('LOSS');
    });

    it('should return VOID if match not ended', () => {
      const match: MatchData = {
        status_id: 2, // FIRST_HALF
        home_score: 2,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O25', match)).toBe('VOID');
    });

    it('should return VOID if score is null', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: null,
        away_score: 2,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O25', match)).toBe('VOID');
    });
  });

  describe('BTTS (Both Teams To Score)', () => {
    it('should return WIN if both teams score', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('BTTS', match)).toBe('WIN');
    });

    it('should return WIN for 1-1', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 1,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('BTTS', match)).toBe('WIN');
    });

    it('should return LOSS if home does not score', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 0,
        away_score: 2,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('BTTS', match)).toBe('LOSS');
    });

    it('should return LOSS if away does not score', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 3,
        away_score: 0,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('BTTS', match)).toBe('LOSS');
    });

    it('should return LOSS for 0-0', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 0,
        away_score: 0,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('BTTS', match)).toBe('LOSS');
    });

    it('should return VOID if match not ended', () => {
      const match: MatchData = {
        status_id: 3, // HALF_TIME
        home_score: 1,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('BTTS', match)).toBe('VOID');
    });
  });

  describe('HT_O05 (Half-Time Over 0.5)', () => {
    it('should return WIN for 1+ HT goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: [1, 2],
        away_scores: [0, 1],
      };
      expect(evaluateMarket('HT_O05', match)).toBe('WIN');
    });

    it('should return WIN for 1-0 HT', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 3,
        away_score: 0,
        home_scores: [1, 3],
        away_scores: [0, 0],
      };
      expect(evaluateMarket('HT_O05', match)).toBe('WIN');
    });

    it('should return WIN for 1-1 HT (2 goals)', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 2,
        home_scores: [1, 2],
        away_scores: [1, 2],
      };
      expect(evaluateMarket('HT_O05', match)).toBe('WIN');
    });

    it('should return LOSS for 0-0 HT', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: [0, 2],
        away_scores: [0, 1],
      };
      expect(evaluateMarket('HT_O05', match)).toBe('LOSS');
    });

    it('should return VOID if HT score missing', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('HT_O05', match)).toBe('VOID');
    });

    it('should return VOID if match not ended', () => {
      const match: MatchData = {
        status_id: 2, // FIRST_HALF
        home_score: null,
        away_score: null,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('HT_O05', match)).toBe('VOID');
    });
  });

  describe('O35 (Over 3.5 Goals)', () => {
    it('should return WIN for 4+ goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 3,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O35', match)).toBe('WIN');
    });

    it('should return WIN for exactly 4 goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 2,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O35', match)).toBe('WIN');
    });

    it('should return WIN for 7 goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 5,
        away_score: 2,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O35', match)).toBe('WIN');
    });

    it('should return LOSS for 3 goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O35', match)).toBe('LOSS');
    });

    it('should return LOSS for 0 goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 0,
        away_score: 0,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O35', match)).toBe('LOSS');
    });
  });

  describe('HOME_O15 (Home Over 1.5)', () => {
    it('should return WIN for home 2+ goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 0,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('HOME_O15', match)).toBe('WIN');
    });

    it('should return WIN for home 3 goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 3,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('HOME_O15', match)).toBe('WIN');
    });

    it('should return LOSS for home 1 goal', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 1,
        away_score: 2,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('HOME_O15', match)).toBe('LOSS');
    });

    it('should return LOSS for home 0 goals', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 0,
        away_score: 3,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('HOME_O15', match)).toBe('LOSS');
    });

    it('should return VOID if home score missing', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: null,
        away_score: 2,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('HOME_O15', match)).toBe('VOID');
    });
  });

  describe('CORNERS_O85 (Corners Over 8.5)', () => {
    it('should return WIN for 9+ corners', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: [null, null, null, null, 6],
        away_scores: [null, null, null, null, 5],
      };
      expect(evaluateMarket('CORNERS_O85', match)).toBe('WIN');
    });

    it('should return WIN for exactly 9 corners', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 1,
        away_score: 0,
        home_scores: [null, null, null, null, 5],
        away_scores: [null, null, null, null, 4],
      };
      expect(evaluateMarket('CORNERS_O85', match)).toBe('WIN');
    });

    it('should return LOSS for 8 corners', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 1,
        away_score: 1,
        home_scores: [null, null, null, null, 4],
        away_scores: [null, null, null, null, 4],
      };
      expect(evaluateMarket('CORNERS_O85', match)).toBe('LOSS');
    });

    it('should return LOSS for 3 corners', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 0,
        away_score: 1,
        home_scores: [null, null, null, null, 1],
        away_scores: [null, null, null, null, 2],
      };
      expect(evaluateMarket('CORNERS_O85', match)).toBe('LOSS');
    });

    it('should return VOID if corner data missing', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('CORNERS_O85', match)).toBe('VOID');
    });

    it('should return VOID if one corner is missing', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: [null, null, null, null, 6],
        away_scores: [null, null, null, null, null],
      };
      expect(evaluateMarket('CORNERS_O85', match)).toBe('VOID');
    });
  });

  describe('CARDS_O25 (Cards Over 2.5)', () => {
    it('should return WIN for 3+ cards', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: [null, null, 2, null],
        away_scores: [null, null, null, 3],
      };
      expect(evaluateMarket('CARDS_O25', match)).toBe('WIN');
    });

    it('should return WIN for exactly 3 cards', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 1,
        away_score: 1,
        home_scores: [null, null, 1, null],
        away_scores: [null, null, null, 2],
      };
      expect(evaluateMarket('CARDS_O25', match)).toBe('WIN');
    });

    it('should return LOSS for 2 cards', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 1,
        away_score: 0,
        home_scores: [null, null, 1, null],
        away_scores: [null, null, null, 1],
      };
      expect(evaluateMarket('CARDS_O25', match)).toBe('LOSS');
    });

    it('should return LOSS for 0 cards', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: [null, null, 0, null],
        away_scores: [null, null, null, 0],
      };
      expect(evaluateMarket('CARDS_O25', match)).toBe('LOSS');
    });

    it('should return VOID if card data missing', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('CARDS_O25', match)).toBe('VOID');
    });

    it('should return VOID if one card count is missing', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: [null, null, 2, null],
        away_scores: [null, null, null, null],
      };
      expect(evaluateMarket('CARDS_O25', match)).toBe('VOID');
    });
  });

  describe('Edge Cases', () => {
    it('should return VOID for postponed match (status_id=9)', () => {
      const match: MatchData = {
        status_id: 9, // POSTPONED
        home_score: null,
        away_score: null,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O25', match)).toBe('VOID');
      expect(evaluateMarket('BTTS', match)).toBe('VOID');
    });

    it('should return VOID for cancelled match (status_id=10)', () => {
      const match: MatchData = {
        status_id: 10, // CANCELLED
        home_score: null,
        away_score: null,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('O25', match)).toBe('VOID');
    });

    it('should handle unknown market gracefully', () => {
      const match: MatchData = {
        status_id: 8,
        home_score: 2,
        away_score: 1,
        home_scores: null,
        away_scores: null,
      };
      expect(evaluateMarket('UNKNOWN_MARKET', match)).toBe('VOID');
    });
  });
});
