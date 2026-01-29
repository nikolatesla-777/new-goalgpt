/**
 * AI Summary Formatter Tests - Phase-3B.1
 *
 * Tests for deterministic summary generation and schema validation
 */

import {
  validateSummarySchema,
  generateAISummary,
} from '../aiSummaryFormatter.service';
import type { MatchSummaryInput } from '../../../types/aiSummary.types';

describe('AI Summary Formatter', () => {
  // ============================================================================
  // SCHEMA VALIDATION TESTS
  // ============================================================================

  describe('validateSummarySchema', () => {
    it('should validate a valid summary', () => {
      const validSummary = {
        match_id: '12345',
        title: 'Barcelona vs Real Madrid - La Liga Analysis',
        key_angles: [
          {
            icon: '⚡',
            title: 'High Scoring',
            description: 'High xG values',
          },
        ],
        bet_ideas: [
          {
            market: 'Over 2.5',
            reason: 'Strong form',
            confidence: 70,
          },
        ],
        disclaimer: 'Risk warning',
        generated_at: '2026-01-29T19:30:00Z',
        locale: 'tr',
      };

      const result = validateSummarySchema(validSummary);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject summary without match_id', () => {
      const invalidSummary = {
        title: 'Test',
        key_angles: [],
        bet_ideas: [],
        disclaimer: 'Test',
        generated_at: '2026-01-29T19:30:00Z',
        locale: 'tr',
      };

      const result = validateSummarySchema(invalidSummary);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('match_id is required and must be a string');
    });

    it('should reject summary with invalid key_angles', () => {
      const invalidSummary = {
        match_id: '12345',
        title: 'Test',
        key_angles: [
          {
            icon: '⚡',
            // Missing title and description
          },
        ],
        bet_ideas: [],
        disclaimer: 'Test',
        generated_at: '2026-01-29T19:30:00Z',
        locale: 'tr',
      };

      const result = validateSummarySchema(invalidSummary);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('key_angles'))).toBe(true);
    });

    it('should reject summary with invalid bet_ideas confidence', () => {
      const invalidSummary = {
        match_id: '12345',
        title: 'Test',
        key_angles: [
          {
            icon: '⚡',
            title: 'Test',
            description: 'Test',
          },
        ],
        bet_ideas: [
          {
            market: 'Over 2.5',
            reason: 'Test',
            confidence: 150, // Invalid: > 100
          },
        ],
        disclaimer: 'Test',
        generated_at: '2026-01-29T19:30:00Z',
        locale: 'tr',
      };

      const result = validateSummarySchema(invalidSummary);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('confidence must be a number between 0-100'))).toBe(true);
    });

    it('should reject summary with invalid locale', () => {
      const invalidSummary = {
        match_id: '12345',
        title: 'Test',
        key_angles: [],
        bet_ideas: [],
        disclaimer: 'Test',
        generated_at: '2026-01-29T19:30:00Z',
        locale: 'fr', // Invalid: not tr or en
      };

      const result = validateSummarySchema(invalidSummary);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('locale must be "tr" or "en"');
    });
  });

  // ============================================================================
  // SUMMARY GENERATION TESTS
  // ============================================================================

  describe('generateAISummary', () => {
    const mockInput: MatchSummaryInput = {
      home_team: 'Barcelona',
      away_team: 'Real Madrid',
      competition: 'La Liga',
      match_time: '2026-01-29T20:00:00Z',
      scoring_data: {
        xg: {
          home: 1.65,
          away: 1.20,
        },
        markets: [
          {
            market_id: 'O25',
            confidence: 72,
          },
          {
            market_id: 'BTTS',
            confidence: 75,
          },
        ],
        btts_percentage: 68,
        home_form: {
          ppg: 2.3,
        },
        away_form: {
          ppg: 1.8,
        },
      },
      footystats_data: {
        btts_pct: 68,
        home_ppg: 2.3,
        away_ppg: 1.8,
        corners_avg: 10.5,
      },
    };

    it('should generate summary with Turkish locale', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.locale).toBe('tr');
      expect(result.data?.title).toContain('Barcelona');
      expect(result.data?.title).toContain('Real Madrid');
      expect(result.data?.title).toContain('Analizi');
    });

    it('should generate summary with English locale', async () => {
      const result = await generateAISummary(mockInput, 'en');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.locale).toBe('en');
      expect(result.data?.title).toContain('Barcelona');
      expect(result.data?.title).toContain('Real Madrid');
      expect(result.data?.title).toContain('Analysis');
    });

    it('should include high scoring angle when xG > 2.3', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);
      expect(result.data?.key_angles.length).toBeGreaterThan(0);

      const highScoringAngle = result.data?.key_angles.find((a) =>
        a.description.includes('xG')
      );
      expect(highScoringAngle).toBeDefined();
    });

    it('should include BTTS angle when btts_pct > 60', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);

      const bttsAngle = result.data?.key_angles.find((a) =>
        a.title.includes('Gol') || a.title.includes('Score')
      );
      expect(bttsAngle).toBeDefined();
    });

    it('should include form angle when ppg > 0', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);

      const formAngle = result.data?.key_angles.find((a) =>
        a.title.includes('Form')
      );
      expect(formAngle).toBeDefined();
    });

    it('should include corners angle when corners_avg > 9', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);

      const cornersAngle = result.data?.key_angles.find((a) =>
        a.description.includes('korner') || a.description.includes('corner')
      );
      expect(cornersAngle).toBeDefined();
    });

    it('should include bet ideas with confidence >= 60', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);
      expect(result.data?.bet_ideas.length).toBeGreaterThan(0);

      const over25Idea = result.data?.bet_ideas.find((i) =>
        i.market.includes('2.5')
      );
      expect(over25Idea).toBeDefined();
      expect(over25Idea?.confidence).toBeGreaterThanOrEqual(60);
    });

    it('should limit key angles to max 5', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);
      expect(result.data?.key_angles.length).toBeLessThanOrEqual(5);
    });

    it('should limit bet ideas to max 4', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);
      expect(result.data?.bet_ideas.length).toBeLessThanOrEqual(4);
    });

    it('should include disclaimer', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);
      expect(result.data?.disclaimer).toBeDefined();
      expect(result.data?.disclaimer.length).toBeGreaterThan(0);
    });

    it('should include generated_at timestamp', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);
      expect(result.data?.generated_at).toBeDefined();

      // Check if it's a valid ISO timestamp
      const timestamp = new Date(result.data!.generated_at);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });

    it('should handle missing xG data gracefully', async () => {
      const inputWithoutXG: MatchSummaryInput = {
        ...mockInput,
        scoring_data: {
          markets: [],
        },
      };

      const result = await generateAISummary(inputWithoutXG, 'tr');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Should still generate summary with available data
    });

    it('should handle missing footystats data gracefully', async () => {
      const inputWithoutFootyStats: MatchSummaryInput = {
        ...mockInput,
        footystats_data: {},
      };

      const result = await generateAISummary(inputWithoutFootyStats, 'tr');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should validate generated summary schema', async () => {
      const result = await generateAISummary(mockInput, 'tr');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Validate the generated summary
      const validation = validateSummarySchema(result.data!);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty scoring_data', async () => {
      const input: MatchSummaryInput = {
        home_team: 'Team A',
        away_team: 'Team B',
        competition: 'League',
        match_time: '2026-01-29T20:00:00Z',
      };

      const result = await generateAISummary(input, 'tr');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.key_angles).toBeDefined();
      expect(result.data?.bet_ideas).toBeDefined();
    });

    it('should handle very low confidence markets', async () => {
      const input: MatchSummaryInput = {
        home_team: 'Team A',
        away_team: 'Team B',
        competition: 'League',
        match_time: '2026-01-29T20:00:00Z',
        scoring_data: {
          markets: [
            {
              market_id: 'O25',
              confidence: 30, // Low confidence
            },
          ],
        },
      };

      const result = await generateAISummary(input, 'tr');

      expect(result.success).toBe(true);
      expect(result.data?.bet_ideas.length).toBe(0); // No bet ideas with confidence < 60
    });
  });
});
