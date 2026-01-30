/**
 * Canonical Match Snapshot - Our Internal Contract
 *
 * This is the single source of truth for match data in our system.
 * All downstream services (AI generator, telegram, admin) use this shape.
 *
 * VERSIONING:
 * - schema_version tracks breaking changes to this contract
 * - Increment on any field rename, type change, or semantic change
 * - Current version: 1
 *
 * @module matchSnapshot
 * @version 1.0.0
 */

/**
 * Canonical Match Snapshot
 *
 * Contract guarantees:
 * - All IDs are numbers (never null)
 * - All optional fields use undefined (never null)
 * - Arrays default to [] (never null/undefined)
 * - Missing data tracked in missing_fields array
 * - Timestamps always in Unix seconds
 */
export interface CanonicalMatchSnapshot {
  // === IDENTITY ===
  ids: {
    fs_match_id: number;           // FootyStats match ID (primary)
    home_team_id: number;          // FootyStats home team ID
    away_team_id: number;          // FootyStats away team ID
    league_id?: number;            // Derived from competition name (optional)
    season_id?: string;            // Format: "YYYY-YYYY" or "YYYY"
  };

  // === TEMPORAL ===
  time: {
    match_date_unix: number;       // Kickoff time (Unix seconds)
    status: string;                // Match status (e.g. "scheduled", "live", "finished")
    captured_at_unix: number;      // When this snapshot was created
  };

  // === BASIC INFO ===
  teams: {
    home_name: string;
    away_name: string;
    competition_name?: string;     // League/tournament name
  };

  // === MATCH STATS ===
  stats: {
    // Form data (home/away split)
    form: {
      home?: {
        ppg?: number;              // Points per game
        btts_pct?: number;         // Both teams to score %
        over25_pct?: number;       // Over 2.5 goals %
        overall_form?: string;     // Form string (e.g. "WWLDW")
        home_only_form?: string;   // Home form string
      };
      away?: {
        ppg?: number;
        btts_pct?: number;
        over25_pct?: number;
        overall_form?: string;
        away_only_form?: string;   // Away form string
      };
    };

    // Head-to-head history
    h2h?: {
      total_matches: number;
      home_wins: number;
      draws: number;
      away_wins: number;
      btts_pct?: number;
      avg_goals?: number;
      recent_match_ids?: number[];  // Last 5 h2h match IDs
    };

    // Expected goals (xG)
    xg: {
      home?: number;               // Home team xG
      away?: number;               // Away team xG
      total?: number;              // Combined xG
    };

    // Actual scores (if match finished)
    goals?: {
      home: number;
      away: number;
    };

    // Betting potentials (0-100 scale)
    potentials: {
      btts?: number;               // Both teams to score
      over25?: number;             // Over 2.5 goals
      over15?: number;             // Over 1.5 goals
      corners?: number;            // Total corners
      cards?: number;              // Total cards
    };
  };

  // === ODDS ===
  odds?: {
    home?: number;                 // 1 (home win)
    draw?: number;                 // X (draw)
    away?: number;                 // 2 (away win)
  };

  // === TRENDS ===
  trends?: {
    home: string[];                // Home team trend descriptions
    away: string[];                // Away team trend descriptions
  };

  // === METADATA ===
  meta: {
    schema_version: number;        // Current: 1
    source_version: string;        // FootyStats API version/endpoint
    missing_fields: string[];      // Fields that were null/missing in source
    confidence: {
      data_completeness: number;   // 0-100: how complete is this snapshot
      has_form_data: boolean;
      has_h2h_data: boolean;
      has_xg_data: boolean;
      has_odds_data: boolean;
    };
  };
}

/**
 * Snapshot storage metadata
 */
export interface SnapshotMetadata {
  snapshot_id?: string;            // UUID if persisted
  created_at: Date;
  updated_at?: Date;
  ttl_seconds: number;             // Cache TTL
  source: 'footystats' | 'manual'; // Data source
}

/**
 * Complete snapshot with storage metadata
 */
export interface StoredMatchSnapshot {
  snapshot: CanonicalMatchSnapshot;
  metadata: SnapshotMetadata;
}
