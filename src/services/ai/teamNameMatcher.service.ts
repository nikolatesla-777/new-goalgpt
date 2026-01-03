/**
 * Team Name Matcher Service
 * 
 * Provides fuzzy string matching for team names from external AI predictions
 * to TheSports team database entries.
 */

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';

export interface TeamMatchResult {
    teamId: string;
    teamName: string;
    shortName: string | null;
    confidence: number;
    matchMethod: 'exact' | 'normalized' | 'fuzzy' | 'partial';
}

export interface MatchLookupResult {
    matchExternalId: string;
    matchUuid: string;
    homeTeam: TeamMatchResult;
    awayTeam: TeamMatchResult;
    overallConfidence: number;
    matchTime: number;
    statusId: number;
}

export class TeamNameMatcherService {
    /**
     * Normalize team name for comparison
     * - Lowercase
     * - Remove common suffixes (FC, SC, CF, etc.)
     * - Remove punctuation and extra spaces
     */
    normalizeTeamName(name: string): string {
        if (!name) return '';

        return name
            .toLowerCase()
            .replace(/\s?(fc|sc|cf|afc|bc|ac|fk|sk|as|ss|us|bk|if|ssk|spor|kulübü|club|team|united|city)\.?$/gi, '')
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1: string, str2: string): number {
        const m = str1.length;
        const n = str2.length;

        // Create matrix
        const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        // Initialize base cases
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        // Fill matrix
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(
                        dp[i - 1][j],     // deletion
                        dp[i][j - 1],     // insertion
                        dp[i - 1][j - 1]  // substitution
                    );
                }
            }
        }

        return dp[m][n];
    }

    /**
     * Calculate similarity score (0-1) between two strings
     */
    calculateSimilarity(str1: string, str2: string): number {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;

        const maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0) return 1;

        const distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLen);
    }

    /**
     * Check if one string contains the other (partial match)
     */
    partialMatch(str1: string, str2: string): number {
        if (!str1 || !str2) return 0;

        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();

        if (s1.includes(s2) || s2.includes(s1)) {
            const minLen = Math.min(s1.length, s2.length);
            const maxLen = Math.max(s1.length, s2.length);
            return minLen / maxLen;
        }

        return 0;
    }

    /**
     * Find best matching team from database
     */
    async findBestMatch(
        searchName: string,
        leagueHint?: string,
        countryHint?: string
    ): Promise<TeamMatchResult | null> {
        const client = await pool.connect();
        try {
            const normalizedSearch = this.normalizeTeamName(searchName);

            // First try exact match on name or short_name
            const exactQuery = `
        SELECT external_id, name, short_name 
        FROM ts_teams 
        WHERE LOWER(name) = $1 OR LOWER(short_name) = $1
        LIMIT 1
      `;
            const exactResult = await client.query(exactQuery, [searchName.toLowerCase()]);

            if (exactResult.rows.length > 0) {
                const team = exactResult.rows[0];
                return {
                    teamId: team.external_id,
                    teamName: team.name,
                    shortName: team.short_name,
                    confidence: 1.0,
                    matchMethod: 'exact'
                };
            }

            // Try normalized match
            const normalizedQuery = `
        SELECT external_id, name, short_name 
        FROM ts_teams 
        WHERE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s]', '', 'g')) ILIKE $1
        LIMIT 1
      `;
            const normalizedResult = await client.query(normalizedQuery, [`%${normalizedSearch}%`]);

            if (normalizedResult.rows.length > 0) {
                const team = normalizedResult.rows[0];
                const similarity = this.calculateSimilarity(
                    normalizedSearch,
                    this.normalizeTeamName(team.name)
                );
                return {
                    teamId: team.external_id,
                    teamName: team.name,
                    shortName: team.short_name,
                    confidence: Math.max(0.8, similarity),
                    matchMethod: 'normalized'
                };
            }

            // Fuzzy search - get potential candidates and score them
            const fuzzyQuery = `
        SELECT external_id, name, short_name 
        FROM ts_teams 
        WHERE name ILIKE $1 OR short_name ILIKE $1
        ORDER BY 
          CASE WHEN LOWER(name) LIKE $2 THEN 0 ELSE 1 END,
          LENGTH(name)
        LIMIT 20
      `;
            const fuzzyResult = await client.query(fuzzyQuery, [
                `%${searchName.substring(0, 4)}%`,
                `%${normalizedSearch}%`
            ]);

            if (fuzzyResult.rows.length === 0) {
                // Broader search if no results
                const broadQuery = `
          SELECT external_id, name, short_name 
          FROM ts_teams 
          LIMIT 500
        `;
                const broadResult = await client.query(broadQuery);
                fuzzyResult.rows.push(...broadResult.rows);
            }

            // Score all candidates
            let bestMatch: TeamMatchResult | null = null;
            let bestScore = 0;

            for (const team of fuzzyResult.rows) {
                const teamNormalized = this.normalizeTeamName(team.name);
                const shortNormalized = team.short_name ? this.normalizeTeamName(team.short_name) : '';

                // Calculate similarity scores
                const nameSimilarity = this.calculateSimilarity(normalizedSearch, teamNormalized);
                const shortSimilarity = shortNormalized ? this.calculateSimilarity(normalizedSearch, shortNormalized) : 0;
                const partialScore = Math.max(
                    this.partialMatch(normalizedSearch, teamNormalized),
                    shortNormalized ? this.partialMatch(normalizedSearch, shortNormalized) : 0
                );

                const score = Math.max(nameSimilarity, shortSimilarity, partialScore * 0.9);

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        teamId: team.external_id,
                        teamName: team.name,
                        shortName: team.short_name,
                        confidence: score,
                        matchMethod: score > 0.8 ? 'fuzzy' : 'partial'
                    };
                }
            }

            // Only return if confidence is above threshold (60%)
            if (bestMatch && bestMatch.confidence >= 0.6) {
                return bestMatch;
            }

            logger.warn(`[TeamMatcher] No good match found for: "${searchName}"`);
            return null;

        } finally {
            client.release();
        }
    }

    /**
     * Find team by alias table first, then fall back to fuzzy matching
     */
    async findTeamByAlias(teamName: string): Promise<TeamMatchResult | null> {
        const client = await pool.connect();
        try {
            // First, check alias table for exact match
            const aliasQuery = `
                SELECT t.external_id, t.name, t.short_name 
                FROM ts_team_aliases a
                JOIN ts_teams t ON t.external_id = a.team_external_id
                WHERE LOWER(a.alias) = LOWER($1)
                LIMIT 1
            `;
            const aliasResult = await client.query(aliasQuery, [teamName.trim()]);

            if (aliasResult.rows.length > 0) {
                const team = aliasResult.rows[0];
                logger.info(`[TeamMatcher] Found team via alias: "${teamName}" -> "${team.name}"`);
                return {
                    teamId: team.external_id,
                    teamName: team.name,
                    shortName: team.short_name,
                    confidence: 1.0,
                    matchMethod: 'exact'
                };
            }
        } finally {
            client.release();
        }

        // Fall back to fuzzy matching
        return this.findBestMatch(teamName);
    }

    /**
     * Find active match with matching teams
     * NEW LOGIC: Single team match is enough (home OR away)
     */
    async findMatchByTeams(
        homeTeamName: string,
        awayTeamName: string,
        minuteHint?: number,
        scoreHint?: string
    ): Promise<MatchLookupResult | null> {
        // Try to match both teams using alias + fuzzy
        const [homeMatch, awayMatch] = await Promise.all([
            this.findTeamByAlias(homeTeamName),
            this.findTeamByAlias(awayTeamName)
        ]);

        const client = await pool.connect();
        try {
            // Strategy 1: Both teams matched - search with both
            if (homeMatch && awayMatch) {
                const matchQuery = `
                    SELECT 
                        m.id as match_uuid,
                        m.external_id,
                        m.home_team_id,
                        m.away_team_id,
                        m.match_time,
                        m.status_id
                    FROM ts_matches m
                    WHERE 
                        m.home_team_id = $1 AND m.away_team_id = $2
                        AND m.status_id IN (2, 3, 4, 5, 7) -- Only LIVE matches
                    ORDER BY 
                        CASE WHEN m.status_id IN (2, 3, 4) THEN 0 ELSE 1 END, -- Prioritize active play
                        m.match_time DESC
                    LIMIT 1
                `;

                let matchResult = await client.query(matchQuery, [homeMatch.teamId, awayMatch.teamId]);

                // Try reverse if not found
                if (matchResult.rows.length === 0) {
                    matchResult = await client.query(matchQuery, [awayMatch.teamId, homeMatch.teamId]);
                }

                if (matchResult.rows.length > 0) {
                    const m = matchResult.rows[0];
                    return {
                        matchExternalId: m.external_id,
                        matchUuid: m.match_uuid,
                        homeTeam: homeMatch,
                        awayTeam: awayMatch,
                        overallConfidence: (homeMatch.confidence + awayMatch.confidence) / 2,
                        matchTime: m.match_time,
                        statusId: m.status_id
                    };
                }
            }

            // Strategy 2: SINGLE TEAM MATCH - search with just one team
            const singleTeamMatch = homeMatch || awayMatch;
            const matchedTeamName = homeMatch ? homeTeamName : awayTeamName;
            const unmatchedTeamName = homeMatch ? awayTeamName : homeTeamName;

            if (singleTeamMatch) {
                logger.info(`[TeamMatcher] Trying single-team match with: "${matchedTeamName}"`);

                // Find any LIVE match where this team is playing (home or away)
                const singleQuery = `
                    SELECT 
                        m.id as match_uuid,
                        m.external_id,
                        m.home_team_id,
                        m.away_team_id,
                        th.name as home_team_name,
                        ta.name as away_team_name,
                        th.short_name as home_short_name,
                        ta.short_name as away_short_name,
                        m.match_time,
                        m.status_id
                    FROM ts_matches m
                    JOIN ts_teams th ON th.external_id = m.home_team_id
                    JOIN ts_teams ta ON ta.external_id = m.away_team_id
                    WHERE 
                        (m.home_team_id = $1 OR m.away_team_id = $1)
                        AND m.status_id IN (2, 3, 4, 5, 7) -- Only LIVE matches
                    ORDER BY 
                        CASE WHEN m.status_id IN (2, 3, 4) THEN 0 ELSE 1 END, -- Prioritize active play
                        m.match_time DESC
                    LIMIT 5
                `;

                const singleResult = await client.query(singleQuery, [singleTeamMatch.teamId]);

                if (singleResult.rows.length > 0) {
                    // If only one match found, use it directly
                    if (singleResult.rows.length === 1) {
                        const m = singleResult.rows[0];
                        const isHome = m.home_team_id === singleTeamMatch.teamId;

                        logger.info(`[TeamMatcher] Single-team match found: ${m.home_team_name} vs ${m.away_team_name}`);

                        return {
                            matchExternalId: m.external_id,
                            matchUuid: m.match_uuid,
                            homeTeam: isHome ? singleTeamMatch : {
                                teamId: m.home_team_id,
                                teamName: m.home_team_name,
                                shortName: m.home_short_name,
                                confidence: 0.5,
                                matchMethod: 'partial'
                            },
                            awayTeam: !isHome ? singleTeamMatch : {
                                teamId: m.away_team_id,
                                teamName: m.away_team_name,
                                shortName: m.away_short_name,
                                confidence: 0.5,
                                matchMethod: 'partial'
                            },
                            overallConfidence: singleTeamMatch.confidence * 0.8, // Slightly lower confidence for single-team
                            matchTime: m.match_time,
                            statusId: m.status_id
                        };
                    }

                    // Multiple matches found - try to find one where opponent name partially matches
                    for (const m of singleResult.rows) {
                        const isHome = m.home_team_id === singleTeamMatch.teamId;
                        const opponentName = isHome ? m.away_team_name : m.home_team_name;
                        const opponentShort = isHome ? m.away_short_name : m.home_short_name;

                        // Check if unmatched team name has any similarity to opponent
                        const similarity = Math.max(
                            this.calculateSimilarity(this.normalizeTeamName(unmatchedTeamName), this.normalizeTeamName(opponentName)),
                            opponentShort ? this.calculateSimilarity(this.normalizeTeamName(unmatchedTeamName), this.normalizeTeamName(opponentShort)) : 0,
                            this.partialMatch(unmatchedTeamName, opponentName)
                        );

                        if (similarity > 0.3) { // Even low similarity is acceptable for the unmatched team
                            logger.info(`[TeamMatcher] Found match via single-team + partial opponent: ${m.home_team_name} vs ${m.away_team_name}`);

                            return {
                                matchExternalId: m.external_id,
                                matchUuid: m.match_uuid,
                                homeTeam: isHome ? singleTeamMatch : {
                                    teamId: m.home_team_id,
                                    teamName: m.home_team_name,
                                    shortName: m.home_short_name,
                                    confidence: similarity,
                                    matchMethod: 'partial'
                                },
                                awayTeam: !isHome ? singleTeamMatch : {
                                    teamId: m.away_team_id,
                                    teamName: m.away_team_name,
                                    shortName: m.away_short_name,
                                    confidence: similarity,
                                    matchMethod: 'partial'
                                },
                                overallConfidence: (singleTeamMatch.confidence + similarity) / 2,
                                matchTime: m.match_time,
                                statusId: m.status_id
                            };
                        }
                    }

                    // If no partial match found, return first match anyway (single team was matched)
                    const m = singleResult.rows[0];
                    const isHome = m.home_team_id === singleTeamMatch.teamId;

                    logger.info(`[TeamMatcher] Using first single-team match: ${m.home_team_name} vs ${m.away_team_name}`);

                    return {
                        matchExternalId: m.external_id,
                        matchUuid: m.match_uuid,
                        homeTeam: isHome ? singleTeamMatch : {
                            teamId: m.home_team_id,
                            teamName: m.home_team_name,
                            shortName: m.home_short_name,
                            confidence: 0.4,
                            matchMethod: 'partial'
                        },
                        awayTeam: !isHome ? singleTeamMatch : {
                            teamId: m.away_team_id,
                            teamName: m.away_team_name,
                            shortName: m.away_short_name,
                            confidence: 0.4,
                            matchMethod: 'partial'
                        },
                        overallConfidence: singleTeamMatch.confidence * 0.7,
                        matchTime: m.match_time,
                        statusId: m.status_id
                    };
                }
            }

            logger.warn(`[TeamMatcher] No match found for: "${homeTeamName}" vs "${awayTeamName}"`);
            return null;

        } finally {
            client.release();
        }
    }
}

export const teamNameMatcherService = new TeamNameMatcherService();
