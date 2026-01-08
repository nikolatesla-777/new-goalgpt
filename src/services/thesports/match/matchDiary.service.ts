
/**
 * Match Diary Service
 * 
 * Handles business logic for /match/diary endpoint
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { MatchDiaryResponse, MatchDiaryParams } from '../../../types/thesports/match';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { TeamDataService } from '../team/teamData.service';
import { MatchEnricherService } from './matchEnricher.service';
import { TeamLogoService } from '../team/teamLogo.service';
import { CompetitionService } from '../competition/competition.service';
import { formatTheSportsDate } from '../../../utils/thesports/timestamp.util';

export class MatchDiaryService {
  private teamDataService: TeamDataService;
  private teamLogoService: TeamLogoService;
  private matchEnricher: MatchEnricherService;
  private competitionService: CompetitionService;

  constructor(private client: any) {
    this.teamDataService = new TeamDataService(client);
    this.teamLogoService = new TeamLogoService(client);
    this.competitionService = new CompetitionService(client);
    this.matchEnricher = new MatchEnricherService(this.teamDataService, this.teamLogoService, this.competitionService);
  }

  /**
   * Get match diary for a specific date with cache support and team enrichment
   */
  async getMatchDiary(params: MatchDiaryParams = {}): Promise<MatchDiaryResponse> {
    // Convert date format from YYYY-MM-DD to YYYYMMDD if provided
    // CRITICAL: API requires YYYYMMDD format (no dashes, 8 digits)
    let dateStr: string;
    if (params.date) {
      // Convert YYYY-MM-DD to YYYYMMDD
      dateStr = params.date.replace(/-/g, '');
      
      // Validate format: Must be 8 digits (YYYYMMDD)
      if (!/^\d{8}$/.test(dateStr)) {
        logger.warn(`Invalid date format: ${params.date}. Expected YYYYMMDD format.`);
        // Try to fix: if it's already YYYYMMDD, use it; otherwise use today
        if (params.date.length === 8 && /^\d{8}$/.test(params.date)) {
          dateStr = params.date;
        } else {
          dateStr = formatTheSportsDate(new Date()).replace(/-/g, '');
          logger.warn(`Using today's date instead: ${dateStr}`);
        }
      }
    } else {
      dateStr = formatTheSportsDate(new Date()).replace(/-/g, '');
    }
    
    // Final validation: Ensure dateStr is exactly 8 digits
    if (!/^\d{8}$/.test(dateStr)) {
      logger.error(`Date format validation failed: ${dateStr}. Using today's date.`);
      dateStr = formatTheSportsDate(new Date()).replace(/-/g, '');
    }
    const cacheKey = this.buildCacheKey(dateStr);

    // Check cache first (skip if forceRefresh param is set)
    if (!(params as any).forceRefresh) {
      const cached = await cacheService.get<MatchDiaryResponse>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for match diary: ${cacheKey}`);
        return cached;
      }
    } else {
      logger.info(`🔄 [MatchDiary] Force refresh - skipping cache`);
    }

    // Fetch from API
    logger.info(`🔍 [MatchDiary] Fetching match diary for date: ${dateStr} (format: YYYYMMDD)`);
    const response = await this.client.get<MatchDiaryResponse>(
      '/match/diary',
      { date: dateStr }
    );

    // CRITICAL: Log FULL API response structure
    logger.info(`📦 [MatchDiary] API Response Structure:`, {
      hasResults: !!response.results,
      resultsType: Array.isArray(response.results) ? 'array' : typeof response.results,
      resultsLength: response.results?.length || 0,
      hasResultsExtra: !!response.results_extra,
      hasCompetitionInExtra: !!response.results_extra?.competition,
      competitionCount: response.results_extra?.competition ? Object.keys(response.results_extra.competition).length : 0,
      hasTeamInExtra: !!response.results_extra?.team,
      teamCount: response.results_extra?.team ? Object.keys(response.results_extra.team).length : 0,
      hasErr: !!response.err,
      err: response.err || null,
    });

    // CRITICAL: Log total matches received from API
    const totalMatches = response.results?.length || 0;
    logger.info(`📊 [MatchDiary] API returned ${totalMatches} matches for date ${dateStr}`);
    
    if (totalMatches === 0) {
      logger.warn(`⚠️ [MatchDiary] No matches found for date ${dateStr}. This might be normal if no matches are scheduled.`);
    } else if (totalMatches < 50) {
      logger.warn(`⚠️ [MatchDiary] Only ${totalMatches} matches found. Expected 200+ for a full day. Check if API response is limited.`);
    } else {
      logger.info(`✅ [MatchDiary] Good match count: ${totalMatches} matches`);
    }

    // DEBUG: Log raw API response structure - FULL MATCH OBJECT (only if THESPORTS_DEBUG=1)
    if (process.env.THESPORTS_DEBUG === '1' && response.results && response.results.length > 0) {
      const firstMatch = response.results[0] as any;
      logger.info('🔍 [DEBUG] Raw API Match Structure (FULL):', JSON.stringify(firstMatch, null, 2));
      logger.info('🔍 [DEBUG] All keys in match object:', Object.keys(firstMatch).join(', '));
    }

    // Check for API error (TheSports API uses 'code' and 'msg' for errors, not 'err')
    if ((response as any)?.code && (response as any).code !== 200 && (response as any).code !== 0) {
      const errorMsg = (response as any).msg || 'TheSports API error';
      const errorCode = (response as any).code;
      
      // Special handling for rate limit errors
      if (errorCode === 429 || errorMsg.toLowerCase().includes('too many requests')) {
        logger.warn(`⚠️ Rate limit exceeded for match diary. Please wait before retrying.`);
        return {
          results: [],
          err: 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.',
        };
      }
      
      logger.warn(`TheSports API error for match diary: ${errorMsg} (code: ${errorCode})`);
      // Return empty results with error message
      return {
        results: [],
        err: errorMsg,
      };
    }

    // Also check for 'err' field (backward compatibility)
    if (response.err) {
      logger.warn(`TheSports API error for match diary: ${response.err}`);
      // Return empty results with error message
      return {
        results: [],
        err: response.err,
      };
    }

    // Extract and cache results_extra separately for team data enrichment
    if (response.results_extra) {
      await this.cacheResultsExtra(dateStr, response.results_extra);
      await this.teamDataService.enrichFromResultsExtra(response.results_extra);
      if (response.results_extra.competition) {
        await this.competitionService.enrichFromResultsExtra(response.results_extra);
      }
    }

    // CRITICAL FIX: Extract team names from results_extra BEFORE enrichment
    // NOTE: results_extra.team is an ARRAY, not an object!
    const teamNamesMap = new Map<string, { name: string; logo_url?: string }>();
    if (response.results_extra?.team) {
      // Handle both array and object formats
      if (Array.isArray(response.results_extra.team)) {
        // Array format: [{ id: "...", name: "...", logo: "..." }, ...]
        for (const team of response.results_extra.team) {
          if (team.id && team.name) {
            teamNamesMap.set(team.id, {
              name: team.name,
              logo_url: team.logo || team.logo_url || undefined,
            });
          }
        }
      } else {
        // Object format: { "team_id": { name: "...", logo_url: "..." }, ... }
        for (const [teamId, teamInfo] of Object.entries(response.results_extra.team)) {
          if (teamInfo && typeof teamInfo === 'object' && (teamInfo as any).name) {
            teamNamesMap.set(teamId, {
              name: (teamInfo as any).name,
              logo_url: (teamInfo as any).logo_url || (teamInfo as any).logo || undefined,
            });
          }
        }
      }
      logger.info(`📋 Extracted ${teamNamesMap.size} team names from results_extra (format: ${Array.isArray(response.results_extra.team) ? 'ARRAY' : 'OBJECT'})`);
    }

    // Transform and enrich matches - BRUTE FORCE ALL POSSIBLE NAME FIELDS
    const results = (response.results || []).map((match: any) => {
      // Normalize IDs to strings for consistent Map/Object indexing
      const homeTeamId = match.home_team_id != null ? String(match.home_team_id) : '';
      const awayTeamId = match.away_team_id != null ? String(match.away_team_id) : '';
      const competitionId = match.competition_id != null ? String(match.competition_id) : '';
      // Get team names from results_extra (raw API data) - FIRST PRIORITY
      const homeTeamInfo = homeTeamId ? teamNamesMap.get(homeTeamId) : undefined;
      const awayTeamInfo = awayTeamId ? teamNamesMap.get(awayTeamId) : undefined;
      
      // BRUTE FORCE: Try ALL possible field names for home team
      const homeName = 
        homeTeamInfo?.name ||           // From results_extra (highest priority)
        match.home_name ||              // Common field
        match.host_name ||              // Common variant
        match.home_team_name ||         // Snake case
        (Array.isArray(match.home) ? match.home[0] || match.home[1] : null) ||  // Array variant
        (match.home?.name) ||           // Object variant
        (match.home_team?.name) ||      // Nested object
        (Array.isArray(match.home_team) ? match.home_team[0] || match.home_team[1] : null) ||  // Array variant
        match.localTeam?.name ||        // Alternative naming
        match.localTeam ||              // Direct value
        null;
      
      // BRUTE FORCE: Try ALL possible field names for away team
      const awayName = 
        awayTeamInfo?.name ||           // From results_extra (highest priority)
        match.away_name ||              // Common field
        match.visitor_name ||           // Common variant
        match.away_team_name ||         // Snake case
        (Array.isArray(match.away) ? match.away[0] || match.away[1] : null) ||  // Array variant
        (match.away?.name) ||           // Object variant
        (match.away_team?.name) ||      // Nested object
        (Array.isArray(match.away_team) ? match.away_team[0] || match.away_team[1] : null) ||  // Array variant
        match.visitorTeam?.name ||      // Alternative naming
        match.visitorTeam ||            // Direct value
        null;
      
      // Extract score arrays (Array[7] format from API)
      // Index 0: Normal Süre, Index 1: Devre Arası, Index 2: Kırmızı Kart, Index 3: Sarı Kart, Index 4: Korner, Index 5: Uzatma, Index 6: Penaltı
      const homeScores = match.home_scores || (match.home_score !== undefined ? [match.home_score] : null);
      const awayScores = match.away_scores || (match.away_score !== undefined ? [match.away_score] : null);
      
      const homeRegularScore = Array.isArray(homeScores) && homeScores.length > 0 ? homeScores[0] : (match.home_score || null);
      const homeOvertimeScore = Array.isArray(homeScores) && homeScores.length > 5 ? homeScores[5] : null;
      const homePenaltyScore = Array.isArray(homeScores) && homeScores.length > 6 ? homeScores[6] : null;
      const homeRedCards = Array.isArray(homeScores) && homeScores.length > 2 ? homeScores[2] : null;
      const homeYellowCards = Array.isArray(homeScores) && homeScores.length > 3 ? homeScores[3] : null;
      const homeCorners = Array.isArray(homeScores) && homeScores.length > 4 ? homeScores[4] : null;
      
      const awayRegularScore = Array.isArray(awayScores) && awayScores.length > 0 ? awayScores[0] : (match.away_score || null);
      const awayOvertimeScore = Array.isArray(awayScores) && awayScores.length > 5 ? awayScores[5] : null;
      const awayPenaltyScore = Array.isArray(awayScores) && awayScores.length > 6 ? awayScores[6] : null;
      const awayRedCards = Array.isArray(awayScores) && awayScores.length > 2 ? awayScores[2] : null;
      const awayYellowCards = Array.isArray(awayScores) && awayScores.length > 3 ? awayScores[3] : null;
      const awayCorners = Array.isArray(awayScores) && awayScores.length > 4 ? awayScores[4] : null;

      // Extract competition info from results_extra
      let competitionInfo: any = null;
      if (competitionId && response.results_extra?.competition) {
        const compData = (response.results_extra.competition as any)[competitionId] as any;
        if (compData) {
          competitionInfo = {
            id: competitionId,
            name: compData.name || compData.name_en || compData.name_cn || null,
            logo_url: compData.logo_url || compData.logo || null,
          };
        }
      }

      // CRITICAL: Validate status against match_time (timezone fix)
      // If match_time is in the future, status cannot be "Ended"
      let validatedStatus = match.status_id || match.status || 0;
      const now = Math.floor(Date.now() / 1000); // Current Unix timestamp (UTC)
      if (match.match_time && match.match_time > now) {
        // Match is in the future, cannot be finished
        if (validatedStatus === 8 || validatedStatus === 12) { // END or CANCEL
          logger.debug(`Match ${match.id || match.match_id} has status ${validatedStatus} but match_time is in the future. Fixing to NOT_STARTED.`);
          validatedStatus = 1; // NOT_STARTED
        }
      }

      return {
        ...match,
        status_id: validatedStatus,
        status: validatedStatus,
        home_score: homeRegularScore,
        away_score: awayRegularScore,
        // CRITICAL: Add overtime and penalty scores for frontend display
        home_score_overtime: homeOvertimeScore,
        away_score_overtime: awayOvertimeScore,
        home_score_penalties: homePenaltyScore,
        away_score_penalties: awayPenaltyScore,
        // CRITICAL: Add live incidents statistics (Array[7] indices 2, 3, 4)
        home_red_cards: homeRedCards,
        away_red_cards: awayRedCards,
        home_yellow_cards: homeYellowCards,
        away_yellow_cards: awayYellowCards,
        home_corners: homeCorners,
        away_corners: awayCorners,
        // CRITICAL: Add raw team names - BRUTE FORCE MAPPING
        home_team_name: homeName,
        away_team_name: awayName,
        home_team_logo: homeTeamInfo?.logo_url || match.home_logo || match.home?.logo || null,
        away_team_logo: awayTeamInfo?.logo_url || match.away_logo || match.away?.logo || null,
        // CRITICAL: Add competition info from results_extra
        competition_info: competitionInfo,
      };
    });
    
    // DEBUG: Log final mapped match sample
    if (results.length > 0) {
      const sampleMatch = results[0] as any;
      logger.info('✅ [DEBUG] Final Mapped Match Sample:', {
        id: sampleMatch.id,
        home_team_id: sampleMatch.home_team_id,
        home_team_name: sampleMatch.home_team_name,
        home_team_name_type: typeof sampleMatch.home_team_name,
        away_team_id: sampleMatch.away_team_id,
        away_team_name: sampleMatch.away_team_name,
        away_team_name_type: typeof sampleMatch.away_team_name,
      });
    }
    
    const enrichedResults = await this.matchEnricher.enrichMatches(results);
    
    // CRITICAL FIX: Override enriched team names with raw API names if available
    // Also merge competition data from results_extra (MUST preserve competition_info priority)
    const finalResults = enrichedResults.map((match: any) => {
      // ALWAYS use raw API names if available (even if enricher found something)
      if (match.home_team_name && typeof match.home_team_name === 'string' && match.home_team_name.trim() !== '') {
        match.home_team = {
          id: match.home_team_id,
          name: match.home_team_name,
          logo_url: match.home_team_logo || match.home_team?.logo_url || null,
          short_name: null,
        };
      } else if (!match.home_team || match.home_team.name === 'Unknown Team') {
        // Fallback: keep the enriched team but mark as unknown
        match.home_team = match.home_team || {
          id: match.home_team_id,
          name: 'Unknown Team',
          logo_url: null,
          short_name: null,
        };
      }
      
      if (match.away_team_name && typeof match.away_team_name === 'string' && match.away_team_name.trim() !== '') {
        match.away_team = {
          id: match.away_team_id,
          name: match.away_team_name,
          logo_url: match.away_team_logo || match.away_team?.logo_url || null,
          short_name: null,
        };
      } else if (!match.away_team || match.away_team.name === 'Unknown Team') {
        // Fallback: keep the enriched team but mark as unknown
        match.away_team = match.away_team || {
          id: match.away_team_id,
          name: 'Unknown Team',
          logo_url: null,
          short_name: null,
        };
      }
      
      // CRITICAL: Merge competition data from results_extra (highest priority)
      // results_extra.competition has the most up-to-date data
      // MUST preserve competition_info even if enricher added a competition
      if (match.competition_info && match.competition_info.name) {
        // Use competition_info from results_extra (highest priority - ALWAYS override enricher)
        match.competition = {
          id: match.competition_info.id,
          name: match.competition_info.name,
          logo_url: match.competition_info.logo_url,
        };
        logger.debug(`✅ Using competition from results_extra: ${match.competition_info.name} (${match.competition_info.id})`);
      } else if (match.competition_id) {
        // Fallback 1: Try to get from enriched competition (DB) - only if results_extra didn't provide it
        if (match.competition && match.competition.name && match.competition.name !== 'Bilinmeyen Lig') {
          logger.debug(`Using competition from enricher (DB): ${match.competition.name} (${match.competition_id})`);
        } else {
          // Fallback 2: If competition_id exists but no name, try to fetch immediately
          logger.warn(`⚠️ Competition ${match.competition_id} has no name. Attempting immediate fetch...`);
          this.competitionService.getCompetitionById(match.competition_id)
            .then(comp => {
              if (comp && comp.name) {
                logger.info(`✅ Fetched competition ${match.competition_id}: ${comp.name}`);
                // Update the match object (non-blocking)
                match.competition = {
                  id: comp.id,
                  name: comp.name,
                  logo_url: comp.logo_url || null,
                };
              }
            })
            .catch(err => logger.warn(`Failed to fetch competition ${match.competition_id}:`, err));
          
          // Set placeholder competition to avoid "Unknown League" - but only if we have no competition at all
          if (!match.competition) {
            match.competition = {
              id: match.competition_id,
              name: null, // Will be updated when fetch completes
              logo_url: null,
            };
          }
        }
      }
      
      return match;
    });
    
    // DEBUG: Log final result after enrichment
    if (finalResults.length > 0) {
      const sampleFinal = finalResults[0] as any;
      logger.info('🎯 [DEBUG] Final Result After Enrichment:', {
        id: sampleFinal.id,
        home_team_name: sampleFinal.home_team?.name,
        home_team_id: sampleFinal.home_team_id,
        away_team_name: sampleFinal.away_team?.name,
        away_team_id: sampleFinal.away_team_id,
        competition_id: sampleFinal.competition_id,
        competition_name: sampleFinal.competition?.name || 'MISSING',
        competition_info: sampleFinal.competition_info ? 'PRESENT' : 'MISSING',
      });
    }

      // CRITICAL: Log final results count and competition coverage
      const matchesWithCompetition = finalResults.filter((m: any) => m.competition && m.competition.name).length;
      const matchesWithCompetitionInfo = finalResults.filter((m: any) => m.competition_info).length;
      const coveragePct =
        finalResults.length > 0 ? Math.round((matchesWithCompetition / finalResults.length) * 100) : 0;

      logger.info(
        `📊 [MatchDiary] Final results: ${finalResults.length} matches, ` +
        `${matchesWithCompetition} with competition names (${coveragePct}%), ` +
        `${matchesWithCompetitionInfo} with competition_info`
      );
      
      // CRITICAL: Ensure competition object is always present (even if name is null)
      // This prevents "Bilinmeyen Lig" in the frontend
      finalResults.forEach((match: any) => {
        if (match.competition_id) {
          if (!match.competition) {
            logger.warn(`⚠️ Match ${match.id} has competition_id ${match.competition_id} but no competition object. Creating placeholder.`);
            match.competition = {
              id: match.competition_id,
              name: null,
              logo_url: null,
            };
          }
          // Ensure competition object has the correct structure
          if (match.competition && !match.competition.id) {
            match.competition.id = match.competition_id;
          }
        }
      });

    const enrichedResponse: MatchDiaryResponse = {
      ...response,
      results: finalResults as any,
    };

    // Cache full response
    await cacheService.set(cacheKey, enrichedResponse, CacheTTL.Day);

    return enrichedResponse;
  }

  /**
   * Cache results_extra separately for team data enrichment
   */
  private async cacheResultsExtra(
    dateStr: string,
    resultsExtra: MatchDiaryResponse['results_extra']
  ): Promise<void> {
    if (!resultsExtra) return;

    const extraCacheKey = `${CacheKeyPrefix.TheSports}:diary:extra:${dateStr}`;
    await cacheService.set(extraCacheKey, resultsExtra, CacheTTL.Day);
    logger.debug(`Cached results_extra for date: ${dateStr}`);
  }

  /**
   * Build cache key from date
   */
  private buildCacheKey(dateStr: string): string {
    return `${CacheKeyPrefix.TheSports}:match:diary:${dateStr}`;
  }
}

