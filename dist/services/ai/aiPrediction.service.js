"use strict";
/**
 * AI Prediction Service
 *
 * Handles ingestion and processing of AI predictions from external sources.
 * This runs on the VPS backend (Digital Ocean) - NOT on Vercel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiPredictionService = exports.AIPredictionService = void 0;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const teamNameMatcher_service_1 = require("./teamNameMatcher.service");
const predictionSettlement_service_1 = require("./predictionSettlement.service");
const PredictionOrchestrator_1 = require("../orchestration/PredictionOrchestrator");
class AIPredictionService {
    /**
     * Get statistics for all bots
     * REFACTORED: Uses new 29-column schema with direct match_id link
     * - Uses p.canonical_bot_name instead of p.bot_name
     * - Uses p.result field (already settled by predictionSettlement.service)
     * - Uses p.match_id directly joined to ts_matches.id
     * - No more ai_prediction_matches junction table
     */
    async getBotPerformanceStats() {
        try {
            // Get stats grouped by canonical_bot_name using the new schema
            // The result field is already populated by predictionSettlement.service
            const result = await connection_1.pool.query(`
                SELECT
                    p.canonical_bot_name as bot_name,
                    COUNT(*) as total_predictions,
                    SUM(CASE WHEN p.result = 'won' THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN p.result = 'lost' THEN 1 ELSE 0 END) as losses,
                    SUM(CASE WHEN p.result = 'pending' OR p.result IS NULL THEN 1 ELSE 0 END) as pending
                FROM ai_predictions p
                GROUP BY p.canonical_bot_name
            `);
            // Normalization Map
            const nameMap = {
                'ALERT: D': 'Alert D',
                'ALERT D': 'Alert D',
                'CODE: 35': 'Code 35',
                'Algoritma: 01': 'Algoritma 01',
                'Alert System': 'Alert System'
            };
            const rawBots = result.rows.map(row => {
                const wins = parseInt(row.wins);
                const losses = parseInt(row.losses);
                const total = parseInt(row.total_predictions);
                const pending = parseInt(row.pending);
                const totalFinished = wins + losses;
                const originalName = row.bot_name || 'Unknown';
                const displayName = nameMap[originalName] || originalName;
                return {
                    bot_name: displayName,
                    total_predictions: total,
                    wins: wins,
                    losses: losses,
                    pending: pending,
                    win_rate: totalFinished > 0 ? parseFloat(((wins / totalFinished) * 100).toFixed(1)) : 0
                };
            });
            // Merge stats by normalized name
            const mergedStats = {};
            for (const bot of rawBots) {
                if (!mergedStats[bot.bot_name]) {
                    mergedStats[bot.bot_name] = { ...bot };
                }
                else {
                    const existing = mergedStats[bot.bot_name];
                    const newTotalFinished = (existing.wins + bot.wins) + (existing.losses + bot.losses);
                    existing.total_predictions += bot.total_predictions;
                    existing.wins += bot.wins;
                    existing.losses += bot.losses;
                    existing.pending += bot.pending;
                    existing.win_rate = newTotalFinished > 0
                        ? parseFloat((((existing.wins) / newTotalFinished) * 100).toFixed(1))
                        : 0;
                }
            }
            const botStats = Object.values(mergedStats);
            // Calculate global stats
            const globalTotal = botStats.reduce((sum, b) => sum + b.total_predictions, 0);
            const globalWins = botStats.reduce((sum, b) => sum + b.wins, 0);
            const globalLosses = botStats.reduce((sum, b) => sum + b.losses, 0);
            const globalPending = botStats.reduce((sum, b) => sum + b.pending, 0);
            const globalFinished = globalWins + globalLosses;
            const globalStats = {
                bot_name: 'GLOBAL',
                total_predictions: globalTotal,
                wins: globalWins,
                losses: globalLosses,
                pending: globalPending,
                win_rate: globalFinished > 0 ? parseFloat(((globalWins / globalFinished) * 100).toFixed(1)) : 0
            };
            return {
                global: globalStats,
                bots: botStats
            };
        }
        catch (error) {
            logger_1.logger.error('[AIPrediction] Error calculating bot stats:', error);
            return {
                global: { bot_name: 'GLOBAL', total_predictions: 0, wins: 0, losses: 0, pending: 0, win_rate: 0 },
                bots: []
            };
        }
    }
    /**
     * Get all bot rules for admin display
     */
    async getAllBotRules() {
        const result = await connection_1.pool.query(`
            SELECT 
                id, bot_group_id, bot_display_name, minute_from, minute_to, 
                priority, is_active, created_at, prediction_type_pattern
            FROM ai_bot_rules
            ORDER BY priority DESC
        `);
        return result.rows;
    }
    /**
     * Decode Base64 prediction payload and URL-decode the content
     */
    decodePayload(base64String) {
        try {
            // First decode Base64
            const base64Decoded = Buffer.from(base64String, 'base64').toString('utf-8');
            // Then try to URL-decode (handles emoji characters like %E2%9A%BD -> ⚽)
            try {
                return decodeURIComponent(base64Decoded);
            }
            catch {
                // If URL decode fails, return the base64-decoded string as-is
                return base64Decoded;
            }
        }
        catch (error) {
            logger_1.logger.error('[AIPrediction] Failed to decode Base64 payload:', error);
            return base64String; // Return as-is if not valid base64
        }
    }
    /**
     * Get bot group for a prediction based on minute
     * Uses rules from ai_bot_rules table, sorted by priority (higher = more specific)
     */
    async getBotGroupForMinute(minute) {
        try {
            const result = await connection_1.pool.query(`
                SELECT id, bot_group_id, bot_display_name, minute_from, minute_to, priority, display_template, prediction_period, base_prediction_type
                FROM ai_bot_rules
                WHERE is_active = true
                  AND bot_display_name != 'Alert System'  -- CRITICAL FIX: Alert System is only for manual predictions, not external ones
                ORDER BY priority DESC
            `);
            for (const rule of result.rows) {
                const minFrom = rule.minute_from ?? 0;
                const minTo = rule.minute_to ?? 999;
                if (minute >= minFrom && minute <= minTo) {
                    return {
                        botGroupId: rule.bot_group_id || null,
                        botDisplayName: rule.bot_display_name,
                        displayTemplate: rule.display_template,
                        predictionPeriod: rule.prediction_period,
                        basePredictionType: rule.base_prediction_type
                    };
                }
            }
            // Default fallback: Create dynamic bot name based on minute
            const dynamicBotName = `BOT ${minute}`;
            logger_1.logger.info(`[AIPrediction] No specific bot rule found for minute ${minute}, using dynamic: ${dynamicBotName}`);
            return {
                botGroupId: null,
                botDisplayName: dynamicBotName,
                displayTemplate: `🤖 {period} {value} ÜST ({minute}'' dk)`,
                predictionPeriod: 'AUTO',
                basePredictionType: 'ÜST'
            };
        }
        catch (error) {
            logger_1.logger.warn('[AIPrediction] Failed to get bot group, using dynamic fallback:', error);
            // Fallback with dynamic name even on error
            const dynamicBotName = `BOT ${minute}`;
            return {
                botGroupId: null,
                botDisplayName: dynamicBotName,
                displayTemplate: `🤖 {period} {value} ÜST ({minute}'' dk)`,
                predictionPeriod: 'AUTO',
                basePredictionType: 'ÜST'
            };
        }
    }
    /**
     * Calculate prediction value based on current total goals
     * For ÜST (OVER) predictions:
     * - 0 goals → 0.5 ÜST
     * - 1 goal → 1.5 ÜST
     * - 2 goals → 2.5 ÜST
     * - etc.
     */
    calculatePredictionValue(totalGoals) {
        return `${totalGoals + 0.5}`;
    }
    /**
     * Determine period based on minute (SABIT KURAL)
     * 1-45' → IY (first half) - SABIT
     * 46-90' → MS (full match) - SABIT
     * Bot rule'daki period değeri IGNORE edilir, sadece dakikaya göre belirlenir
     */
    determinePeriod(minute, botPeriod) {
        // KRITIK: Dakikaya göre SABIT belirleme
        // Bot rule'daki period değeri kullanılmaz
        return minute <= 45 ? 'IY' : 'MS';
    }
    /**
     * Generate prediction details from score
     * REFACTORED: Now returns prediction (unified) and predictionThreshold (numeric) for new schema
     */
    generatePredictionFromScore(score, // e.g., "0-0", "1-0"
    minute, botRule) {
        // Parse score
        const [homeStr, awayStr] = score.split('-').map(s => s.trim());
        const homeGoals = parseInt(homeStr) || 0;
        const awayGoals = parseInt(awayStr) || 0;
        const totalGoals = homeGoals + awayGoals;
        // Determine period and prediction value
        const period = this.determinePeriod(minute, botRule.predictionPeriod);
        const thresholdNumeric = totalGoals + 0.5; // e.g., 0.5, 1.5, 2.5
        const bareValue = thresholdNumeric.toString();
        const baseType = botRule.basePredictionType || 'ÜST';
        // Format: "MS 0.5 ÜST" (Period + Value + Type) - this is the unified prediction
        const predictionValue = `${period} ${bareValue} ${baseType}`;
        // Type: "MS" (Period) - keeps it clean for aggregation
        const predictionType = period;
        // Build display text from template or default
        let displayPrediction;
        if (botRule.displayTemplate) {
            displayPrediction = botRule.displayTemplate
                .replace('{period}', period)
                .replace('{value}', bareValue)
                .replace('{minute}', minute.toString());
        }
        else {
            displayPrediction = `🤖 ${predictionValue} (${minute}' dk)`;
        }
        return {
            predictionType: predictionType,
            predictionValue: predictionValue,
            displayPrediction,
            // NEW SCHEMA FIELDS
            prediction: predictionValue, // Unified field "MS 0.5 ÜST"
            predictionThreshold: thresholdNumeric // Numeric 0.5, 1.5, 2.5
        };
    }
    /**
     * Check if a goal event triggers instant win for a prediction
     * Returns true if prediction is instantly won
     */
    checkInstantWin(predictionType, predictionValue, newTotalGoals, minute, statusId, htHome, // Optional HT scores for retroactive IY settlement
    htAway) {
        // KRITIK: prediction_value'den sadece sayısal değeri çıkar
        // Örnek: "IY 0.5 ÜST" -> "0.5", "0.5" -> "0.5", "MS 2.5 ÜST" -> "2.5"
        const numericMatch = predictionValue.match(/([\d.]+)/);
        const value = numericMatch ? parseFloat(numericMatch[1]) : parseFloat(predictionValue);
        if (isNaN(value)) {
            logger_1.logger.warn(`[AIPrediction] Invalid prediction_value: ${predictionValue}, cannot parse numeric value`);
            return { isInstantWin: false, reason: `Invalid prediction value: ${predictionValue}` };
        }
        const isOver = predictionType.toUpperCase().includes('ÜST');
        const isUnder = predictionType.toUpperCase().includes('ALT');
        const isIY = predictionType.toUpperCase().includes('IY');
        // IY Period Check:
        // Use statusId if available (Status 2/3 = First Half).
        // Fallback to minute if not available, allowing up to 60' for injury time safety.
        if (isIY) {
            let isIYValid = true;
            if (statusId !== undefined) {
                // Status 2 (1H) or 3 (HT) -> Valid IY
                // Status 4+ -> Invalid IY (normally), BUT check if we have HT score
                const isFirstHalf = statusId === 2 || statusId === 3;
                if (!isFirstHalf) {
                    // CRITICAL FIX: If period ended (Status 4+), allow settlement IF we verify the win using HT score
                    logger_1.logger.info(`[AIPrediction] IY Check - Post HT. Status: ${statusId}, HT: ${htHome}-${htAway}, Over: ${isOver}, Val: ${value}`);
                    if (htHome !== undefined && htAway !== undefined) {
                        const htTotal = htHome + htAway;
                        // If OVER bet and HT Total > Line -> It's a WIN (Retroactive)
                        if (isOver && htTotal > value) {
                            logger_1.logger.info(`[AIPrediction] IY Retroactive WIN logic met: ${htTotal} > ${value}`);
                            return { isInstantWin: true, reason: `Retroactive HT Win: ${htTotal} > ${value}` };
                        }
                        // If UNDER bet? Usually dealt with at end, but if we are at Status 4+, IY is definitely over.
                        // If HT Total <= Line -> It's a WIN
                        if (isUnder && htTotal <= value) {
                            return { isInstantWin: true, reason: `Retroactive HT Win: ${htTotal} <= ${value}` };
                        }
                    }
                    isIYValid = false;
                }
            }
            else {
                // Fallback
                if (minute > 60)
                    isIYValid = false;
            }
            if (!isIYValid) {
                return { isInstantWin: false, reason: 'IY period ended' };
            }
        }
        // OVER (ÜST) - instant win when total goals exceed value
        if (isOver && newTotalGoals > value) {
            return { isInstantWin: true, reason: `Gol! Toplam ${newTotalGoals} > ${value}` };
        }
        // UNDER (ALT) - instant lose when total goals exceed value
        if (isUnder && newTotalGoals > value) {
            return { isInstantWin: false, reason: `Gol! Toplam ${newTotalGoals} > ${value} - Kaybetti` };
        }
        return { isInstantWin: false, reason: 'Henüz sonuçlanmadı' };
    }
    /**
     * Parse multi-line prediction format (emoji-based or simple)
     *
     * Format 1 (Emoji-based):
     *   00084⚽ *Sunderland A.F.C - Manchester City  ( 0 - 0 )*
     *   🏟 English Premier League
     *   ⏰ 10
     *   ❗ IY Gol
     *   👉 AlertCode: IY-1 Ev: 18.5 Dep: 6.2
     *
     * Format 2 (Simple):
     *   00053*Denbigh Town - Gresford Athletic ( 1 - 2 )*
     *   Wales Championship North
     *   Minute: 65 SonGol dk: 51
     *   *3.5 ÜST*
     */
    parseMultiLineFormat(content, externalId) {
        try {
            // Split by newlines (handle both \r\n and \n)
            const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length < 2) {
                return null;
            }
            let homeTeam = '';
            let awayTeam = '';
            let score = '0-0';
            let minute = 0;
            let league = '';
            let predictionType = '';
            let predictionValue = '';
            // Parse first line: Teams and score
            // Format: "00084⚽ *Sunderland A.F.C - Manchester City  ( 0 - 0 )*"
            // Or: "00053*Denbigh Town - Gresford Athletic ( 1 - 2 )*"
            const firstLine = lines[0];
            // Extract teams and score from first line
            // Match pattern: *TeamA - TeamB ( H - A )*
            // CRITICAL FIX: Use ' - ' (space-hyphen-space) as separator to avoid splitting team names with hyphens
            // Old regex: /\*([^*]+?)\s*-\s*([^*]+?)\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)\s*\*/
            // Problem: Lazy quantifier splits "Al-Shabab(KUW)" into "Al" + "Shabab(KUW)"
            // New regex: Split on ' - ' (with mandatory spaces) and use score parenthesis as anchor
            const teamsScoreMatch = firstLine.match(/\*(.+?)\s+-\s+([^(]+)\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)\s*\*/);
            if (teamsScoreMatch) {
                homeTeam = teamsScoreMatch[1].trim();
                awayTeam = teamsScoreMatch[2].trim();
                score = `${teamsScoreMatch[3]}-${teamsScoreMatch[4]}`;
            }
            else {
                // Try simpler pattern: TeamA - TeamB (using space-hyphen-space separator)
                // CRITICAL FIX: Also use ' - ' here instead of just '-'
                const simpleTeamsMatch = firstLine.match(/\*?(.+?)\s+-\s+([^*(]+)/i);
                if (simpleTeamsMatch) {
                    homeTeam = simpleTeamsMatch[1].trim().replace(/^[\d⚽🏟]+/, '').trim();
                    awayTeam = simpleTeamsMatch[2].trim();
                }
            }
            // Parse remaining lines
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                // League line (🏟 or second line without special prefix)
                if (line.startsWith('🏟') || (i === 1 && !line.startsWith('⏰') && !line.startsWith('❗') && !line.startsWith('Minute'))) {
                    league = line.replace(/^🏟\s*/, '').trim();
                }
                // Minute line: "⏰ 10" or "Minute: 65 SonGol dk: 51"
                else if (line.startsWith('⏰') || line.toLowerCase().startsWith('minute')) {
                    const minuteMatch = line.match(/(\d+)/);
                    if (minuteMatch) {
                        minute = parseInt(minuteMatch[1], 10);
                    }
                }
                // Prediction type line: "❗ IY Gol"
                else if (line.startsWith('❗')) {
                    predictionType = line.replace(/^❗\s*/, '').trim();
                    predictionValue = predictionType;
                }
                // Prediction value line: "*3.5 ÜST*" or "*2.5 ALT*"
                else if (line.match(/^\*[\d.]+\s*(ÜST|ALT|OVER|UNDER)\*$/i)) {
                    predictionValue = line.replace(/^\*|\*$/g, '').trim();
                    predictionType = predictionValue;
                }
                // AlertCode line (extract additional info if needed)
                else if (line.startsWith('👉') || line.toLowerCase().includes('alertcode')) {
                    // Extract AlertCode value if prediction type not set
                    if (!predictionType) {
                        const alertMatch = line.match(/AlertCode:\s*([\w-]+)/i);
                        if (alertMatch) {
                            predictionType = alertMatch[1];
                        }
                    }
                }
            }
            // Validate we got minimum required fields
            if (!homeTeam || !awayTeam) {
                logger_1.logger.debug('[AIPrediction] Multi-line parse: No teams found');
                return null;
            }
            logger_1.logger.info(`[AIPrediction] Multi-line parsed: ${homeTeam} vs ${awayTeam} | Score: ${score} | Min: ${minute} | League: ${league} | Type: ${predictionType}`);
            return {
                externalId: externalId || `pred_${Date.now()}`,
                botName: 'external',
                leagueName: league,
                homeTeamName: homeTeam,
                awayTeamName: awayTeam,
                scoreAtPrediction: score,
                minuteAtPrediction: minute,
                predictionType: predictionType,
                predictionValue: predictionValue,
                rawPayload: content
            };
        }
        catch (error) {
            logger_1.logger.error('[AIPrediction] Error in multi-line parser:', error);
            return null;
        }
    }
    /**
     * Parse prediction content from decoded string
     * Tries multiple formats in order:
     * 1. Multi-line format (emoji-based or simple) - NEW
     * 2. JSON object
     * 3. Pipe-delimited format
     * 4. Simple team format
     */
    parsePredictionContent(content, externalId) {
        try {
            // Try multi-line format first (most common from external systems)
            const multiLineResult = this.parseMultiLineFormat(content, externalId);
            if (multiLineResult) {
                return multiLineResult;
            }
            // Try JSON parse
            try {
                const json = JSON.parse(content);
                if (json.home_team || json.homeTeam) {
                    return {
                        externalId: externalId || json.id || `pred_${Date.now()}`,
                        botName: json.bot_name || json.botName || 'unknown',
                        leagueName: json.league || json.leagueName || '',
                        homeTeamName: json.home_team || json.homeTeam || '',
                        awayTeamName: json.away_team || json.awayTeam || '',
                        scoreAtPrediction: json.score || '0-0',
                        minuteAtPrediction: parseInt(String(json.minute || '0').replace(/[^\d]/g, '')) || 0,
                        predictionType: json.prediction_type || json.predictionType || '',
                        predictionValue: json.prediction_value || json.predictionValue || json.prediction || '',
                        rawPayload: content
                    };
                }
            }
            catch {
                // Not JSON, continue to other formats
            }
            // Try pipe-delimited format: "Teams | Score | Minute | League | Prediction"
            const parts = content.split('|').map(p => p.trim());
            if (parts.length >= 3) {
                // Parse teams (usually "Home - Away" or "Home vs Away")
                const teamsPart = parts[0];
                const teamsSplit = teamsPart.split(/\s*[-vs]+\s*/i);
                const homeTeam = teamsSplit[0]?.trim() || '';
                const awayTeam = teamsSplit[1]?.trim() || '';
                return {
                    externalId: externalId || `pred_${Date.now()}`,
                    botName: 'external',
                    leagueName: parts[3] || '',
                    homeTeamName: homeTeam,
                    awayTeamName: awayTeam,
                    scoreAtPrediction: parts[1] || '0-0',
                    minuteAtPrediction: parseInt(String(parts[2] || '0').replace(/[^\d]/g, '')) || 0,
                    predictionType: parts[4] || '',
                    predictionValue: parts[4] || '',
                    rawPayload: content
                };
            }
            // Try simple team format: "Home - Away"
            const simpleMatch = content.match(/^(.+?)\s*[-vs]+\s*(.+?)$/i);
            if (simpleMatch) {
                return {
                    externalId: externalId || `pred_${Date.now()}`,
                    botName: 'external',
                    leagueName: '',
                    homeTeamName: simpleMatch[1].trim(),
                    awayTeamName: simpleMatch[2].trim(),
                    scoreAtPrediction: '0-0',
                    minuteAtPrediction: 0,
                    predictionType: '',
                    predictionValue: '',
                    rawPayload: content
                };
            }
            logger_1.logger.warn('[AIPrediction] Could not parse prediction content:', content.substring(0, 200));
            return null;
        }
        catch (error) {
            logger_1.logger.error('[AIPrediction] Error parsing prediction:', error);
            return null;
        }
    }
    /**
     * Ingest a new prediction
     */
    async ingestPrediction(payload) {
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            // Decode if base64
            let decodedContent = '';
            if (payload.prediction) {
                decodedContent = this.decodePayload(payload.prediction);
            }
            // Parse the content
            let parsed = null;
            if (decodedContent) {
                parsed = this.parsePredictionContent(decodedContent, payload.id || '');
            }
            else if (payload.home_team && payload.away_team) {
                // Direct fields provided
                parsed = {
                    externalId: payload.id || `pred_${Date.now()}`,
                    botName: payload.bot_name || 'external',
                    leagueName: payload.league || '',
                    homeTeamName: payload.home_team,
                    awayTeamName: payload.away_team,
                    scoreAtPrediction: payload.score || '0-0',
                    minuteAtPrediction: parseInt(String(payload.minute || '0').replace(/[^\d]/g, '')) || 0,
                    predictionType: payload.prediction_type || '',
                    predictionValue: payload.prediction_value || '',
                    rawPayload: JSON.stringify(payload)
                };
            }
            if (!parsed || !parsed.homeTeamName || !parsed.awayTeamName) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    matchFound: false,
                    error: 'Could not parse prediction payload'
                };
            }
            // Try to match with TheSports data FIRST
            // CRITICAL: Pass league hint for better matching (e.g., Myanmar Professional League)
            let matchResult = null;
            try {
                matchResult = await teamNameMatcher_service_1.teamNameMatcherService.findMatchByTeams(parsed.homeTeamName, parsed.awayTeamName, parsed.minuteAtPrediction, parsed.scoreAtPrediction, parsed.leagueName // League hint for better matching
                );
            }
            catch (matchError) {
                logger_1.logger.warn('[AIPrediction] Team matching failed:', matchError);
            }
            // Determine bot group based on minute
            const botGroup = await this.getBotGroupForMinute(parsed.minuteAtPrediction);
            // KRITIK: Period sadece dakikaya göre belirlenir (SABIT KURAL)
            // 1-45. dakika → IY (İlk Yarı)
            // 46-90. dakika → MS (Maç Sonu)
            // Bot rule'daki period veya match status IGNORE edilir
            const effectivePeriod = parsed.minuteAtPrediction <= 45 ? 'IY' : 'MS';
            // Generate prediction details based on SCORE + 0.5 logic
            const generatedDetails = this.generatePredictionFromScore(parsed.scoreAtPrediction, parsed.minuteAtPrediction, {
                ...botGroup,
                predictionPeriod: effectivePeriod // Dakikaya göre sabit belirlenen period
            });
            logger_1.logger.info(`[AIPrediction] Assigned to bot: ${botGroup.botDisplayName} (minute: ${parsed.minuteAtPrediction})`);
            logger_1.logger.info(`[AIPrediction] Generated details: ${JSON.stringify(generatedDetails)}`);
            // PHASE 2: Use PredictionOrchestrator for event-driven insert
            const createData = {
                external_id: parsed.externalId,
                canonical_bot_name: botGroup.botDisplayName,
                league_name: parsed.leagueName,
                home_team_name: parsed.homeTeamName,
                away_team_name: parsed.awayTeamName,
                score_at_prediction: parsed.scoreAtPrediction,
                minute_at_prediction: parsed.minuteAtPrediction,
                prediction: generatedDetails.prediction,
                prediction_threshold: generatedDetails.predictionThreshold,
                match_id: null, // Will be set below if matched
                match_time: null,
                match_status: 1,
                access_type: 'FREE',
                source: 'external',
            };
            const orchestrator = PredictionOrchestrator_1.PredictionOrchestrator.getInstance();
            const createResult = await orchestrator.createPrediction(createData);
            if (createResult.status === 'duplicate') {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    matchFound: false,
                    error: 'Duplicate prediction',
                    predictionId: createResult.predictionId,
                };
            }
            if (createResult.status === 'error') {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    matchFound: false,
                    error: createResult.reason || 'Failed to create prediction',
                };
            }
            const predictionId = createResult.predictionId;
            logger_1.logger.info(`[AIPrediction] Created prediction ${predictionId}: ${parsed.homeTeamName} vs ${parsed.awayTeamName}`);
            // PHASE 2: If matched, use orchestrator to update match_id
            if (matchResult && matchResult.overallConfidence >= 0.6) {
                const updateResult = await orchestrator.updatePrediction(predictionId, {
                    match_id: matchResult.matchExternalId,
                    match_status: matchResult.statusId || 1,
                });
                if (updateResult.status === 'success') {
                    logger_1.logger.info(`[AIPrediction] Linked to match ${matchResult.matchExternalId} (confidence: ${matchResult.overallConfidence.toFixed(2)})`);
                    await client.query('COMMIT');
                    return {
                        success: true,
                        predictionId,
                        matchFound: true,
                        matchExternalId: matchResult.matchExternalId,
                        matchId: matchResult.matchExternalId,
                        confidence: matchResult.overallConfidence
                    };
                }
                else {
                    logger_1.logger.warn(`[AIPrediction] Failed to link prediction ${predictionId} to match`);
                }
            }
            // No match found or low confidence
            await client.query('COMMIT');
            return {
                success: true,
                predictionId,
                matchFound: false,
                error: matchResult
                    ? `Low confidence match: ${matchResult.overallConfidence.toFixed(2)}`
                    : 'No matching match found in database'
            };
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger_1.logger.error('[AIPrediction] Ingestion error:', error);
            return {
                success: false,
                matchFound: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Get pending predictions (not yet matched)
     */
    async getPendingPredictions(limit = 50) {
        const query = `
      SELECT * FROM ai_predictions 
      WHERE processed = false 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
        const result = await connection_1.pool.query(query, [limit]);
        return result.rows;
    }
    /**
     * Get matched predictions with results (enhanced with match/team/league data)
     * REFACTORED: Uses direct p.match_id join instead of junction table
     */
    async getMatchedPredictions(limit = 50) {
        const query = `
            SELECT
                p.id,
                p.external_id,
                p.canonical_bot_name as bot_name,
                p.league_name,
                p.home_team_name,
                p.away_team_name,
                p.score_at_prediction,
                p.minute_at_prediction,
                p.prediction,
                p.prediction_threshold,
                p.match_id,
                p.result,
                p.final_score,
                p.result_reason,
                p.access_type,
                p.source,
                p.created_at,
                -- Backward compatibility aliases
                m.external_id as match_external_id,
                80 as overall_confidence,
                CASE
                    WHEN p.result = 'won' THEN 'winner'
                    WHEN p.result = 'lost' THEN 'loser'
                    ELSE p.result
                END as prediction_result,
                -- Match data
                m.match_time,
                m.status_id as match_status_id,
                m.minute as match_minute,
                -- Frontend compatibility aliases (PredictionCard expects these field names)
                m.status_id as live_match_status,
                m.minute as live_match_minute,
                -- CRITICAL FIX (2026-01-17): Parse from JSONB array if home_score_display is NULL
                COALESCE(m.home_score_display, (m.home_scores->>0)::INTEGER) as home_score_display,
                COALESCE(m.away_score_display, (m.away_scores->>0)::INTEGER) as away_score_display,
                -- Frontend expects home_score/away_score aliases
                COALESCE(m.home_score_display, (m.home_scores->>0)::INTEGER) as home_score,
                COALESCE(m.away_score_display, (m.away_scores->>0)::INTEGER) as away_score,
                -- Team data
                ht.name as home_team_db_name,
                ht.logo_url as home_team_logo,
                at.name as away_team_db_name,
                at.logo_url as away_team_logo,
                -- Competition data
                c.name as competition_name,
                c.logo_url as competition_logo,
                -- Country data
                ctry.name as country_name,
                ctry.logo as country_logo
            FROM ai_predictions p
            LEFT JOIN ts_matches m ON p.match_id = m.external_id
            LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
            LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
            LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
            LEFT JOIN ts_countries ctry ON c.country_id = ctry.external_id
            WHERE p.match_id IS NOT NULL
            ORDER BY p.created_at DESC
            LIMIT $1
        `;
        const result = await connection_1.pool.query(query, [limit]);
        return result.rows;
    }
    /**
     * Get all predictions for a specific match (for match detail page)
     * Updated to use new 29-column schema with direct match_id link
     */
    async getPredictionsByMatchId(matchId) {
        const query = `
            SELECT
                p.id,
                p.external_id,
                p.canonical_bot_name as bot_name,
                p.league_name,
                p.home_team_name,
                p.away_team_name,
                p.score_at_prediction,
                p.minute_at_prediction,
                p.prediction,
                p.prediction as prediction_value,
                p.prediction as prediction_type,
                p.prediction_threshold,
                p.match_id,
                p.result,
                CASE
                    WHEN p.result = 'won' THEN 'winner'
                    WHEN p.result = 'lost' THEN 'loser'
                    ELSE p.result
                END as prediction_result,
                p.final_score,
                p.result_reason,
                p.access_type,
                p.source,
                p.created_at,
                80 as overall_confidence
            FROM ai_predictions p
            WHERE p.match_id = $1
            ORDER BY p.created_at DESC
        `;
        const result = await connection_1.pool.query(query, [matchId]);
        return result.rows;
    }
    /**
         * Get predictions by bot name (for bot detail page)
         * Uses flexible matching to handle name variations (e.g. ALERT: D vs Alert D)
         */
    async getPredictionsByBotName(botName, limit = 50) {
        let whereClause = 'p.bot_name = $1';
        let params = [botName];
        // Ensure limit is safe integer
        const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
        // Normalize specific bot names for fuzzy matching
        const normalized = botName.toLowerCase().trim();
        // Helper to switch to pattern matching mode (no params needed for name)
        const usePattern = (clause) => {
            whereClause = clause;
            params = []; // No parameters used in WHERE clause
        };
        if (normalized.includes('alert d')) {
            usePattern("(p.bot_name ILIKE '%Alert%D%' OR p.bot_name = 'ALERT: D')");
        }
        else if (normalized.includes('alert system')) {
            usePattern("p.bot_name ILIKE '%Alert System%'");
        }
        else if (normalized.includes('code 35') || normalized.includes('code: 35')) {
            usePattern("(p.bot_name ILIKE '%Code%35%' OR p.bot_name = 'CODE: 35')");
        }
        else if (normalized.includes('code zero')) {
            usePattern("p.bot_name ILIKE '%Code%Zero%'");
        }
        else if (normalized.includes('algoritma 01') || normalized.includes('algoritma: 01')) {
            usePattern("(p.bot_name ILIKE '%Algoritma%01%' OR p.bot_name = 'Algoritma: 01')");
        }
        // REFACTORED: Use new schema with direct match_id
        const query = `
            SELECT
                p.id,
                p.external_id,
                p.canonical_bot_name as bot_name,
                p.league_name as league_name_raw,
                p.home_team_name as home_team_name_raw,
                p.away_team_name as away_team_name_raw,
                p.score_at_prediction,
                p.minute_at_prediction,
                p.prediction,
                p.prediction_threshold,
                p.match_id,
                p.result,
                p.final_score,
                p.result_reason,
                p.access_type,
                p.source,
                p.created_at,
                -- Backward compatibility aliases
                m.external_id as match_external_id,
                80 as overall_confidence,
                CASE
                    WHEN p.result = 'won' THEN 'winner'
                    WHEN p.result = 'lost' THEN 'loser'
                    ELSE p.result
                END as prediction_result,
                -- Team/Competition data
                COALESCE(ht.name, p.home_team_name, 'Unknown Home') as home_team_name,
                COALESCE(at.name, p.away_team_name, 'Unknown Away') as away_team_name,
                COALESCE(c.name, p.league_name, 'Unknown League') as league_name
            FROM ai_predictions p
            LEFT JOIN ts_matches m ON p.match_id = m.external_id
            LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
            LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
            LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
            WHERE ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT ${safeLimit}
        `;
        const result = await connection_1.pool.query(query, params);
        return result.rows;
    }
    /**
     * Get available bot names with prediction counts
     */
    async getBotStats() {
        // Use CASE statement to normalize bot names for accurate aggregation
        const query = `
      SELECT 
        CASE
            WHEN p.bot_name ILIKE '%Alert%D%' OR p.bot_name = 'ALERT: D' THEN 'Alert D'
            WHEN p.bot_name ILIKE '%Alert System%' THEN 'Alert System'
            WHEN p.bot_name ILIKE '%Code%35%' OR p.bot_name = 'CODE: 35' THEN 'Code 35'
            WHEN p.bot_name ILIKE '%Code%Zero%' THEN 'Code Zero'
            WHEN p.bot_name ILIKE '%Algoritma%01%' OR p.bot_name = 'Algoritma: 01' THEN 'Algoritma 01'
            WHEN p.bot_name ILIKE '%BOT%007%' THEN 'BOT 007'
            WHEN p.bot_name ILIKE '%70%Dakika%' THEN '70. Dakika Botu'
            ELSE p.bot_name
        END as bot_name,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE p.processed = false) as pending,
        COUNT(*) FILTER (WHERE p.processed = true) as matched
      FROM ai_predictions p
      GROUP BY 1
      ORDER BY count DESC
    `;
        const result = await connection_1.pool.query(query);
        return result.rows;
    }
    /**
     * Update prediction results based on match outcome
     * REFACTORED: Uses new schema with direct match_id and p.result
     * NOTE: This is a fallback/cleanup method. Primary settlement is via predictionSettlement.service.ts
     */
    async updatePredictionResults() {
        const client = await connection_1.pool.connect();
        try {
            // Get matched predictions that haven't been resulted yet
            // Uses new schema: p.match_id directly links to ts_matches.id
            const pendingQuery = `
                SELECT
                    p.id as prediction_id,
                    p.match_id,
                    p.prediction,
                    p.prediction_threshold,
                    p.score_at_prediction,
                    p.minute_at_prediction,
                    m.external_id as match_external_id,
                    m.status_id,
                    m.home_score_display,
                    m.away_score_display,
                    m.home_scores,
                    m.away_scores
                FROM ai_predictions p
                JOIN ts_matches m ON p.match_id = m.external_id
                WHERE p.result = 'pending'
                  AND p.match_id IS NOT NULL
                  AND m.status_id >= 2
            `;
            const pending = await client.query(pendingQuery);
            let updatedCount = 0;
            for (const row of pending.rows) {
                // Determine Period based on minute_at_prediction (FIXED RULE)
                const period = (row.minute_at_prediction || 0) <= 45 ? 'IY' : 'MS';
                // Extract Scores - CRITICAL FIX: Parse from JSONB if home_score_display is NULL
                let finalHome = row.home_score_display;
                let finalAway = row.away_score_display;
                // Fallback to JSONB array if display score is NULL
                if (finalHome === null || finalHome === undefined) {
                    try {
                        const hScores = Array.isArray(row.home_scores) ? row.home_scores : JSON.parse(row.home_scores || '[]');
                        finalHome = hScores[0] !== undefined ? parseInt(hScores[0]) : 0;
                    }
                    catch (e) {
                        finalHome = 0;
                    }
                }
                else {
                    finalHome = finalHome ?? 0;
                }
                if (finalAway === null || finalAway === undefined) {
                    try {
                        const aScores = Array.isArray(row.away_scores) ? row.away_scores : JSON.parse(row.away_scores || '[]');
                        finalAway = aScores[0] !== undefined ? parseInt(aScores[0]) : 0;
                    }
                    catch (e) {
                        finalAway = 0;
                    }
                }
                else {
                    finalAway = finalAway ?? 0;
                }
                // IY Scores (from JSON arrays, Index 1 is usually Period 1)
                let htHome = 0;
                let htAway = 0;
                try {
                    const hScores = Array.isArray(row.home_scores) ? row.home_scores : JSON.parse(row.home_scores || '[]');
                    const aScores = Array.isArray(row.away_scores) ? row.away_scores : JSON.parse(row.away_scores || '[]');
                    htHome = hScores[1] !== undefined ? parseInt(hScores[1]) : 0;
                    htAway = aScores[1] !== undefined ? parseInt(aScores[1]) : 0;
                }
                catch (e) {
                    // Fallback
                }
                // Use new calculatePredictionResultNew with unified prediction field
                const result = this.calculatePredictionResultNew(row.prediction, row.prediction_threshold, row.score_at_prediction, finalHome, finalAway, htHome, htAway, period, row.status_id);
                if (result) {
                    // Update ai_predictions directly with new schema fields
                    await client.query(`
                        UPDATE ai_predictions
                        SET
                            result = $1,
                            final_score = $2,
                            result_reason = $3,
                            updated_at = NOW()
                        WHERE id = $4
                    `, [
                        result.outcome === 'winner' ? 'won' : result.outcome === 'loser' ? 'lost' : result.outcome,
                        `${row.home_score_display}-${row.away_score_display}`,
                        result.reason,
                        row.prediction_id
                    ]);
                    updatedCount++;
                }
            }
            if (updatedCount > 0) {
                logger_1.logger.info(`[AIPrediction] Updated ${updatedCount} prediction results (Instant/Final)`);
            }
            return updatedCount;
        }
        finally {
            client.release();
        }
    }
    /**
     * Calculate if prediction was correct
     * Supports Instant Win logic for Live Matches
     */
    calculatePredictionResult(predictionType, predictionValue, scoreAtPrediction, finalHome, // Current Live Score if match is live
    finalAway, htHome, htAway, period, statusId) {
        const fullPrediction = `${predictionType} ${predictionValue}`.toUpperCase();
        // Status Map:
        // 2: 1st Half, 3: HT, 4: 2nd Half, 8: FT, 9-13: OT/Pen/Ended
        const isMatchFinished = statusId >= 8;
        const isHalftimeReached = statusId >= 3;
        // Determine scores to use based on period
        // If Period is IY, but we are LIVE in 1st Half (Status 2), we use current scores to check for instant wins.
        // If Period is MS, we always use current scores to check for instant wins.
        let targetHome = finalHome;
        let targetAway = finalAway;
        // Specific check for IY finished
        if (period === 'IY' && isHalftimeReached) {
            targetHome = htHome;
            targetAway = htAway;
        }
        const totalGoals = targetHome + targetAway;
        // ---------------------------------------------------------
        // 1. OVER / ÜST Logic (Can WIN instantly)
        // ---------------------------------------------------------
        // ---------------------------------------------------------
        // 1. OVER / ÜST Logic (Can WIN instantly)
        // ---------------------------------------------------------
        // Try strict match first: "2.5 ÜST" or "ÜST 2.5"
        let overMatch = fullPrediction.match(/([\d.]+)\s*(ÜST|OVER|O)/i);
        if (!overMatch) {
            overMatch = fullPrediction.match(/(ÜST|OVER|O)\s*([\d.]+)/i); // Backwards
        }
        // Fallback: If just a number like "5.5" and NO "ALT/UNDER", assume ÜST
        if (!overMatch) {
            const bareNumber = fullPrediction.match(/(\d+\.5)/); // Match 0.5, 1.5, 5.5 etc specifically
            const isUnder = fullPrediction.match(/ALT|UNDER|U/i);
            if (bareNumber && !isUnder) {
                // Mock the match result structure [full, number, type]
                overMatch = [bareNumber[0], bareNumber[1], 'ÜST'];
            }
        }
        if (overMatch) {
            // Group 1 is number in regex 1, Group 2 in regex 2. 
            // Normalized handling: find the digit part
            const numStr = overMatch[1].match(/[\d.]/) ? overMatch[1] : overMatch[2];
            const line = parseFloat(numStr);
            const isOver = totalGoals > line;
            if (isOver) {
                // Instantly WIN, regardless of status (goals can't be un-scored)
                return {
                    outcome: 'winner',
                    reason: `Instant Win: Total Goals ${totalGoals} > ${line} (${period})`
                };
            }
            // If not yet over, we can only lose if period is finished
            if (period === 'IY') {
                // Check IY specific status
                if (isHalftimeReached)
                    return { outcome: 'loser', reason: `Finished IY: ${totalGoals} <= ${line}` };
                return null; // Wait
            }
            else {
                // MS
                if (isMatchFinished)
                    return { outcome: 'loser', reason: `Finished MS: ${totalGoals} <= ${line}` };
                return null; // Wait
            }
        }
        // ---------------------------------------------------------
        // 2. BTTS YES / VAR Logic (Can WIN instantly)
        // ---------------------------------------------------------
        if (fullPrediction.includes('VAR') || fullPrediction.includes('KG VAR') || fullPrediction.includes('BTTSYES')) {
            const btts = targetHome > 0 && targetAway > 0;
            if (btts) {
                return {
                    outcome: 'winner',
                    reason: `Instant Win: Both teams scored (${period})`
                };
            }
            if (period === 'IY') {
                if (isHalftimeReached)
                    return { outcome: 'loser', reason: `Finished IY: BTTS No` };
                return null;
            }
            else {
                if (isMatchFinished)
                    return { outcome: 'loser', reason: `Finished MS: BTTS No` };
                return null;
            }
        }
        // ---------------------------------------------------------
        // 3. UNDER / ALT (Can LOSE instantly, but we settle usually at end?)
        //    Actually, if Total > Line, we LOSE instantly.
        // ---------------------------------------------------------
        const underMatch = fullPrediction.match(/([\d.]+)\s*(ALT|UNDER|U)/i);
        if (underMatch) {
            const line = parseFloat(underMatch[1]);
            const isOver = totalGoals > line; // Opposed to Under
            if (isOver) {
                // Instantly LOSE (Line exceeded)
                return {
                    outcome: 'loser',
                    reason: `Instant Loss: Total Goals ${totalGoals} > ${line} (${period})`
                };
            }
            // To WIN, we must wait for period end
            if (period === 'IY') {
                if (isHalftimeReached)
                    return { outcome: 'winner', reason: `Finished IY: Under ${line}` };
                return null;
            }
            else {
                if (isMatchFinished)
                    return { outcome: 'winner', reason: `Finished MS: Under ${line}` };
                return null;
            }
        }
        // ---------------------------------------------------------
        // 4. BTTS NO / YOK (Can LOSE instantly)
        // ---------------------------------------------------------
        if (fullPrediction.includes('YOK') || fullPrediction.includes('KG YOK') || fullPrediction.includes('BTTSNO')) {
            const btts = targetHome > 0 && targetAway > 0;
            if (btts) {
                return {
                    outcome: 'loser',
                    reason: `Instant Loss: Both teams scored (${period})`
                };
            }
            if (period === 'IY') {
                if (isHalftimeReached)
                    return { outcome: 'winner', reason: `Finished IY: BTTS No` };
                return null;
            }
            else {
                if (isMatchFinished)
                    return { outcome: 'winner', reason: `Finished MS: BTTS No` };
                return null;
            }
        }
        // ---------------------------------------------------------
        // 5. 1/X/2 (Result) - Must wait for End of Period
        //    (Unless mathematically impossible? No, always possible in football)
        // ---------------------------------------------------------
        // Determine if we can settle (must be finished)
        let canSettle = false;
        if (period === 'IY' && isHalftimeReached)
            canSettle = true;
        if (period === 'MS' && isMatchFinished)
            canSettle = true;
        if (!canSettle)
            return null; // Wait for end
        // Logic for 1/X/2 at end of period
        const isHomeWin = targetHome > targetAway;
        const isAwayWin = targetAway > targetHome;
        const isDraw = targetHome === targetAway;
        if (fullPrediction.match(/\b(MS 1|HOME WIN|IY 1|1\.Y 1)\b/)) {
            return {
                outcome: isHomeWin ? 'winner' : 'loser',
                reason: `Score: ${targetHome}-${targetAway} (${period})`
            };
        }
        if (fullPrediction.match(/\b(MS 2|AWAY WIN|IY 2|1\.Y 2)\b/)) {
            return {
                outcome: isAwayWin ? 'winner' : 'loser',
                reason: `Score: ${targetHome}-${targetAway} (${period})`
            };
        }
        if (fullPrediction.match(/\b(MS X|DRAW|IY X|1\.Y X|BERABERE)\b/)) {
            return {
                outcome: isDraw ? 'winner' : 'loser',
                reason: `Score: ${targetHome}-${targetAway} (${period})`
            };
        }
        if (predictionValue === '1')
            return { outcome: isHomeWin ? 'winner' : 'loser', reason: `Score: ${targetHome}-${targetAway}` };
        if (predictionValue === '2')
            return { outcome: isAwayWin ? 'winner' : 'loser', reason: `Score: ${targetHome}-${targetAway}` };
        if (predictionValue === 'X' || predictionValue === '0')
            return { outcome: isDraw ? 'winner' : 'loser', reason: `Score: ${targetHome}-${targetAway}` };
        return null;
    }
    /**
     * Calculate prediction result using NEW SCHEMA
     * SIMPLIFIED: Uses unified prediction field and numeric threshold
     * @param prediction - Unified field like "MS 0.5 ÜST", "IY 1.5 ÜST"
     * @param threshold - Numeric threshold like 0.5, 1.5, 2.5
     */
    calculatePredictionResultNew(prediction, threshold, scoreAtPrediction, finalHome, finalAway, htHome, htAway, period, statusId) {
        const predUpper = (prediction || '').toUpperCase();
        // Status Map: 2: 1st Half, 3: HT, 4: 2nd Half, 8: FT
        const isMatchFinished = statusId >= 8;
        const isHalftimeReached = statusId >= 3;
        // Determine scores based on period
        let targetHome = finalHome;
        let targetAway = finalAway;
        if (period === 'IY' && isHalftimeReached) {
            targetHome = htHome;
            targetAway = htAway;
        }
        const totalGoals = targetHome + targetAway;
        // OVER / ÜST Logic - Most common case
        if (predUpper.includes('ÜST') || predUpper.includes('OVER')) {
            if (totalGoals > threshold) {
                return {
                    outcome: 'winner',
                    reason: `Instant Win: ${totalGoals} > ${threshold} (${period})`
                };
            }
            // Can only lose if period is finished
            if (period === 'IY' && isHalftimeReached) {
                return { outcome: 'loser', reason: `IY Finished: ${totalGoals} <= ${threshold}` };
            }
            if (period === 'MS' && isMatchFinished) {
                return { outcome: 'loser', reason: `MS Finished: ${totalGoals} <= ${threshold}` };
            }
            return null; // Wait
        }
        // UNDER / ALT Logic
        if (predUpper.includes('ALT') || predUpper.includes('UNDER')) {
            if (totalGoals > threshold) {
                return {
                    outcome: 'loser',
                    reason: `Instant Loss: ${totalGoals} > ${threshold} (${period})`
                };
            }
            if (period === 'IY' && isHalftimeReached) {
                return { outcome: 'winner', reason: `IY Finished: ${totalGoals} <= ${threshold}` };
            }
            if (period === 'MS' && isMatchFinished) {
                return { outcome: 'winner', reason: `MS Finished: ${totalGoals} <= ${threshold}` };
            }
            return null; // Wait
        }
        // KG VAR / BTTS YES
        if (predUpper.includes('KG VAR') || predUpper.includes('BTTS')) {
            const btts = targetHome > 0 && targetAway > 0;
            if (btts) {
                return { outcome: 'winner', reason: `Both teams scored (${period})` };
            }
            if (period === 'IY' && isHalftimeReached) {
                return { outcome: 'loser', reason: `IY Finished: BTTS No` };
            }
            if (period === 'MS' && isMatchFinished) {
                return { outcome: 'loser', reason: `MS Finished: BTTS No` };
            }
            return null;
        }
        // KG YOK / BTTS NO
        if (predUpper.includes('KG YOK')) {
            const btts = targetHome > 0 && targetAway > 0;
            if (btts) {
                return { outcome: 'loser', reason: `Both teams scored (${period})` };
            }
            if (period === 'IY' && isHalftimeReached) {
                return { outcome: 'winner', reason: `IY Finished: BTTS No` };
            }
            if (period === 'MS' && isMatchFinished) {
                return { outcome: 'winner', reason: `MS Finished: BTTS No` };
            }
            return null;
        }
        // 1/X/2 Result - Must wait for period end
        let canSettle = false;
        if (period === 'IY' && isHalftimeReached)
            canSettle = true;
        if (period === 'MS' && isMatchFinished)
            canSettle = true;
        if (!canSettle)
            return null;
        const isHomeWin = targetHome > targetAway;
        const isAwayWin = targetAway > targetHome;
        const isDraw = targetHome === targetAway;
        if (predUpper.includes('MS 1') || predUpper.includes('IY 1')) {
            return { outcome: isHomeWin ? 'winner' : 'loser', reason: `Score: ${targetHome}-${targetAway}` };
        }
        if (predUpper.includes('MS 2') || predUpper.includes('IY 2')) {
            return { outcome: isAwayWin ? 'winner' : 'loser', reason: `Score: ${targetHome}-${targetAway}` };
        }
        if (predUpper.includes('MS X') || predUpper.includes('MS 0') || predUpper.includes('IY X')) {
            return { outcome: isDraw ? 'winner' : 'loser', reason: `Score: ${targetHome}-${targetAway}` };
        }
        return null;
    }
    /**
     * Update display_prediction text for a prediction
     * This is the admin-editable text shown to users
     */
    async updateDisplayPrediction(predictionId, displayText) {
        try {
            const result = await connection_1.pool.query(`UPDATE ai_predictions 
                 SET display_prediction = $1, updated_at = NOW() 
                 WHERE id = $2
                 RETURNING id`, [displayText.trim() || null, predictionId]);
            if (result.rowCount && result.rowCount > 0) {
                logger_1.logger.info(`[AIPrediction] Updated display_prediction for ${predictionId}: "${displayText}"`);
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('[AIPrediction] Failed to update display_prediction:', error);
            throw error;
        }
    }
    /**
     * Bulk update display_prediction for multiple predictions
     */
    async bulkUpdateDisplayPrediction(updates) {
        let updatedCount = 0;
        for (const update of updates) {
            const success = await this.updateDisplayPrediction(update.id, update.displayText);
            if (success)
                updatedCount++;
        }
        return updatedCount;
    }
    /**
     * Get predictions with display_prediction set (for user-facing components)
     * Only returns predictions that have admin-defined display text
     * REFACTORED: Uses new schema with direct match_id
     */
    async getDisplayablePredictions(limit = 50) {
        const query = `
            SELECT
                p.id,
                p.external_id,
                p.canonical_bot_name as bot_name,
                p.prediction as display_prediction,
                p.minute_at_prediction,
                p.created_at,
                p.match_id,
                p.result,
                m.external_id as match_external_id,
                80 as overall_confidence,
                CASE
                    WHEN p.result = 'won' THEN 'winner'
                    WHEN p.result = 'lost' THEN 'loser'
                    ELSE p.result
                END as prediction_result
            FROM ai_predictions p
            LEFT JOIN ts_matches m ON p.match_id = m.external_id
            WHERE p.prediction IS NOT NULL
              AND p.prediction != ''
              AND p.match_id IS NOT NULL
            ORDER BY p.created_at DESC
            LIMIT $1
        `;
        const result = await connection_1.pool.query(query, [limit]);
        return result.rows;
    }
    /**
     * Settle predictions for a specific match (auto settlement)
     * Called when match ends (status_id >= 8) OR transitions to HT (status_id = 3)
     *
     * @deprecated This method is deprecated. Use predictionSettlementService.settleMatchPredictions() instead.
     * This wrapper is kept for backward compatibility only.
     *
     * REFACTORED: Now redirects to predictionSettlementService for centralized settlement logic.
     */
    async settleMatchPredictions(matchExternalId, overridingStatusId, overridingHomeScore, overridingAwayScore) {
        logger_1.logger.warn(`[AIPrediction] DEPRECATED: settleMatchPredictions called for ${matchExternalId}. Use predictionSettlementService instead.`);
        // Redirect to centralized settlement service
        return await predictionSettlement_service_1.predictionSettlementService.settleMatchPredictions(matchExternalId, overridingHomeScore, overridingAwayScore, overridingHomeScore, // htHome - using same as overridingHomeScore for backward compat
        overridingAwayScore // htAway - using same as overridingAwayScore for backward compat
        );
    }
    /**
     * Check for INSTANT WIN when a goal is scored
     * Called by WebSocketService on GOAL event
     *
     * @deprecated This method is deprecated. Use predictionSettlementService.settleInstantWin() instead.
     * This wrapper is kept for backward compatibility only.
     *
     * REFACTORED: Now redirects to predictionSettlementService for centralized settlement logic.
     */
    async settleInstantWin(matchExternalId, homeScore, awayScore, minute, overridingStatusId) {
        logger_1.logger.warn(`[AIPrediction] DEPRECATED: settleInstantWin called for ${matchExternalId}. Use predictionSettlementService instead.`);
        // Redirect to centralized settlement service
        await predictionSettlement_service_1.predictionSettlementService.settleInstantWin(matchExternalId, homeScore, awayScore, minute, overridingStatusId);
    }
    /**
     * Get manual predictions (Alert System bot)
     * REFACTORED: Uses new schema with direct match_id
     */
    async getManualPredictions(limit = 100) {
        const query = `
            SELECT
                p.id,
                p.external_id,
                p.canonical_bot_name as bot_name,
                p.league_name,
                p.home_team_name,
                p.away_team_name,
                p.score_at_prediction,
                p.minute_at_prediction,
                p.prediction,
                p.prediction as prediction_type,
                p.prediction as prediction_value,
                p.prediction_threshold,
                p.processed,
                p.created_at,
                p.access_type,
                p.match_id,
                p.result,
                CASE
                    WHEN p.result = 'won' THEN 'winner'
                    WHEN p.result = 'lost' THEN 'loser'
                    ELSE p.result
                END as prediction_result,
                m.external_id as match_external_id,
                80 as overall_confidence
            FROM ai_predictions p
            LEFT JOIN ts_matches m ON p.match_id = m.external_id
            WHERE p.canonical_bot_name = 'Alert System'
            ORDER BY p.created_at DESC
            LIMIT $1
        `;
        const res = await connection_1.pool.query(query, [limit]);
        return res.rows;
    }
    async createManualPrediction(data) {
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            // Extract threshold from prediction string (e.g., "IY 0.5 ÜST" -> 0.5)
            const thresholdMatch = data.prediction.match(/(\d+\.?\d*)/);
            const threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 0.5;
            // Get league name from match if not provided
            let leagueName = data.league;
            if (!leagueName || leagueName.trim() === '' || leagueName === '-') {
                const matchQuery = await client.query(`
                    SELECT c.name as competition_name
                    FROM ts_matches m
                    LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
                    WHERE m.id = $1
                `, [data.match_id]);
                if (matchQuery.rows.length > 0 && matchQuery.rows[0].competition_name) {
                    leagueName = matchQuery.rows[0].competition_name;
                    logger_1.logger.info(`[AIPrediction] Manuel tahmin için lig bilgisi maçtan alındı: ${leagueName}`);
                }
            }
            const predictionId = crypto.randomUUID();
            const externalId = `manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const botName = data.bot_name || 'Alert System';
            // Insert into ai_predictions with NEW 29-column schema
            await client.query(`
                INSERT INTO ai_predictions (
                    id, external_id, canonical_bot_name, league_name,
                    home_team_name, away_team_name, score_at_prediction,
                    minute_at_prediction, prediction, prediction_threshold,
                    match_id, result, access_type, source, created_at, coupon_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15)
            `, [
                predictionId,
                externalId,
                botName,
                leagueName || '',
                data.home_team,
                data.away_team,
                data.score,
                data.minute,
                data.prediction,
                threshold,
                data.match_id,
                'pending',
                data.access_type,
                'manual',
                data.coupon_id || null
            ]);
            logger_1.logger.info(`[AIPrediction] Manuel tahmin oluşturuldu: ${data.prediction} - ${data.home_team} vs ${data.away_team} (match_id: ${data.match_id})`);
            await client.query('COMMIT');
            return { id: predictionId, prediction: data.prediction };
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger_1.logger.error('[AIPredictions] Create Manual Prediction Error:', error);
            return null;
        }
        finally {
            client.release();
        }
    }
    /**
     * Create a new Coupon with multiple predictions
     */
    async createCoupon(data) {
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            // 1. Create Coupon
            const couponId = crypto.randomUUID();
            await client.query(`
                INSERT INTO ai_coupons (id, title, access_type, status, created_at)
                VALUES ($1, $2, $3, 'pending', NOW())
            `, [couponId, data.title, data.access_type]);
            // 2. Create Predictions for each item
            let successCount = 0;
            for (const item of data.items) {
                // Determine threshold
                const thresholdMatch = item.prediction.match(/(\d+\.?\d*)/);
                const threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 0.5;
                // Get league if missing
                let leagueName = item.league;
                if (!leagueName || leagueName.trim() === '' || leagueName === '-') {
                    const matchQuery = await client.query(`
                        SELECT c.name as competition_name
                        FROM ts_matches m
                        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
                        WHERE m.id = $1
                    `, [item.match_id]);
                    if (matchQuery.rows.length > 0 && matchQuery.rows[0].competition_name) {
                        leagueName = matchQuery.rows[0].competition_name;
                    }
                }
                const predictionId = crypto.randomUUID();
                const externalId = `manual_coupon_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                await client.query(`
                    INSERT INTO ai_predictions (
                        id, external_id, canonical_bot_name, league_name,
                        home_team_name, away_team_name, score_at_prediction,
                        minute_at_prediction, prediction, prediction_threshold,
                        match_id, result, access_type, source, created_at, coupon_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15)
                `, [
                    predictionId,
                    externalId,
                    'Coupon Bot', // Distinct bot name for coupons
                    leagueName || '',
                    item.home_team,
                    item.away_team,
                    item.score,
                    item.minute,
                    item.prediction,
                    threshold,
                    item.match_id,
                    'pending',
                    data.access_type, // Inherit from Coupon
                    'manual_coupon',
                    couponId
                ]);
                successCount++;
            }
            logger_1.logger.info(`[AIPrediction] Coupon created: ${data.title} with ${successCount} items`);
            await client.query('COMMIT');
            return { id: couponId, title: data.title, count: successCount };
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger_1.logger.error('[AIPredictions] Create Coupon Error:', error);
            return null;
        }
        finally {
            client.release();
        }
    }
}
exports.AIPredictionService = AIPredictionService;
exports.aiPredictionService = new AIPredictionService();
