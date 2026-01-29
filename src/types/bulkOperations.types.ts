/**
 * Phase-3B.2: Bulk Operations Types
 *
 * Type definitions for bulk preview and bulk publish operations.
 * Used for daily list generation and batch publishing to Telegram.
 */

// ============================================================================
// BULK PREVIEW TYPES
// ============================================================================

export interface BulkPreviewRequest {
  date_from: string; // ISO 8601 timestamp
  date_to: string; // ISO 8601 timestamp
  markets: MarketId[];
  filters: BulkPreviewFilters;
  limit_per_market: number;
  locale: 'tr' | 'en';
}

export interface BulkPreviewFilters {
  min_confidence: number; // 0-100
  min_probability: number; // 0.0-1.0
  max_risk_flags: number; // Maximum number of risk flags allowed
  max_per_league: number; // Maximum picks per league (diversity)
  time_spread_minutes: number; // Minimum time between matches
}

export type MarketId =
  | 'O25'
  | 'BTTS'
  | 'HT_O05'
  | 'O35'
  | 'HOME_O15'
  | 'CORNERS_O85'
  | 'CARDS_O25';

export interface BulkPreviewResponse {
  success: boolean;
  data?: {
    generated_at: string;
    filters_applied: BulkPreviewFilters;
    markets: BulkMarketPreview[];
  };
  error?: string;
}

export interface BulkMarketPreview {
  market_id: MarketId;
  market_name: string; // Localized
  market_name_tr: string;
  market_name_en: string;
  emoji: string;
  picks: BulkPickPreview[];
  total_candidates: number; // Before filtering
  total_selected: number; // After filtering
}

export interface BulkPickPreview {
  match_id: string;
  fs_match_id: number;
  kickoff_time: number; // Unix timestamp
  league: string;
  home_team: string;
  away_team: string;
  probability: number; // 0.0-1.0
  confidence: number; // 0-100
  pick: 'YES' | 'NO' | 'SKIP';
  can_publish: boolean;
  risk_flags: string[];
  reasons: {
    passed: string[]; // Why this pick passed filters
    failed: string[]; // Why filters might have been close to rejecting
  };
}

// ============================================================================
// BULK PUBLISH TYPES
// ============================================================================

export interface BulkPublishRequest {
  admin_user_id: string;
  dry_run: boolean;
  picks: BulkPublishPick[];
}

export interface BulkPublishPick {
  match_id: string;
  market_id: MarketId;
  locale: 'tr' | 'en';
  template_version: string; // e.g., "v1"
}

export interface BulkPublishResponse {
  success: boolean;
  data?: {
    summary: {
      total: number;
      sent: number;
      failed: number;
      skipped: number;
    };
    results: BulkPublishResult[];
  };
  error?: string;
}

export interface BulkPublishResult {
  match_id: string;
  market_id: MarketId;
  status: 'sent' | 'failed' | 'skipped';
  reason?: string; // Why skipped or failed
  telegram_message_id?: number;
  error_message?: string;
  dry_run: boolean;
}

// ============================================================================
// ADMIN PUBLISH LOG TYPES
// ============================================================================

export interface AdminPublishLog {
  id: string;
  admin_user_id: string;
  match_id: string;
  market_id: MarketId;
  dry_run: boolean;
  payload: Record<string, any>; // Snapshot of publish request
  status: 'dry_run_success' | 'sent' | 'failed' | 'skipped';
  telegram_message_id?: number;
  error_message?: string;
  request_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string; // ISO timestamp
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
