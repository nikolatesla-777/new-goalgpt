"use strict";
/**
 * FootyStats Repository
 *
 * All database access for FootyStats integration entities.
 * This is the ONLY place where DB access is allowed for FootyStats operations.
 *
 * PR-4: Repository Layer Lockdown
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeagues = getLeagues;
exports.getVerifiedLeagueMappings = getVerifiedLeagueMappings;
exports.searchMappings = searchMappings;
exports.clearAllMappings = clearAllMappings;
exports.getTeamMapping = getTeamMapping;
exports.getMatchDetails = getMatchDetails;
exports.runMigrations = runMigrations;
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
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
async function getLeagues(query, params) {
    return await (0, connection_1.safeQuery)(query, params);
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
async function getVerifiedLeagueMappings() {
    return await (0, connection_1.safeQuery)(`SELECT ts_id, ts_name, fs_id, fs_name, confidence_score
         FROM integration_mappings
         WHERE entity_type = 'league' AND is_verified = true
         ORDER BY confidence_score DESC
         LIMIT 50`);
}
/**
 * Search mappings by name (case-insensitive)
 * Searches both TheSports and FootyStats names
 *
 * @param searchTerm - Search string
 * @returns Array of matching mappings across all entity types
 */
async function searchMappings(searchTerm) {
    return await (0, connection_1.safeQuery)(`SELECT ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified, entity_type
         FROM integration_mappings
         WHERE LOWER(ts_name) LIKE $1 OR LOWER(fs_name) LIKE $1
         ORDER BY confidence_score DESC
         LIMIT 50`, [`%${searchTerm.toLowerCase()}%`]);
}
/**
 * Clear all integration mappings
 * Used for re-running mapping operations
 */
async function clearAllMappings() {
    await (0, connection_1.safeQuery)('DELETE FROM integration_mappings');
    logger_1.logger.info('[FootyStatsRepository] All mappings cleared');
}
/**
 * Get team mapping by name
 * Used to find FootyStats team ID from TheSports team name
 *
 * @param teamName - TheSports team name
 * @param entityType - Entity type (default: 'team')
 * @returns Team mapping or empty array
 */
async function getTeamMapping(teamName, entityType = 'team') {
    return await (0, connection_1.safeQuery)(`SELECT fs_id FROM integration_mappings
         WHERE entity_type = $1 AND ts_name = $2`, [entityType, teamName]);
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
async function getMatchDetails(matchId) {
    return await (0, connection_1.safeQuery)(`SELECT m.id, m.external_id, m.home_team_id, m.away_team_id,
                m.competition_id, m.match_time, m.status_id,
                m.home_scores, m.away_scores,
                ht.name as home_team_name, ht.logo_url as home_logo,
                at.name as away_team_name, at.logo_url as away_logo,
                c.name as league_name
         FROM ts_matches m
         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
         LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
         WHERE m.external_id = $1`, [matchId]);
}
// ============================================================
// MIGRATION OPERATIONS
// ============================================================
/**
 * Run FootyStats table migrations
 * Creates necessary tables if they don't exist
 */
async function runMigrations() {
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
            await (0, connection_1.safeQuery)(migrations[i]);
            logger_1.logger.debug(`[FootyStatsRepository] Created table ${i + 1}/${migrations.length}`);
        }
        catch (error) {
            logger_1.logger.error(`[FootyStatsRepository] Failed to create table ${i + 1}:`, error);
            throw error;
        }
    }
    logger_1.logger.info('[FootyStatsRepository] FootyStats tables created successfully');
}
