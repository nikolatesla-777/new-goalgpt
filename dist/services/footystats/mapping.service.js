"use strict";
/**
 * FootyStats Mapping Service
 *
 * Handles the mapping between TheSports IDs and FootyStats IDs
 * using fuzzy string matching (Levenshtein distance).
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FootyStatsMappingService = exports.mappingService = void 0;
exports.normalizeString = normalizeString;
exports.stringSimilarity = stringSimilarity;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const footystats_client_1 = require("./footystats.client");
// ============================================================================
// STRING SIMILARITY (Levenshtein Distance)
// ============================================================================
/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            }
            else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}
/**
 * Calculate similarity score (0-100) between two strings
 */
function stringSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0)
        return 100;
    const distance = levenshteinDistance(str1, str2);
    return ((maxLength - distance) / maxLength) * 100;
}
/**
 * Normalize string for comparison
 * - Lowercase
 * - Remove special characters
 * - Common abbreviation replacements
 */
function normalizeString(str) {
    let normalized = str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '') // Remove special chars
        .replace(/\s+/g, ' '); // Normalize spaces
    // Common football team/league name replacements
    const replacements = {
        // Nationality adjectives to country names
        'english': 'england',
        'french': 'france',
        'german': 'germany',
        'spanish': 'spain',
        'italian': 'italy',
        'dutch': 'netherlands',
        'portuguese': 'portugal',
        'belgian': 'belgium',
        'scottish': 'scotland',
        'welsh': 'wales',
        'irish': 'ireland',
        'turkish': 'turkey',
        'greek': 'greece',
        'austrian': 'austria',
        'swiss': 'switzerland',
        'brazilian': 'brazil',
        'argentine': 'argentina',
        'mexican': 'mexico',
        'american': 'usa',
        'japanese': 'japan',
        'korean': 'korea',
        'chinese': 'china',
        'australian': 'australia',
        // Football abbreviations
        'fc': '',
        'sc': '',
        'cf': '',
        'ac': '',
        'as': '',
        'ss': '',
        'sd': '',
        'cd': '',
        'rcd': '',
        'rc': '',
        'real': '',
        'athletic': 'atletico',
        'united': 'utd',
        'city': '',
        'town': '',
        'wanderers': '',
        'rovers': '',
        'hotspur': '',
        'albion': '',
        'villa': '',
        'palace': '',
        'forest': '',
        'ham': '',
        '1899': '',
        '1900': '',
        '1904': '',
        '1909': '',
    };
    for (const [key, value] of Object.entries(replacements)) {
        normalized = normalized.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
    }
    return normalized.replace(/\s+/g, ' ').trim();
}
// ============================================================================
// MAPPING SERVICE
// ============================================================================
class FootyStatsMappingService {
    constructor() {
        this.AUTO_VERIFY_THRESHOLD = 90; // 90%+ = auto verify
        this.REVIEW_THRESHOLD = 60; // 60-90% = needs review
    }
    static getInstance() {
        if (!FootyStatsMappingService.instance) {
            FootyStatsMappingService.instance = new FootyStatsMappingService();
        }
        return FootyStatsMappingService.instance;
    }
    // ============================================================================
    // LEAGUE MAPPING
    // ============================================================================
    /**
     * Map all TheSports leagues to FootyStats leagues
     */
    async mapLeagues() {
        logger_1.logger.info('[Mapping] Starting league mapping...');
        const stats = {
            total: 0,
            auto_verified: 0,
            pending_review: 0,
            no_match: 0,
        };
        try {
            // 1. Get our leagues from TheSports (join with countries table for country name)
            const tsLeagues = await (0, connection_1.safeQuery)(`SELECT c.id, c.name, COALESCE(co.name, 'International') as country_name
         FROM ts_competitions c
         LEFT JOIN ts_countries co ON c.country_id = co.external_id
         ORDER BY co.name NULLS LAST, c.name
         LIMIT 3000`);
            if (tsLeagues.length === 0) {
                logger_1.logger.warn('[Mapping] No active leagues found in ts_competitions');
                return stats;
            }
            // 2. Get FootyStats leagues
            const fsResponse = await footystats_client_1.footyStatsAPI.getLeagueList();
            const fsLeagues = fsResponse.data;
            if (!fsLeagues || fsLeagues.length === 0) {
                logger_1.logger.warn('[Mapping] No leagues returned from FootyStats API');
                return stats;
            }
            logger_1.logger.info(`[Mapping] Matching ${tsLeagues.length} TheSports leagues with ${fsLeagues.length} FootyStats leagues`);
            // 3. Match each TheSports league
            for (const tsLeague of tsLeagues) {
                stats.total++;
                const normalizedTsName = normalizeString(tsLeague.name);
                let bestMatch = null;
                let highestScore = 0;
                // Find best match among FootyStats leagues (same country preferred)
                for (const fsLeague of fsLeagues) {
                    // Country must match (or be close)
                    const countryMatch = normalizeString(fsLeague.country) === normalizeString(tsLeague.country_name) ||
                        stringSimilarity(normalizeString(fsLeague.country), normalizeString(tsLeague.country_name)) > 80;
                    if (!countryMatch)
                        continue;
                    // Try both full name and league_name, use the higher score
                    // Full name (e.g., "England Premier League") is more specific
                    const normalizedFullName = normalizeString(fsLeague.name);
                    const normalizedLeagueName = normalizeString(fsLeague.league_name || '');
                    const fullNameScore = stringSimilarity(normalizedTsName, normalizedFullName);
                    const leagueNameScore = normalizedLeagueName
                        ? stringSimilarity(normalizedTsName, normalizedLeagueName)
                        : 0;
                    const score = Math.max(fullNameScore, leagueNameScore);
                    if (score > highestScore) {
                        highestScore = score;
                        bestMatch = fsLeague;
                    }
                }
                // 4. Save mapping based on confidence
                if (bestMatch && highestScore >= this.REVIEW_THRESHOLD) {
                    const isAutoVerified = highestScore >= this.AUTO_VERIFY_THRESHOLD;
                    // Get the most recent season ID as the league identifier
                    const seasons = bestMatch.season || [];
                    const latestSeason = seasons.length > 0
                        ? seasons.reduce((a, b) => (a.year > b.year ? a : b))
                        : null;
                    if (!latestSeason) {
                        logger_1.logger.warn(`[Mapping] No seasons found for ${bestMatch.name}`);
                        stats.no_match++;
                        continue;
                    }
                    await this.saveMapping({
                        entity_type: 'league',
                        ts_id: tsLeague.id,
                        ts_name: tsLeague.name,
                        fs_id: latestSeason.id,
                        fs_name: `${bestMatch.name} (${latestSeason.year})`,
                        confidence_score: highestScore,
                        is_verified: isAutoVerified,
                    });
                    if (isAutoVerified) {
                        stats.auto_verified++;
                        logger_1.logger.debug(`[Mapping] ✓ Auto-verified: ${tsLeague.name} → ${bestMatch.name} (${highestScore.toFixed(1)}%)`);
                    }
                    else {
                        stats.pending_review++;
                        logger_1.logger.debug(`[Mapping] ? Needs review: ${tsLeague.name} → ${bestMatch.name} (${highestScore.toFixed(1)}%)`);
                    }
                }
                else {
                    stats.no_match++;
                    logger_1.logger.warn(`[Mapping] ✗ No match for: ${tsLeague.name} (best: ${highestScore.toFixed(1)}%)`);
                }
            }
            logger_1.logger.info(`[Mapping] League mapping complete: ${stats.auto_verified} verified, ${stats.pending_review} pending, ${stats.no_match} no match`);
            return stats;
        }
        catch (error) {
            logger_1.logger.error('[Mapping] League mapping failed:', error);
            throw error;
        }
    }
    // ============================================================================
    // TEAM MAPPING
    // ============================================================================
    /**
     * Map teams for a specific league
     */
    async mapTeamsForLeague(tsLeagueId) {
        logger_1.logger.info(`[Mapping] Starting team mapping for league ${tsLeagueId}...`);
        const stats = {
            total: 0,
            auto_verified: 0,
            pending_review: 0,
            no_match: 0,
        };
        try {
            // 1. Get FootyStats league ID from mapping
            const leagueMapping = await this.getMapping('league', tsLeagueId);
            if (!leagueMapping) {
                logger_1.logger.warn(`[Mapping] No FootyStats mapping found for league ${tsLeagueId}`);
                return stats;
            }
            // 2. Get our teams from TheSports (using external_id for joins)
            const tsTeams = await (0, connection_1.safeQuery)(`SELECT DISTINCT t.id, t.name
         FROM ts_teams t
         JOIN ts_matches m ON (t.external_id = m.home_team_id OR t.external_id = m.away_team_id)
         JOIN ts_competitions c ON m.competition_id = c.external_id
         WHERE c.id = $1
         ORDER BY t.name`, [tsLeagueId]);
            if (tsTeams.length === 0) {
                logger_1.logger.warn(`[Mapping] No teams found for league ${tsLeagueId}`);
                return stats;
            }
            // 3. Get FootyStats teams
            let fsTeams = [];
            try {
                const fsResponse = await footystats_client_1.footyStatsAPI.getLeagueTeams(leagueMapping.fs_id);
                fsTeams = fsResponse.data || [];
            }
            catch (apiError) {
                logger_1.logger.warn(`[Mapping] FootyStats API error for season ${leagueMapping.fs_id}: ${apiError.message || 'Unknown error'}`);
                return stats;
            }
            if (!fsTeams || fsTeams.length === 0) {
                logger_1.logger.warn(`[Mapping] No teams returned from FootyStats for season ${leagueMapping.fs_id}`);
                return stats;
            }
            logger_1.logger.info(`[Mapping] Matching ${tsTeams.length} TheSports teams with ${fsTeams.length} FootyStats teams`);
            // 4. Match each TheSports team
            for (const tsTeam of tsTeams) {
                stats.total++;
                const normalizedTsName = normalizeString(tsTeam.name);
                let bestMatch = null;
                let highestScore = 0;
                for (const fsTeam of fsTeams) {
                    const normalizedFsName = normalizeString(fsTeam.cleanName || fsTeam.name);
                    const score = stringSimilarity(normalizedTsName, normalizedFsName);
                    if (score > highestScore) {
                        highestScore = score;
                        bestMatch = fsTeam;
                    }
                }
                // 5. Save mapping
                if (bestMatch && highestScore >= this.REVIEW_THRESHOLD) {
                    const isAutoVerified = highestScore >= this.AUTO_VERIFY_THRESHOLD;
                    await this.saveMapping({
                        entity_type: 'team',
                        ts_id: tsTeam.id,
                        ts_name: tsTeam.name,
                        fs_id: bestMatch.id,
                        fs_name: bestMatch.name,
                        confidence_score: highestScore,
                        is_verified: isAutoVerified,
                    });
                    if (isAutoVerified) {
                        stats.auto_verified++;
                    }
                    else {
                        stats.pending_review++;
                    }
                }
                else {
                    stats.no_match++;
                    logger_1.logger.warn(`[Mapping] ✗ No match for team: ${tsTeam.name}`);
                }
            }
            logger_1.logger.info(`[Mapping] Team mapping complete for league ${tsLeagueId}`);
            return stats;
        }
        catch (error) {
            logger_1.logger.error(`[Mapping] Team mapping failed for league ${tsLeagueId}:`, error);
            throw error;
        }
    }
    /**
     * Map teams for all mapped leagues
     */
    async mapAllTeams() {
        logger_1.logger.info('[Mapping] Starting team mapping for all leagues...');
        const totalStats = {
            total: 0,
            auto_verified: 0,
            pending_review: 0,
            no_match: 0,
        };
        // Get all verified league mappings
        const leagueMappings = await (0, connection_1.safeQuery)(`SELECT ts_id FROM integration_mappings
       WHERE entity_type = 'league' AND is_verified = true`);
        for (const mapping of leagueMappings) {
            const stats = await this.mapTeamsForLeague(mapping.ts_id);
            totalStats.total += stats.total;
            totalStats.auto_verified += stats.auto_verified;
            totalStats.pending_review += stats.pending_review;
            totalStats.no_match += stats.no_match;
        }
        logger_1.logger.info(`[Mapping] All team mapping complete: ${totalStats.auto_verified} verified, ${totalStats.pending_review} pending`);
        return totalStats;
    }
    // ============================================================================
    // DATABASE OPERATIONS
    // ============================================================================
    /**
     * Save or update a mapping
     */
    async saveMapping(mapping) {
        try {
            await (0, connection_1.safeQuery)(`INSERT INTO integration_mappings
          (entity_type, ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (entity_type, ts_id)
         DO UPDATE SET
          fs_id = EXCLUDED.fs_id,
          fs_name = EXCLUDED.fs_name,
          confidence_score = EXCLUDED.confidence_score,
          is_verified = EXCLUDED.is_verified,
          updated_at = NOW()`, [
                mapping.entity_type,
                mapping.ts_id,
                mapping.ts_name,
                mapping.fs_id,
                mapping.fs_name,
                mapping.confidence_score,
                mapping.is_verified,
            ]);
        }
        catch (err) {
            // Skip duplicate fs_id errors (multiple TheSports leagues may map to same FootyStats season)
            if (err.code === '23505' && err.constraint?.includes('fs_id')) {
                logger_1.logger.debug(`[Mapping] Skipping duplicate fs_id ${mapping.fs_id} for ${mapping.ts_name}`);
                return;
            }
            throw err;
        }
    }
    /**
     * Get mapping for a specific entity
     */
    async getMapping(entityType, tsId) {
        const results = await (0, connection_1.safeQuery)(`SELECT ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified
       FROM integration_mappings
       WHERE entity_type = $1 AND ts_id = $2`, [entityType, tsId]);
        return results[0] || null;
    }
    /**
     * Get FootyStats ID for a TheSports entity
     */
    async getFootyStatsId(entityType, tsId) {
        const mapping = await this.getMapping(entityType, tsId);
        return mapping?.fs_id || null;
    }
    /**
     * Get all unverified mappings for admin review
     */
    async getUnverifiedMappings(entityType) {
        let query = `
      SELECT ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified
      FROM integration_mappings
      WHERE is_verified = false
    `;
        const params = [];
        if (entityType) {
            query += ` AND entity_type = $1`;
            params.push(entityType);
        }
        query += ` ORDER BY confidence_score DESC`;
        return (0, connection_1.safeQuery)(query, params);
    }
    /**
     * Manually verify a mapping
     */
    async verifyMapping(entityType, tsId, verifiedBy = 'admin') {
        await (0, connection_1.safeQuery)(`UPDATE integration_mappings
       SET is_verified = true, verified_by = $3, verified_at = NOW(), updated_at = NOW()
       WHERE entity_type = $1 AND ts_id = $2`, [entityType, tsId, verifiedBy]);
        logger_1.logger.info(`[Mapping] Verified: ${entityType} ${tsId}`);
    }
    /**
     * Update mapping with correct FootyStats ID
     */
    async updateMapping(entityType, tsId, newFsId, newFsName) {
        await (0, connection_1.safeQuery)(`UPDATE integration_mappings
       SET fs_id = $3, fs_name = $4, confidence_score = 100, is_verified = true, updated_at = NOW()
       WHERE entity_type = $1 AND ts_id = $2`, [entityType, tsId, newFsId, newFsName]);
        logger_1.logger.info(`[Mapping] Updated: ${entityType} ${tsId} → ${newFsId}`);
    }
    /**
     * Get mapping statistics
     */
    async getStats() {
        const leagueStats = await (0, connection_1.safeQuery)(`SELECT is_verified, COUNT(*) as count
       FROM integration_mappings
       WHERE entity_type = 'league'
       GROUP BY is_verified`);
        const teamStats = await (0, connection_1.safeQuery)(`SELECT is_verified, COUNT(*) as count
       FROM integration_mappings
       WHERE entity_type = 'team'
       GROUP BY is_verified`);
        const parseStats = (rows) => {
            let verified = 0;
            let pending = 0;
            for (const row of rows) {
                if (row.is_verified) {
                    verified = parseInt(row.count);
                }
                else {
                    pending = parseInt(row.count);
                }
            }
            return {
                total: verified + pending,
                auto_verified: verified,
                pending_review: pending,
                no_match: 0,
            };
        };
        return {
            leagues: parseStats(leagueStats),
            teams: parseStats(teamStats),
        };
    }
}
exports.FootyStatsMappingService = FootyStatsMappingService;
FootyStatsMappingService.instance = null;
// ============================================================================
// EXPORTS
// ============================================================================
exports.mappingService = FootyStatsMappingService.getInstance();
