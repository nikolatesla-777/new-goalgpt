/**
 * Feature Builder Service Tests
 *
 * Tests composite feature building (TheSports + FootyStats merge)
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { featureBuilderService } from '../services/scoring/featureBuilder.service';
import { pool } from '../database/connection';

// Mock database
jest.mock('../database/connection', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('FeatureBuilderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildScoringFeatures', () => {
    const mockTheSportsMatch = {
      id: 'ts-internal-uuid-123',
      external_id: 'ts-match-456',
      home_team_id: 'team-1',
      away_team_id: 'team-2',
      competition_id: 'league-1',
      home_team: 'Barcelona',
      away_team: 'Real Madrid',
      match_time: 1706553600,
      status_id: 8,
      home_score_display: 3,
      away_score_display: 1,
      home_scores: [0, 2, 0, 2, 0, 7], // [unused, HT=2, unused, cards=2, unused, corners=7]
      away_scores: [0, 0, 0, 0, 1, 4], // [unused, HT=0, unused, unused, cards=1, corners=4]
    };

    const mockFootyStatsData = {
      fs_match_id: 789,
      team_a_xg_prematch: 1.65,
      team_b_xg_prematch: 1.20,
      btts_potential: 72,
      o25_potential: 68,
      o15_potential: 85,
      corners_potential: 55,
      cards_potential: 48,
      odds_ft_1: 2.10,
      odds_ft_x: 3.40,
      odds_ft_2: 3.50,
      h2h_stats: { avg_goals: 3.2 },
      trends: { home: [], away: [] },
      data_quality_score: 85,
    };

    test('should build composite features when FootyStats mapping exists (stored_mapping)', async () => {
      // CASE 1: Stored mapping (fs_match_stats.ts_match_id exists)

      // Mock TheSports query (first query)
      mockPool.query.mockResolvedValueOnce({
        rows: [mockTheSportsMatch],
      } as any);

      // Mock FootyStats query - stored mapping (second query)
      mockPool.query.mockResolvedValueOnce({
        rows: [mockFootyStatsData],
      } as any);

      const result = await featureBuilderService.buildScoringFeatures('ts-match-456');

      // Assertions
      expect(result.features).toBeDefined();
      expect(result.source_refs).toBeDefined();
      expect(result.risk_flags).toBeDefined();

      // Source tracking
      expect(result.source_refs.thesports_match_id).toBe('ts-match-456');
      expect(result.source_refs.thesports_internal_id).toBe('ts-internal-uuid-123');
      expect(result.source_refs.footystats_match_id).toBe(789);
      expect(result.source_refs.footystats_linked).toBe(true);
      expect(result.source_refs.link_method).toBe('stored_mapping');

      // Features - TheSports data
      expect(result.features.match_id).toBe('ts-match-456');
      expect(result.features.home_team.name).toBe('Barcelona');
      expect(result.features.away_team.name).toBe('Real Madrid');
      expect(result.features.ft_scores).toEqual({
        home: 3,
        away: 1,
        total: 4,
      });
      expect(result.features.ht_scores).toEqual({
        home: 2,
        away: 0,
        total: 2,
      });
      expect(result.features.corners).toEqual({
        home: 7,
        away: 4,
        total: 11,
      });
      expect(result.features.cards).toEqual({
        home: 2,
        away: 1,
        total: 3,
      });

      // Features - FootyStats data (merged)
      expect(result.features.xg).toBeDefined();
      expect(result.features.xg?.home).toBe(1.65);
      expect(result.features.xg?.away).toBe(1.20);
      expect(result.features.xg?.total).toBeCloseTo(2.85, 2);
      expect(result.features.odds).toEqual({
        home_win: 2.10,
        draw: 3.40,
        away_win: 3.50,
      });
      expect(result.features.potentials).toBeDefined();
      expect(result.features.potentials?.over25).toBe(68);
      expect(result.features.potentials?.btts).toBe(72);

      // Source should be 'hybrid'
      expect(result.features.source).toBe('hybrid');

      // Completeness
      expect(result.features.completeness.present).toContain('xg');
      expect(result.features.completeness.present).toContain('odds');
      expect(result.features.completeness.present).toContain('potentials');
      expect(result.features.completeness.present).toContain('ft_scores');

      // Risk flags should be minimal (all data present)
      expect(result.risk_flags).not.toContain('MISSING_XG');
      expect(result.risk_flags).not.toContain('MISSING_ODDS');
      expect(result.risk_flags).not.toContain('MISSING_POTENTIALS');
    });

    test('should build composite features when deterministic match succeeds', async () => {
      // CASE 2: Deterministic match (date ±2h + exact team names)

      // Mock TheSports query
      mockPool.query.mockResolvedValueOnce({
        rows: [mockTheSportsMatch],
      } as any);

      // Mock FootyStats query - stored mapping (empty)
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      // Mock FootyStats query - deterministic match (success)
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            ...mockFootyStatsData,
            ts_home: 'Barcelona',
            ts_away: 'Real Madrid',
            ts_time: 1706553700, // 100 seconds later
          },
        ],
      } as any);

      const result = await featureBuilderService.buildScoringFeatures('ts-match-456');

      // Assertions
      expect(result.source_refs.footystats_linked).toBe(true);
      expect(result.source_refs.link_method).toBe('deterministic_match');

      // Features should include FootyStats data
      expect(result.features.xg).toBeDefined();
      expect(result.features.odds).toBeDefined();
      expect(result.features.source).toBe('hybrid');
    });

    test('should build TheSports-only features when FootyStats not found', async () => {
      // CASE 3: No FootyStats data (not_found)

      // Mock TheSports query
      mockPool.query.mockResolvedValueOnce({
        rows: [mockTheSportsMatch],
      } as any);

      // Mock FootyStats query - stored mapping (empty)
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      // Mock FootyStats query - deterministic match (empty)
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      const result = await featureBuilderService.buildScoringFeatures('ts-match-456');

      // Assertions
      expect(result.source_refs.footystats_linked).toBe(false);
      expect(result.source_refs.link_method).toBe('not_found');
      expect(result.source_refs.footystats_match_id).toBeUndefined();

      // Features - TheSports data only
      expect(result.features.match_id).toBe('ts-match-456');
      expect(result.features.ft_scores).toBeDefined();
      expect(result.features.ht_scores).toBeDefined();
      expect(result.features.corners).toBeDefined();
      expect(result.features.cards).toBeDefined();

      // Features - No FootyStats data
      expect(result.features.xg).toBeUndefined();
      expect(result.features.odds).toBeUndefined();
      expect(result.features.potentials).toBeUndefined();

      // Source should be 'thesports'
      expect(result.features.source).toBe('thesports');

      // Completeness
      expect(result.features.completeness.missing).toContain('xg');
      expect(result.features.completeness.missing).toContain('odds');
      expect(result.features.completeness.missing).toContain('potentials');

      // Risk flags should include missing data flags
      expect(result.risk_flags).toContain('MISSING_XG');
    });

    test('should throw error when TheSports match not found', async () => {
      // Mock TheSports query - empty
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      await expect(
        featureBuilderService.buildScoringFeatures('nonexistent-match-id')
      ).rejects.toThrow('Match not found: nonexistent-match-id');
    });

    test('should throw error when TheSports data is invalid', async () => {
      // Mock TheSports query - invalid data (missing required fields)
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'ts-internal-uuid-123',
            // missing external_id (REQUIRED)
            home_team: 'Barcelona',
            away_team: 'Real Madrid',
            match_time: 1706553600,
            status_id: 8,
          },
        ],
      } as any);

      await expect(
        featureBuilderService.buildScoringFeatures('ts-match-456')
      ).rejects.toThrow('Invalid TheSports data');
    });

    test('should handle partial TheSports data (missing scores)', async () => {
      // TheSports match with no scores (pre-match state)
      const preMatchData = {
        ...mockTheSportsMatch,
        status_id: 1, // NOT_STARTED
        home_score_display: null,
        away_score_display: null,
        home_scores: null,
        away_scores: null,
      };

      // Mock TheSports query
      mockPool.query.mockResolvedValueOnce({
        rows: [preMatchData],
      } as any);

      // Mock FootyStats query - stored mapping
      mockPool.query.mockResolvedValueOnce({
        rows: [mockFootyStatsData],
      } as any);

      const result = await featureBuilderService.buildScoringFeatures('ts-match-456');

      // Features should have xG/odds/potentials (from FootyStats)
      expect(result.features.xg).toBeDefined();
      expect(result.features.odds).toBeDefined();

      // But no scores/corners/cards (match not started)
      expect(result.features.ft_scores).toBeUndefined();
      expect(result.features.ht_scores).toBeUndefined();
      expect(result.features.corners).toBeUndefined();
      expect(result.features.cards).toBeUndefined();

      // Completeness
      expect(result.features.completeness.present).toContain('xg');
      expect(result.features.completeness.missing).toContain('ft_scores');
    });

    test('should merge potentials correctly with undefined fields', async () => {
      // FootyStats data with partial potentials
      const partialFootyStatsData = {
        ...mockFootyStatsData,
        o25_potential: 68,
        btts_potential: 72,
        o15_potential: null, // Missing
        corners_potential: null, // Missing
        cards_potential: null, // Missing
      };

      // Mock queries
      mockPool.query.mockResolvedValueOnce({
        rows: [mockTheSportsMatch],
      } as any);

      mockPool.query.mockResolvedValueOnce({
        rows: [partialFootyStatsData],
      } as any);

      const result = await featureBuilderService.buildScoringFeatures('ts-match-456');

      // Potentials should be present but with some undefined fields
      expect(result.features.potentials).toBeDefined();
      expect(result.features.potentials?.over25).toBe(68);
      expect(result.features.potentials?.btts).toBe(72);
      expect(result.features.potentials?.over15).toBeUndefined();
      expect(result.features.potentials?.corners_over85).toBeUndefined();
      expect(result.features.potentials?.cards_over25).toBeUndefined();
    });
  });
});
