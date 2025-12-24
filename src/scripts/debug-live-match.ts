/**
 * Debug Live Match Script
 * 
 * Single match root-cause analysis:
 * 1. DB state vs Provider state comparison
 * 2. Why provider data didn't write to DB (log analysis)
 * 3. Minimal fix proposal
 */

import dotenv from 'dotenv';
import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { MatchRecentService } from '../services/thesports/match/matchRecent.service';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface DebugResult {
  external_id: string;
  db: {
    match_time: number | null;
    status_id: number | null;
    minute: number | null;
    minute_text: string | null;
    home_score: number | null;
    away_score: number | null;
    provider_update_time: number | null;
    last_event_ts: number | null;
    updated_at: string | null;
    first_half_kickoff_ts: number | null;
    second_half_kickoff_ts: number | null;
  };
  provider: {
    diary: {
      found: boolean;
      status_id: number | null;
      minute: number | null;
      minute_text: string | null;
      home_score: number | null;
      away_score: number | null;
      update_time: number | null;
    };
    recent_list: {
      found: boolean;
      status_id: number | null;
      minute: number | null;
      minute_text: string | null;
      home_score: number | null;
      away_score: number | null;
      update_time: number | null;
    };
    detail_live: {
      found: boolean;
      status_id: number | null;
      minute: number | null;
      minute_text: string | null;
      home_score: number | null;
      away_score: number | null;
      update_time: number | null;
      error?: string;
    };
  };
  logs: {
    watchdog_reconcile: Array<{
      timestamp: string;
      event: string;
      match_id: string;
      result?: string;
      reason?: string;
      row_count?: number;
      duration_ms?: number;
    }>;
    dataupdate_reconcile: Array<{
      timestamp: string;
      event: string;
      match_id: string;
      result?: string;
      row_count?: number;
      duration_ms?: number;
    }>;
    websocket: Array<{
      timestamp: string;
      event: string;
      match_id?: string;
      message?: string;
    }>;
  };
  mismatch: {
    status: boolean;
    minute: boolean;
    score: boolean;
    overall: boolean;
  };
  root_cause?: string;
}

async function getDbState(externalId: string): Promise<any> {
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        external_id,
        match_time,
        status_id,
        minute,
        home_score_regular as home_score,
        away_score_regular as away_score,
        provider_update_time,
        last_event_ts,
        updated_at,
        first_half_kickoff_ts,
        second_half_kickoff_ts
      FROM ts_matches
      WHERE external_id = $1
    `;
    const result = await client.query(query, [externalId]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

function generateMinuteText(minute: number | null, statusId: number | null): string {
  if (minute === null) return '—';
  if (statusId === 1) return '—';
  if (statusId === 3) return 'Devre Arası';
  if (statusId === 8 || statusId === 9 || statusId === 10 || statusId === 12) return 'FT';
  if (minute < 0) return '—';
  if (minute > 90) return `${minute}'`;
  return `${minute}'`;
}

async function getProviderDiaryState(externalId: string, date: string): Promise<any> {
  try {
    // Use backend API instead of direct client (bypasses IP whitelist)
    const http = require('http');
    const url = `http://localhost:3000/api/matches/diary?date=${date}`;
    
    return new Promise((resolve) => {
      http.get(url, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const matches = response.data?.results || [];
            const match = matches.find((m: any) => 
              String(m.external_id || m.id || m.match_id) === externalId
            );
            
            if (!match) {
              resolve({ found: false });
              return;
            }
            
            const statusId = match.status_id ?? match.status ?? null;
            const minute = match.minute !== null && match.minute !== undefined ? Number(match.minute) : null;
            
            resolve({
              found: true,
              status_id: statusId,
              minute: minute,
              minute_text: generateMinuteText(minute, statusId),
              home_score: match.home_score ?? null,
              away_score: match.away_score ?? null,
              update_time: match.provider_update_time ?? match.update_time ?? null,
            });
          } catch (error: any) {
            resolve({ found: false, error: error.message });
          }
        });
      }).on('error', (error: any) => {
        resolve({ found: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { found: false, error: error.message };
  }
}

async function getProviderRecentListState(externalId: string): Promise<any> {
  try {
    // Use backend API instead of direct client (bypasses IP whitelist)
    const http = require('http');
    const url = 'http://localhost:3000/api/provider/recent-list?page=1&limit=500';
    
    return new Promise((resolve) => {
      http.get(url, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const matches = response.results || [];
            const match = matches.find((m: any) => 
              String(m.id || m.external_id || m.match_id) === externalId
            );
            
            if (!match) {
              resolve({ found: false });
              return;
            }
            
            const statusId = match.status_id ?? match.status ?? null;
            const minute = match.minute !== null && match.minute !== undefined ? Number(match.minute) : null;
            
            resolve({
              found: true,
              status_id: statusId,
              minute: minute,
              minute_text: generateMinuteText(minute, statusId),
              home_score: match.home_score ?? null,
              away_score: match.away_score ?? null,
              update_time: match.provider_update_time ?? match.update_time ?? null,
            });
          } catch (error: any) {
            resolve({ found: false, error: error.message });
          }
        });
      }).on('error', (error: any) => {
        resolve({ found: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { found: false, error: error.message };
  }
}

async function getProviderDetailLiveState(externalId: string): Promise<any> {
  try {
    const client = new TheSportsClient();
    const detailService = new MatchDetailLiveService(client);
    const response = await detailService.getMatchDetailLive({ match_id: externalId }, { forceRefresh: true });
    
    if (!response || !response.results || response.results.length === 0) {
      return { found: false, error: 'NOT_FOUND' };
    }
    
    const match = response.results[0];
    const statusId = match.status_id ?? match.status ?? null;
    const minute = match.minute !== null && match.minute !== undefined ? Number(match.minute) : null;
    
    return {
      found: true,
      status_id: statusId,
      minute: minute,
      minute_text: generateMinuteText(minute, statusId),
      home_score: match.home_score ?? null,
      away_score: match.away_score ?? null,
      update_time: match.provider_update_time ?? match.update_time ?? null,
    };
  } catch (error: any) {
    return { found: false, error: error.message };
  }
}

function parseLogLine(line: string): any {
  try {
    const parsed = JSON.parse(line);
    return parsed;
  } catch {
    return null;
  }
}

async function searchLogs(externalId: string, logPath: string = 'logs/combined.log'): Promise<any> {
  const logs = {
    watchdog_reconcile: [] as any[],
    dataupdate_reconcile: [] as any[],
    websocket: [] as any[],
  };
  
  try {
    if (!fs.existsSync(logPath)) {
      return logs;
    }
    
    // Use tail command to get last 1000 lines (more efficient than reading entire file)
    const { execSync } = require('child_process');
    let lines: string[] = [];
    try {
      const tailOutput = execSync(`tail -n 1000 "${logPath}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      lines = tailOutput.split('\n').filter(l => l.trim());
    } catch (error: any) {
      // Fallback: try reading last N bytes
      const stats = fs.statSync(logPath);
      const fileSize = stats.size;
      const chunkSize = Math.min(1024 * 1024, fileSize); // 1MB chunk
      const buffer = Buffer.alloc(chunkSize);
      const fd = fs.openSync(logPath, 'r');
      fs.readSync(fd, buffer, 0, chunkSize, fileSize - chunkSize);
      fs.closeSync(fd);
      lines = buffer.toString('utf-8').split('\n').filter(l => l.trim());
    }
    
    for (const line of lines) {
      if (!line.includes(externalId)) continue;
      
      const parsed = parseLogLine(line);
      if (!parsed) continue;
      
      const event = parsed.event || parsed.message || '';
      const matchId = parsed.match_id || parsed.matchId || '';
      
      if (event.includes('watchdog.reconcile')) {
        logs.watchdog_reconcile.push({
          timestamp: parsed.timestamp || parsed.ts || '',
          event: event,
          match_id: matchId,
          result: parsed.result,
          reason: parsed.reason,
          row_count: parsed.row_count || parsed.rowCount,
          duration_ms: parsed.duration_ms || parsed.duration_ms,
        });
      }
      
      if (event.includes('dataupdate.reconcile')) {
        logs.dataupdate_reconcile.push({
          timestamp: parsed.timestamp || parsed.ts || '',
          event: event,
          match_id: matchId,
          result: parsed.result,
          row_count: parsed.row_count || parsed.rowCount,
          duration_ms: parsed.duration_ms || parsed.duration_ms,
        });
      }
      
      if (event.includes('websocket') || event.includes('mqtt')) {
        logs.websocket.push({
          timestamp: parsed.timestamp || parsed.ts || '',
          event: event,
          match_id: matchId,
          message: parsed.message,
        });
      }
    }
  } catch (error: any) {
    logger.error('Error reading logs:', error);
  }
  
  return logs;
}

async function main() {
  const args = process.argv.slice(2);
  let externalId: string | null = null;
  let teamName: string | null = null;
  let date: string | null = null;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--externalId' && args[i + 1]) {
      externalId = args[i + 1];
      i++;
    } else if (args[i] === '--team' && args[i + 1]) {
      teamName = args[i + 1];
      i++;
    } else if (args[i] === '--date' && args[i + 1]) {
      date = args[i + 1];
      i++;
    }
  }
  
  // If team name provided, find external_id
  if (!externalId && teamName && date) {
    const client = await pool.connect();
    try {
      const year = parseInt(date.substring(0, 4));
      const month = parseInt(date.substring(4, 6)) - 1;
      const day = parseInt(date.substring(6, 8));
      const TSI_OFFSET_SECONDS = 3 * 3600;
      const startOfDayUTC = new Date(Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000);
      const endOfDayUTC = new Date(Date.UTC(year, month, day, 23, 59, 59) - TSI_OFFSET_SECONDS * 1000);
      const startUnix = Math.floor(startOfDayUTC.getTime() / 1000);
      const endUnix = Math.floor(endOfDayUTC.getTime() / 1000);
      
      const query = `
        SELECT m.external_id, ht.name as home_team, at.name as away_team
        FROM ts_matches m
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        WHERE m.match_time >= $1 AND m.match_time <= $2
          AND (ht.name ILIKE $3 OR at.name ILIKE $3)
        LIMIT 1
      `;
      const result = await client.query(query, [startUnix, endUnix, `%${teamName}%`]);
      if (result.rows.length > 0) {
        externalId = result.rows[0].external_id;
        console.log(`Found match: ${result.rows[0].home_team} vs ${result.rows[0].away_team} (${externalId})`);
      }
    } finally {
      client.release();
    }
  }
  
  if (!externalId) {
    console.error('Error: --externalId or --team + --date required');
    process.exit(1);
  }
  
  if (!date) {
    // Extract date from match_time
    const dbState = await getDbState(externalId);
    if (dbState && dbState.match_time) {
      const matchDate = new Date(dbState.match_time * 1000);
      date = `${matchDate.getUTCFullYear()}${String(matchDate.getUTCMonth() + 1).padStart(2, '0')}${String(matchDate.getUTCDate()).padStart(2, '0')}`;
    } else {
      console.error('Error: Cannot determine date. Provide --date YYYYMMDD');
      process.exit(1);
    }
  }
  
  console.log(`\n=== DEBUG LIVE MATCH ===`);
  console.log(`External ID: ${externalId}`);
  console.log(`Date: ${date}`);
  console.log(`\n[1/4] Fetching DB state...`);
  
  const dbState = await getDbState(externalId);
  if (!dbState) {
    console.error(`Match not found in DB: ${externalId}`);
    process.exit(1);
  }
  
  console.log(`[2/4] Fetching Provider states...`);
  const [diaryState, recentListState, detailLiveState] = await Promise.all([
    getProviderDiaryState(externalId, date),
    getProviderRecentListState(externalId),
    getProviderDetailLiveState(externalId),
  ]);
  
  console.log(`[3/4] Searching logs...`);
  const logs = await searchLogs(externalId);
  
  console.log(`[4/4] Analyzing mismatch...`);
  
  // Determine authoritative provider state (priority: detail_live > recent_list > diary)
  const providerState = detailLiveState.found ? detailLiveState :
                        recentListState.found ? recentListState :
                        diaryState.found ? diaryState :
                        null;
  
  const mismatch = {
    status: providerState && providerState.status_id !== dbState.status_id,
    minute: providerState && providerState.minute !== dbState.minute,
    score: providerState && (
      providerState.home_score !== dbState.home_score ||
      providerState.away_score !== dbState.away_score
    ),
    overall: false,
  };
  mismatch.overall = mismatch.status || mismatch.minute || mismatch.score;
  
  // Determine root cause
  let rootCause = 'UNKNOWN';
  if (!providerState || (!detailLiveState.found && !recentListState.found && !diaryState.found)) {
    rootCause = 'PROVIDER_NOT_FOUND';
  } else if (logs.watchdog_reconcile.length > 0) {
    const lastReconcile = logs.watchdog_reconcile[logs.watchdog_reconcile.length - 1];
    if (lastReconcile.row_count === 0) {
      rootCause = `WATCHDOG_RECONCILE_SKIPPED: ${lastReconcile.reason || 'unknown'}`;
    } else {
      rootCause = 'WATCHDOG_RECONCILE_SUCCESS_BUT_STALE';
    }
  } else if (logs.dataupdate_reconcile.length > 0) {
    const lastReconcile = logs.dataupdate_reconcile[logs.dataupdate_reconcile.length - 1];
    if (lastReconcile.row_count === 0) {
      rootCause = `DATAUPDATE_RECONCILE_SKIPPED: ${lastReconcile.reason || 'unknown'}`;
    } else {
      rootCause = 'DATAUPDATE_RECONCILE_SUCCESS_BUT_STALE';
    }
  } else if (logs.websocket.length === 0) {
    rootCause = 'NO_WEBSOCKET_MESSAGE';
  } else {
    rootCause = 'NO_RECONCILE_ATTEMPT';
  }
  
  const result: DebugResult = {
    external_id: externalId,
    db: {
      match_time: dbState.match_time,
      status_id: dbState.status_id,
      minute: dbState.minute,
      minute_text: generateMinuteText(dbState.minute, dbState.status_id),
      home_score: dbState.home_score,
      away_score: dbState.away_score,
      provider_update_time: dbState.provider_update_time,
      last_event_ts: dbState.last_event_ts,
      updated_at: dbState.updated_at ? new Date(dbState.updated_at).toISOString() : null,
      first_half_kickoff_ts: dbState.first_half_kickoff_ts,
      second_half_kickoff_ts: dbState.second_half_kickoff_ts,
    },
    provider: {
      diary: diaryState,
      recent_list: recentListState,
      detail_live: detailLiveState,
    },
    logs: logs,
    mismatch: mismatch,
    root_cause: rootCause,
  };
  
  // Print summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`\nDB State:`);
  console.log(`  Status: ${dbState.status_id} | Minute: ${dbState.minute} | Score: ${dbState.home_score}-${dbState.away_score}`);
  console.log(`  Provider Update Time: ${dbState.provider_update_time ? new Date(dbState.provider_update_time * 1000).toISOString() : 'NULL'}`);
  console.log(`  Last Event TS: ${dbState.last_event_ts ? new Date(dbState.last_event_ts * 1000).toISOString() : 'NULL'}`);
  console.log(`  Updated At: ${dbState.updated_at ? new Date(dbState.updated_at).toISOString() : 'NULL'}`);
  
  if (providerState) {
    console.log(`\nProvider State (${providerState.found ? 'FOUND' : 'NOT_FOUND'}):`);
    console.log(`  Source: ${detailLiveState.found ? 'detail_live' : recentListState.found ? 'recent_list' : 'diary'}`);
    console.log(`  Status: ${providerState.status_id} | Minute: ${providerState.minute} | Score: ${providerState.home_score}-${providerState.away_score}`);
    console.log(`  Update Time: ${providerState.update_time ? new Date(providerState.update_time * 1000).toISOString() : 'NULL'}`);
  } else {
    console.log(`\nProvider State: NOT FOUND in any endpoint`);
  }
  
  console.log(`\nMismatch:`);
  console.log(`  Status: ${mismatch.status ? 'YES' : 'NO'}`);
  console.log(`  Minute: ${mismatch.minute ? 'YES' : 'NO'}`);
  console.log(`  Score: ${mismatch.score ? 'YES' : 'NO'}`);
  console.log(`  Overall: ${mismatch.overall ? 'YES' : 'NO'}`);
  
  console.log(`\nRoot Cause: ${rootCause}`);
  
  console.log(`\nLogs:`);
  console.log(`  Watchdog Reconcile: ${logs.watchdog_reconcile.length} attempts`);
  if (logs.watchdog_reconcile.length > 0) {
    logs.watchdog_reconcile.forEach(log => {
      console.log(`    ${log.timestamp}: ${log.event} - result=${log.result} reason=${log.reason} row_count=${log.row_count}`);
    });
  }
  console.log(`  DataUpdate Reconcile: ${logs.dataupdate_reconcile.length} attempts`);
  if (logs.dataupdate_reconcile.length > 0) {
    logs.dataupdate_reconcile.forEach(log => {
      console.log(`    ${log.timestamp}: ${log.event} - result=${log.result} row_count=${log.row_count}`);
    });
  }
  console.log(`  WebSocket: ${logs.websocket.length} events`);
  
  // Write JSON output
  const outputPath = path.join(process.cwd(), `debug-live-match-${externalId}-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ Full debug result written to: ${outputPath}`);
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

