/**
 * Compare /match/diary vs /match/recent/list endpoints
 *
 * TheSports API has two main endpoints:
 * 1. /match/diary - Returns matches for a specific DATE
 * 2. /match/recent/list - Returns recently updated matches (paginated)
 */

import dotenv from 'dotenv';
import { theSportsAPI } from '../core/TheSportsAPIManager';
import { logger } from '../utils/logger';

dotenv.config();

// TSİ offset
const TSI_OFFSET_MS = 3 * 60 * 60 * 1000;

async function compare() {
  const nowTSI = new Date(Date.now() + TSI_OFFSET_MS);
  const todayStr = nowTSI.toISOString().split('T')[0].replace(/-/g, '');

  console.log('🔍 ENDPOINT COMPARISON');
  console.log('=======================');
  console.log(`Date: ${todayStr} (TSİ)`);
  console.log('');

  // 1. Fetch from /match/diary
  console.log('📅 FETCHING /match/diary...');
  try {
    const diaryResponse = await theSportsAPI.get<any>('/match/diary', { date: todayStr });
    const diaryMatches = diaryResponse.results || [];
    console.log(`   Total matches: ${diaryMatches.length}`);

    // Count by status
    const diaryByStatus: Record<number, number> = {};
    diaryMatches.forEach((m: any) => {
      const status = m.status_id || m.status || 0;
      diaryByStatus[status] = (diaryByStatus[status] || 0) + 1;
    });
    console.log('   Status distribution:', diaryByStatus);

    // Count unique competition IDs
    const diaryComps = new Set(diaryMatches.map((m: any) => m.competition_id));
    console.log(`   Unique competitions: ${diaryComps.size}`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('');

  // 2. Fetch from /match/recent/list (paginated - fetch all)
  console.log('📋 FETCHING /match/recent/list (all pages)...');
  try {
    const allRecentMatches: any[] = [];
    let page = 1;
    const limit = 500; // Max per page
    let hasMore = true;

    while (hasMore && page <= 10) { // Max 10 pages = 5000 matches
      const recentResponse = await theSportsAPI.get<any>('/match/recent/list', {
        page: page.toString(),
        limit: limit.toString()
      });

      const matches = recentResponse.results || [];
      console.log(`   Page ${page}: ${matches.length} matches`);

      if (matches.length === 0) {
        hasMore = false;
      } else {
        allRecentMatches.push(...matches);
        page++;

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`   Total fetched: ${allRecentMatches.length} matches`);

    // Filter to today only (using match_time)
    const startOfDay = Math.floor(new Date(`${nowTSI.toISOString().split('T')[0]}T00:00:00+03:00`).getTime() / 1000);
    const endOfDay = startOfDay + 86400;

    const todayMatches = allRecentMatches.filter((m: any) => {
      const mt = m.match_time;
      return mt >= startOfDay && mt < endOfDay;
    });

    console.log(`   Today's matches (filtered): ${todayMatches.length}`);

    // Count by status
    const recentByStatus: Record<number, number> = {};
    todayMatches.forEach((m: any) => {
      const status = m.status_id || m.status || 0;
      recentByStatus[status] = (recentByStatus[status] || 0) + 1;
    });
    console.log('   Status distribution:', recentByStatus);

    // Count unique competition IDs
    const recentComps = new Set(todayMatches.map((m: any) => m.competition_id));
    console.log(`   Unique competitions: ${recentComps.size}`);

  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('');
  console.log('📊 ANALYSIS');
  console.log('-----------');
  console.log('/match/diary: Returns matches scheduled for a specific date');
  console.log('/match/recent/list: Returns recently CHANGED matches (500 limit per page)');
  console.log('');
  console.log('If /match/recent/list has more matches, it means:');
  console.log('- Some matches were added/changed after the diary sync');
  console.log('- Need to run incremental sync more frequently');
}

compare().catch(console.error).finally(() => process.exit(0));
