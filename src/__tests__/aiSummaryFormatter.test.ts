/**
 * AI Summary Formatter Unit Tests - Week-2B Hardening
 *
 * Tests for AI-powered match summary formatting
 *
 * Coverage:
 * - TR/EN locale formatting
 * - Emoji styles (minimal/none)
 * - Threshold-based labels (xG, edge)
 * - canPublish filtering
 * - Banned word detection
 * - Single-line disclaimers
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { AISummaryFormatter } from '../services/content/aiSummaryFormatter';
import type { MatchSummaryInput } from '../services/content/aiSummaryFormatter';

describe('AISummaryFormatter - Week-2B Hardening', () => {
  let formatter: AISummaryFormatter;

  beforeEach(() => {
    formatter = new AISummaryFormatter();
  });

  // Helper: Create mock match summary input
  const createMockInput = (options: {
    publishableMarkets?: string[];
    xgTotal?: number;
    confidence?: number;
    edge?: number;
  } = {}): MatchSummaryInput => {
    const {
      publishableMarkets = ['O25', 'BTTS'],
      xgTotal = 2.85,
      confidence = 72,
      edge = 0.08,
    } = options;

    return {
      homeTeam: 'Barcelona',
      awayTeam: 'Real Madrid',
      league: 'LaLiga',
      matchTime: '2026-01-28T20:00:00Z',
      predictions: [
        {
          marketId: 'O25',
          displayName: '2.5 Üst Gol',
          scoringResult: {
            pick: 'YES',
            probability: 0.685,
            confidence,
            edge,
            metadata: { lambda_total: xgTotal },
            risk_flags: [],
          },
          publishEligibility: {
            canPublish: publishableMarkets.includes('O25'),
            reasons: publishableMarkets.includes('O25') ? [] : ['LOW_CONFIDENCE'],
          },
        },
        {
          marketId: 'BTTS',
          displayName: 'Karşılıklı Gol',
          scoringResult: {
            pick: 'YES',
            probability: 0.712,
            confidence: 78,
            edge: 0.05,
            metadata: { home_scoring_prob: 0.85, away_scoring_prob: 0.83 },
            risk_flags: [],
          },
          publishEligibility: {
            canPublish: publishableMarkets.includes('BTTS'),
            reasons: publishableMarkets.includes('BTTS') ? [] : ['LOW_CONFIDENCE'],
          },
        },
        {
          marketId: 'O35',
          displayName: '3.5 Üst Gol',
          scoringResult: {
            pick: 'NO',
            probability: 0.425,
            confidence: 58,
            edge: null,
            metadata: {},
            risk_flags: [],
          },
          publishEligibility: {
            canPublish: false,
            reasons: ['LOW_CONFIDENCE'],
          },
        },
      ],
    };
  };

  describe('Turkish (TR) Locale', () => {
    it('should format summary in Turkish with minimal emoji', () => {
      // Arrange
      const input = createMockInput();

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr', emojiStyle: 'minimal' });

      // Assert
      expect(result.header).toContain('🤖');
      expect(result.header).toContain('GoalGPT AI İstatistik Özeti');
      expect(result.overview).toContain('Barcelona - Real Madrid');
      expect(result.overview).toContain('market analiz edildi');
      expect(result.footer).toContain('FootyStats');
      expect(result.fullText).toBeTruthy();
    });

    it('should format summary in Turkish without emoji', () => {
      // Arrange
      const input = createMockInput();

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr', emojiStyle: 'none' });

      // Assert
      expect(result.header).not.toContain('🤖');
      expect(result.header).toBe('GoalGPT AI İstatistik Özeti');
      expect(result.fullText).not.toContain('⚡');
      expect(result.fullText).not.toContain('📊');
      expect(result.footer).toContain('*');
    });

    it('should show Turkish xG threshold labels correctly', () => {
      // Arrange: High xG
      const highXG = createMockInput({ xgTotal: 3.2 });

      // Act
      const result = formatter.formatMatchSummary(highXG, { locale: 'tr' });

      // Assert: Should show "Yüksek seviye"
      const xgLine = result.keyAngles.find(a => a.includes('Beklenen gol'));
      expect(xgLine).toContain('3.20');
      expect(xgLine).toContain('Yüksek seviye');
    });

    it('should show Turkish medium xG label for threshold >= 2.0', () => {
      // Arrange: Medium xG
      const mediumXG = createMockInput({ xgTotal: 2.3 });

      // Act
      const result = formatter.formatMatchSummary(mediumXG, { locale: 'tr' });

      // Assert
      const xgLine = result.keyAngles.find(a => a.includes('Beklenen gol'));
      expect(xgLine).toContain('2.30');
      expect(xgLine).toContain('Orta seviye');
    });

    it('should show Turkish low xG label for threshold < 2.0', () => {
      // Arrange: Low xG
      const lowXG = createMockInput({ xgTotal: 1.8 });

      // Act
      const result = formatter.formatMatchSummary(lowXG, { locale: 'tr' });

      // Assert
      const xgLine = result.keyAngles.find(a => a.includes('Beklenen gol'));
      expect(xgLine).toContain('1.80');
      expect(xgLine).toContain('Düşük seviye');
    });

    it('should format edge percentage correctly in Turkish', () => {
      // Arrange: Set O25 confidence higher to ensure it's first in bet ideas
      const input = createMockInput({ edge: 0.08, confidence: 85 });

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert: Edge should be formatted as percentage
      // Find O25 market in bet ideas (sorted by confidence)
      const o25BetIdea = result.betIdeas.find(idea => idea.includes('2.5 Üst Gol'));
      expect(o25BetIdea).toBeDefined();
      expect(o25BetIdea).toContain('Değer: +8.0%');
    });

    it('should add "(yüksek)" label for significant edge in Turkish', () => {
      // Arrange: Significant edge (>= 5%) with high confidence
      const input = createMockInput({ edge: 0.12, confidence: 90 });

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert
      const o25BetIdea = result.betIdeas.find(idea => idea.includes('2.5 Üst Gol'));
      expect(o25BetIdea).toBeDefined();
      expect(o25BetIdea).toContain('Değer: +12.0% (yüksek)');
    });

    it('should have single-line disclaimer in Turkish', () => {
      // Arrange
      const input = createMockInput();

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert: No line breaks in disclaimer
      expect(result.footer).not.toContain('\n');
      expect(result.footer).toContain('GoalGPT AI');
      expect(result.footer).toContain('FootyStats');
    });
  });

  describe('English (EN) Locale', () => {
    it('should format summary in English with minimal emoji', () => {
      // Arrange
      const input = createMockInput();

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'en', emojiStyle: 'minimal' });

      // Assert
      expect(result.header).toContain('🤖');
      expect(result.header).toContain('GoalGPT AI Stats Summary');
      expect(result.overview).toContain('Barcelona vs Real Madrid');
      expect(result.overview).toContain('markets analyzed');
      expect(result.footer).toContain('FootyStats');
    });

    it('should show English xG threshold labels correctly', () => {
      // Arrange: High xG
      const highXG = createMockInput({ xgTotal: 3.0 });

      // Act
      const result = formatter.formatMatchSummary(highXG, { locale: 'en' });

      // Assert: Should show "High level"
      const xgLine = result.keyAngles.find(a => a.includes('Expected goals'));
      expect(xgLine).toContain('3.00');
      expect(xgLine).toContain('High level');
    });

    it('should show English medium xG label for threshold >= 2.0', () => {
      // Arrange
      const mediumXG = createMockInput({ xgTotal: 2.5 });

      // Act
      const result = formatter.formatMatchSummary(mediumXG, { locale: 'en' });

      // Assert
      const xgLine = result.keyAngles.find(a => a.includes('Expected goals'));
      expect(xgLine).toContain('2.50');
      expect(xgLine).toContain('Medium level');
    });

    it('should show English low xG label for threshold < 2.0', () => {
      // Arrange
      const lowXG = createMockInput({ xgTotal: 1.5 });

      // Act
      const result = formatter.formatMatchSummary(lowXG, { locale: 'en' });

      // Assert
      const xgLine = result.keyAngles.find(a => a.includes('Expected goals'));
      expect(xgLine).toContain('1.50');
      expect(xgLine).toContain('Low level');
    });

    it('should add "(high)" label for significant edge in English', () => {
      // Arrange: Significant edge (>= 5%) with high confidence
      const input = createMockInput({ edge: 0.15, confidence: 90 });

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'en' });

      // Assert
      const o25BetIdea = result.betIdeas.find(idea => idea.includes('2.5 Üst Gol'));
      expect(o25BetIdea).toBeDefined();
      expect(o25BetIdea).toContain('Edge: +15.0% (high)');
    });

    it('should have single-line disclaimer in English', () => {
      // Arrange
      const input = createMockInput();

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'en' });

      // Assert: No line breaks in disclaimer
      expect(result.footer).not.toContain('\n');
      expect(result.footer).toContain('GoalGPT AI');
      expect(result.footer).toContain('FootyStats');
    });
  });

  describe('canPublish Filtering (GUARDRAIL)', () => {
    it('should ONLY include canPublish=true markets in bet ideas', () => {
      // Arrange: Only O25 is publishable
      const input = createMockInput({ publishableMarkets: ['O25'] });

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert: Only O25 should appear in bet ideas
      expect(result.betIdeas.length).toBeGreaterThan(0);
      expect(result.betIdeas[0]).toContain('2.5 Üst Gol');
      expect(result.betIdeas.join(' ')).not.toContain('Karşılıklı Gol'); // BTTS not publishable
      expect(result.betIdeas.join(' ')).not.toContain('3.5 Üst Gol'); // O35 not publishable
    });

    it('should show "no predictions" message when no markets publishable', () => {
      // Arrange: No publishable markets
      const input = createMockInput({ publishableMarkets: [] });

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert
      expect(result.betIdeas).toHaveLength(1);
      expect(result.betIdeas[0]).toContain('Yayına uygun yüksek güvenli tahmin bulunamadı');
    });

    it('should limit bet ideas to top 4 by confidence', () => {
      // Arrange: Create input with 6 publishable markets
      const input: MatchSummaryInput = {
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        league: 'Test League',
        matchTime: '2026-01-28T20:00:00Z',
        predictions: [
          {
            marketId: 'M1',
            displayName: 'Market 1',
            scoringResult: {
              pick: 'YES',
              probability: 0.6,
              confidence: 90,
              edge: 0.1,
              metadata: {},
              risk_flags: [],
            },
            publishEligibility: { canPublish: true, reasons: [] },
          },
          {
            marketId: 'M2',
            displayName: 'Market 2',
            scoringResult: {
              pick: 'YES',
              probability: 0.6,
              confidence: 85,
              edge: 0.1,
              metadata: {},
              risk_flags: [],
            },
            publishEligibility: { canPublish: true, reasons: [] },
          },
          {
            marketId: 'M3',
            displayName: 'Market 3',
            scoringResult: {
              pick: 'YES',
              probability: 0.6,
              confidence: 80,
              edge: 0.1,
              metadata: {},
              risk_flags: [],
            },
            publishEligibility: { canPublish: true, reasons: [] },
          },
          {
            marketId: 'M4',
            displayName: 'Market 4',
            scoringResult: {
              pick: 'YES',
              probability: 0.6,
              confidence: 75,
              edge: 0.1,
              metadata: {},
              risk_flags: [],
            },
            publishEligibility: { canPublish: true, reasons: [] },
          },
          {
            marketId: 'M5',
            displayName: 'Market 5',
            scoringResult: {
              pick: 'YES',
              probability: 0.6,
              confidence: 70,
              edge: 0.1,
              metadata: {},
              risk_flags: [],
            },
            publishEligibility: { canPublish: true, reasons: [] },
          },
          {
            marketId: 'M6',
            displayName: 'Market 6',
            scoringResult: {
              pick: 'YES',
              probability: 0.6,
              confidence: 65,
              edge: 0.1,
              metadata: {},
              risk_flags: [],
            },
            publishEligibility: { canPublish: true, reasons: [] },
          },
        ],
      };

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert: Max 4 bet ideas
      expect(result.betIdeas.length).toBe(4);
      expect(result.betIdeas[0]).toContain('Market 1'); // Highest confidence
      expect(result.betIdeas[1]).toContain('Market 2');
      expect(result.betIdeas[2]).toContain('Market 3');
      expect(result.betIdeas[3]).toContain('Market 4');
      expect(result.betIdeas.join(' ')).not.toContain('Market 5'); // Excluded
      expect(result.betIdeas.join(' ')).not.toContain('Market 6'); // Excluded
    });
  });

  describe('Banned Words Detection (GUARDRAIL)', () => {
    const bannedWords = [
      'guaranteed',
      'sure win',
      'risk-free',
      '100% win',
      'can\'t lose',
      'guaranteed profit',
      'no risk',
    ];

    bannedWords.forEach((word) => {
      it(`should NOT contain banned word: "${word}"`, () => {
        // Arrange
        const input = createMockInput();

        // Act
        const result = formatter.formatMatchSummary(input, { locale: 'en' });

        // Assert
        const fullTextLower = result.fullText.toLowerCase();
        expect(fullTextLower).not.toContain(word.toLowerCase());
      });
    });

    it('should use neutral, data-driven language only', () => {
      // Arrange
      const input = createMockInput();

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'en' });

      // Assert: Check for neutral tone
      expect(result.fullText).toContain('probability');
      expect(result.fullText).toContain('confidence');
      expect(result.fullText).not.toMatch(/must|definitely|certainly|absolutely/i);
    });
  });

  describe('formatPrediction() - Single Market Formatting', () => {
    it('should format single prediction with edge in Turkish', () => {
      // Arrange
      const scoringResult = {
        pick: 'YES',
        probability: 0.685,
        confidence: 72,
        edge: 0.08,
        metadata: {},
        risk_flags: [],
      };

      // Act
      const formatted = formatter.formatPrediction('2.5 Üst Gol', scoringResult, 'tr');

      // Assert
      expect(formatted).toContain('2.5 Üst Gol');
      expect(formatted).toContain('68.5%');
      expect(formatted).toContain('Güven: 72/100');
      expect(formatted).toContain('Değer: +8.0%');
    });

    it('should format single prediction without edge in English', () => {
      // Arrange
      const scoringResult = {
        pick: 'YES',
        probability: 0.712,
        confidence: 78,
        edge: null, // No edge
        metadata: {},
        risk_flags: [],
      };

      // Act
      const formatted = formatter.formatPrediction('BTTS', scoringResult, 'en');

      // Assert
      expect(formatted).toContain('BTTS');
      expect(formatted).toContain('71.2%');
      expect(formatted).toContain('Confidence: 78/100');
      expect(formatted).not.toContain('Edge');
    });

    it('should not show edge for negative edge', () => {
      // Arrange
      const scoringResult = {
        pick: 'YES',
        probability: 0.6,
        confidence: 65,
        edge: -0.02, // Negative edge
        metadata: {},
        risk_flags: [],
      };

      // Act
      const formatted = formatter.formatPrediction('Test Market', scoringResult, 'tr');

      // Assert: Negative edge should not be displayed
      expect(formatted).not.toContain('Değer');
    });

    it('should not show edge for zero edge', () => {
      // Arrange
      const scoringResult = {
        pick: 'YES',
        probability: 0.6,
        confidence: 65,
        edge: 0, // Zero edge
        metadata: {},
        risk_flags: [],
      };

      // Act
      const formatted = formatter.formatPrediction('Test Market', scoringResult, 'tr');

      // Assert: Zero edge should not be displayed
      expect(formatted).not.toContain('Değer');
    });
  });

  describe('Full Text Assembly', () => {
    it('should include all sections in correct order', () => {
      // Arrange
      const input = createMockInput();

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert: Check order of sections
      const sections = result.fullText.split('\n\n');

      expect(sections.length).toBeGreaterThan(3);
      expect(sections[0]).toContain('GoalGPT AI'); // Header
      expect(result.fullText.indexOf('Barcelona - Real Madrid')).toBeLessThan(
        result.fullText.indexOf('Öne Çıkan Noktalar')
      ); // Overview before key angles
      expect(result.fullText.indexOf('Öne Çıkan Noktalar')).toBeLessThan(
        result.fullText.indexOf('Bahis Fikirleri')
      ); // Key angles before bet ideas
      expect(result.fullText.indexOf('Bahis Fikirleri')).toBeLessThan(
        result.fullText.indexOf('FootyStats')
      ); // Bet ideas before footer
    });

    it('should separate sections with blank lines', () => {
      // Arrange
      const input = createMockInput();

      // Act
      const result = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert: Should have blank lines between sections
      expect(result.fullText).toContain('\n\n');
    });
  });
});
