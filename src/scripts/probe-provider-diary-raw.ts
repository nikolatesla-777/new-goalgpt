/**
 * Raw Provider Diary Probe Script
 * 
 * Uses backend services to call TheSports API (backend has IP whitelist)
 * Used for root-cause investigation of AIScore (135) vs our diary (125) mismatch
 */

import dotenv from 'dotenv';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { MatchRecentService } from '../services/thesports/match/matchRecent.service';

dotenv.config();


class RawProviderProbe {
  private client: TheSportsClient;
  private diaryService: MatchDiaryService;
  private recentService: MatchRecentService;

  constructor() {
    this.client = new TheSportsClient();
    this.diaryService = new MatchDiaryService(this.client);
    this.recentService = new MatchRecentService(this.client);
  }

  /**
   * Get base URL and auth info (for logging)
   */
  private getConfigInfo(): { baseUrl: string; user: string; secretSet: boolean } {
    // Access private config via reflection (for logging only)
    const baseUrl = (this.client as any).config?.baseUrl || 'https://api.thesports.com/v1/football';
    const user = (this.client as any).config?.user || '';
    const secret = (this.client as any).config?.secret || '';
    return { baseUrl, user, secretSet: !!secret };
  }

  /**
   * Step 1: Raw provider diary call (via backend service)
   */
  async probeDiary(date: string): Promise<{ count: number; ids: string[]; first5: string[]; last5: string[]; competitions: Record<string, number> }> {
    console.log(`\n=== STEP 1: Raw Provider Diary Call (date=${date}) ===\n`);
    
    const configInfo = this.getConfigInfo();
    console.log(`[REQUEST] /match/diary`);
    console.log(`  Base URL: ${configInfo.baseUrl}`);
    console.log(`  User: ${configInfo.user}`);
    console.log(`  Secret: ${configInfo.secretSet ? '***SET***' : 'NOT SET'}`);
    console.log(`  Params: date=${date}`);
    console.log(`  Headers: Accept: application/json, User-Agent: GoalGPT/1.0`);
    
    try {
      const response = await this.diaryService.getMatchDiary({ date, forceRefresh: true } as any);
      
      if (response.err) {
        console.error(`ERROR: ${response.err}`);
        return { count: 0, ids: [], first5: [], last5: [], competitions: {} };
      }
      
      const arr = response.results || [];
      const ids = arr.map((m: any) => String(m.id || m.external_id || m.match_id || '')).filter(Boolean);
      
      // Competition breakdown
      const competitions: Record<string, number> = {};
      arr.forEach((m: any) => {
        const compId = String(m.competition_id || 'unknown');
        competitions[compId] = (competitions[compId] || 0) + 1;
      });
      
      console.log(`[RESPONSE] provider_diary_count = ${ids.length}`);
      if (ids.length > 0) {
        console.log(`  First 5 IDs: ${ids.slice(0, 5).join(', ')}`);
        console.log(`  Last 5 IDs: ${ids.slice(-5).join(', ')}`);
      }
      
      return {
        count: ids.length,
        ids,
        first5: ids.slice(0, 5),
        last5: ids.slice(-5),
        competitions,
      };
    } catch (error: any) {
      console.error(`ERROR: ${error.message}`);
      return { count: 0, ids: [], first5: [], last5: [], competitions: {} };
    }
  }

  /**
   * Step 2: Date boundary test
   */
  async probeDateBoundary(): Promise<{
    day23: { count: number; ids: string[] };
    day24: { count: number; ids: string[] };
    day25: { count: number; ids: string[] };
    combined: { count: number; ids: string[] };
  }> {
    console.log(`\n=== STEP 2: Date Boundary Test (UTC/TSI Hypothesis) ===\n`);
    
    const day23 = await this.probeDiary('20251223');
    const day24 = await this.probeDiary('20251224');
    const day25 = await this.probeDiary('20251225');
    
    const combinedIds = new Set([...day23.ids, ...day24.ids, ...day25.ids]);
    
    console.log(`\n[SUMMARY]`);
    console.log(`  20251223: ${day23.count} matches`);
    console.log(`  20251224: ${day24.count} matches`);
    console.log(`  20251225: ${day25.count} matches`);
    console.log(`  Combined unique: ${combinedIds.size} matches`);
    
    return {
      day23: { count: day23.count, ids: day23.ids },
      day24: { count: day24.count, ids: day24.ids },
      day25: { count: day25.count, ids: day25.ids },
      combined: { count: combinedIds.size, ids: Array.from(combinedIds) },
    };
  }

  /**
   * Step 3: Endpoint mix hypothesis (recent/list)
   */
  async probeRecentList(): Promise<{ count: number; ids: string[] }> {
    console.log(`\n=== STEP 3: Endpoint Mix Hypothesis (/match/recent/list) ===\n`);
    
    const configInfo = this.getConfigInfo();
    console.log(`[REQUEST] /match/recent/list`);
    console.log(`  Base URL: ${configInfo.baseUrl}`);
    console.log(`  Params: page=1, limit=500`);
    
    try {
      const response = await this.recentService.getMatchRecentList({ page: 1, limit: 500 });
      
      if (response.err) {
        console.error(`ERROR: ${response.err}`);
        return { count: 0, ids: [] };
      }
      
      const arr = response.results || [];
      const ids = arr.map((m: any) => String(m.id || m.external_id || m.match_id || '')).filter(Boolean);
      
      console.log(`[RESPONSE] provider_recent_list_count = ${ids.length}`);
      
      return { count: ids.length, ids };
    } catch (error: any) {
      console.error(`ERROR: ${error.message}`);
      return { count: 0, ids: [] };
    }
  }

  /**
   * Step 4: Scope analysis (competition/country breakdown)
   */
  async probeScope(date: string): Promise<{
    competitionBreakdown: Record<string, number>;
    uniqueCompetitions: number;
    countryBreakdown?: Record<string, number>;
    uniqueCountries?: number;
  }> {
    console.log(`\n=== STEP 4: Scope Analysis (date=${date}) ===\n`);
    
    try {
      const response = await this.diaryService.getMatchDiary({ date, forceRefresh: true } as any);
      
      if (response.err || !response.results) {
        console.error(`ERROR: ${response.err || 'No results'}`);
        return { competitionBreakdown: {}, uniqueCompetitions: 0 };
      }
      
      const arr = response.results || [];
      const competitionMap: Record<string, number> = {};
      const countryMap: Record<string, number> = {};
      
      arr.forEach((m: any) => {
        const compId = String(m.competition_id || 'unknown');
        competitionMap[compId] = (competitionMap[compId] || 0) + 1;
        
        if (m.country_id) {
          const countryId = String(m.country_id);
          countryMap[countryId] = (countryMap[countryId] || 0) + 1;
        }
      });
      
      const topCompetitions = Object.entries(competitionMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
      
      console.log(`[SCOPE ANALYSIS]`);
      console.log(`  Total matches: ${arr.length}`);
      console.log(`  Unique competitions: ${Object.keys(competitionMap).length}`);
      console.log(`  Top 15 competitions:`);
      topCompetitions.forEach(([compId, count]) => {
        console.log(`    ${compId}: ${count} matches`);
      });
      
      if (Object.keys(countryMap).length > 0) {
        console.log(`  Unique countries: ${Object.keys(countryMap).length}`);
        const topCountries = Object.entries(countryMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        console.log(`  Top 10 countries:`);
        topCountries.forEach(([countryId, count]) => {
          console.log(`    ${countryId}: ${count} matches`);
        });
      }
      
      return {
        competitionBreakdown: competitionMap,
        uniqueCompetitions: Object.keys(competitionMap).length,
        countryBreakdown: Object.keys(countryMap).length > 0 ? countryMap : undefined,
        uniqueCountries: Object.keys(countryMap).length > 0 ? Object.keys(countryMap).length : undefined,
      };
    } catch (error: any) {
      console.error(`ERROR: ${error.message}`);
      return { competitionBreakdown: {}, uniqueCompetitions: 0 };
    }
  }
}

async function main() {
  const probe = new RawProviderProbe();
  const configInfo = probe.getConfigInfo();
  
  console.log('=== RAW PROVIDER DIARY PROBE ===');
  console.log(`Base URL: ${configInfo.baseUrl}`);
  console.log(`User: ${configInfo.user || 'NOT SET'}`);
  console.log(`Secret: ${configInfo.secretSet ? '***SET***' : 'NOT SET'}`);
  
  try {
    // Step 1: Raw provider call for 20251224
    const step1 = await probe.probeDiary('20251224');
    
    // Step 2: Date boundary test
    const step2 = await probe.probeDateBoundary();
    
    // Step 3: Endpoint mix
    const step3 = await probe.probeRecentList();
    
    // Step 3 continued: Compute set difference for 24 Dec 2025 TSI range
    const start24Dec2025TSI = 1766523600; // 24 Dec 2025 00:00 TSİ
    const end24Dec2025TSI = 1766610000; // 25 Dec 2025 00:00 TSİ
    
    // Filter recent/list matches for 24 Dec 2025 TSI
    const recent24Dec = step3.ids.filter(async (id) => {
      // We need match_time from recent/list response, but we only have IDs
      // For now, we'll compare all recent IDs with diary IDs
      return true;
    });
    
    const diaryIds = new Set(step1.ids);
    const recentIds = new Set(step3.ids);
    const onlyInRecent = Array.from(recentIds).filter(id => !diaryIds.has(id));
    const onlyInDiary = Array.from(diaryIds).filter(id => !recentIds.has(id));
    
    console.log(`\n[ENDPOINT MIX ANALYSIS]`);
    console.log(`  Diary unique: ${diaryIds.size}`);
    console.log(`  Recent/list unique: ${recentIds.size}`);
    console.log(`  Only in recent/list (not in diary): ${onlyInRecent.length}`);
    if (onlyInRecent.length > 0) {
      console.log(`  Sample IDs: ${onlyInRecent.slice(0, 10).join(', ')}`);
    }
    console.log(`  Only in diary (not in recent/list): ${onlyInDiary.length}`);
    
    // Step 4: Scope analysis
    const step4 = await probe.probeScope('20251224');
    
    // Final summary
    console.log(`\n=== FINAL SUMMARY ===`);
    console.log(`Step 1 (20251224 diary): ${step1.count} matches`);
    console.log(`Step 2 (combined 23-25): ${step2.combined.count} matches`);
    console.log(`Step 3 (recent/list): ${step3.count} matches`);
    console.log(`Step 3 (recent not in diary): ${onlyInRecent.length} matches`);
    console.log(`Step 4 (unique competitions): ${step4.uniqueCompetitions}`);
    
    process.exit(0);
  } catch (error: any) {
    console.error(`\n[FATAL ERROR]`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

