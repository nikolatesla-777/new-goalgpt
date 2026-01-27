/**
 * FootyStats Repository
 *
 * All database access for FootyStats integration entities.
 * This is the ONLY place where DB access is allowed for FootyStats operations.
 *
 * PR-4: Repository Layer Lockdown
 */

import { safeQuery } from '../database/connection';
import { logger } from '../utils/logger';

// ============================================================
// TYPES
// ============================================================

export interface League {
    id: string;
    name: string;
    country_name: string;
}

export interface IntegrationMapping {
    ts_id: string;
    ts_name: string;
    fs_id: number;
    fs_name: string;
    confidence_score: number;
    is_verified?: boolean;
    entity_type?: string;
}

export interface MatchDetailsRow {
    id: string;
    external_id: string;
    home_team_id: string;
    away_team_id: string;
    competition_id: string;
    match_time: Date;
    status_id: number;
    home_scores: any;
    away_scores: any;
    home_team_name: string;
    home_logo: string;
    away_team_name: string;
    away_logo: string;
    league_name: string;
}

export interface TeamMapping {
    fs_id: number;
}

// ============================================================
// LEAGUE OPERATIONS
// ============================================================

/**
 * Search leagues by query string
 * Supports both name and country searches
 *
 * @param query - SQL query string with placeholders
 * @param params - Query parameters
 * @returns Array of leagues with country names
 */
export async function getLeagues(query: string, params: string[]): Promise<League[]> {
    return await safeQuery<League>(query, params);
}

// ============================================================
// MAPPING OPERATIONS
// ============================================================

/**
 * Get all verified league mappings
 * Returns leagues that have been manually verified for integration
 *
 * @returns Array of verified league mappings
 */
export async function getVerifiedLeagueMappings(): Promise<IntegrationMapping[]> {
    return await safeQuery<IntegrationMapping>(
        `SELECT ts_id, ts_name, fs_id, fs_name, confidence_score
         FROM integration_mappings
         WHERE entity_type = 'league' AND is_verified = true
         ORDER BY confidence_score DESC
         LIMIT 50`
    );
}

/**
 * Search mappings by name (case-insensitive)
 * Searches both TheSports and FootyStats names
 *
 * @param searchTerm - Search string
 * @returns Array of matching mappings across all entity types
 */
export async function searchMappings(searchTerm: string): Promise<IntegrationMapping[]> {
    return await safeQuery<IntegrationMapping>(
        `SELECT ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified, entity_type
         FROM integration_mappings
         WHERE LOWER(ts_name) LIKE $1 OR LOWER(fs_name) LIKE $1
         ORDER BY confidence_score DESC
         LIMIT 50`,
        [`%${searchTerm.toLowerCase()}%`]
    );
}

/**
 * Clear all integration mappings
 * Used for re-running mapping operations
 */
export async function clearAllMappings(): Promise<void> {
    await safeQuery('DELETE FROM integration_mappings');
    logger.info('[FootyStatsRepository] All mappings cleared');
}

/**
 * Get team mapping by name
 * Used to find FootyStats team ID from TheSports team name
 *
 * @param teamName - TheSports team name
 * @param entityType - Entity type (default: 'team')
 * @returns Team mapping or empty array
 */
export async function getTeamMapping(teamName: string, entityType: string = 'team'): Promise<TeamMapping[]> {
    return await safeQuery<TeamMapping>(
        `SELECT fs_id FROM integration_mappings
         WHERE entity_type = $1 AND ts_name = $2`,
        [entityType, teamName]
    );
}

// ============================================================
// MATCH OPERATIONS
// ============================================================

/**
 * Get match details with team and league information
 * Includes LEFT JOINs for teams and competition data
 *
 * @param matchId - TheSports external match ID
 * @returns Match details with team/league names, or empty array if not found
 */
export async function getMatchDetails(matchId: string): Promise<MatchDetailsRow[]> {
    return await safeQuery<MatchDetailsRow>(
        `SELECT m.id, m.external_id, m.home_team_id, m.away_team_id,
                m.competition_id, m.match_time, m.status_id,
                m.home_scores, m.away_scores,
                ht.name as home_team_name, ht.logo_url as home_logo,
                at.name as away_team_name, at.logo_url as away_logo,
                c.name as league_name
         FROM ts_matches m
         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
         LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
         WHERE m.external_id = $1`,
        [matchId]
    );
}

// ============================================================
// MIGRATION OPERATIONS
// ============================================================

/**
 * Run FootyStats table migrations
 * Creates necessary tables if they don't exist
 */
export async function runMigrations(): Promise<void> {
    const migrations = [
        // integration_mappings
        `CREATE TABLE IF NOT EXISTS integration_mappings (
          id SERIAL PRIMARY KEY,
          entity_type VARCHAR(50) NOT NULL,
          ts_id VARCHAR(100) NOT NULL,
          ts_name VARCHAR(255),
          fs_id INTEGER NOT NULL,
          fs_name VARCHAR(255),
          confidence_score DECIMAL(5,2),
          is_verified BOOLEAN DEFAULT FALSE,
          verified_by VARCHAR(100),
          verified_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(entity_type, ts_id),
          UNIQUE(entity_type, fs_id)
        )`,
        // fs_match_stats
        `CREATE TABLE IF NOT EXISTS fs_match_stats (
          id SERIAL PRIMARY KEY,
          match_id VARCHAR(100) NOT NULL UNIQUE,
          fs_match_id INTEGER,
          btts_potential INTEGER,
          o25_potential INTEGER,
          avg_potential DECIMAL(4,2),
          corners_potential DECIMAL(5,2),
          cards_potential DECIMAL(5,2),
          xg_home_prematch DECIMAL(4,2),
          xg_away_prematch DECIMAL(4,2),
          trends JSONB,
          h2h_data JSONB,
          odds_comparison JSONB,
          risk_level VARCHAR(20),
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        // fs_team_form
        `CREATE TABLE IF NOT EXISTS fs_team_form (
          id SERIAL PRIMARY KEY,
          team_id VARCHAR(100) NOT NULL,
          fs_team_id INTEGER,
          season_id VARCHAR(50),
          form_string_overall VARCHAR(20),
          form_string_home VARCHAR(20),
          form_string_away VARCHAR(20),
          ppg_overall DECIMAL(4,2),
          ppg_home DECIMAL(4,2),
          ppg_away DECIMAL(4,2),
          xg_for_avg DECIMAL(4,2),
          xg_against_avg DECIMAL(4,2),
          btts_percentage INTEGER,
          over25_percentage INTEGER,
          clean_sheet_percentage INTEGER,
          failed_to_score_percentage INTEGER,
          corners_avg DECIMAL(4,2),
          cards_avg DECIMAL(4,2),
          goal_timing JSONB,
          last_x_matches INTEGER DEFAULT 5,
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(team_id, season_id, last_x_matches)
        )`,
    ];

    for (let i = 0; i < migrations.length; i++) {
        try {
            await safeQuery(migrations[i]);
            logger.debug(`[FootyStatsRepository] Created table ${i + 1}/${migrations.length}`);
        } catch (error) {
            logger.error(`[FootyStatsRepository] Failed to create table ${i + 1}:`, error);
            throw error;
        }
    }

    logger.info('[FootyStatsRepository] FootyStats tables created successfully');
}
