/**
 * Unit Tests for AISummaryFormatter - Week-2B
 *
 * Tests AI summary generation with locale support, emoji control, and data-driven content
 *
 * @author GoalGPT Team
 */

import type { ScoringResult } from '../services/scoring/marketScorer.service';
import type { PublishEligibilityResult } from '../services/scoring/publishEligibility';
import type { MatchSummaryInput } from '../services/content/aiSummaryFormatter';

// Mock imports
const AISummaryFormatterModule = require('../services/content/aiSummaryFormatter');
const { AISummaryFormatter } = AISummaryFormatterModule;

describe('AISummaryFormatter', () => {
  let formatter: any;

  beforeEach(() => {
    formatter = new AISummaryFormatter();
  });

  // ============================================================================
  // TEST 1: Turkish Locale (TR) - Minimal Emoji
  // ============================================================================
  describe('Turkish Locale (TR)', () => {
    it('should generate summary in Turkish with minimal emojis', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Barcelona',
        awayTeam: 'Real Madrid',
        league: 'LaLiga',
        matchTime: '2026-01-29T20:00:00Z',
        predictions: [
          {
            marketId: 'O25',
            displayName: '2.5 Üst Gol',
            scoringResult: {
              market_id: 'O25',
              match_id: 'test-match-123',
              probability: 0.685,
              confidence: 72,
              pick: 'YES',
              edge: 0.15,
              risk_flags: [],
              metadata: {
                lambda_total: 2.85,
              },
            } as ScoringResult,
            publishEligibility: {
              canPublish: true,
              reason: 'All checks passed',
              failedChecks: [],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr', emojiStyle: 'minimal' });

      // Assert
      expect(summary.header).toContain('🤖');
      expect(summary.header).toContain('GoalGPT AI İstatistik Özeti');
      expect(summary.overview).toContain('Barcelona - Real Madrid');
      expect(summary.overview).toContain('1 market yayına uygun');
      expect(summary.footer).toContain('FootyStats');
      expect(summary.fullText).toContain('🤖');
      expect(summary.fullText).toContain('Barcelona');
      expect(summary.fullText).toContain('Real Madrid');
    });
  });

  // ============================================================================
  // TEST 2: English Locale (EN) - Minimal Emoji
  // ============================================================================
  describe('English Locale (EN)', () => {
    it('should generate summary in English with minimal emojis', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Manchester City',
        awayTeam: 'Liverpool',
        league: 'Premier League',
        matchTime: '2026-01-29T18:30:00Z',
        predictions: [
          {
            marketId: 'BTTS',
            displayName: 'Both Teams To Score',
            scoringResult: {
              market_id: 'BTTS',
              match_id: 'test-match-456',
              probability: 0.712,
              confidence: 78,
              pick: 'YES',
              edge: 0.08,
              risk_flags: [],
              metadata: {
                home_scoring_prob: 0.82,
                away_scoring_prob: 0.75,
              },
            } as ScoringResult,
            publishEligibility: {
              canPublish: true,
              reason: 'All checks passed',
              failedChecks: [],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'en', emojiStyle: 'minimal' });

      // Assert
      expect(summary.header).toContain('🤖');
      expect(summary.header).toContain('GoalGPT AI Stats Summary');
      expect(summary.overview).toContain('Manchester City vs Liverpool');
      expect(summary.overview).toContain('1 markets eligible for publish');
      expect(summary.footer).toContain('FootyStats');
    });
  });

  // ============================================================================
  // TEST 3: No Emoji Mode
  // ============================================================================
  describe('No Emoji Mode', () => {
    it('should generate summary without emojis when emojiStyle=none', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Bayern Munich',
        awayTeam: 'Dortmund',
        league: 'Bundesliga',
        matchTime: '2026-01-29T19:30:00Z',
        predictions: [
          {
            marketId: 'O35',
            displayName: '3.5 Üst Gol',
            scoringResult: {
              market_id: 'O35',
              match_id: 'test-match-789',
              probability: 0.425,
              confidence: 58,
              pick: 'NO',
              edge: -0.03,
              risk_flags: ['LAMBDA_TOO_LOW'],
              metadata: {
                lambda_total: 3.05,
              },
            } as ScoringResult,
            publishEligibility: {
              canPublish: false,
              reason: 'Confidence below threshold',
              failedChecks: ['Confidence 58 < 78 (threshold)'],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr', emojiStyle: 'none' });

      // Assert
      expect(summary.header).not.toContain('🤖');
      expect(summary.header).toContain('GoalGPT AI İstatistik Özeti');
      expect(summary.fullText).not.toContain('🤖');
      expect(summary.fullText).not.toContain('📊');
      expect(summary.fullText).not.toContain('⚠️');
      expect(summary.footer).toContain('*'); // Text-only disclaimer marker
    });
  });

  // ============================================================================
  // TEST 4: Disclaimer Presence (CRITICAL SAFETY)
  // ============================================================================
  describe('Disclaimer Presence', () => {
    it('should always include disclaimer footer in Turkish', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Fenerbahçe',
        awayTeam: 'Galatasaray',
        league: 'Süper Lig',
        matchTime: '2026-01-29T21:00:00Z',
        predictions: [],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert
      expect(summary.footer).toContain('GoalGPT AI');
      expect(summary.footer).toContain('FootyStats');
      expect(summary.footer).toContain('garantisi verilmez');
      expect(summary.fullText).toContain(summary.footer);
    });

    it('should always include disclaimer footer in English', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'PSG',
        awayTeam: 'Marseille',
        league: 'Ligue 1',
        matchTime: '2026-01-29T22:00:00Z',
        predictions: [],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'en' });

      // Assert
      expect(summary.footer).toContain('GoalGPT AI');
      expect(summary.footer).toContain('FootyStats');
      expect(summary.footer).toContain('No guarantee');
      expect(summary.fullText).toContain(summary.footer);
    });
  });

  // ============================================================================
  // TEST 5: No Publishable Markets (EDGE CASE)
  // ============================================================================
  describe('No Publishable Markets', () => {
    it('should handle case with no publishable markets gracefully (TR)', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Atalanta',
        awayTeam: 'Juventus',
        league: 'Serie A',
        matchTime: '2026-01-29T20:45:00Z',
        predictions: [
          {
            marketId: 'O25',
            displayName: '2.5 Üst Gol',
            scoringResult: {
              market_id: 'O25',
              match_id: 'test-match-999',
              probability: 0.55,
              confidence: 52,
              pick: 'NO',
              edge: null,
              risk_flags: ['MISSING_XG', 'MISSING_ODDS'],
              metadata: {},
            } as ScoringResult,
            publishEligibility: {
              canPublish: false,
              reason: 'Blocking flags present',
              failedChecks: ['Blocking flags present: MISSING_XG'],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert
      expect(summary.overview).toContain('Yüksek güvenli tahmin bulunamadı');
      expect(summary.betIdeas).toContain('Yayına uygun yüksek güvenli tahmin bulunamadı.');
    });

    it('should handle case with no publishable markets gracefully (EN)', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Chelsea',
        awayTeam: 'Arsenal',
        league: 'Premier League',
        matchTime: '2026-01-29T17:00:00Z',
        predictions: [
          {
            marketId: 'BTTS',
            displayName: 'Both Teams To Score',
            scoringResult: {
              market_id: 'BTTS',
              match_id: 'test-match-111',
              probability: 0.48,
              confidence: 45,
              pick: 'NO',
              edge: null,
              risk_flags: ['MISSING_POTENTIALS'],
              metadata: {},
            } as ScoringResult,
            publishEligibility: {
              canPublish: false,
              reason: 'Probability below threshold',
              failedChecks: ['Probability 0.48 < 0.60 (threshold)'],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'en' });

      // Assert
      expect(summary.overview).toContain('No high-confidence predictions found');
      expect(summary.betIdeas).toContain('No high-confidence predictions eligible for publish.');
    });
  });

  // ============================================================================
  // TEST 6: Key Angles Generation (xG, Scoring Probs)
  // ============================================================================
  describe('Key Angles Generation', () => {
    it('should generate xG angle when lambda_total present', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Inter Milan',
        awayTeam: 'AC Milan',
        league: 'Serie A',
        matchTime: '2026-01-29T20:00:00Z',
        predictions: [
          {
            marketId: 'O25',
            displayName: '2.5 Üst Gol',
            scoringResult: {
              market_id: 'O25',
              match_id: 'test-match-222',
              probability: 0.695,
              confidence: 75,
              pick: 'YES',
              edge: 0.12,
              risk_flags: [],
              metadata: {
                lambda_total: 3.15, // High xG
              },
            } as ScoringResult,
            publishEligibility: {
              canPublish: true,
              reason: 'All checks passed',
              failedChecks: [],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr', emojiStyle: 'minimal' });

      // Assert
      expect(summary.keyAngles.length).toBeGreaterThan(0);
      expect(summary.keyAngles.some((angle) => angle.includes('xG'))).toBe(true);
      expect(summary.keyAngles.some((angle) => angle.includes('3.15'))).toBe(true);
      expect(summary.keyAngles.some((angle) => angle.includes('Yüksek'))).toBe(true); // High level
    });

    it('should generate scoring probability angle for BTTS', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Atletico Madrid',
        awayTeam: 'Sevilla',
        league: 'LaLiga',
        matchTime: '2026-01-29T19:00:00Z',
        predictions: [
          {
            marketId: 'BTTS',
            displayName: 'Karşılıklı Gol',
            scoringResult: {
              market_id: 'BTTS',
              match_id: 'test-match-333',
              probability: 0.702,
              confidence: 76,
              pick: 'YES',
              edge: 0.09,
              risk_flags: [],
              metadata: {
                home_scoring_prob: 0.85,
                away_scoring_prob: 0.78,
              },
            } as ScoringResult,
            publishEligibility: {
              canPublish: true,
              reason: 'All checks passed',
              failedChecks: [],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr', emojiStyle: 'minimal' });

      // Assert
      expect(summary.keyAngles.length).toBeGreaterThan(0);
      expect(summary.keyAngles.some((angle) => angle.includes('Gol atma olasılığı'))).toBe(true);
      expect(summary.keyAngles.some((angle) => angle.includes('85') && angle.includes('78'))).toBe(true);
    });
  });

  // ============================================================================
  // TEST 7: Bet Ideas (ONLY from canPublish=true)
  // ============================================================================
  describe('Bet Ideas Generation', () => {
    it('should include bet ideas ONLY for publishable markets', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Ajax',
        awayTeam: 'PSV',
        league: 'Eredivisie',
        matchTime: '2026-01-29T19:45:00Z',
        predictions: [
          {
            marketId: 'O25',
            displayName: '2.5 Üst Gol',
            scoringResult: {
              market_id: 'O25',
              match_id: 'test-match-444',
              probability: 0.688,
              confidence: 73,
              pick: 'YES',
              edge: 0.14,
              risk_flags: [],
              metadata: {},
            } as ScoringResult,
            publishEligibility: {
              canPublish: true,
              reason: 'All checks passed',
              failedChecks: [],
              passedChecks: [],
            },
          },
          {
            marketId: 'BTTS',
            displayName: 'Karşılıklı Gol',
            scoringResult: {
              market_id: 'BTTS',
              match_id: 'test-match-444',
              probability: 0.52,
              confidence: 48,
              pick: 'NO',
              edge: null,
              risk_flags: ['MISSING_ODDS'],
              metadata: {},
            } as ScoringResult,
            publishEligibility: {
              canPublish: false,
              reason: 'Confidence below threshold',
              failedChecks: ['Confidence 48 < 60 (threshold)'],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert
      expect(summary.betIdeas.length).toBe(1);
      expect(summary.betIdeas[0]).toContain('2.5 Üst Gol');
      expect(summary.betIdeas[0]).toContain('68.8'); // Probability
      expect(summary.betIdeas[0]).toContain('73'); // Confidence
      expect(summary.betIdeas[0]).not.toContain('Karşılıklı Gol'); // Not publishable
    });

    it('should show edge value when present', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Benfica',
        awayTeam: 'Porto',
        league: 'Primeira Liga',
        matchTime: '2026-01-29T21:30:00Z',
        predictions: [
          {
            marketId: 'HT_O05',
            displayName: 'İlk Yarı 0.5 Üst',
            scoringResult: {
              market_id: 'HT_O05',
              match_id: 'test-match-555',
              probability: 0.672,
              confidence: 69,
              pick: 'YES',
              edge: 0.082, // Significant edge
              risk_flags: [],
              metadata: {},
            } as ScoringResult,
            publishEligibility: {
              canPublish: true,
              reason: 'All checks passed',
              failedChecks: [],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert
      expect(summary.betIdeas[0]).toContain('Değer:'); // Edge label
      expect(summary.betIdeas[0]).toContain('8.2'); // Edge percentage
      expect(summary.betIdeas[0]).toContain('yüksek'); // High edge indicator
    });
  });

  // ============================================================================
  // TEST 8: Full Text Assembly
  // ============================================================================
  describe('Full Text Assembly', () => {
    it('should assemble full text with proper structure', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Napoli',
        awayTeam: 'Roma',
        league: 'Serie A',
        matchTime: '2026-01-29T20:30:00Z',
        predictions: [
          {
            marketId: 'O25',
            displayName: '2.5 Üst Gol',
            scoringResult: {
              market_id: 'O25',
              match_id: 'test-match-666',
              probability: 0.691,
              confidence: 74,
              pick: 'YES',
              edge: 0.11,
              risk_flags: [],
              metadata: {
                lambda_total: 2.92,
              },
            } as ScoringResult,
            publishEligibility: {
              canPublish: true,
              reason: 'All checks passed',
              failedChecks: [],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr', emojiStyle: 'minimal' });

      // Assert
      expect(summary.fullText).toContain(summary.header);
      expect(summary.fullText).toContain(summary.overview);
      expect(summary.fullText).toContain(summary.footer);
      // Check for proper sections
      expect(summary.fullText).toContain('📊 Öne Çıkan Noktalar:');
      expect(summary.fullText).toContain('💡 Bahis Fikirleri:');
      // Check structure (blank lines between sections)
      expect(summary.fullText.split('\n\n').length).toBeGreaterThan(3);
    });
  });

  // ============================================================================
  // TEST 9: Default Options (TR + Minimal Emoji)
  // ============================================================================
  describe('Default Options', () => {
    it('should use default locale (TR) and emoji style (minimal) when not specified', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Villarreal',
        awayTeam: 'Valencia',
        league: 'LaLiga',
        matchTime: '2026-01-29T18:00:00Z',
        predictions: [],
      };

      // Act
      const summary = formatter.formatMatchSummary(input); // No options

      // Assert
      expect(summary.header).toContain('🤖'); // Emoji present
      expect(summary.header).toContain('İstatistik Özeti'); // Turkish
      expect(summary.overview).toContain('maçı'); // Turkish word
    });
  });

  // ============================================================================
  // TEST 10: Data-Driven Threshold Labels
  // ============================================================================
  describe('Data-Driven Threshold Labels', () => {
    it('should use "Yüksek" label for lambda >= 2.8 (TR)', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'RB Leipzig',
        awayTeam: 'Bayern Munich',
        league: 'Bundesliga',
        matchTime: '2026-01-29T19:30:00Z',
        predictions: [
          {
            marketId: 'O25',
            displayName: '2.5 Üst Gol',
            scoringResult: {
              market_id: 'O25',
              match_id: 'test-match-777',
              probability: 0.705,
              confidence: 76,
              pick: 'YES',
              edge: 0.13,
              risk_flags: [],
              metadata: {
                lambda_total: 3.05, // >= 2.8 = High
              },
            } as ScoringResult,
            publishEligibility: {
              canPublish: true,
              reason: 'All checks passed',
              failedChecks: [],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert
      expect(summary.keyAngles.some((angle) => angle.includes('3.05') && angle.includes('Yüksek'))).toBe(true);
    });

    it('should use "Orta" label for lambda >= 2.0 and < 2.8 (TR)', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Bayer Leverkusen',
        awayTeam: 'Frankfurt',
        league: 'Bundesliga',
        matchTime: '2026-01-29T17:30:00Z',
        predictions: [
          {
            marketId: 'O25',
            displayName: '2.5 Üst Gol',
            scoringResult: {
              market_id: 'O25',
              match_id: 'test-match-888',
              probability: 0.658,
              confidence: 68,
              pick: 'YES',
              edge: 0.09,
              risk_flags: [],
              metadata: {
                lambda_total: 2.45, // >= 2.0 and < 2.8 = Medium
              },
            } as ScoringResult,
            publishEligibility: {
              canPublish: true,
              reason: 'All checks passed',
              failedChecks: [],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert
      expect(summary.keyAngles.some((angle) => angle.includes('2.45') && angle.includes('Orta'))).toBe(true);
    });

    it('should use "Düşük" label for lambda < 2.0 (TR)', () => {
      // Arrange
      const input: MatchSummaryInput = {
        homeTeam: 'Freiburg',
        awayTeam: 'Augsburg',
        league: 'Bundesliga',
        matchTime: '2026-01-29T16:30:00Z',
        predictions: [
          {
            marketId: 'O25',
            displayName: '2.5 Üst Gol',
            scoringResult: {
              market_id: 'O25',
              match_id: 'test-match-999',
              probability: 0.525,
              confidence: 55,
              pick: 'NO',
              edge: null,
              risk_flags: [],
              metadata: {
                lambda_total: 1.85, // < 2.0 = Low
              },
            } as ScoringResult,
            publishEligibility: {
              canPublish: false,
              reason: 'Probability below threshold',
              failedChecks: ['Probability 0.525 < 0.60'],
              passedChecks: [],
            },
          },
        ],
      };

      // Act
      const summary = formatter.formatMatchSummary(input, { locale: 'tr' });

      // Assert
      expect(summary.keyAngles.some((angle) => angle.includes('1.85') && angle.includes('Düşük'))).toBe(true);
    });
  });
});
