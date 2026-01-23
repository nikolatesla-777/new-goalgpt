/**
 * PR-5B Migration Tests
 *
 * Minimal validation tests for TheSportsClient adapter migration
 * Tests migrated services: MatchDiaryService, CompetitionService
 */

import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { theSportsAPIAdapter } from '../integrations/thesports';

describe('PR-5B: TheSportsClient Adapter Migration', () => {
  describe('MatchDiaryService', () => {
    it('should return valid match diary response structure', async () => {
      const service = new MatchDiaryService();
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

      const response = await service.getMatchDiary({ date: today });

      // Assert key fields exist
      expect(response).toBeDefined();
      expect(response).toHaveProperty('results');
      expect(Array.isArray(response.results)).toBe(true);

      // If results exist, check structure
      if (response.results && response.results.length > 0) {
        const match = response.results[0];
        expect(match).toHaveProperty('id');
        expect(match).toHaveProperty('home_team_id');
        expect(match).toHaveProperty('away_team_id');
        expect(match).toHaveProperty('match_time');
      }
    }, 15000); // 15s timeout for API call

    it('should handle API errors gracefully', async () => {
      const service = new MatchDiaryService();
      // Invalid date format should not crash
      const response = await service.getMatchDiary({ date: 'invalid' });

      // Should return response even on error
      expect(response).toBeDefined();
      expect(response).toHaveProperty('results');
    }, 15000);
  });

  describe('CompetitionService', () => {
    it('should return valid competition list response structure', async () => {
      const service = new CompetitionService();

      const response = await service.getCompetitionList();

      // Assert key fields exist
      expect(response).toBeDefined();
      expect(response).toHaveProperty('results');
      expect(Array.isArray(response.results)).toBe(true);

      // If results exist, check structure
      if (response.results && response.results.length > 0) {
        const competition = response.results[0];
        expect(competition).toHaveProperty('id');
        expect(competition).toHaveProperty('name');
      }
    }, 15000); // 15s timeout for API call
  });

  describe('TheSportsAPIAdapter', () => {
    it('should be available and healthy', () => {
      const health = theSportsAPIAdapter.getHealth();

      expect(health).toBeDefined();
      expect(health).toHaveProperty('initialized');
      expect(health).toHaveProperty('circuitState');
      expect(health).toHaveProperty('rateLimiter');
      expect(health.initialized).toBe(true);
    });

    it('should report circuit breaker state', () => {
      const isAvailable = theSportsAPIAdapter.isAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });
  });
});
