/**
 * Competition Service
 * 
 * Handles competition data retrieval
 */

import { TheSportsClient } from '../client/thesports-client';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { logger } from '../../../utils/logger';
import { CompetitionRepository, CompetitionEntity } from '../../../repositories/implementations/CompetitionRepository';

export interface Competition {
  id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  type?: number | null;
  category_id?: string | null;
  country_id?: string | null;
  country_name?: string;
  cur_season_id?: string | null;
  cur_stage_id?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

export interface CompetitionListResponse {
  results: Competition[];
  err?: string;
}

export class CompetitionService {
  private repository: CompetitionRepository;

  constructor(private client: TheSportsClient) {
    this.repository = new CompetitionRepository();
  }

  /**
   * Get competition list
   */
  async getCompetitionList(): Promise<CompetitionListResponse> {
    const cacheKey = `${CacheKeyPrefix.TheSports}:competition:list`;

    // Check cache
    const cached = await cacheService.get<CompetitionListResponse>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for competition list');
      return cached;
    }

    try {
      logger.info('Fetching competition list from API');
      const response = await this.client.get<CompetitionListResponse>(
        '/competition/list'
      );

      if (response.err) {
        logger.warn(`TheSports API error for competition list: ${response.err}`);
        return { results: [], err: response.err };
      }

      // Cache response
      await cacheService.set(cacheKey, response, CacheTTL.Day);

      return response;
    } catch (error: any) {
      logger.error('Failed to fetch competition list:', error);
      return { results: [], err: error.message };
    }
  }

  /**
   * Get competition by ID (from database first, fallback to API)
   */
  async getCompetitionById(competitionId: string): Promise<Competition | null> {
    // 1. Check cache
    const cacheKey = `${CacheKeyPrefix.TheSports}:competition:${competitionId}`;
    const cached = await cacheService.get<Competition>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Check database
    const dbCompetition = await this.repository.findByExternalId(competitionId);
    if (dbCompetition) {
      const competition: Competition = {
        id: dbCompetition.external_id,
        name: dbCompetition.name,
        short_name: dbCompetition.short_name || null,
        logo_url: dbCompetition.logo_url || null,
        type: dbCompetition.type || null,
        category_id: dbCompetition.category_id || null,
        country_id: dbCompetition.country_id || null,
        country_name: dbCompetition.country_name || undefined, // From ts_countries JOIN
        cur_season_id: dbCompetition.cur_season_id || null,
        cur_stage_id: dbCompetition.cur_stage_id || null,
        primary_color: dbCompetition.primary_color || null,
        secondary_color: dbCompetition.secondary_color || null,
      };
      await cacheService.set(cacheKey, competition, CacheTTL.Day);
      return competition;
    }

    // 3. Fallback to API (should rarely happen if sync is working)
    logger.debug(`Competition ${competitionId} not in DB, fetching from API`);
    try {
      const list = await this.getCompetitionList();
      if (list && list.results && Array.isArray(list.results)) {
        const apiCompetition = list.results.find(c => c && c.id === competitionId);
        if (apiCompetition) {
          await cacheService.set(cacheKey, apiCompetition, CacheTTL.Day);
          return apiCompetition;
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to fetch competition ${competitionId} from API: ${error.message}`);
    }
    return null;
  }

  /**
   * Get competitions by IDs (batch) - from database first
   */
  async getCompetitionsByIds(competitionIds: string[]): Promise<Map<string, Competition>> {
    const map = new Map<string, Competition>();
    if (competitionIds.length === 0) return map;

    // 1. Check cache for all
    const cachePromises = competitionIds.map(async (id) => {
      const cacheKey = `${CacheKeyPrefix.TheSports}:competition:${id}`;
      const cached = await cacheService.get<Competition>(cacheKey);
      if (cached) {
        map.set(id, cached);
      }
      return { id, cached };
    });
    await Promise.all(cachePromises);

    // 2. Check database for missing
    const missingIds = competitionIds.filter(id => !map.has(id));
    if (missingIds.length > 0) {
      const dbCompetitions = await this.repository.findByExternalIds(missingIds);
      for (const dbComp of dbCompetitions) {
        const competition: Competition = {
          id: dbComp.external_id,
          name: dbComp.name,
          short_name: dbComp.short_name || null,
          logo_url: dbComp.logo_url || null,
          type: dbComp.type || null,
          category_id: dbComp.category_id || null,
          country_id: dbComp.country_id || null,
          country_name: dbComp.country_name || undefined, // From ts_countries JOIN
          cur_season_id: dbComp.cur_season_id || null,
          cur_stage_id: dbComp.cur_stage_id || null,
          primary_color: dbComp.primary_color || null,
          secondary_color: dbComp.secondary_color || null,
        };
        map.set(dbComp.external_id, competition);

        // Cache it
        const cacheKey = `${CacheKeyPrefix.TheSports}:competition:${dbComp.external_id}`;
        await cacheService.set(cacheKey, competition, CacheTTL.Day);
      }
    }

    // 3. Fallback to API for still missing (should rarely happen)
    const stillMissing = competitionIds.filter(id => !map.has(id));
    if (stillMissing.length > 0) {
      logger.debug(`Fetching ${stillMissing.length} competitions from API (not in DB)`);
      try {
        const list = await this.getCompetitionList();
        if (list && list.results && Array.isArray(list.results)) {
          for (const comp of list.results) {
            if (comp && comp.id && stillMissing.includes(comp.id)) {
              map.set(comp.id, comp);
              const cacheKey = `${CacheKeyPrefix.TheSports}:competition:${comp.id}`;
              await cacheService.set(cacheKey, comp, CacheTTL.Day);
            }
          }
        }
      } catch (error: any) {
        logger.warn(`Failed to fetch competition list from API: ${error.message}`);
      }
    }

    return map;
  }

  /**
   * Enrich competition data from results_extra
   * CRITICAL: Saves to DB, not just cache (prevents foreign key constraint failures)
   */
  async enrichFromResultsExtra(resultsExtra: { competition?: Record<string, any> }): Promise<void> {
    if (!resultsExtra.competition) {
      return;
    }

    try {
      // Extract competition data from results_extra
      const competitions = resultsExtra.competition;
      const competitionsToSave: Array<{
        external_id: string;
        name: string;
        logo_url?: string | null;
        country_id?: string | null;
        category_id?: string | null;
        type?: number | null;
      }> = [];

      // Prepare competitions for DB save
      for (const [compId, compData] of Object.entries(competitions)) {
        if (!compId || compId === '0' || compId === '') continue;

        const competition: Competition = {
          id: compId,
          name: compData.name || compData.name_en || compData.name_cn || 'Unknown Competition',
          logo_url: compData.logo_url || compData.logo || null,
          country_id: compData.country_id || undefined,
          country_name: compData.country_name || undefined,
        };

        // Save to DB (CRITICAL: Prevents foreign key constraint failures)
        competitionsToSave.push({
          external_id: compId,
          name: competition.name,
          logo_url: competition.logo_url || null,
          country_id: competition.country_id || null,
          category_id: compData.category_id || null,
          type: compData.type || null,
        });

        // Also cache it
        const cacheKey = `${CacheKeyPrefix.TheSports}:competition:${compId}`;
        await cacheService.set(cacheKey, competition, CacheTTL.Day);
      }

      // Batch save to DB
      if (competitionsToSave.length > 0) {
        await this.repository.batchUpsert(competitionsToSave);
        logger.info(`✅ Saved ${competitionsToSave.length} competitions to DB from results_extra`);
      }

      logger.debug(`Enriched ${Object.keys(competitions).length} competitions from results_extra`);
    } catch (error: any) {
      logger.error('❌ Failed to enrich competitions from results_extra:', error.message);
      throw error; // Re-throw to prevent silent failures
    }
  }
}

