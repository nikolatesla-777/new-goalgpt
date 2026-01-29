/**
 * AI Summary Types - Phase-3B.1
 *
 * Structured output for AI-generated match summaries
 */

export interface AISummaryRequest {
  match_id: string; // TheSports external_id
  locale: 'tr' | 'en';
}

export interface AISummaryKeyAngle {
  icon: string; // Emoji or icon identifier
  title: string;
  description: string;
}

export interface AISummaryBetIdea {
  market: string; // e.g., "Over 2.5", "BTTS"
  reason: string;
  confidence: number; // 0-100
}

export interface AISummaryResponse {
  success: boolean;
  data?: {
    match_id: string;
    title: string; // e.g., "Barcelona vs Real Madrid - El Clásico Analysis"
    key_angles: AISummaryKeyAngle[]; // 3-5 key points
    bet_ideas: AISummaryBetIdea[]; // 2-4 betting suggestions
    disclaimer: string; // Risk warning text
    generated_at: string; // ISO timestamp
    locale: 'tr' | 'en';
  };
  error?: string;
}

/**
 * Match data input for summary generation
 */
export interface MatchSummaryInput {
  home_team: string;
  away_team: string;
  competition: string;
  match_time: string; // ISO timestamp
  scoring_data?: any; // From Week-2A endpoint
  footystats_data?: any; // From FootyStats
}

/**
 * Schema validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
