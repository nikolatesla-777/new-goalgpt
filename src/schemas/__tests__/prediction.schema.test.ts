/**
 * Prediction Schema Validation Tests
 *
 * Purpose: Verify schema validation rules for manual predictions
 */

import { manualPredictionSchema } from '../prediction.schema';

describe('Manual Prediction Schema Validation', () => {
  describe('Valid Payloads', () => {
    test('Should accept valid manual prediction with Alert_System bot', () => {
      const validPayload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Barcelona',
        away_team: 'Real Madrid',
        league: 'La Liga',
        score: '0-0',
        minute: 15,
        prediction: 'IY 0.5 ÜST',
        access_type: 'VIP' as const,
        bot_name: 'Alert_System',
      };

      const result = manualPredictionSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    test('Should accept bot_name with underscores', () => {
      const payload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Barcelona',
        away_team: 'Real Madrid',
        league: 'La Liga',
        score: '1-0',
        minute: 30,
        prediction: 'MS 1',
        access_type: 'FREE' as const,
        bot_name: 'Manual_Alert_Bot_v2',
      };

      const result = manualPredictionSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test('Should accept bot_name with alphanumeric', () => {
      const payload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Liverpool',
        away_team: 'Arsenal',
        league: 'Premier League',
        score: '2-1',
        minute: 45,
        prediction: 'KG VAR',
        access_type: 'VIP' as const,
        bot_name: 'Bot123',
      };

      const result = manualPredictionSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    test('Should accept bot_name as optional (undefined)', () => {
      const payload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Chelsea',
        away_team: 'Manchester United',
        league: 'Premier League',
        score: '0-0',
        minute: 10,
        prediction: 'IY 1.5 ÜST',
        access_type: 'VIP' as const,
        // bot_name not provided - should use service default
      };

      const result = manualPredictionSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Payloads - Bot Name Validation', () => {
    test('Should reject bot_name with spaces (Alert System)', () => {
      const invalidPayload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Barcelona',
        away_team: 'Real Madrid',
        league: 'La Liga',
        score: '0-0',
        minute: 15,
        prediction: 'IY 0.5 ÜST',
        access_type: 'VIP' as const,
        bot_name: 'Alert System', // ❌ Has space
      };

      const result = manualPredictionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('bot_name');
        expect(result.error.issues[0].message).toContain('alphanumeric');
      }
    });

    test('Should reject bot_name with special characters', () => {
      const invalidPayload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Barcelona',
        away_team: 'Real Madrid',
        league: 'La Liga',
        score: '0-0',
        minute: 15,
        prediction: 'IY 0.5 ÜST',
        access_type: 'VIP' as const,
        bot_name: 'Alert-Bot!', // ❌ Has hyphen and exclamation
      };

      const result = manualPredictionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    test('Should reject bot_name with Turkish characters', () => {
      const invalidPayload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Galatasaray',
        away_team: 'Fenerbahçe',
        league: 'Süper Lig',
        score: '1-1',
        minute: 20,
        prediction: 'MS X',
        access_type: 'FREE' as const,
        bot_name: 'Uyarı_Sistemi', // ❌ Has Turkish char 'ı'
      };

      const result = manualPredictionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid Payloads - Other Fields', () => {
    test('Should reject invalid score format', () => {
      const invalidPayload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Barcelona',
        away_team: 'Real Madrid',
        league: 'La Liga',
        score: '0:0', // ❌ Wrong format (should be "0-0")
        minute: 15,
        prediction: 'IY 0.5 ÜST',
        access_type: 'VIP' as const,
        bot_name: 'Alert_System',
      };

      const result = manualPredictionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('score');
      }
    });

    test('Should reject minute out of range (negative)', () => {
      const invalidPayload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Barcelona',
        away_team: 'Real Madrid',
        league: 'La Liga',
        score: '0-0',
        minute: -5, // ❌ Negative
        prediction: 'IY 0.5 ÜST',
        access_type: 'VIP' as const,
        bot_name: 'Alert_System',
      };

      const result = manualPredictionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('minute');
      }
    });

    test('Should reject minute out of range (too large)', () => {
      const invalidPayload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Barcelona',
        away_team: 'Real Madrid',
        league: 'La Liga',
        score: '0-0',
        minute: 200, // ❌ Exceeds 150
        prediction: 'IY 0.5 ÜST',
        access_type: 'VIP' as const,
        bot_name: 'Alert_System',
      };

      const result = manualPredictionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('minute');
      }
    });

    test('Should reject invalid access_type', () => {
      const invalidPayload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Barcelona',
        away_team: 'Real Madrid',
        league: 'La Liga',
        score: '0-0',
        minute: 15,
        prediction: 'IY 0.5 ÜST',
        access_type: 'PREMIUM', // ❌ Not in enum ['VIP', 'FREE']
        bot_name: 'Alert_System',
      };

      const result = manualPredictionSchema.safeParse(invalidPayload as any);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('access_type');
      }
    });

    test('Should reject empty required fields', () => {
      const invalidPayload = {
        match_id: '',  // ❌ Empty
        home_team: '',
        away_team: '',
        league: '',
        score: '0-0',
        minute: 15,
        prediction: '',
        access_type: 'VIP' as const,
      };

      const result = manualPredictionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      // Should have multiple errors for empty fields
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(1);
      }
    });
  });

  describe('Edge Cases', () => {
    test('Should accept minute at boundaries (0 and 150)', () => {
      const payloadMin = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: 'Barcelona',
        away_team: 'Real Madrid',
        league: 'La Liga',
        score: '0-0',
        minute: 0,
        prediction: 'IY 0.5 ÜST',
        access_type: 'VIP' as const,
        bot_name: 'Alert_System',
      };

      const resultMin = manualPredictionSchema.safeParse(payloadMin);
      expect(resultMin.success).toBe(true);

      const payloadMax = { ...payloadMin, minute: 150 };
      const resultMax = manualPredictionSchema.safeParse(payloadMax);
      expect(resultMax.success).toBe(true);
    });

    test('Should trim team names', () => {
      const payload = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_team: '  Barcelona  ', // Has spaces
        away_team: 'Real Madrid   ',
        league: '  La Liga',
        score: '0-0',
        minute: 15,
        prediction: 'IY 0.5 ÜST',
        access_type: 'VIP' as const,
        bot_name: 'Alert_System',
      };

      const result = manualPredictionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.home_team).toBe('Barcelona');
        expect(result.data.away_team).toBe('Real Madrid');
        expect(result.data.league).toBe('La Liga');
      }
    });
  });
});
