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
     * Find active match with matching teams
     */
    async findMatchByTeams(
        homeTeamName: string,
        awayTeamName: string,
        minuteHint?: number,
        scoreHint?: string
    ): Promise<MatchLookupResult | null> {
        // Match both teams
        const [homeMatch, awayMatch] = await Promise.all([
            this.findBestMatch(homeTeamName),
            this.findBestMatch(awayTeamName)
        ]);

        if (!homeMatch || !awayMatch) {
            logger.warn(`[TeamMatcher] Could not match teams: "${homeTeamName}" vs "${awayTeamName}"`);
            return null;
        }

        // Find match in database with these teams
        const client = await pool.connect();
        try {
            // Look for matches with these team IDs (recent matches - last 24 hours)
            const matchQuery = `
        SELECT 
          m.id as match_uuid,
          m.external_id,
          m.home_team_id,
          m.away_team_id,
          m.match_time,
          m.status_id,
          m.home_score_display,
          m.away_score_display
        FROM ts_matches m
        WHERE 
          m.home_team_id = $1 
          AND m.away_team_id = $2
          AND m.match_time >= EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')
          AND m.match_time <= EXTRACT(EPOCH FROM NOW() + INTERVAL '12 hours')
        ORDER BY m.match_time DESC
        LIMIT 1
      `;

            const matchResult = await client.query(matchQuery, [homeMatch.teamId, awayMatch.teamId]);

            if (matchResult.rows.length === 0) {
                // Try reverse order (away at home)
                const reverseResult = await client.query(matchQuery, [awayMatch.teamId, homeMatch.teamId]);
                if (reverseResult.rows.length > 0) {
                    logger.info(`[TeamMatcher] Found match with reversed teams`);
                    const m = reverseResult.rows[0];
                    return {
                        matchExternalId: m.external_id,
                        matchUuid: m.match_uuid,
                        homeTeam: awayMatch,
                        awayTeam: homeMatch,
                        overallConfidence: (homeMatch.confidence + awayMatch.confidence) / 2,
                        matchTime: m.match_time,
                        statusId: m.status_id
                    };
                }

                logger.warn(`[TeamMatcher] No match found for teams: ${homeMatch.teamId} vs ${awayMatch.teamId}`);
                return null;
            }

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

        } finally {
            client.release();
        }
    }
}

export const teamNameMatcherService = new TeamNameMatcherService();
