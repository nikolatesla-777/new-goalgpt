/**
 * FootyStatsAPIClient - Singleton Pattern
 *
 * FootyStats API client for advanced betting statistics:
 * - xG (Expected Goals)
 * - BTTS Potential
 * - Over/Under Percentages
 * - Referee Stats
 * - Form Strings
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../../utils/logger';

// ============================================================================
// RATE LIMITER - Simple Token Bucket for FootyStats
// ============================================================================

interface RateLimitConfig {
  requestsPerMinute: number;
  maxBurst: number;
}

const FOOTYSTATS_RATE_CONFIG: RateLimitConfig = {
  requestsPerMinute: 30, // FootyStats allows more requests
  maxBurst: 10,
};

class FootyStatsRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = FOOTYSTATS_RATE_CONFIG) {
    this.config = config;
    this.tokens = config.maxBurst;
    this.lastRefill = Date.now();
  }

  async acquire(context: string = 'default'): Promise<void> {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitTime = this.calculateWaitTime();
    logger.debug(`[FootyStats RateLimit] Waiting ${waitTime}ms for ${context}`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.refillTokens();
    this.tokens -= 1;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timeElapsed = (now - this.lastRefill) / 1000;
    const tokensPerSecond = this.config.requestsPerMinute / 60;
    const tokensToAdd = timeElapsed * tokensPerSecond;
    this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxBurst);
    this.lastRefill = now;
  }

  private calculateWaitTime(): number {
    const tokensPerSecond = this.config.requestsPerMinute / 60;
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / tokensPerSecond) * 1000);
  }
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface FootyStatsPager {
  current_page: number;
  max_page: number;
  results_per_page: number;
  total_results: number;
}

export interface FootyStatsResponse<T> {
  success: boolean;
  pager?: FootyStatsPager;
  data: T;
}

export interface FootyStatsLeagueSeason {
  id: number;
  year: number;
}

export interface FootyStatsLeague {
  name: string;
  country: string;
  league_name: string;
  image?: string;
  season: FootyStatsLeagueSeason[];
}

export interface FootyStatsTeam {
  id: number;
  name: string;
  cleanName: string;
  country: string;
  image?: string;
  seasonPPG_overall?: number;
  seasonBTTSPercentage_overall?: number;
  seasonOver25Percentage_overall?: number;
  xg_for_avg_overall?: number;
  formRun_overall?: string;
}

export interface FootyStatsMatch {
  id: number;
  homeID: number;
  awayID: number;
  home_name: string;
  away_name: string;
  status: string;
  date_unix: number;
  homeGoalCount: number;
  awayGoalCount: number;
  btts_potential?: number;
  o25_potential?: number;
  avg_potential?: number;
  corners_potential?: number;
  cards_potential?: number;
  team_a_xg_prematch?: number;
  team_b_xg_prematch?: number;
  odds_ft_1?: number;
  odds_ft_x?: number;
  odds_ft_2?: number;
  trends?: {
    home: [string, string][];
    away: [string, string][];
  };
  h2h?: {
    previous_matches_results: {
      team_a_wins: number;
      team_b_wins: number;
      draw: number;
      totalMatches: number;
    };
    betting_stats: {
      bttsPercentage: number;
      over25Percentage: number;
      avg_goals: number;
    };
    previous_matches_ids?: Array<{
      id: number;
      date_unix: number;
      team_a_id: number;
      team_b_id: number;
      team_a_goals: number;
      team_b_goals: number;
    }>;
  };
}

export interface FootyStatsTeamForm {
  team_id: number;
  last_x_match_num: number;
  formRun_overall: string;
  formRun_home: string;
  formRun_away: string;
  seasonPPG_overall: number;
  seasonBTTSPercentage_overall: number;
  seasonOver25Percentage_overall: number;
  xg_for_avg_overall: number;
  xg_against_avg_overall: number;
  cornersAVG_overall: number;
  cardsAVG_overall: number;
}

export interface FootyStatsReferee {
  id: number;
  full_name: string;
  nationality: string;
  appearances_overall: number;
  btts_percentage: number;
  goals_per_match_overall: number;
  penalties_given_per_match_overall: number;
  cards_per_match?: number;
}

// ============================================================================
// SINGLETON CLIENT
// ============================================================================

class FootyStatsAPIClient {
  private static instance: FootyStatsAPIClient | null = null;

  private axiosInstance: AxiosInstance;
  private rateLimiter: FootyStatsRateLimiter;
  private apiKey: string;
  private isInitialized = false;

  // Metrics
  private requestCount = 0;
  private errorCount = 0;

  private constructor() {
    this.apiKey = process.env.FOOTYSTATS_API_KEY || '';

    this.axiosInstance = axios.create({
      baseURL: 'https://api.football-data-api.com',
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GoalGPT/1.0-FootyStats',
      },
    });

    this.rateLimiter = new FootyStatsRateLimiter();
    this.setupInterceptors();
    this.isInitialized = true;

    logger.info('[FootyStatsAPI] Client initialized');
  }

  static getInstance(): FootyStatsAPIClient {
    if (!FootyStatsAPIClient.instance) {
      FootyStatsAPIClient.instance = new FootyStatsAPIClient();
    }
    return FootyStatsAPIClient.instance;
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (cfg) => {
        (cfg as any).metadata = { startTime: Date.now() };
        logger.debug(`[FootyStatsAPI] → ${cfg.method?.toUpperCase()} ${cfg.url}`);
        return cfg;
      },
      (error) => {
        logger.error('[FootyStatsAPI] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        const startTime = (response.config as any).metadata?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;
        logger.debug(`[FootyStatsAPI] ← ${response.status} (${duration}ms)`);
        return response;
      },
      (error) => {
        this.errorCount++;
        logger.error('[FootyStatsAPI] Response error:', error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set API key (for runtime configuration)
   */
  setApiKey(key: string): void {
    this.apiKey = key;
    logger.info('[FootyStatsAPI] API key updated');
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Generic GET request
   */
  private async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    await this.rateLimiter.acquire(endpoint);
    this.requestCount++;

    const queryParams = new URLSearchParams({
      key: this.apiKey,
      ...params,
    });

    const url = `${endpoint}?${queryParams.toString()}`;
    const response: AxiosResponse<T> = await this.axiosInstance.get(url);

    if (response.status >= 400) {
      throw new Error(`FootyStats API Error: ${response.status}`);
    }

    return response.data;
  }

  // ============================================================================
  // API ENDPOINTS
  // ============================================================================

  /**
   * Get list of all available leagues
   */
  async getLeagueList(): Promise<FootyStatsResponse<FootyStatsLeague[]>> {
    return this.get<FootyStatsResponse<FootyStatsLeague[]>>('/league-list');
  }

  /**
   * Get today's matches
   */
  async getTodaysMatches(date?: string, timezone?: string): Promise<FootyStatsResponse<FootyStatsMatch[]>> {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    if (timezone) params.timezone = timezone;
    return this.get<FootyStatsResponse<FootyStatsMatch[]>>('/todays-matches', params);
  }

  /**
   * Get match details with stats, H2H, odds, trends
   */
  async getMatchDetails(matchId: number): Promise<FootyStatsResponse<FootyStatsMatch>> {
    return this.get<FootyStatsResponse<FootyStatsMatch>>('/match', { match_id: matchId.toString() });
  }

  /**
   * Get league teams
   */
  async getLeagueTeams(seasonId: number): Promise<FootyStatsResponse<FootyStatsTeam[]>> {
    return this.get<FootyStatsResponse<FootyStatsTeam[]>>('/league-teams', { season_id: seasonId.toString() });
  }

  /**
   * Get league season stats
   */
  async getLeagueSeason(seasonId: number): Promise<FootyStatsResponse<any>> {
    return this.get<FootyStatsResponse<any>>('/league-season', { season_id: seasonId.toString() });
  }

  /**
   * Get team last X matches form
   */
  async getTeamLastX(teamId: number): Promise<FootyStatsResponse<FootyStatsTeamForm[]>> {
    return this.get<FootyStatsResponse<FootyStatsTeamForm[]>>('/lastx', { team_id: teamId.toString() });
  }

  /**
   * Get referee stats
   */
  async getRefereeStats(refereeId: number): Promise<FootyStatsResponse<FootyStatsReferee[]>> {
    return this.get<FootyStatsResponse<FootyStatsReferee[]>>('/referee', { referee_id: refereeId.toString() });
  }

  /**
   * Get BTTS top stats (teams, fixtures, leagues)
   */
  async getBTTSStats(): Promise<FootyStatsResponse<any>> {
    return this.get<FootyStatsResponse<any>>('/stats-data-btts');
  }

  /**
   * Get Over 2.5 top stats
   */
  async getOver25Stats(): Promise<FootyStatsResponse<any>> {
    return this.get<FootyStatsResponse<any>>('/stats-data-over25');
  }

  // ============================================================================
  // HEALTH & METRICS
  // ============================================================================

  getHealth(): {
    initialized: boolean;
    configured: boolean;
    metrics: { requests: number; errors: number };
  } {
    return {
      initialized: this.isInitialized,
      configured: this.isConfigured(),
      metrics: {
        requests: this.requestCount,
        errors: this.errorCount,
      },
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const footyStatsAPI = FootyStatsAPIClient.getInstance();
export { FootyStatsAPIClient };
