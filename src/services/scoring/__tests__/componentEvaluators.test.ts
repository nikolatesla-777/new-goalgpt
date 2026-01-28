/**
 * Component Evaluators Unit Tests
 *
 * Tests for Poisson probability, BTTS calculation, edge calculation, etc.
 * Critical mathematical functions must have high test coverage
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { describe, it, expect } from '@jest/globals';
import {
  factorial,
  calculatePoissonProbability,
  calculateBTTSProbability,
  calculateEdge,
  calculateComponentVariance,
  calculateFormRate,
  calculateTempoIndicator,
  calculateH2HAvgGoalsProxy,
  calculateHomeScoringRate,
  calculateOddsToProbabilityCorrelation,
  calculateAttackingCorrelation,
  calculateIntensityProxy,
} from '../componentEvaluators';

describe('componentEvaluators', () => {
  describe('factorial', () => {
    it('should calculate factorial of 0', () => {
      expect(factorial(0)).toBe(1);
    });

    it('should calculate factorial of 1', () => {
      expect(factorial(1)).toBe(1);
    });

    it('should calculate factorial of 5', () => {
      expect(factorial(5)).toBe(120);
    });

    it('should calculate factorial of 10', () => {
      expect(factorial(10)).toBe(3628800);
    });
  });

  describe('calculatePoissonProbability', () => {
    it('should return 0 for lambda = 0', () => {
      const prob = calculatePoissonProbability(0, 2.5);
      expect(prob).toBe(0);
    });

    it('should return ~0 for very low lambda', () => {
      const prob = calculatePoissonProbability(0.5, 2.5);
      expect(prob).toBeLessThan(0.02); // Less than 2%
    });

    it('should calculate P(X >= 3) for lambda = 2.85 (Over 2.5 example)', () => {
      const prob = calculatePoissonProbability(2.85, 2.5);
      expect(prob).toBeGreaterThan(0.58); // At least 58%
      expect(prob).toBeLessThan(0.65); // At most 65%
    });

    it('should calculate P(X >= 4) for lambda = 2.85 (Over 3.5 example)', () => {
      const prob = calculatePoissonProbability(2.85, 3.5);
      expect(prob).toBeGreaterThan(0.35); // At least 35%
      expect(prob).toBeLessThan(0.45); // At most 45%
    });

    it('should calculate P(X >= 1) for lambda = 1.65 (HT Over 0.5 example)', () => {
      const prob = calculatePoissonProbability(1.65 * 0.45, 0.5);
      expect(prob).toBeGreaterThan(0.50); // At least 50%
      expect(prob).toBeLessThan(0.70); // At most 70%
    });

    it('should calculate P(X >= 2) for lambda = 1.85 (Home Over 1.5 example)', () => {
      const prob = calculatePoissonProbability(1.85, 1.5);
      expect(prob).toBeGreaterThan(0.55); // At least 55%
      expect(prob).toBeLessThan(0.65); // At most 65%
    });

    it('should calculate P(X >= 9) for lambda = 9.5 (Corners Over 8.5 example)', () => {
      const prob = calculatePoissonProbability(9.5, 8.5);
      expect(prob).toBeGreaterThan(0.50); // At least 50%
      expect(prob).toBeLessThan(0.60); // At most 60%
    });

    it('should approach 1 for very high lambda', () => {
      const prob = calculatePoissonProbability(10.0, 2.5);
      expect(prob).toBeGreaterThan(0.98); // Almost certain
    });

    it('should approach 0 for lambda << threshold', () => {
      const prob = calculatePoissonProbability(0.8, 3.5);
      expect(prob).toBeLessThan(0.01); // Almost impossible
    });
  });

  describe('calculateBTTSProbability', () => {
    it('should return 0 for lambda = 0', () => {
      const prob = calculateBTTSProbability(0, 1.2);
      expect(prob).toBe(0);
    });

    it('should return 0 if either team has lambda = 0', () => {
      const prob = calculateBTTSProbability(1.5, 0);
      expect(prob).toBe(0);
    });

    it('should calculate BTTS for Barcelona vs Real Madrid example (xG: 1.65, 1.20)', () => {
      const prob = calculateBTTSProbability(1.65, 1.20);
      expect(prob).toBeGreaterThan(0.55); // At least 55%
      expect(prob).toBeLessThan(0.65); // At most 65%
    });

    it('should calculate BTTS for low-scoring teams (xG: 0.8, 0.7)', () => {
      const prob = calculateBTTSProbability(0.8, 0.7);
      expect(prob).toBeLessThan(0.30); // Less than 30%
    });

    it('should calculate BTTS for high-scoring teams (xG: 2.5, 2.0)', () => {
      const prob = calculateBTTSProbability(2.5, 2.0);
      expect(prob).toBeGreaterThan(0.80); // Greater than 80%
    });

    it('should be symmetric (order of teams should not matter)', () => {
      const prob1 = calculateBTTSProbability(1.5, 1.2);
      const prob2 = calculateBTTSProbability(1.2, 1.5);
      expect(prob1).toBe(prob2);
    });

    it('should increase with higher xG', () => {
      const prob1 = calculateBTTSProbability(1.0, 1.0);
      const prob2 = calculateBTTSProbability(1.5, 1.5);
      const prob3 = calculateBTTSProbability(2.0, 2.0);
      expect(prob2).toBeGreaterThan(prob1);
      expect(prob3).toBeGreaterThan(prob2);
    });
  });

  describe('calculateEdge', () => {
    it('should return positive edge when probability > implied odds', () => {
      const probability = 0.65; // Our calculation: 65%
      const odds = { ft_1: 1.85, ft_x: 3.40, ft_2: 4.50 }; // Implied: 54%
      const edge = calculateEdge(probability, odds);
      expect(edge).toBeGreaterThan(0); // Positive edge
    });

    it('should return negative edge when probability < implied odds', () => {
      const probability = 0.45; // Our calculation: 45%
      const odds = { ft_1: 1.50, ft_x: 3.80, ft_2: 7.00 }; // Implied: 66.7%
      const edge = calculateEdge(probability, odds);
      expect(edge).toBeLessThan(0); // Negative edge
    });

    it('should return ~0 edge when probability = implied odds', () => {
      const probability = 0.54; // Our calculation: 54%
      const odds = { ft_1: 1.85, ft_x: 3.40, ft_2: 4.50 }; // Implied: 54%
      const edge = calculateEdge(probability, odds);
      expect(edge).toBeCloseTo(0, 1); // Close to 0
    });

    it('should handle missing odds gracefully', () => {
      const probability = 0.65;
      const odds = {}; // No odds available
      const edge = calculateEdge(probability, odds);
      expect(edge).toBeGreaterThanOrEqual(-1); // Valid edge
    });
  });

  describe('calculateComponentVariance', () => {
    it('should return 1.0 for empty components', () => {
      const variance = calculateComponentVariance([]);
      expect(variance).toBe(1.0);
    });

    it('should return 0 for identical components', () => {
      const components = [
        { name: 'comp1', weight: 0.33, raw_value: 0.65, weighted_contribution: 0.2145, is_available: true, data_source: 'test' },
        { name: 'comp2', weight: 0.33, raw_value: 0.65, weighted_contribution: 0.2145, is_available: true, data_source: 'test' },
        { name: 'comp3', weight: 0.34, raw_value: 0.65, weighted_contribution: 0.221, is_available: true, data_source: 'test' },
      ];
      const variance = calculateComponentVariance(components);
      expect(variance).toBe(0);
    });

    it('should return low variance for similar components', () => {
      const components = [
        { name: 'comp1', weight: 0.33, raw_value: 0.65, weighted_contribution: 0.2145, is_available: true, data_source: 'test' },
        { name: 'comp2', weight: 0.33, raw_value: 0.68, weighted_contribution: 0.2244, is_available: true, data_source: 'test' },
        { name: 'comp3', weight: 0.34, raw_value: 0.67, weighted_contribution: 0.2278, is_available: true, data_source: 'test' },
      ];
      const variance = calculateComponentVariance(components);
      expect(variance).toBeLessThan(0.001); // Very low variance
    });

    it('should return high variance for disagreeing components', () => {
      const components = [
        { name: 'comp1', weight: 0.33, raw_value: 0.45, weighted_contribution: 0.1485, is_available: true, data_source: 'test' },
        { name: 'comp2', weight: 0.33, raw_value: 0.75, weighted_contribution: 0.2475, is_available: true, data_source: 'test' },
        { name: 'comp3', weight: 0.34, raw_value: 0.60, weighted_contribution: 0.204, is_available: true, data_source: 'test' },
      ];
      const variance = calculateComponentVariance(components);
      expect(variance).toBeGreaterThan(0.01); // High variance
    });

    it('should ignore unavailable components', () => {
      const components = [
        { name: 'comp1', weight: 0.33, raw_value: 0.65, weighted_contribution: 0.2145, is_available: true, data_source: 'test' },
        { name: 'comp2', weight: 0.33, raw_value: null, weighted_contribution: 0, is_available: false, data_source: 'test' },
        { name: 'comp3', weight: 0.34, raw_value: 0.67, weighted_contribution: 0.2278, is_available: true, data_source: 'test' },
      ];
      const variance = calculateComponentVariance(components);
      expect(variance).toBeLessThan(0.001); // Low variance (only 2 components)
    });
  });

  describe('calculateFormRate', () => {
    it('should return null for empty trends', () => {
      const rate = calculateFormRate([], 'O25');
      expect(rate).toBeNull();
    });

    it('should calculate Over 2.5 form rate correctly', () => {
      const trends = [
        { home_goals: 2, away_goals: 1 }, // Total: 3 ✅
        { home_goals: 1, away_goals: 1 }, // Total: 2 ❌
        { home_goals: 3, away_goals: 1 }, // Total: 4 ✅
        { home_goals: 0, away_goals: 2 }, // Total: 2 ❌
        { home_goals: 2, away_goals: 2 }, // Total: 4 ✅
      ];
      const rate = calculateFormRate(trends, 'O25');
      expect(rate).toBe(0.6); // 3/5 = 60%
    });

    it('should calculate BTTS form rate correctly', () => {
      const trends = [
        { home_goals: 2, away_goals: 1 }, // ✅
        { home_goals: 0, away_goals: 1 }, // ❌
        { home_goals: 3, away_goals: 1 }, // ✅
        { home_goals: 1, away_goals: 0 }, // ❌
        { home_goals: 2, away_goals: 2 }, // ✅
      ];
      const rate = calculateFormRate(trends, 'BTTS');
      expect(rate).toBe(0.6); // 3/5 = 60%
    });

    it('should calculate HT Over 0.5 form rate correctly', () => {
      const trends = [
        { ht_home_goals: 1, ht_away_goals: 0 }, // ✅
        { ht_home_goals: 0, ht_away_goals: 0 }, // ❌
        { ht_home_goals: 0, ht_away_goals: 1 }, // ✅
        { ht_home_goals: 2, ht_away_goals: 1 }, // ✅
        { ht_home_goals: 0, ht_away_goals: 0 }, // ❌
      ];
      const rate = calculateFormRate(trends, 'HT_O05');
      expect(rate).toBe(0.6); // 3/5 = 60%
    });
  });

  describe('calculateTempoIndicator', () => {
    it('should return null for missing data', () => {
      const tempo = calculateTempoIndicator(undefined, 2.5);
      expect(tempo).toBeNull();
    });

    it('should calculate tempo for high attacking potential', () => {
      const tempo = calculateTempoIndicator(80, 3.0);
      expect(tempo).toBeGreaterThan(0.6);
      expect(tempo).toBeLessThanOrEqual(1.0);
    });

    it('should calculate tempo for low attacking potential', () => {
      const tempo = calculateTempoIndicator(40, 1.5);
      expect(tempo).toBeGreaterThan(0.2);
      expect(tempo).toBeLessThan(0.5);
    });

    it('should be clamped to [0, 1]', () => {
      const tempo = calculateTempoIndicator(100, 5.0);
      expect(tempo).toBeLessThanOrEqual(1.0);
    });
  });

  describe('calculateH2HAvgGoalsProxy', () => {
    it('should return null for missing data', () => {
      const proxy = calculateH2HAvgGoalsProxy(undefined, 3.5);
      expect(proxy).toBeNull();
    });

    it('should return strong signal for avg >= threshold + 0.5', () => {
      const proxy = calculateH2HAvgGoalsProxy(4.2, 3.5);
      expect(proxy).toBe(0.70);
    });

    it('should return moderate signal for avg >= threshold', () => {
      const proxy = calculateH2HAvgGoalsProxy(3.6, 3.5);
      expect(proxy).toBe(0.55);
    });

    it('should return weak signal for avg >= threshold - 0.5', () => {
      const proxy = calculateH2HAvgGoalsProxy(3.2, 3.5);
      expect(proxy).toBe(0.45);
    });

    it('should return negative signal for avg < threshold - 0.5', () => {
      const proxy = calculateH2HAvgGoalsProxy(2.8, 3.5);
      expect(proxy).toBe(0.30);
    });
  });

  describe('calculateHomeScoringRate', () => {
    it('should return null for missing data', () => {
      const rate = calculateHomeScoringRate(undefined, 1.5);
      expect(rate).toBeNull();
    });

    it('should use Poisson probability', () => {
      const rate = calculateHomeScoringRate(1.85, 1.5);
      const expected = calculatePoissonProbability(1.85, 1.5);
      expect(rate).toBe(expected);
    });
  });

  describe('calculateOddsToProbabilityCorrelation', () => {
    it('should return null for missing odds', () => {
      const corr = calculateOddsToProbabilityCorrelation(undefined);
      expect(corr).toBeNull();
    });

    it('should return null for invalid odds (<= 1.01)', () => {
      const corr = calculateOddsToProbabilityCorrelation(1.00);
      expect(corr).toBeNull();
    });

    it('should calculate correlation from home win odds', () => {
      const corr = calculateOddsToProbabilityCorrelation(1.85);
      expect(corr).toBeGreaterThan(0.5);
      expect(corr).toBeLessThanOrEqual(1.0);
    });

    it('should be higher for lower odds (stronger team)', () => {
      const corr1 = calculateOddsToProbabilityCorrelation(1.30);
      const corr2 = calculateOddsToProbabilityCorrelation(2.50);
      expect(corr1).toBeGreaterThan(corr2);
    });
  });

  describe('calculateAttackingCorrelation', () => {
    it('should return null for missing data', () => {
      const corr = calculateAttackingCorrelation(undefined);
      expect(corr).toBeNull();
    });

    it('should normalize avgPotential to [0, 1]', () => {
      const corr = calculateAttackingCorrelation(75);
      expect(corr).toBe(0.75);
    });

    it('should be clamped to [0, 1]', () => {
      const corr = calculateAttackingCorrelation(120);
      expect(corr).toBe(1.0);
    });
  });

  describe('calculateIntensityProxy', () => {
    it('should return null for missing data', () => {
      const intensity = calculateIntensityProxy(undefined, 1.2);
      expect(intensity).toBeNull();
    });

    it('should return null if either xG is missing', () => {
      const intensity = calculateIntensityProxy(1.5, undefined);
      expect(intensity).toBeNull();
    });

    it('should return high intensity for close match with high xG', () => {
      const intensity = calculateIntensityProxy(2.0, 1.8);
      expect(intensity).toBeGreaterThan(0.6);
    });

    it('should return low intensity for one-sided match', () => {
      const intensity = calculateIntensityProxy(3.0, 0.5);
      expect(intensity).toBeLessThan(0.5);
    });

    it('should be clamped to [0, 1]', () => {
      const intensity = calculateIntensityProxy(2.5, 2.5);
      expect(intensity).toBeLessThanOrEqual(1.0);
      expect(intensity).toBeGreaterThanOrEqual(0.0);
    });
  });
});
