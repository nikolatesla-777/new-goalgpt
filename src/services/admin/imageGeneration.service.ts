/**
 * Phase-3B.3: Image Generation Service
 *
 * Generates deterministic SVG images for match predictions.
 * Styles: "story" (Instagram story format) or "post" (square post format)
 */

import { MarketId } from '../../types/bulkOperations.types';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ImageGenerationRequest {
  match_id: string;
  market_id: MarketId;
  locale: 'tr' | 'en';
  style: 'story' | 'post';
}

export interface ImageGenerationResponse {
  success: boolean;
  data?: {
    image_base64: string;
    template_version: string;
    dimensions: { width: number; height: number };
  };
  error?: string;
}

interface MatchData {
  home_team: string;
  away_team: string;
  league: string;
  kickoff_time: number;
  market_confidence: number;
  market_probability: number;
  market_pick: string;
}

// ============================================================================
// MARKET REGISTRY
// ============================================================================

const MARKET_DISPLAY: Record<MarketId, { name_tr: string; name_en: string; emoji: string }> = {
  O25: { name_tr: '2.5 Üst Gol', name_en: 'Over 2.5 Goals', emoji: '📈' },
  BTTS: { name_tr: 'Karşılıklı Gol', name_en: 'Both Teams To Score', emoji: '⚽' },
  HT_O05: { name_tr: 'İlk Yarı 0.5 Üst', name_en: 'Half-Time Over 0.5', emoji: '⏱️' },
  O35: { name_tr: '3.5 Üst Gol', name_en: 'Over 3.5 Goals', emoji: '🎯' },
  HOME_O15: { name_tr: 'Ev Sahibi 1.5 Üst', name_en: 'Home Over 1.5', emoji: '🏠' },
  CORNERS_O85: { name_tr: 'Korner 8.5 Üst', name_en: 'Corners Over 8.5', emoji: '🚩' },
  CARDS_O25: { name_tr: 'Kart 2.5 Üst', name_en: 'Cards Over 2.5', emoji: '🟨' },
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateMatchImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  try {
    // Fetch match data (stub for now - will integrate with Week-2A)
    const matchData = await fetchMatchData(request.match_id, request.market_id);

    // Generate SVG based on style
    let svg: string;
    let dimensions: { width: number; height: number };

    if (request.style === 'story') {
      svg = generateStoryImage(matchData, request.market_id, request.locale);
      dimensions = { width: 1080, height: 1920 };
    } else {
      svg = generatePostImage(matchData, request.market_id, request.locale);
      dimensions = { width: 1080, height: 1080 };
    }

    // Convert SVG to base64
    const base64 = Buffer.from(svg).toString('base64');

    return {
      success: true,
      data: {
        image_base64: base64,
        template_version: 'v1',
        dimensions,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to generate image',
    };
  }
}

// ============================================================================
// IMAGE GENERATION (SVG)
// ============================================================================

function generateStoryImage(
  matchData: MatchData,
  marketId: MarketId,
  locale: 'tr' | 'en'
): string {
  const marketDisplay = MARKET_DISPLAY[marketId];
  const marketName = locale === 'tr' ? marketDisplay.name_tr : marketDisplay.name_en;
  const kickoffDate = new Date(matchData.kickoff_time * 1000);
  const dateStr = kickoffDate.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const disclaimerText = locale === 'tr'
    ? 'Risk uyarısı: Bahis oynamanın riskleri vardır.'
    : 'Risk warning: Betting involves risks.';

  // SVG Template (Instagram Story: 1080x1920)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bgGradient)" />

  <!-- Header -->
  <text x="540" y="150" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">
    GoalGPT
  </text>
  <text x="540" y="200" font-family="Arial, sans-serif" font-size="28" fill="#94a3b8" text-anchor="middle">
    AI Prediction
  </text>

  <!-- Market Badge -->
  <rect x="390" y="250" width="300" height="80" rx="40" fill="#3b82f6" />
  <text x="540" y="300" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${marketDisplay.emoji} ${marketName}
  </text>

  <!-- Teams -->
  <rect x="90" y="400" width="900" height="300" rx="20" fill="#1e293b" />
  <text x="540" y="480" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${matchData.home_team}
  </text>
  <text x="540" y="560" font-family="Arial, sans-serif" font-size="36" fill="#94a3b8" text-anchor="middle">
    vs
  </text>
  <text x="540" y="640" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${matchData.away_team}
  </text>

  <!-- Match Info -->
  <text x="540" y="770" font-family="Arial, sans-serif" font-size="28" fill="#cbd5e1" text-anchor="middle">
    ${matchData.league}
  </text>
  <text x="540" y="820" font-family="Arial, sans-serif" font-size="28" fill="#94a3b8" text-anchor="middle">
    ${dateStr}
  </text>

  <!-- Prediction Stats -->
  <rect x="90" y="900" width="900" height="400" rx="20" fill="#1e293b" />

  <!-- Confidence -->
  <circle cx="270" cy="1100" r="100" fill="#10b981" />
  <text x="270" y="1090" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${matchData.market_confidence}
  </text>
  <text x="270" y="1130" font-family="Arial, sans-serif" font-size="24" fill="#ffffff" text-anchor="middle">
    /100
  </text>
  <text x="270" y="1230" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8" text-anchor="middle">
    ${locale === 'tr' ? 'Güven' : 'Confidence'}
  </text>

  <!-- Probability -->
  <circle cx="810" cy="1100" r="100" fill="#3b82f6" />
  <text x="810" y="1110" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${Math.round(matchData.market_probability * 100)}%
  </text>
  <text x="810" y="1230" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8" text-anchor="middle">
    ${locale === 'tr' ? 'Olasılık' : 'Probability'}
  </text>

  <!-- Pick Badge -->
  <rect x="390" y="1350" width="300" height="100" rx="50" fill="#10b981" />
  <text x="540" y="1415" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${matchData.market_pick}
  </text>

  <!-- Disclaimer -->
  <text x="540" y="1800" font-family="Arial, sans-serif" font-size="22" fill="#64748b" text-anchor="middle">
    ${disclaimerText}
  </text>
</svg>`;
}

function generatePostImage(
  matchData: MatchData,
  marketId: MarketId,
  locale: 'tr' | 'en'
): string {
  const marketDisplay = MARKET_DISPLAY[marketId];
  const marketName = locale === 'tr' ? marketDisplay.name_tr : marketDisplay.name_en;
  const kickoffDate = new Date(matchData.kickoff_time * 1000);
  const dateStr = kickoffDate.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const disclaimerText = locale === 'tr'
    ? 'Risk uyarısı'
    : 'Risk warning';

  // SVG Template (Square Post: 1080x1080)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bgGradient)" />

  <!-- Header -->
  <text x="540" y="100" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${marketDisplay.emoji} ${marketName}
  </text>

  <!-- Teams Container -->
  <rect x="90" y="180" width="900" height="350" rx="20" fill="#1e293b" />
  <text x="540" y="280" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${matchData.home_team}
  </text>
  <text x="540" y="340" font-family="Arial, sans-serif" font-size="32" fill="#94a3b8" text-anchor="middle">
    vs
  </text>
  <text x="540" y="420" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${matchData.away_team}
  </text>
  <text x="540" y="490" font-family="Arial, sans-serif" font-size="24" fill="#cbd5e1" text-anchor="middle">
    ${matchData.league} • ${dateStr}
  </text>

  <!-- Stats Container -->
  <rect x="90" y="580" width="900" height="350" rx="20" fill="#1e293b" />

  <!-- Left: Confidence -->
  <circle cx="310" cy="750" r="80" fill="#10b981" />
  <text x="310" y="745" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${matchData.market_confidence}
  </text>
  <text x="310" y="780" font-family="Arial, sans-serif" font-size="20" fill="#ffffff" text-anchor="middle">
    /100
  </text>
  <text x="310" y="860" font-family="Arial, sans-serif" font-size="22" fill="#94a3b8" text-anchor="middle">
    ${locale === 'tr' ? 'Güven' : 'Confidence'}
  </text>

  <!-- Right: Probability -->
  <circle cx="770" cy="750" r="80" fill="#3b82f6" />
  <text x="770" y="760" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${Math.round(matchData.market_probability * 100)}%
  </text>
  <text x="770" y="860" font-family="Arial, sans-serif" font-size="22" fill="#94a3b8" text-anchor="middle">
    ${locale === 'tr' ? 'Olasılık' : 'Probability'}
  </text>

  <!-- Footer -->
  <text x="540" y="1000" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#10b981" text-anchor="middle">
    ${matchData.market_pick}
  </text>
  <text x="540" y="1050" font-family="Arial, sans-serif" font-size="18" fill="#64748b" text-anchor="middle">
    ${disclaimerText}
  </text>
</svg>`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchMatchData(
  matchId: string,
  marketId: MarketId
): Promise<MatchData> {
  // TODO: Replace with actual Week-2A scoring endpoint call
  // For now, this is a stub that will be implemented when Week-2A is merged

  // In production, this would call:
  // const response = await fetch(`http://localhost:3000/api/matches/${matchId}/scoring`);
  // const data = await response.json();
  // const market = data.data.markets.find(m => m.market_id === marketId);

  // Stub implementation
  throw new Error(
    'Week-2A scoring endpoint not available yet. This service requires PR#5 (Week-2A) to be merged.'
  );
}
