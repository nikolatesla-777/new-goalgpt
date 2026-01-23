"use strict";
/**
 * Team Name Matcher Service
 *
 * Provides fuzzy string matching for team names from external AI predictions
 * to TheSports team database entries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamNameMatcherService = exports.TeamNameMatcherService = void 0;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
class TeamNameMatcherService {
    /**
     * Normalize team name for comparison
     * - Lowercase
     * - Remove leading asterisks and special chars
     * - NORMALIZE (not remove) gender/age markers: (W) → Women, Youth → Youth
     * - Remove common suffixes (FC, SC, CF, etc.)
     * - Remove punctuation and extra spaces
     */
    normalizeTeamName(name) {
        if (!name)
            return '';
        let normalized = name
            .toLowerCase()
            // STEP 1: Remove leading asterisks and special prefixes (e.g., "*Santos Laguna")
            .replace(/^[\*\#\@\!\+]+\s*/g, '')
            // STEP 2: Normalize gender markers - (W) or (Women) → Women suffix
            .replace(/\s*\(w\)\s*$/gi, ' women')
            .replace(/\s*\(women\)\s*$/gi, ' women')
            // STEP 3: Normalize youth markers - various formats to standard
            .replace(/\s*\(youth\)\s*$/gi, ' youth')
            .replace(/\s*\(u\d+\)\s*$/gi, (match) => ' ' + match.replace(/[()]/g, '').toLowerCase())
            // STEP 4: Handle inline markers (e.g., "Team Name U20" or "Team Name Youth")
            // Keep these as-is, they're already in good format
            // STEP 5: Remove common suffixes ONLY (not gender/age)
            .replace(/\s?(fc|sc|cf|afc|bc|ac|fk|sk|as|ss|us|bk|if|ssk|spor|kulübü|club|team|united|city)\.?\s*$/gi, '')
            // STEP 6: Remove remaining punctuation (but keep spaces)
            .replace(/[^\w\s]/g, '')
            // STEP 7: Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
        return normalized;
    }
    /**
     * Extract team category (gender/age) from name
     * Returns: 'women', 'youth', 'u19', 'u20', 'u21', 'u23', 'reserve', or null for main team
     */
    extractTeamCategory(name) {
        if (!name)
            return null;
        const lower = name.toLowerCase();
        // Check for women's team
        if (/\(w\)|women|femenil|feminin|ladies/i.test(lower))
            return 'women';
        // Check for age categories
        if (/u17|under.?17/i.test(lower))
            return 'u17';
        if (/u19|under.?19/i.test(lower))
            return 'u19';
        if (/u20|under.?20/i.test(lower))
            return 'u20';
        if (/u21|under.?21/i.test(lower))
            return 'u21';
        if (/u23|under.?23/i.test(lower))
            return 'u23';
        // Check for youth/reserve
        if (/youth|junior|juniores|juvenil/i.test(lower))
            return 'youth';
        if (/reserve|ii$|b$| b /i.test(lower))
            return 'reserve';
        return null; // Main/senior team
    }
    /**
     * Check if two team categories are compatible
     * Women's team should only match women's team, youth should match youth, etc.
     */
    categoriesMatch(cat1, cat2) {
        // Both null = both main teams, compatible
        if (cat1 === null && cat2 === null)
            return true;
        // One has category, other doesn't = incompatible
        if (cat1 === null || cat2 === null)
            return false;
        // Both have categories, check if same type
        // Women must match women
        if (cat1 === 'women' || cat2 === 'women') {
            return cat1 === 'women' && cat2 === 'women';
        }
        // Youth categories are somewhat flexible (youth can match U19, U20, etc.)
        const youthCategories = ['youth', 'u17', 'u19', 'u20', 'u21', 'u23', 'reserve'];
        if (youthCategories.includes(cat1) && youthCategories.includes(cat2)) {
            return true; // Youth teams can match each other
        }
        return cat1 === cat2;
    }
    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        // Create matrix
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        // Initialize base cases
        for (let i = 0; i <= m; i++)
            dp[i][0] = i;
        for (let j = 0; j <= n; j++)
            dp[0][j] = j;
        // Fill matrix
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                }
                else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j], // deletion
                    dp[i][j - 1], // insertion
                    dp[i - 1][j - 1] // substitution
                    );
                }
            }
        }
        return dp[m][n];
    }
    /**
     * Calculate similarity score (0-1) between two strings
     * OPTIMIZED: For multi-word team names, use word-based matching
     */
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2)
            return 0;
        if (str1 === str2)
            return 1;
        // For multi-word names, use word-based similarity (more accurate)
        const words1 = str1.split(/\s+/).filter(w => w.length > 0);
        const words2 = str2.split(/\s+/).filter(w => w.length > 0);
        // If both have 2+ words, use word-based matching
        if (words1.length >= 2 && words2.length >= 2) {
            return this.calculateWordBasedSimilarity(words1, words2, str1, str2);
        }
        // For single-word or mixed, use standard Levenshtein
        const maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0)
            return 1;
        const distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLen);
    }
    /**
     * Calculate similarity for multi-word team names
     * Example: "Al Ittihad Jeddah" vs "Al Ittihad Club"
     * - "Al" matches "Al" → 100%
     * - "Ittihad" matches "Ittihad" → 100%
     * - "Jeddah" vs "Club" → lower similarity
     * - Weighted average with bonus for matching words
     */
    calculateWordBasedSimilarity(words1, words2, fullStr1, fullStr2) {
        // Find matching words (exact or high similarity)
        let totalSimilarity = 0;
        let matchedWords = 0;
        const wordSimilarities = [];
        for (const word1 of words1) {
            let bestMatch = 0;
            for (const word2 of words2) {
                // Check exact match first
                if (word1 === word2) {
                    bestMatch = 1.0;
                    break;
                }
                // Check similarity
                const wordSim = this.calculateWordSimilarity(word1, word2);
                if (wordSim > bestMatch) {
                    bestMatch = wordSim;
                }
            }
            wordSimilarities.push(bestMatch);
            totalSimilarity += bestMatch;
            if (bestMatch >= 0.8)
                matchedWords++;
        }
        // Calculate base similarity (average of word similarities)
        const baseSimilarity = totalSimilarity / words1.length;
        // Bonus for matching words (if most words match, boost similarity)
        const matchRatio = matchedWords / words1.length;
        const bonus = matchRatio * 0.15; // Up to 15% bonus
        // Also consider full string similarity (for cases like "Jeddah" vs "Club")
        const fullStrSim = this.calculateFullStringSimilarity(fullStr1, fullStr2);
        // Weighted combination: 60% word-based, 40% full string, plus bonus
        const finalSimilarity = (baseSimilarity * 0.6) + (fullStrSim * 0.4) + bonus;
        return Math.min(1.0, finalSimilarity);
    }
    /**
     * Calculate similarity between two words
     */
    calculateWordSimilarity(word1, word2) {
        if (word1 === word2)
            return 1.0;
        const maxLen = Math.max(word1.length, word2.length);
        if (maxLen === 0)
            return 1.0;
        const distance = this.levenshteinDistance(word1, word2);
        return 1 - (distance / maxLen);
    }
    /**
     * Calculate full string similarity (standard Levenshtein)
     */
    calculateFullStringSimilarity(str1, str2) {
        const maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0)
            return 1;
        const distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLen);
    }
    /**
     * Check if one string contains the other (partial match)
     */
    partialMatch(str1, str2) {
        if (!str1 || !str2)
            return 0;
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
    async findBestMatch(searchName, leagueHint, countryHint) {
        const client = await connection_1.pool.connect();
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
            // Try normalized match - IMPROVED: Use word-based search for better matching
            // For multi-word names, search for teams that contain the key words
            const words = normalizedSearch.split(/\s+/).filter(w => w.length > 1); // Filter single chars
            let normalizedQuery = '';
            let normalizedParams = [];
            if (words.length >= 2) {
                // Multi-word: Search for teams that contain at least 2 key words
                // Example: "al ittihad jeddah" → search for teams with ("al" AND "ittihad") OR ("ittihad" AND "jeddah")
                // This allows "Al Ittihad Club" to match (has "al" and "ittihad")
                const firstTwoWords = words.slice(0, 2);
                const wordConditions = firstTwoWords.map((_, i) => `LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s]', '', 'g')) ILIKE $${i + 1}`).join(' AND ');
                normalizedQuery = `
                    SELECT external_id, name, short_name 
                    FROM ts_teams 
                    WHERE ${wordConditions}
                    ORDER BY 
                        CASE WHEN LOWER(name) LIKE $${firstTwoWords.length + 1} THEN 0 ELSE 1 END,
                        LENGTH(name)
                    LIMIT 20
                `;
                normalizedParams = [
                    ...firstTwoWords.map(w => `%${w}%`),
                    `%${normalizedSearch}%` // Full match bonus
                ];
            }
            else {
                // Single word: Use simple ILIKE
                normalizedQuery = `
                    SELECT external_id, name, short_name 
                    FROM ts_teams 
                    WHERE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s]', '', 'g')) ILIKE $1
                    LIMIT 20
                `;
                normalizedParams = [`%${normalizedSearch}%`];
            }
            const normalizedResult = await client.query(normalizedQuery, normalizedParams);
            if (normalizedResult.rows.length > 0) {
                // Score ALL candidates using word-based similarity and pick the best
                let bestTeam = null;
                let bestScore = 0;
                for (const team of normalizedResult.rows) {
                    const teamNormalized = this.normalizeTeamName(team.name);
                    let similarity = this.calculateSimilarity(normalizedSearch, teamNormalized);
                    // BONUS: If search name has location word (e.g., "Jeddah") and team name doesn't have it,
                    // but team name has other location (e.g., "Club"), give bonus for main team
                    // Example: "Al Ittihad Jeddah" vs "Al Ittihad Club" → prefer "Club" if it's the main team
                    const searchWords = normalizedSearch.split(/\s+/);
                    const teamWords = teamNormalized.split(/\s+/);
                    // Check if search has location word that team doesn't have
                    const searchHasLocation = searchWords.some(w => w.length > 3 && !['al', 'the', 'fc', 'sc', 'cf'].includes(w));
                    const teamHasLocation = teamWords.some(w => w.length > 3 && !['al', 'the', 'fc', 'sc', 'cf'].includes(w));
                    // If both have location words but different, prefer team without reserve suffix
                    const teamNameLower = team.name.toLowerCase();
                    // CRITICAL: Category-based matching using new extractTeamCategory function
                    // This ensures Women's predictions ONLY match Women's teams, Youth matches Youth, etc.
                    const searchCategory = this.extractTeamCategory(searchName);
                    const teamCategory = this.extractTeamCategory(team.name);
                    if (!this.categoriesMatch(searchCategory, teamCategory)) {
                        // Categories don't match - heavy penalty (50%)
                        // e.g., "*Santos Laguna (W)" should NOT match "Santos Laguna" (men's team)
                        similarity = similarity * 0.5;
                    }
                    else if (searchCategory !== null && teamCategory !== null) {
                        // Categories match exactly - give small bonus
                        similarity = Math.min(1.0, similarity * 1.1);
                    }
                    if (similarity > bestScore) {
                        bestScore = similarity;
                        bestTeam = team;
                    }
                }
                // Only return if similarity >= 60% (threshold)
                if (bestTeam && bestScore >= 0.6) {
                    return {
                        teamId: bestTeam.external_id,
                        teamName: bestTeam.name,
                        shortName: bestTeam.short_name,
                        confidence: bestScore,
                        matchMethod: 'normalized'
                    };
                }
            }
            // OPTIMIZED: Full name similarity search - check ALL teams with full name comparison
            // This ensures we find matches like "Muembe" vs "Mwembe" (94.74% similarity)
            const fuzzyQuery = `
        SELECT external_id, name, short_name 
        FROM ts_teams 
        WHERE 
          -- Try multiple prefix patterns for better coverage
          name ILIKE $1 OR name ILIKE $2 OR name ILIKE $3
          OR short_name ILIKE $1 OR short_name ILIKE $2 OR short_name ILIKE $3
        ORDER BY 
          CASE 
            WHEN LOWER(name) LIKE $4 THEN 0 
            WHEN LOWER(name) LIKE $5 THEN 1
            ELSE 2 
          END,
          LENGTH(name)
        LIMIT 50
      `;
            // Generate multiple prefix patterns for better matching
            const prefix2 = searchName.substring(0, 2); // First 2 chars
            const prefix3 = searchName.substring(0, 3); // First 3 chars
            const prefix4 = searchName.substring(0, 4); // First 4 chars
            const fuzzyResult = await client.query(fuzzyQuery, [
                `%${prefix2}%`, // Pattern 1: First 2 chars
                `%${prefix3}%`, // Pattern 2: First 3 chars
                `%${prefix4}%`, // Pattern 3: First 4 chars
                `%${normalizedSearch}%`, // Full normalized name
                `%${normalizedSearch.substring(0, Math.min(10, normalizedSearch.length))}%` // First 10 chars
            ]);
            if (fuzzyResult.rows.length === 0) {
                // Broader search if no results - check all teams
                const broadQuery = `
          SELECT external_id, name, short_name 
          FROM ts_teams 
          LIMIT 1000
        `;
                const broadResult = await client.query(broadQuery);
                fuzzyResult.rows.push(...broadResult.rows);
            }
            // Score all candidates using FULL NAME similarity
            let bestMatch = null;
            let bestScore = 0;
            for (const team of fuzzyResult.rows) {
                const teamNormalized = this.normalizeTeamName(team.name);
                const shortNormalized = team.short_name ? this.normalizeTeamName(team.short_name) : '';
                // CRITICAL: Calculate similarity on FULL normalized names
                const nameSimilarity = this.calculateSimilarity(normalizedSearch, teamNormalized);
                const shortSimilarity = shortNormalized ? this.calculateSimilarity(normalizedSearch, shortNormalized) : 0;
                const partialScore = Math.max(this.partialMatch(normalizedSearch, teamNormalized), shortNormalized ? this.partialMatch(normalizedSearch, shortNormalized) : 0);
                // Use the best similarity score
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
            logger_1.logger.warn(`[TeamMatcher] No good match found for: "${searchName}"`);
            return null;
        }
        finally {
            client.release();
        }
    }
    /**
     * Find team by alias table first, then fall back to fuzzy matching
     * CRITICAL: Use league hint for better matching (e.g., Myanmar Professional League)
     */
    async findTeamByAlias(teamName, leagueHint) {
        const client = await connection_1.pool.connect();
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
                logger_1.logger.info(`[TeamMatcher] Found team via alias: "${teamName}" -> "${team.name}"`);
                return {
                    teamId: team.external_id,
                    teamName: team.name,
                    shortName: team.short_name,
                    confidence: 1.0,
                    matchMethod: 'exact'
                };
            }
        }
        finally {
            client.release();
        }
        // Fall back to fuzzy matching with league hint
        return this.findBestMatch(teamName, leagueHint);
    }
    /**
     * Find active match with matching teams
     * NEW LOGIC: Single team match is enough (home OR away)
     */
    async findMatchByTeams(homeTeamName, awayTeamName, minuteHint, scoreHint, leagueHint) {
        // OPTIMIZED: Try to match teams sequentially (faster - stop at first match)
        // First try home team, if matched, find match immediately
        // CRITICAL: Use league hint for better matching (e.g., Myanmar Professional League)
        let homeMatch = await this.findTeamByAlias(homeTeamName, leagueHint);
        const client = await connection_1.pool.connect();
        try {
            // OPTIMIZED STRATEGY: Single team match is faster - use first matched team
            // If home team matches, find its match immediately (no need to check away team)
            if (homeMatch && homeMatch.confidence >= 0.6) {
                logger_1.logger.info(`[TeamMatcher] Home team matched (${homeMatch.confidence * 100}%): "${homeTeamName}" → "${homeMatch.teamName}"`);
                // Find LIVE match where this team is playing
                const matchQuery = `
                    SELECT 
                        m.id as match_uuid,
                        m.external_id,
                        m.home_team_id,
                        m.away_team_id,
                        m.match_time,
                        m.status_id,
                        th.name as home_team_name,
                        ta.name as away_team_name,
                        th.short_name as home_short_name,
                        ta.short_name as away_short_name
                    FROM ts_matches m
                    JOIN ts_teams th ON th.external_id = m.home_team_id
                    JOIN ts_teams ta ON ta.external_id = m.away_team_id
                    WHERE 
                        (m.home_team_id = $1 OR m.away_team_id = $1)
                        AND m.status_id IN (1, 2, 3, 4, 5, 7, 8) -- Include Pending (1) and Finished (8)
                    ORDER BY 
                        CASE -- Priority: Live > Pending > Finished
                            WHEN m.status_id IN (2, 3, 4, 5, 7) THEN 0 
                            WHEN m.status_id = 1 THEN 1
                            ELSE 2 
                        END,
                        m.match_time ASC -- Pick nearest match (crucial for pending)
                    LIMIT 5
                `;
                const matchResult = await client.query(matchQuery, [homeMatch.teamId]);
                if (matchResult.rows.length > 0) {
                    // If only one match, use it directly
                    if (matchResult.rows.length === 1) {
                        const m = matchResult.rows[0];
                        const isHome = m.home_team_id === homeMatch.teamId;
                        // Check if away team name matches (for confidence calculation)
                        const awayTeamMatch = await this.findTeamByAlias(awayTeamName);
                        const awayConfidence = awayTeamMatch ? awayTeamMatch.confidence : 0.5;
                        logger_1.logger.info(`[TeamMatcher] Match found via home team: ${m.home_team_name} vs ${m.away_team_name}`);
                        return {
                            matchExternalId: m.external_id,
                            matchUuid: m.match_uuid,
                            homeTeam: isHome ? homeMatch : {
                                teamId: m.home_team_id,
                                teamName: m.home_team_name,
                                shortName: m.home_short_name,
                                confidence: awayConfidence,
                                matchMethod: 'partial'
                            },
                            awayTeam: !isHome ? homeMatch : {
                                teamId: m.away_team_id,
                                teamName: m.away_team_name,
                                shortName: m.away_short_name,
                                confidence: awayConfidence,
                                matchMethod: 'partial'
                            },
                            overallConfidence: (homeMatch.confidence + awayConfidence) / 2,
                            matchTime: m.match_time,
                            statusId: m.status_id
                        };
                    }
                    // Multiple matches - check away team name similarity
                    for (const m of matchResult.rows) {
                        const isHome = m.home_team_id === homeMatch.teamId;
                        const opponentName = isHome ? m.away_team_name : m.home_team_name;
                        // Check if away team name matches opponent
                        const similarity = this.calculateSimilarity(this.normalizeTeamName(awayTeamName), this.normalizeTeamName(opponentName));
                        if (similarity >= 0.6) {
                            logger_1.logger.info(`[TeamMatcher] Match found with away team similarity (${similarity * 100}%): ${m.home_team_name} vs ${m.away_team_name}`);
                            return {
                                matchExternalId: m.external_id,
                                matchUuid: m.match_uuid,
                                homeTeam: isHome ? homeMatch : {
                                    teamId: m.home_team_id,
                                    teamName: m.home_team_name,
                                    shortName: m.home_short_name,
                                    confidence: similarity,
                                    matchMethod: 'fuzzy'
                                },
                                awayTeam: !isHome ? homeMatch : {
                                    teamId: m.away_team_id,
                                    teamName: m.away_team_name,
                                    shortName: m.away_short_name,
                                    confidence: similarity,
                                    matchMethod: 'fuzzy'
                                },
                                overallConfidence: (homeMatch.confidence + similarity) / 2,
                                matchTime: m.match_time,
                                statusId: m.status_id
                            };
                        }
                    }
                    // No away team match, use first match anyway
                    const m = matchResult.rows[0];
                    const isHome = m.home_team_id === homeMatch.teamId;
                    logger_1.logger.info(`[TeamMatcher] Using first match (away team not matched): ${m.home_team_name} vs ${m.away_team_name}`);
                    return {
                        matchExternalId: m.external_id,
                        matchUuid: m.match_uuid,
                        homeTeam: isHome ? homeMatch : {
                            teamId: m.home_team_id,
                            teamName: m.home_team_name,
                            shortName: m.home_short_name,
                            confidence: 0.5,
                            matchMethod: 'partial'
                        },
                        awayTeam: !isHome ? homeMatch : {
                            teamId: m.away_team_id,
                            teamName: m.away_team_name,
                            shortName: m.away_short_name,
                            confidence: 0.5,
                            matchMethod: 'partial'
                        },
                        overallConfidence: homeMatch.confidence * 0.8,
                        matchTime: m.match_time,
                        statusId: m.status_id
                    };
                }
            }
            // If home team didn't match, try away team
            const awayMatch = await this.findTeamByAlias(awayTeamName, leagueHint);
            if (awayMatch && awayMatch.confidence >= 0.6) {
                logger_1.logger.info(`[TeamMatcher] Away team matched (${awayMatch.confidence * 100}%): "${awayTeamName}" → "${awayMatch.teamName}"`);
                // Find LIVE match where this team is playing
                const matchQuery = `
                    SELECT 
                        m.id as match_uuid,
                        m.external_id,
                        m.home_team_id,
                        m.away_team_id,
                        m.match_time,
                        m.status_id,
                        th.name as home_team_name,
                        ta.name as away_team_name,
                        th.short_name as home_short_name,
                        ta.short_name as away_short_name
                    FROM ts_matches m
                    JOIN ts_teams th ON th.external_id = m.home_team_id
                    JOIN ts_teams ta ON ta.external_id = m.away_team_id
                    WHERE 
                        (m.home_team_id = $1 OR m.away_team_id = $1)
                        AND m.status_id IN (1, 2, 3, 4, 5, 7, 8) -- Include Pending and Finished
                    ORDER BY 
                        CASE 
                            WHEN m.status_id IN (2, 3, 4, 5, 7) THEN 0
                            WHEN m.status_id = 1 THEN 1
                            ELSE 2 
                        END,
                        m.match_time ASC
                    LIMIT 5
                `;
                const matchResult = await client.query(matchQuery, [awayMatch.teamId]);
                if (matchResult.rows.length > 0) {
                    // If only one match, use it directly
                    if (matchResult.rows.length === 1) {
                        const m = matchResult.rows[0];
                        const isAway = m.away_team_id === awayMatch.teamId;
                        logger_1.logger.info(`[TeamMatcher] Match found via away team: ${m.home_team_name} vs ${m.away_team_name}`);
                        return {
                            matchExternalId: m.external_id,
                            matchUuid: m.match_uuid,
                            homeTeam: isAway ? {
                                teamId: m.home_team_id,
                                teamName: m.home_team_name,
                                shortName: m.home_short_name,
                                confidence: 0.5,
                                matchMethod: 'partial'
                            } : awayMatch,
                            awayTeam: isAway ? awayMatch : {
                                teamId: m.away_team_id,
                                teamName: m.away_team_name,
                                shortName: m.away_short_name,
                                confidence: 0.5,
                                matchMethod: 'partial'
                            },
                            overallConfidence: awayMatch.confidence * 0.8,
                            matchTime: m.match_time,
                            statusId: m.status_id
                        };
                    }
                    // Multiple matches - check home team name similarity
                    for (const m of matchResult.rows) {
                        const isAway = m.away_team_id === awayMatch.teamId;
                        const opponentName = isAway ? m.home_team_name : m.away_team_name;
                        const similarity = this.calculateSimilarity(this.normalizeTeamName(homeTeamName), this.normalizeTeamName(opponentName));
                        if (similarity >= 0.6) {
                            logger_1.logger.info(`[TeamMatcher] Match found with home team similarity (${similarity * 100}%): ${m.home_team_name} vs ${m.away_team_name}`);
                            return {
                                matchExternalId: m.external_id,
                                matchUuid: m.match_uuid,
                                homeTeam: isAway ? {
                                    teamId: m.home_team_id,
                                    teamName: m.home_team_name,
                                    shortName: m.home_short_name,
                                    confidence: similarity,
                                    matchMethod: 'fuzzy'
                                } : awayMatch,
                                awayTeam: isAway ? awayMatch : {
                                    teamId: m.away_team_id,
                                    teamName: m.away_team_name,
                                    shortName: m.away_short_name,
                                    confidence: similarity,
                                    matchMethod: 'fuzzy'
                                },
                                overallConfidence: (awayMatch.confidence + similarity) / 2,
                                matchTime: m.match_time,
                                statusId: m.status_id
                            };
                        }
                    }
                    // No home team match, use first match anyway
                    const m = matchResult.rows[0];
                    const isAway = m.away_team_id === awayMatch.teamId;
                    logger_1.logger.info(`[TeamMatcher] Using first match (home team not matched): ${m.home_team_name} vs ${m.away_team_name}`);
                    return {
                        matchExternalId: m.external_id,
                        matchUuid: m.match_uuid,
                        homeTeam: isAway ? {
                            teamId: m.home_team_id,
                            teamName: m.home_team_name,
                            shortName: m.home_short_name,
                            confidence: 0.5,
                            matchMethod: 'partial'
                        } : awayMatch,
                        awayTeam: isAway ? awayMatch : {
                            teamId: m.away_team_id,
                            teamName: m.away_team_name,
                            shortName: m.away_short_name,
                            confidence: 0.5,
                            matchMethod: 'partial'
                        },
                        overallConfidence: awayMatch.confidence * 0.8,
                        matchTime: m.match_time,
                        statusId: m.status_id
                    };
                }
            }
            logger_1.logger.warn(`[TeamMatcher] No match found for: "${homeTeamName}" vs "${awayTeamName}"`);
            return null;
        }
        finally {
            client.release();
        }
    }
}
exports.TeamNameMatcherService = TeamNameMatcherService;
exports.teamNameMatcherService = new TeamNameMatcherService();
