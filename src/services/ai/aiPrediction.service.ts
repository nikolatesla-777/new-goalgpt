/**
 * AI Prediction Service
 * 
 * Handles ingestion and processing of AI predictions from external sources.
 * This runs on the VPS backend (Digital Ocean) - NOT on Vercel.
 */

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { teamNameMatcherService, MatchLookupResult } from './teamNameMatcher.service';

export interface RawPredictionPayload {
    id?: string;
    date?: string;
    prediction?: string; // Base64 encoded
    // Direct fields (if not base64)
    bot_name?: string;
    league?: string;
    home_team?: string;
    away_team?: string;
    score?: string;
    minute?: string | number;
    prediction_type?: string;
    prediction_value?: string;
}

export interface ParsedPrediction {
    externalId: string;
    botName: string;
    leagueName: string;
    homeTeamName: string;
    awayTeamName: string;
    scoreAtPrediction: string;
    minuteAtPrediction: number;
    predictionType: string;
    predictionValue: string;
    rawPayload: string;
}

export interface PredictionIngestionResult {
    success: boolean;
    predictionId?: string;
    matchFound: boolean;
    matchExternalId?: string;
    confidence?: number;
    botGroupName?: string;
    error?: string;
}

interface BotRule {
    id: string;
    bot_group_id: string;
    bot_display_name: string;
    minute_from: number | null;
    minute_to: number | null;
    priority: number;
}

export class AIPredictionService {
    /**
     * Decode Base64 prediction payload
     */
    decodePayload(base64String: string): string {
        try {
            return Buffer.from(base64String, 'base64').toString('utf-8');
        } catch (error) {
            logger.error('[AIPrediction] Failed to decode Base64 payload:', error);
            return base64String; // Return as-is if not valid base64
        }
    }

    /**
     * Get bot group for a prediction based on minute
     * Uses rules from ai_bot_rules table, sorted by priority (higher = more specific)
     */
    async getBotGroupForMinute(minute: number): Promise<{ botGroupId: string | null; botDisplayName: string }> {
        try {
            const result = await pool.query(`
                SELECT id, bot_group_id, bot_display_name, minute_from, minute_to, priority
                FROM ai_bot_rules
                WHERE is_active = true
                ORDER BY priority DESC
            `);

            for (const rule of result.rows as BotRule[]) {
                const minFrom = rule.minute_from ?? 0;
                const minTo = rule.minute_to ?? 999;

                if (minute >= minFrom && minute <= minTo) {
                    return {
                        botGroupId: rule.bot_group_id || null,
                        botDisplayName: rule.bot_display_name
                    };
                }
            }

            // Default fallback
            return { botGroupId: null, botDisplayName: 'BOT 007' };
        } catch (error) {
            logger.warn('[AIPrediction] Failed to get bot group, using default:', error);
            return { botGroupId: null, botDisplayName: 'BOT 007' };
        }
    }

    /**
     * Parse prediction content from decoded string
     * Expected formats:
     * - "TeamA - TeamB | 0-0 | 10' | League Name | IY 0.5 ÜST"
     * - JSON object with fields
     */
    parsePredictionContent(content: string, externalId: string): ParsedPrediction | null {
        try {
            // Try JSON parse first
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
            } catch {
                // Not JSON, try pipe-delimited format
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

            logger.warn('[AIPrediction] Could not parse prediction content:', content.substring(0, 100));
            return null;

        } catch (error) {
            logger.error('[AIPrediction] Error parsing prediction:', error);
            return null;
        }
    }

    /**
     * Ingest a new prediction
     */
    async ingestPrediction(payload: RawPredictionPayload): Promise<PredictionIngestionResult> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Decode if base64
            let decodedContent = '';
            if (payload.prediction) {
                decodedContent = this.decodePayload(payload.prediction);
            }

            // Parse the content
            let parsed: ParsedPrediction | null = null;

            if (decodedContent) {
                parsed = this.parsePredictionContent(decodedContent, payload.id || '');
            } else if (payload.home_team && payload.away_team) {
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

            // Determine bot group based on minute
            const botGroup = await this.getBotGroupForMinute(parsed.minuteAtPrediction);
            logger.info(`[AIPrediction] Assigned to bot: ${botGroup.botDisplayName} (minute: ${parsed.minuteAtPrediction})`);

            // Insert into ai_predictions
            const insertQuery = `
        INSERT INTO ai_predictions (
          external_id, bot_group_id, bot_name, league_name, home_team_name, away_team_name,
          score_at_prediction, minute_at_prediction, prediction_type, prediction_value,
          raw_payload, processed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
        RETURNING id
      `;

            const insertResult = await client.query(insertQuery, [
                parsed.externalId,
                botGroup.botGroupId,
                botGroup.botDisplayName,
                parsed.leagueName,
                parsed.homeTeamName,
                parsed.awayTeamName,
                parsed.scoreAtPrediction,
                parsed.minuteAtPrediction,
                parsed.predictionType,
                parsed.predictionValue,
                parsed.rawPayload
            ]);

            const predictionId = insertResult.rows[0].id;
            logger.info(`[AIPrediction] Inserted prediction ${predictionId}: ${parsed.homeTeamName} vs ${parsed.awayTeamName}`);

            // Try to match with TheSports data
            let matchResult: MatchLookupResult | null = null;
            try {
                matchResult = await teamNameMatcherService.findMatchByTeams(
                    parsed.homeTeamName,
                    parsed.awayTeamName,
                    parsed.minuteAtPrediction,
                    parsed.scoreAtPrediction
                );
            } catch (matchError) {
                logger.warn('[AIPrediction] Team matching failed:', matchError);
            }

            if (matchResult && matchResult.overallConfidence >= 0.6) {
                // Insert match link
                const matchLinkQuery = `
          INSERT INTO ai_prediction_matches (
            prediction_id, match_external_id, match_uuid,
            home_team_id, away_team_id,
            home_team_confidence, away_team_confidence, overall_confidence,
            match_status, matched_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'matched', NOW())
          RETURNING id
        `;

                await client.query(matchLinkQuery, [
                    predictionId,
                    matchResult.matchExternalId,
                    matchResult.matchUuid,
                    matchResult.homeTeam.teamId,
                    matchResult.awayTeam.teamId,
                    matchResult.homeTeam.confidence,
                    matchResult.awayTeam.confidence,
                    matchResult.overallConfidence
                ]);

                // Mark prediction as processed
                await client.query('UPDATE ai_predictions SET processed = true WHERE id = $1', [predictionId]);

                logger.info(`[AIPrediction] Matched to ${matchResult.matchExternalId} (confidence: ${matchResult.overallConfidence.toFixed(2)})`);

                await client.query('COMMIT');
                return {
                    success: true,
                    predictionId,
                    matchFound: true,
                    matchExternalId: matchResult.matchExternalId,
                    confidence: matchResult.overallConfidence
                };
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

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('[AIPrediction] Ingestion error:', error);
            return {
                success: false,
                matchFound: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get pending predictions (not yet matched)
     */
    async getPendingPredictions(limit: number = 50): Promise<any[]> {
        const query = `
      SELECT * FROM ai_predictions 
      WHERE processed = false 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    /**
     * Get matched predictions with results
     */
    async getMatchedPredictions(limit: number = 50): Promise<any[]> {
        const query = `
      SELECT 
        p.*,
        pm.match_external_id,
        pm.overall_confidence,
        pm.prediction_result,
        pm.final_home_score,
        pm.final_away_score,
        pm.matched_at,
        pm.resulted_at
      FROM ai_predictions p
      JOIN ai_prediction_matches pm ON pm.prediction_id = p.id
      ORDER BY p.created_at DESC
      LIMIT $1
    `;
        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    /**
     * Update prediction results based on match outcome
     */
    async updatePredictionResults(): Promise<number> {
        const client = await pool.connect();
        try {
            // Get matched predictions that haven't been resulted yet
            const pendingQuery = `
        SELECT 
          pm.id as match_id,
          pm.prediction_id,
          pm.match_external_id,
          p.prediction_type,
          p.prediction_value,
          p.score_at_prediction,
          m.status_id,
          m.home_score_display,
          m.away_score_display
        FROM ai_prediction_matches pm
        JOIN ai_predictions p ON p.id = pm.prediction_id
        JOIN ts_matches m ON m.external_id = pm.match_external_id
        WHERE pm.prediction_result = 'pending'
          AND m.status_id IN (8, 9, 10, 11, 12, 13)
      `;

            const pending = await client.query(pendingQuery);
            let updatedCount = 0;

            for (const row of pending.rows) {
                const result = this.calculatePredictionResult(
                    row.prediction_type,
                    row.prediction_value,
                    row.score_at_prediction,
                    row.home_score_display,
                    row.away_score_display
                );

                if (result) {
                    await client.query(`
            UPDATE ai_prediction_matches 
            SET 
              prediction_result = $1,
              final_home_score = $2,
              final_away_score = $3,
              result_reason = $4,
              resulted_at = NOW(),
              updated_at = NOW()
            WHERE id = $5
          `, [
                        result.outcome,
                        row.home_score_display,
                        row.away_score_display,
                        result.reason,
                        row.match_id
                    ]);
                    updatedCount++;
                }
            }

            logger.info(`[AIPrediction] Updated ${updatedCount} prediction results`);
            return updatedCount;

        } finally {
            client.release();
        }
    }

    /**
     * Calculate if prediction was correct
     */
    calculatePredictionResult(
        predictionType: string,
        predictionValue: string,
        scoreAtPrediction: string,
        finalHome: number,
        finalAway: number
    ): { outcome: 'winner' | 'loser'; reason: string } | null {
        const fullPrediction = `${predictionType} ${predictionValue}`.toUpperCase();
        const totalGoals = finalHome + finalAway;

        // Parse initial score
        const [initHome, initAway] = scoreAtPrediction.split('-').map(s => parseInt(s) || 0);
        const goalsAfterPrediction = totalGoals - (initHome + initAway);

        // Over/Under patterns
        const overMatch = fullPrediction.match(/([\d.]+)\s*(ÜST|OVER|O)/i);
        const underMatch = fullPrediction.match(/([\d.]+)\s*(ALT|UNDER|U)/i);

        if (overMatch) {
            const line = parseFloat(overMatch[1]);
            const isOver = goalsAfterPrediction > line;
            return {
                outcome: isOver ? 'winner' : 'loser',
                reason: `Goals after prediction: ${goalsAfterPrediction}, Line: ${line}`
            };
        }

        if (underMatch) {
            const line = parseFloat(underMatch[1]);
            const isUnder = goalsAfterPrediction < line;
            return {
                outcome: isUnder ? 'winner' : 'loser',
                reason: `Goals after prediction: ${goalsAfterPrediction}, Line: ${line}`
            };
        }

        // Home/Away win patterns
        if (fullPrediction.includes('MS 1') || fullPrediction.includes('HOME WIN')) {
            return {
                outcome: finalHome > finalAway ? 'winner' : 'loser',
                reason: `Final: ${finalHome}-${finalAway}`
            };
        }

        if (fullPrediction.includes('MS 2') || fullPrediction.includes('AWAY WIN')) {
            return {
                outcome: finalAway > finalHome ? 'winner' : 'loser',
                reason: `Final: ${finalHome}-${finalAway}`
            };
        }

        if (fullPrediction.includes('MS X') || fullPrediction.includes('DRAW')) {
            return {
                outcome: finalHome === finalAway ? 'winner' : 'loser',
                reason: `Final: ${finalHome}-${finalAway}`
            };
        }

        logger.warn(`[AIPrediction] Unknown prediction type: ${fullPrediction}`);
        return null;
    }
}

export const aiPredictionService = new AIPredictionService();
