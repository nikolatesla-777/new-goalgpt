"use strict";
/**
 * Team Name Matcher Service
 *
 * Provides fuzzy string matching for team names from external AI predictions
 * to TheSports team database entries.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamNameMatcherService = exports.TeamNameMatcherService = void 0;
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
var TeamNameMatcherService = /** @class */ (function () {
    function TeamNameMatcherService() {
    }
    /**
     * Normalize team name for comparison
     * - Lowercase
     * - Remove leading asterisks and special chars
     * - NORMALIZE (not remove) gender/age markers: (W) → Women, Youth → Youth
     * - Remove common suffixes (FC, SC, CF, etc.)
     * - Remove punctuation and extra spaces
     */
    TeamNameMatcherService.prototype.normalizeTeamName = function (name) {
        if (!name)
            return '';
        var normalized = name
            .toLowerCase()
            // STEP 1: Remove leading asterisks and special prefixes (e.g., "*Santos Laguna")
            .replace(/^[\*\#\@\!\+]+\s*/g, '')
            // STEP 2: Normalize gender markers - (W) or (Women) → Women suffix
            .replace(/\s*\(w\)\s*$/gi, ' women')
            .replace(/\s*\(women\)\s*$/gi, ' women')
            // STEP 3: Normalize youth markers - various formats to standard
            .replace(/\s*\(youth\)\s*$/gi, ' youth')
            .replace(/\s*\(u\d+\)\s*$/gi, function (match) { return ' ' + match.replace(/[()]/g, '').toLowerCase(); })
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
    };
    /**
     * Extract team category (gender/age) from name
     * Returns: 'women', 'youth', 'u19', 'u20', 'u21', 'u23', 'reserve', or null for main team
     */
    TeamNameMatcherService.prototype.extractTeamCategory = function (name) {
        if (!name)
            return null;
        var lower = name.toLowerCase();
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
    };
    /**
     * Check if two team categories are compatible
     * Women's team should only match women's team, youth should match youth, etc.
     */
    TeamNameMatcherService.prototype.categoriesMatch = function (cat1, cat2) {
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
        var youthCategories = ['youth', 'u17', 'u19', 'u20', 'u21', 'u23', 'reserve'];
        if (youthCategories.includes(cat1) && youthCategories.includes(cat2)) {
            return true; // Youth teams can match each other
        }
        return cat1 === cat2;
    };
    /**
     * Calculate Levenshtein distance between two strings
     */
    TeamNameMatcherService.prototype.levenshteinDistance = function (str1, str2) {
        var m = str1.length;
        var n = str2.length;
        // Create matrix
        var dp = Array(m + 1).fill(null).map(function () { return Array(n + 1).fill(0); });
        // Initialize base cases
        for (var i = 0; i <= m; i++)
            dp[i][0] = i;
        for (var j = 0; j <= n; j++)
            dp[0][j] = j;
        // Fill matrix
        for (var i = 1; i <= m; i++) {
            for (var j = 1; j <= n; j++) {
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
    };
    /**
     * Calculate similarity score (0-1) between two strings
     * OPTIMIZED: For multi-word team names, use word-based matching
     */
    TeamNameMatcherService.prototype.calculateSimilarity = function (str1, str2) {
        if (!str1 || !str2)
            return 0;
        if (str1 === str2)
            return 1;
        // For multi-word names, use word-based similarity (more accurate)
        var words1 = str1.split(/\s+/).filter(function (w) { return w.length > 0; });
        var words2 = str2.split(/\s+/).filter(function (w) { return w.length > 0; });
        // If both have 2+ words, use word-based matching
        if (words1.length >= 2 && words2.length >= 2) {
            return this.calculateWordBasedSimilarity(words1, words2, str1, str2);
        }
        // For single-word or mixed, use standard Levenshtein
        var maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0)
            return 1;
        var distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLen);
    };
    /**
     * Calculate similarity for multi-word team names
     * Example: "Al Ittihad Jeddah" vs "Al Ittihad Club"
     * - "Al" matches "Al" → 100%
     * - "Ittihad" matches "Ittihad" → 100%
     * - "Jeddah" vs "Club" → lower similarity
     * - Weighted average with bonus for matching words
     */
    TeamNameMatcherService.prototype.calculateWordBasedSimilarity = function (words1, words2, fullStr1, fullStr2) {
        // Find matching words (exact or high similarity)
        var totalSimilarity = 0;
        var matchedWords = 0;
        var wordSimilarities = [];
        for (var _i = 0, words1_1 = words1; _i < words1_1.length; _i++) {
            var word1 = words1_1[_i];
            var bestMatch = 0;
            for (var _a = 0, words2_1 = words2; _a < words2_1.length; _a++) {
                var word2 = words2_1[_a];
                // Check exact match first
                if (word1 === word2) {
                    bestMatch = 1.0;
                    break;
                }
                // Check similarity
                var wordSim = this.calculateWordSimilarity(word1, word2);
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
        var baseSimilarity = totalSimilarity / words1.length;
        // Bonus for matching words (if most words match, boost similarity)
        var matchRatio = matchedWords / words1.length;
        var bonus = matchRatio * 0.15; // Up to 15% bonus
        // Also consider full string similarity (for cases like "Jeddah" vs "Club")
        var fullStrSim = this.calculateFullStringSimilarity(fullStr1, fullStr2);
        // Weighted combination: 60% word-based, 40% full string, plus bonus
        var finalSimilarity = (baseSimilarity * 0.6) + (fullStrSim * 0.4) + bonus;
        return Math.min(1.0, finalSimilarity);
    };
    /**
     * Calculate similarity between two words
     */
    TeamNameMatcherService.prototype.calculateWordSimilarity = function (word1, word2) {
        if (word1 === word2)
            return 1.0;
        var maxLen = Math.max(word1.length, word2.length);
        if (maxLen === 0)
            return 1.0;
        var distance = this.levenshteinDistance(word1, word2);
        return 1 - (distance / maxLen);
    };
    /**
     * Calculate full string similarity (standard Levenshtein)
     */
    TeamNameMatcherService.prototype.calculateFullStringSimilarity = function (str1, str2) {
        var maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0)
            return 1;
        var distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLen);
    };
    /**
     * Check if one string contains the other (partial match)
     */
    TeamNameMatcherService.prototype.partialMatch = function (str1, str2) {
        if (!str1 || !str2)
            return 0;
        var s1 = str1.toLowerCase();
        var s2 = str2.toLowerCase();
        if (s1.includes(s2) || s2.includes(s1)) {
            var minLen = Math.min(s1.length, s2.length);
            var maxLen = Math.max(s1.length, s2.length);
            return minLen / maxLen;
        }
        return 0;
    };
    /**
     * Find best matching team from database
     */
    TeamNameMatcherService.prototype.findBestMatch = function (searchName, leagueHint, countryHint) {
        return __awaiter(this, void 0, void 0, function () {
            var client, normalizedSearch, exactQuery, exactResult, team, words, normalizedQuery, normalizedParams, firstTwoWords, wordConditions, normalizedResult, bestTeam, bestScore_1, _i, _a, team, teamNormalized, similarity, searchWords, teamWords, searchHasLocation, teamHasLocation, teamNameLower, searchCategory, teamCategory, fuzzyQuery, prefix2, prefix3, prefix4, fuzzyResult, broadQuery, broadResult, bestMatch, bestScore, _b, _c, team, teamNormalized, shortNormalized, nameSimilarity, shortSimilarity, partialScore, score;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _e.sent();
                        _e.label = 2;
                    case 2:
                        _e.trys.push([2, , 8, 9]);
                        normalizedSearch = this.normalizeTeamName(searchName);
                        exactQuery = "\n        SELECT external_id, name, short_name \n        FROM ts_teams \n        WHERE LOWER(name) = $1 OR LOWER(short_name) = $1\n        LIMIT 1\n      ";
                        return [4 /*yield*/, client.query(exactQuery, [searchName.toLowerCase()])];
                    case 3:
                        exactResult = _e.sent();
                        if (exactResult.rows.length > 0) {
                            team = exactResult.rows[0];
                            return [2 /*return*/, {
                                    teamId: team.external_id,
                                    teamName: team.name,
                                    shortName: team.short_name,
                                    confidence: 1.0,
                                    matchMethod: 'exact'
                                }];
                        }
                        words = normalizedSearch.split(/\s+/).filter(function (w) { return w.length > 1; });
                        normalizedQuery = '';
                        normalizedParams = [];
                        if (words.length >= 2) {
                            firstTwoWords = words.slice(0, 2);
                            wordConditions = firstTwoWords.map(function (_, i) {
                                return "LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s]', '', 'g')) ILIKE $".concat(i + 1);
                            }).join(' AND ');
                            normalizedQuery = "\n                    SELECT external_id, name, short_name \n                    FROM ts_teams \n                    WHERE ".concat(wordConditions, "\n                    ORDER BY \n                        CASE WHEN LOWER(name) LIKE $").concat(firstTwoWords.length + 1, " THEN 0 ELSE 1 END,\n                        LENGTH(name)\n                    LIMIT 20\n                ");
                            normalizedParams = __spreadArray(__spreadArray([], firstTwoWords.map(function (w) { return "%".concat(w, "%"); }), true), [
                                "%".concat(normalizedSearch, "%") // Full match bonus
                            ], false);
                        }
                        else {
                            // Single word: Use simple ILIKE
                            normalizedQuery = "\n                    SELECT external_id, name, short_name \n                    FROM ts_teams \n                    WHERE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s]', '', 'g')) ILIKE $1\n                    LIMIT 20\n                ";
                            normalizedParams = ["%".concat(normalizedSearch, "%")];
                        }
                        return [4 /*yield*/, client.query(normalizedQuery, normalizedParams)];
                    case 4:
                        normalizedResult = _e.sent();
                        if (normalizedResult.rows.length > 0) {
                            bestTeam = null;
                            bestScore_1 = 0;
                            for (_i = 0, _a = normalizedResult.rows; _i < _a.length; _i++) {
                                team = _a[_i];
                                teamNormalized = this.normalizeTeamName(team.name);
                                similarity = this.calculateSimilarity(normalizedSearch, teamNormalized);
                                searchWords = normalizedSearch.split(/\s+/);
                                teamWords = teamNormalized.split(/\s+/);
                                searchHasLocation = searchWords.some(function (w) {
                                    return w.length > 3 && !['al', 'the', 'fc', 'sc', 'cf'].includes(w);
                                });
                                teamHasLocation = teamWords.some(function (w) {
                                    return w.length > 3 && !['al', 'the', 'fc', 'sc', 'cf'].includes(w);
                                });
                                teamNameLower = team.name.toLowerCase();
                                searchCategory = this.extractTeamCategory(searchName);
                                teamCategory = this.extractTeamCategory(team.name);
                                if (!this.categoriesMatch(searchCategory, teamCategory)) {
                                    // Categories don't match - heavy penalty (50%)
                                    // e.g., "*Santos Laguna (W)" should NOT match "Santos Laguna" (men's team)
                                    similarity = similarity * 0.5;
                                }
                                else if (searchCategory !== null && teamCategory !== null) {
                                    // Categories match exactly - give small bonus
                                    similarity = Math.min(1.0, similarity * 1.1);
                                }
                                if (similarity > bestScore_1) {
                                    bestScore_1 = similarity;
                                    bestTeam = team;
                                }
                            }
                            // Only return if similarity >= 60% (threshold)
                            if (bestTeam && bestScore_1 >= 0.6) {
                                return [2 /*return*/, {
                                        teamId: bestTeam.external_id,
                                        teamName: bestTeam.name,
                                        shortName: bestTeam.short_name,
                                        confidence: bestScore_1,
                                        matchMethod: 'normalized'
                                    }];
                            }
                        }
                        fuzzyQuery = "\n        SELECT external_id, name, short_name \n        FROM ts_teams \n        WHERE \n          -- Try multiple prefix patterns for better coverage\n          name ILIKE $1 OR name ILIKE $2 OR name ILIKE $3\n          OR short_name ILIKE $1 OR short_name ILIKE $2 OR short_name ILIKE $3\n        ORDER BY \n          CASE \n            WHEN LOWER(name) LIKE $4 THEN 0 \n            WHEN LOWER(name) LIKE $5 THEN 1\n            ELSE 2 \n          END,\n          LENGTH(name)\n        LIMIT 50\n      ";
                        prefix2 = searchName.substring(0, 2);
                        prefix3 = searchName.substring(0, 3);
                        prefix4 = searchName.substring(0, 4);
                        return [4 /*yield*/, client.query(fuzzyQuery, [
                                "%".concat(prefix2, "%"), // Pattern 1: First 2 chars
                                "%".concat(prefix3, "%"), // Pattern 2: First 3 chars
                                "%".concat(prefix4, "%"), // Pattern 3: First 4 chars
                                "%".concat(normalizedSearch, "%"), // Full normalized name
                                "%".concat(normalizedSearch.substring(0, Math.min(10, normalizedSearch.length)), "%") // First 10 chars
                            ])];
                    case 5:
                        fuzzyResult = _e.sent();
                        if (!(fuzzyResult.rows.length === 0)) return [3 /*break*/, 7];
                        broadQuery = "\n          SELECT external_id, name, short_name \n          FROM ts_teams \n          LIMIT 1000\n        ";
                        return [4 /*yield*/, client.query(broadQuery)];
                    case 6:
                        broadResult = _e.sent();
                        (_d = fuzzyResult.rows).push.apply(_d, broadResult.rows);
                        _e.label = 7;
                    case 7:
                        bestMatch = null;
                        bestScore = 0;
                        for (_b = 0, _c = fuzzyResult.rows; _b < _c.length; _b++) {
                            team = _c[_b];
                            teamNormalized = this.normalizeTeamName(team.name);
                            shortNormalized = team.short_name ? this.normalizeTeamName(team.short_name) : '';
                            nameSimilarity = this.calculateSimilarity(normalizedSearch, teamNormalized);
                            shortSimilarity = shortNormalized ? this.calculateSimilarity(normalizedSearch, shortNormalized) : 0;
                            partialScore = Math.max(this.partialMatch(normalizedSearch, teamNormalized), shortNormalized ? this.partialMatch(normalizedSearch, shortNormalized) : 0);
                            score = Math.max(nameSimilarity, shortSimilarity, partialScore * 0.9);
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
                            return [2 /*return*/, bestMatch];
                        }
                        logger_1.logger.warn("[TeamMatcher] No good match found for: \"".concat(searchName, "\""));
                        return [2 /*return*/, null];
                    case 8:
                        client.release();
                        return [7 /*endfinally*/];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Find team by alias table first, then fall back to fuzzy matching
     * CRITICAL: Use league hint for better matching (e.g., Myanmar Professional League)
     */
    TeamNameMatcherService.prototype.findTeamByAlias = function (teamName, leagueHint) {
        return __awaiter(this, void 0, void 0, function () {
            var client, aliasQuery, aliasResult, team;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, , 4, 5]);
                        aliasQuery = "\n                SELECT t.external_id, t.name, t.short_name \n                FROM ts_team_aliases a\n                JOIN ts_teams t ON t.external_id = a.team_external_id\n                WHERE LOWER(a.alias) = LOWER($1)\n                LIMIT 1\n            ";
                        return [4 /*yield*/, client.query(aliasQuery, [teamName.trim()])];
                    case 3:
                        aliasResult = _a.sent();
                        if (aliasResult.rows.length > 0) {
                            team = aliasResult.rows[0];
                            logger_1.logger.info("[TeamMatcher] Found team via alias: \"".concat(teamName, "\" -> \"").concat(team.name, "\""));
                            return [2 /*return*/, {
                                    teamId: team.external_id,
                                    teamName: team.name,
                                    shortName: team.short_name,
                                    confidence: 1.0,
                                    matchMethod: 'exact'
                                }];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        client.release();
                        return [7 /*endfinally*/];
                    case 5: 
                    // Fall back to fuzzy matching with league hint
                    return [2 /*return*/, this.findBestMatch(teamName, leagueHint)];
                }
            });
        });
    };
    /**
     * Find active match with matching teams
     * NEW LOGIC: Single team match is enough (home OR away)
     */
    TeamNameMatcherService.prototype.findMatchByTeams = function (homeTeamName, awayTeamName, minuteHint, scoreHint, leagueHint) {
        return __awaiter(this, void 0, void 0, function () {
            var homeMatch, client, matchQuery, matchResult, m_1, isHome_1, awayTeamMatch, awayConfidence, _i, _a, m_2, isHome_2, opponentName, similarity, m, isHome, awayMatch, matchQuery, matchResult, m_3, isAway_1, _b, _c, m_4, isAway_2, opponentName, similarity, m, isAway;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.findTeamByAlias(homeTeamName, leagueHint)];
                    case 1:
                        homeMatch = _d.sent();
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 2:
                        client = _d.sent();
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, , 11, 12]);
                        if (!(homeMatch && homeMatch.confidence >= 0.6)) return [3 /*break*/, 7];
                        logger_1.logger.info("[TeamMatcher] Home team matched (".concat(homeMatch.confidence * 100, "%): \"").concat(homeTeamName, "\" \u2192 \"").concat(homeMatch.teamName, "\""));
                        matchQuery = "\n                    SELECT \n                        m.id as match_uuid,\n                        m.external_id,\n                        m.home_team_id,\n                        m.away_team_id,\n                        m.match_time,\n                        m.status_id,\n                        th.name as home_team_name,\n                        ta.name as away_team_name,\n                        th.short_name as home_short_name,\n                        ta.short_name as away_short_name\n                    FROM ts_matches m\n                    JOIN ts_teams th ON th.external_id = m.home_team_id\n                    JOIN ts_teams ta ON ta.external_id = m.away_team_id\n                    WHERE \n                        (m.home_team_id = $1 OR m.away_team_id = $1)\n                        AND m.status_id IN (1, 2, 3, 4, 5, 7, 8) -- Include Pending (1) and Finished (8)\n                    ORDER BY \n                        CASE -- Priority: Live > Pending > Finished\n                            WHEN m.status_id IN (2, 3, 4, 5, 7) THEN 0 \n                            WHEN m.status_id = 1 THEN 1\n                            ELSE 2 \n                        END,\n                        m.match_time ASC -- Pick nearest match (crucial for pending)\n                    LIMIT 5\n                ";
                        return [4 /*yield*/, client.query(matchQuery, [homeMatch.teamId])];
                    case 4:
                        matchResult = _d.sent();
                        if (!(matchResult.rows.length > 0)) return [3 /*break*/, 7];
                        if (!(matchResult.rows.length === 1)) return [3 /*break*/, 6];
                        m_1 = matchResult.rows[0];
                        isHome_1 = m_1.home_team_id === homeMatch.teamId;
                        return [4 /*yield*/, this.findTeamByAlias(awayTeamName)];
                    case 5:
                        awayTeamMatch = _d.sent();
                        awayConfidence = awayTeamMatch ? awayTeamMatch.confidence : 0.5;
                        logger_1.logger.info("[TeamMatcher] Match found via home team: ".concat(m_1.home_team_name, " vs ").concat(m_1.away_team_name));
                        return [2 /*return*/, {
                                matchExternalId: m_1.external_id,
                                matchUuid: m_1.match_uuid,
                                homeTeam: isHome_1 ? homeMatch : {
                                    teamId: m_1.home_team_id,
                                    teamName: m_1.home_team_name,
                                    shortName: m_1.home_short_name,
                                    confidence: awayConfidence,
                                    matchMethod: 'partial'
                                },
                                awayTeam: !isHome_1 ? homeMatch : {
                                    teamId: m_1.away_team_id,
                                    teamName: m_1.away_team_name,
                                    shortName: m_1.away_short_name,
                                    confidence: awayConfidence,
                                    matchMethod: 'partial'
                                },
                                overallConfidence: (homeMatch.confidence + awayConfidence) / 2,
                                matchTime: m_1.match_time,
                                statusId: m_1.status_id
                            }];
                    case 6:
                        // Multiple matches - check away team name similarity
                        for (_i = 0, _a = matchResult.rows; _i < _a.length; _i++) {
                            m_2 = _a[_i];
                            isHome_2 = m_2.home_team_id === homeMatch.teamId;
                            opponentName = isHome_2 ? m_2.away_team_name : m_2.home_team_name;
                            similarity = this.calculateSimilarity(this.normalizeTeamName(awayTeamName), this.normalizeTeamName(opponentName));
                            if (similarity >= 0.6) {
                                logger_1.logger.info("[TeamMatcher] Match found with away team similarity (".concat(similarity * 100, "%): ").concat(m_2.home_team_name, " vs ").concat(m_2.away_team_name));
                                return [2 /*return*/, {
                                        matchExternalId: m_2.external_id,
                                        matchUuid: m_2.match_uuid,
                                        homeTeam: isHome_2 ? homeMatch : {
                                            teamId: m_2.home_team_id,
                                            teamName: m_2.home_team_name,
                                            shortName: m_2.home_short_name,
                                            confidence: similarity,
                                            matchMethod: 'fuzzy'
                                        },
                                        awayTeam: !isHome_2 ? homeMatch : {
                                            teamId: m_2.away_team_id,
                                            teamName: m_2.away_team_name,
                                            shortName: m_2.away_short_name,
                                            confidence: similarity,
                                            matchMethod: 'fuzzy'
                                        },
                                        overallConfidence: (homeMatch.confidence + similarity) / 2,
                                        matchTime: m_2.match_time,
                                        statusId: m_2.status_id
                                    }];
                            }
                        }
                        m = matchResult.rows[0];
                        isHome = m.home_team_id === homeMatch.teamId;
                        logger_1.logger.info("[TeamMatcher] Using first match (away team not matched): ".concat(m.home_team_name, " vs ").concat(m.away_team_name));
                        return [2 /*return*/, {
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
                            }];
                    case 7: return [4 /*yield*/, this.findTeamByAlias(awayTeamName, leagueHint)];
                    case 8:
                        awayMatch = _d.sent();
                        if (!(awayMatch && awayMatch.confidence >= 0.6)) return [3 /*break*/, 10];
                        logger_1.logger.info("[TeamMatcher] Away team matched (".concat(awayMatch.confidence * 100, "%): \"").concat(awayTeamName, "\" \u2192 \"").concat(awayMatch.teamName, "\""));
                        matchQuery = "\n                    SELECT \n                        m.id as match_uuid,\n                        m.external_id,\n                        m.home_team_id,\n                        m.away_team_id,\n                        m.match_time,\n                        m.status_id,\n                        th.name as home_team_name,\n                        ta.name as away_team_name,\n                        th.short_name as home_short_name,\n                        ta.short_name as away_short_name\n                    FROM ts_matches m\n                    JOIN ts_teams th ON th.external_id = m.home_team_id\n                    JOIN ts_teams ta ON ta.external_id = m.away_team_id\n                    WHERE \n                        (m.home_team_id = $1 OR m.away_team_id = $1)\n                        AND m.status_id IN (1, 2, 3, 4, 5, 7, 8) -- Include Pending and Finished\n                    ORDER BY \n                        CASE \n                            WHEN m.status_id IN (2, 3, 4, 5, 7) THEN 0\n                            WHEN m.status_id = 1 THEN 1\n                            ELSE 2 \n                        END,\n                        m.match_time ASC\n                    LIMIT 5\n                ";
                        return [4 /*yield*/, client.query(matchQuery, [awayMatch.teamId])];
                    case 9:
                        matchResult = _d.sent();
                        if (matchResult.rows.length > 0) {
                            // If only one match, use it directly
                            if (matchResult.rows.length === 1) {
                                m_3 = matchResult.rows[0];
                                isAway_1 = m_3.away_team_id === awayMatch.teamId;
                                logger_1.logger.info("[TeamMatcher] Match found via away team: ".concat(m_3.home_team_name, " vs ").concat(m_3.away_team_name));
                                return [2 /*return*/, {
                                        matchExternalId: m_3.external_id,
                                        matchUuid: m_3.match_uuid,
                                        homeTeam: isAway_1 ? {
                                            teamId: m_3.home_team_id,
                                            teamName: m_3.home_team_name,
                                            shortName: m_3.home_short_name,
                                            confidence: 0.5,
                                            matchMethod: 'partial'
                                        } : awayMatch,
                                        awayTeam: isAway_1 ? awayMatch : {
                                            teamId: m_3.away_team_id,
                                            teamName: m_3.away_team_name,
                                            shortName: m_3.away_short_name,
                                            confidence: 0.5,
                                            matchMethod: 'partial'
                                        },
                                        overallConfidence: awayMatch.confidence * 0.8,
                                        matchTime: m_3.match_time,
                                        statusId: m_3.status_id
                                    }];
                            }
                            // Multiple matches - check home team name similarity
                            for (_b = 0, _c = matchResult.rows; _b < _c.length; _b++) {
                                m_4 = _c[_b];
                                isAway_2 = m_4.away_team_id === awayMatch.teamId;
                                opponentName = isAway_2 ? m_4.home_team_name : m_4.away_team_name;
                                similarity = this.calculateSimilarity(this.normalizeTeamName(homeTeamName), this.normalizeTeamName(opponentName));
                                if (similarity >= 0.6) {
                                    logger_1.logger.info("[TeamMatcher] Match found with home team similarity (".concat(similarity * 100, "%): ").concat(m_4.home_team_name, " vs ").concat(m_4.away_team_name));
                                    return [2 /*return*/, {
                                            matchExternalId: m_4.external_id,
                                            matchUuid: m_4.match_uuid,
                                            homeTeam: isAway_2 ? {
                                                teamId: m_4.home_team_id,
                                                teamName: m_4.home_team_name,
                                                shortName: m_4.home_short_name,
                                                confidence: similarity,
                                                matchMethod: 'fuzzy'
                                            } : awayMatch,
                                            awayTeam: isAway_2 ? awayMatch : {
                                                teamId: m_4.away_team_id,
                                                teamName: m_4.away_team_name,
                                                shortName: m_4.away_short_name,
                                                confidence: similarity,
                                                matchMethod: 'fuzzy'
                                            },
                                            overallConfidence: (awayMatch.confidence + similarity) / 2,
                                            matchTime: m_4.match_time,
                                            statusId: m_4.status_id
                                        }];
                                }
                            }
                            m = matchResult.rows[0];
                            isAway = m.away_team_id === awayMatch.teamId;
                            logger_1.logger.info("[TeamMatcher] Using first match (home team not matched): ".concat(m.home_team_name, " vs ").concat(m.away_team_name));
                            return [2 /*return*/, {
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
                                }];
                        }
                        _d.label = 10;
                    case 10:
                        logger_1.logger.warn("[TeamMatcher] No match found for: \"".concat(homeTeamName, "\" vs \"").concat(awayTeamName, "\""));
                        return [2 /*return*/, null];
                    case 11:
                        client.release();
                        return [7 /*endfinally*/];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    return TeamNameMatcherService;
}());
exports.TeamNameMatcherService = TeamNameMatcherService;
exports.teamNameMatcherService = new TeamNameMatcherService();
