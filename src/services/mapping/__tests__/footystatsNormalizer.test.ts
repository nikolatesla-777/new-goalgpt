/**
 * FootyStats Normalizer Tests
 *
 * Tests for raw API data normalization to canonical snapshots
 */

import { normalizeFootyStatsMatch, validateSnapshot } from '../footystatsNormalizer';
import { RawFootyStatsMatch, RawFootyStatsTeamForm } from '../../../types/footystats.raw';

describe('footystatsNormalizer', () => {
  describe('normalizeFootyStatsMatch - Basic Structure', () => {
    it('should normalize minimal match data', () => {
      const rawMatch: RawFootyStatsMatch = {
        id: 12345,
        homeID: 100,
        awayID: 200,
        home_name: 'Manchester United',
        away_name: 'Liverpool',
        status: 'scheduled',
        date_unix: 1706745600, // 2024-02-01 00:00:00
        homeGoalCount: null,
        awayGoalCount: null,
      };

      const snapshot = normalizeFootyStatsMatch(rawMatch);

      // Validate basic structure
      expect(snapshot.ids.fs_match_id).toBe(12345);
      expect(snapshot.ids.home_team_id).toBe(100);
      expect(snapshot.ids.away_team_id).toBe(200);
      expect(snapshot.teams.home_name).toBe('Manchester United');
      expect(snapshot.teams.away_name).toBe('Liverpool');
      expect(snapshot.time.status).toBe('scheduled');
      expect(snapshot.time.match_date_unix).toBe(1706745600);

      // Validate metadata
      expect(snapshot.meta.schema_version).toBe(1);
      expect(snapshot.meta.source_version).toBe('footystats-api-v1');
      expect(snapshot.meta.confidence.data_completeness).toBeGreaterThan(0);

      // Validate no null values
      const validation = validateSnapshot(snapshot);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should normalize match with full data', () => {
      const rawMatch: RawFootyStatsMatch = {
        id: 12345,
        homeID: 100,
        awayID: 200,
        home_name: 'Manchester United',
        away_name: 'Liverpool',
        competition_name: 'Premier League',
        status: 'scheduled',
        date_unix: 1706745600,
        homeGoalCount: null,
        awayGoalCount: null,
        btts_potential: 75,
        o25_potential: 80,
        o15_potential: 90,
        avg_potential: 85,
        corners_potential: 70,
        cards_potential: 65,
        team_a_xg_prematch: 1.8,
        team_b_xg_prematch: 1.5,
        odds_ft_1: 2.1,
        odds_ft_x: 3.4,
        odds_ft_2: 3.2,
        trends: {
          home: [
            ['positive', 'Strong home form'],
            ['neutral', 'Average attack'],
          ],
          away: [
            ['negative', 'Weak away form'],
          ],
        },
        h2h: {
          previous_matches_results: {
            team_a_wins: 5,
            team_b_wins: 3,
            draw: 2,
            totalMatches: 10,
          },
          betting_stats: {
            bttsPercentage: 60,
            over25Percentage: 70,
            avg_goals: 2.8,
          },
          previous_matches_ids: [
            { id: 1, date_unix: 1700000000, team_a_id: 100, team_b_id: 200, team_a_goals: 2, team_b_goals: 1 },
            { id: 2, date_unix: 1690000000, team_a_id: 100, team_b_id: 200, team_a_goals: 1, team_b_goals: 1 },
          ],
        },
      };

      const snapshot = normalizeFootyStatsMatch(rawMatch);

      // Validate potentials
      expect(snapshot.stats.potentials.btts).toBe(75);
      expect(snapshot.stats.potentials.over25).toBe(80);
      expect(snapshot.stats.potentials.over15).toBe(90);
      expect(snapshot.stats.potentials.corners).toBe(70);
      expect(snapshot.stats.potentials.cards).toBe(65);

      // Validate xG
      expect(snapshot.stats.xg.home).toBe(1.8);
      expect(snapshot.stats.xg.away).toBe(1.5);
      expect(snapshot.stats.xg.total).toBe(3.3);

      // Validate odds
      expect(snapshot.odds?.home).toBe(2.1);
      expect(snapshot.odds?.draw).toBe(3.4);
      expect(snapshot.odds?.away).toBe(3.2);

      // Validate trends
      expect(snapshot.trends?.home).toEqual(['Strong home form', 'Average attack']);
      expect(snapshot.trends?.away).toEqual(['Weak away form']);

      // Validate H2H
      expect(snapshot.stats.h2h?.total_matches).toBe(10);
      expect(snapshot.stats.h2h?.home_wins).toBe(5);
      expect(snapshot.stats.h2h?.away_wins).toBe(3);
      expect(snapshot.stats.h2h?.draws).toBe(2);
      expect(snapshot.stats.h2h?.btts_pct).toBe(60);
      expect(snapshot.stats.h2h?.avg_goals).toBe(2.8);
      expect(snapshot.stats.h2h?.recent_match_ids).toEqual([1, 2]);

      // Validate confidence
      expect(snapshot.meta.confidence.data_completeness).toBeGreaterThan(80);
      expect(snapshot.meta.confidence.has_xg_data).toBe(true);
      expect(snapshot.meta.confidence.has_h2h_data).toBe(true);
      expect(snapshot.meta.confidence.has_odds_data).toBe(true);
    });
  });

  describe('normalizeFootyStatsMatch - Null Handling', () => {
    it('should convert null to undefined for optional fields', () => {
      const rawMatch: RawFootyStatsMatch = {
        id: 12345,
        homeID: 100,
        awayID: 200,
        home_name: 'Team A',
        away_name: 'Team B',
        status: 'scheduled',
        date_unix: 1706745600,
        homeGoalCount: null,
        awayGoalCount: null,
        btts_potential: null,
        o25_potential: null,
        team_a_xg_prematch: null,
        team_b_xg_prematch: null,
        trends: null,
        h2h: null,
      };

      const snapshot = normalizeFootyStatsMatch(rawMatch);

      // All null values should be undefined (not present in JSON)
      expect(snapshot.stats.potentials.btts).toBeUndefined();
      expect(snapshot.stats.potentials.over25).toBeUndefined();
      expect(snapshot.stats.xg.home).toBeUndefined();
      expect(snapshot.stats.xg.away).toBeUndefined();
      expect(snapshot.stats.xg.total).toBeUndefined();
      expect(snapshot.trends).toBeUndefined();
      expect(snapshot.stats.h2h).toBeUndefined();

      // Validate no null in JSON
      const jsonStr = JSON.stringify(snapshot);
      expect(jsonStr).not.toContain(':null');
    });

    it('should handle deeply nested nulls in H2H', () => {
      const rawMatch: RawFootyStatsMatch = {
        id: 12345,
        homeID: 100,
        awayID: 200,
        home_name: 'Team A',
        away_name: 'Team B',
        status: 'scheduled',
        date_unix: 1706745600,
        homeGoalCount: null,
        awayGoalCount: null,
        h2h: {
          previous_matches_results: {
            team_a_wins: null,
            team_b_wins: null,
            draw: null,
            totalMatches: null,
          },
          betting_stats: null,
          previous_matches_ids: null,
        },
      };

      const snapshot = normalizeFootyStatsMatch(rawMatch);

      // H2H should exist but with default values
      expect(snapshot.stats.h2h?.total_matches).toBe(0);
      expect(snapshot.stats.h2h?.home_wins).toBe(0);
      expect(snapshot.stats.h2h?.away_wins).toBe(0);
      expect(snapshot.stats.h2h?.draws).toBe(0);
      expect(snapshot.stats.h2h?.recent_match_ids).toEqual([]);
    });
  });

  describe('normalizeFootyStatsMatch - Form Data', () => {
    it('should normalize home form data', () => {
      const rawMatch: RawFootyStatsMatch = {
        id: 12345,
        homeID: 100,
        awayID: 200,
        home_name: 'Team A',
        away_name: 'Team B',
        status: 'scheduled',
        date_unix: 1706745600,
        homeGoalCount: null,
        awayGoalCount: null,
      };

      const homeForm: RawFootyStatsTeamForm = {
        team_id: 100,
        last_x_match_num: 5,
        formRun_overall: 'WWLDW',
        formRun_home: 'WWW',
        formRun_away: 'DW',
        seasonPPG_overall: 2.1,
        seasonBTTSPercentage_overall: 60,
        seasonOver25Percentage_overall: 55,
        xg_for_avg_overall: 1.8,
        xg_against_avg_overall: 1.2,
        cornersAVG_overall: 5.5,
        cardsAVG_overall: 2.3,
      };

      const snapshot = normalizeFootyStatsMatch(rawMatch, homeForm);

      expect(snapshot.stats.form.home?.ppg).toBe(2.1);
      expect(snapshot.stats.form.home?.btts_pct).toBe(60);
      expect(snapshot.stats.form.home?.over25_pct).toBe(55);
      expect(snapshot.stats.form.home?.overall_form).toBe('WWLDW');
      expect(snapshot.stats.form.home?.home_only_form).toBe('WWW');

      expect(snapshot.meta.confidence.has_form_data).toBe(true);
    });

    it('should handle missing form data gracefully', () => {
      const rawMatch: RawFootyStatsMatch = {
        id: 12345,
        homeID: 100,
        awayID: 200,
        home_name: 'Team A',
        away_name: 'Team B',
        status: 'scheduled',
        date_unix: 1706745600,
        homeGoalCount: null,
        awayGoalCount: null,
      };

      const snapshot = normalizeFootyStatsMatch(rawMatch);

      expect(snapshot.stats.form.home).toBeUndefined();
      expect(snapshot.stats.form.away).toBeUndefined();
      expect(snapshot.meta.confidence.has_form_data).toBe(false);
    });
  });

  describe('normalizeFootyStatsMatch - Missing Fields Tracking', () => {
    it('should track missing critical fields', () => {
      const rawMatch: RawFootyStatsMatch = {
        id: 12345,
        homeID: 100,
        awayID: 200,
        home_name: 'Team A',
        away_name: 'Team B',
        status: 'scheduled',
        date_unix: 1706745600,
        homeGoalCount: null,
        awayGoalCount: null,
        btts_potential: null,
        o25_potential: null,
        team_a_xg_prematch: null,
        team_b_xg_prematch: null,
      };

      const snapshot = normalizeFootyStatsMatch(rawMatch);

      // Check missing fields are tracked
      expect(snapshot.meta.missing_fields).toContain('potentials.btts');
      expect(snapshot.meta.missing_fields).toContain('potentials.over25');
      expect(snapshot.meta.missing_fields).toContain('xg.home');
      expect(snapshot.meta.missing_fields).toContain('xg.away');

      // Completeness should be lower
      expect(snapshot.meta.confidence.data_completeness).toBeLessThan(80);
    });

    it('should have high completeness with full data', () => {
      const rawMatch: RawFootyStatsMatch = {
        id: 12345,
        homeID: 100,
        awayID: 200,
        home_name: 'Team A',
        away_name: 'Team B',
        status: 'scheduled',
        date_unix: 1706745600,
        homeGoalCount: null,
        awayGoalCount: null,
        btts_potential: 75,
        o25_potential: 80,
        team_a_xg_prematch: 1.5,
        team_b_xg_prematch: 1.2,
      };

      const homeForm: RawFootyStatsTeamForm = {
        team_id: 100,
        last_x_match_num: 5,
        formRun_overall: 'WWLDW',
        formRun_home: null,
        formRun_away: null,
        seasonPPG_overall: 2.1,
        seasonBTTSPercentage_overall: 60,
        seasonOver25Percentage_overall: 55,
        xg_for_avg_overall: null,
        xg_against_avg_overall: null,
        cornersAVG_overall: null,
        cardsAVG_overall: null,
      };

      const snapshot = normalizeFootyStatsMatch(rawMatch, homeForm);

      // Completeness should be high with critical fields present
      expect(snapshot.meta.confidence.data_completeness).toBeGreaterThanOrEqual(70);
      expect(snapshot.meta.missing_fields.length).toBeLessThan(10);
    });
  });

  describe('validateSnapshot', () => {
    it('should validate correct snapshot', () => {
      const rawMatch: RawFootyStatsMatch = {
        id: 12345,
        homeID: 100,
        awayID: 200,
        home_name: 'Team A',
        away_name: 'Team B',
        status: 'scheduled',
        date_unix: 1706745600,
        homeGoalCount: null,
        awayGoalCount: null,
      };

      const snapshot = normalizeFootyStatsMatch(rawMatch);
      const validation = validateSnapshot(snapshot);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidSnapshot: any = {
        ids: {},
        time: {},
        teams: {},
        stats: {},
        meta: {},
      };

      const validation = validateSnapshot(invalidSnapshot);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Missing ids.fs_match_id');
      expect(validation.errors).toContain('Missing teams.home_name');
    });
  });
});
