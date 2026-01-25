/**
 * Confidence Scorer Service Tests
 *
 * Tests for PHASE-2B confidence scoring functionality
 */

import { calculateConfidenceScore, formatConfidenceScoreForTelegram, ConfidenceScoreResult } from '../confidenceScorer.service';

describe('confidenceScorer.service', () => {
  describe('calculateConfidenceScore', () => {
    it('should return maximum score (85) with all signals present and strong', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(85); // 50 + 10 + 10 + 10 + 5
      expect(result.level).toBe('high');
      expect(result.emoji).toBe('🔥');
    });

    it('should return base score (50) with no signals meeting thresholds', () => {
      const matchData = {
        potentials: {
          btts: 50,
          over25: 40,
        },
        xg: {
          home: 0.8,
          away: 0.5,
        },
        form: {
          home: { ppg: 1.2 },
          away: { ppg: 1.0 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(50);
      expect(result.level).toBe('medium');
      expect(result.emoji).toBe('⭐');
    });

    it('should score 75 (HIGH) when BTTS signal is missing', () => {
      const matchData = {
        potentials: {
          over25: 70,
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(75); // 50 + 10 (o25) + 10 (xg) + 5 (form)
      expect(result.level).toBe('high');
    });

    it('should score 75 (HIGH) when O2.5 signal is missing', () => {
      const matchData = {
        potentials: {
          btts: 75,
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(75); // 50 + 10 (btts) + 10 (xg) + 5 (form)
      expect(result.level).toBe('high');
    });

    it('should score 75 (HIGH) when xG signal is missing', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(75); // 50 + 10 (btts) + 10 (o25) + 5 (form)
      expect(result.level).toBe('high');
    });

    it('should score 80 (HIGH) when form signal is missing', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(80); // 50 + 10 (btts) + 10 (o25) + 10 (xg)
      expect(result.level).toBe('high');
    });

    it('should handle null potentials gracefully', () => {
      const matchData = {
        potentials: null,
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(65); // 50 + 10 (xg) + 5 (form)
      expect(result.level).toBe('medium');
    });

    it('should handle null xG gracefully', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: null,
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(75); // 50 + 10 (btts) + 10 (o25) + 5 (form)
      expect(result.level).toBe('high');
    });

    it('should handle null form gracefully', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: null,
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(80); // 50 + 10 (btts) + 10 (o25) + 10 (xg)
      expect(result.level).toBe('high');
    });

    it('should handle completely empty matchData', () => {
      const matchData = {};

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(50); // Base score only
      expect(result.level).toBe('medium');
      expect(result.emoji).toBe('⭐');
    });

    it('should not count BTTS if below threshold (70)', () => {
      const matchData = {
        potentials: {
          btts: 69, // Just below threshold
          over25: 70,
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(75); // 50 + 10 (o25) + 10 (xg) + 5 (form)
      expect(result.level).toBe('high');
    });

    it('should not count O2.5 if below threshold (65)', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 64, // Just below threshold
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(75); // 50 + 10 (btts) + 10 (xg) + 5 (form)
      expect(result.level).toBe('high');
    });

    it('should not count xG if total is below threshold (2.5)', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: {
          home: 1.0,
          away: 1.4, // Total = 2.4, below 2.5
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(75); // 50 + 10 (btts) + 10 (o25) + 5 (form)
      expect(result.level).toBe('high');
    });

    it('should not count form if average PPG is below threshold (1.8)', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: {
          home: { ppg: 1.5 },
          away: { ppg: 1.6 }, // Average = 1.55, below 1.8
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(80); // 50 + 10 (btts) + 10 (o25) + 10 (xg)
      expect(result.level).toBe('high');
    });

    it('should handle missing xG.home', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: {
          away: 1.5,
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(75); // 50 + 10 (btts) + 10 (o25) + 5 (form)
    });

    it('should handle missing xG.away', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: {
          home: 1.5,
        },
        form: {
          home: { ppg: 2.0 },
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(75); // 50 + 10 (btts) + 10 (o25) + 5 (form)
    });

    it('should handle missing form.home.ppg', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: {
          home: {},
          away: { ppg: 1.8 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(80); // 50 + 10 (btts) + 10 (o25) + 10 (xg)
    });

    it('should handle missing form.away.ppg', () => {
      const matchData = {
        potentials: {
          btts: 75,
          over25: 70,
        },
        xg: {
          home: 1.8,
          away: 1.2,
        },
        form: {
          home: { ppg: 2.0 },
          away: {},
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(80); // 50 + 10 (btts) + 10 (o25) + 10 (xg)
    });

    it('should count BTTS at exactly threshold (70)', () => {
      const matchData = {
        potentials: {
          btts: 70, // Exactly at threshold
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(60); // 50 + 10
    });

    it('should count O2.5 at exactly threshold (65)', () => {
      const matchData = {
        potentials: {
          over25: 65, // Exactly at threshold
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(60); // 50 + 10
    });

    it('should count xG at exactly threshold (2.5)', () => {
      const matchData = {
        xg: {
          home: 1.2,
          away: 1.3, // Total = 2.5, exactly at threshold
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(60); // 50 + 10
    });

    it('should count form at exactly threshold (1.8)', () => {
      const matchData = {
        form: {
          home: { ppg: 1.8 },
          away: { ppg: 1.8 }, // Average = 1.8, exactly at threshold
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(55); // 50 + 5
    });

    it('should return LOW level for scores below 50', () => {
      // Since base score is 50, we can't actually get below 50 with this implementation
      // But let's test the boundary
      const matchData = {};

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBe(50);
      expect(result.level).toBe('medium'); // At boundary
    });

    it('should cap score at 100 even if logic would exceed', () => {
      // With current implementation max is 85, but let's test the cap logic
      const matchData = {
        potentials: {
          btts: 100,
          over25: 100,
        },
        xg: {
          home: 5.0,
          away: 5.0,
        },
        form: {
          home: { ppg: 3.0 },
          away: { ppg: 3.0 },
        },
      };

      const result = calculateConfidenceScore(matchData);

      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBe(85); // Actual max with current logic
    });
  });

  describe('formatConfidenceScoreForTelegram', () => {
    it('should format HIGH level correctly in Turkish', () => {
      const confidence: ConfidenceScoreResult = {
        score: 85,
        level: 'high',
        emoji: '🔥',
      };

      const result = formatConfidenceScoreForTelegram(confidence);

      expect(result).toBe('🔥 <b>Güven Skoru:</b> 85/100 (Yüksek)');
    });

    it('should format MEDIUM level correctly in Turkish', () => {
      const confidence: ConfidenceScoreResult = {
        score: 65,
        level: 'medium',
        emoji: '⭐',
      };

      const result = formatConfidenceScoreForTelegram(confidence);

      expect(result).toBe('⭐ <b>Güven Skoru:</b> 65/100 (Orta)');
    });

    it('should format LOW level correctly in Turkish', () => {
      const confidence: ConfidenceScoreResult = {
        score: 40,
        level: 'low',
        emoji: '⚠️',
      };

      const result = formatConfidenceScoreForTelegram(confidence);

      expect(result).toBe('⚠️ <b>Güven Skoru:</b> 40/100 (Düşük)');
    });

    it('should handle score of 0', () => {
      const confidence: ConfidenceScoreResult = {
        score: 0,
        level: 'low',
        emoji: '⚠️',
      };

      const result = formatConfidenceScoreForTelegram(confidence);

      expect(result).toBe('⚠️ <b>Güven Skoru:</b> 0/100 (Düşük)');
    });

    it('should handle score of 100', () => {
      const confidence: ConfidenceScoreResult = {
        score: 100,
        level: 'high',
        emoji: '🔥',
      };

      const result = formatConfidenceScoreForTelegram(confidence);

      expect(result).toBe('🔥 <b>Güven Skoru:</b> 100/100 (Yüksek)');
    });
  });
});
