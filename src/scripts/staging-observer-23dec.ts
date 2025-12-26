/**
 * Staging Observer Script for 23 Dec Full Bulletin Monitoring
 * 
 * This script performs automated monitoring of live matches with DB invariant checks.
 * Runs Layer A snapshots and automatically triggers DB diff checks when anomalies are detected.
 */

import 'dotenv/config';
import { pool } from '../database/connection';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';

// Parse CLI arguments
const args = process.argv.slice(2);
let onceMode = false;
let intervalSec = 60;
let customBaseUrl: string | undefined;
let customDbConn: string | undefined;
let customLogPath: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--once') {
    onceMode = true;
  } else if (arg === '--intervalSec' && i + 1 < args.length) {
    intervalSec = parseInt(args[i + 1], 10) || 60;
    i++;
  } else if (arg === '--baseUrl' && i + 1 < args.length) {
    customBaseUrl = args[i + 1];
    i++;
  } else if (arg === '--dbConn' && i + 1 < args.length) {
    customDbConn = args[i + 1];
    i++;
  } else if (arg === '--logPath' && i + 1 < args.length) {
    customLogPath = args[i + 1];
    i++;
  }
}

const STAGING_HTTP_BASE = customBaseUrl || process.env.STAGING_HTTP_BASE || 'http://localhost:3000';
const LOG_PATH = customLogPath || process.env.LOG_PATH || 'logs/combined.log';
const OBSERVATION_LOG_PATH = process.env.OBSERVATION_LOG_PATH || 'PHASE5_S_24H_OBSERVATION_LOG.md';
const DB_CONN = customDbConn || process.env.DB_CONN || 'psql -h localhost -U postgres -d goalgpt';

interface LiveMatch {
  external_id: string;
  status_id: number;
  minute: number | null;
  minute_text: string | null;
  home_score?: number;
  away_score?: number;
  home_score_display?: string;
  away_score_display?: string;
  home_team_name?: string;
  away_team_name?: string;
}

interface SnapshotState {
  timestamp: string;
  matches: Map<string, LiveMatch>;
  anomalies: {
    minute_text_null: string[];
    minute_regression: Array<{ id: string; prev: number | null; curr: number | null }>;
    status_regression: Array<{ id: string; prev: number; curr: number }>;
    score_change_no_timestamp: Array<{ id: string; score_change: string }>;
  };
}

let previousSnapshot: SnapshotState | null = null;

/**
 * Layer A: Fetch live matches and detect anomalies
 */
async function layerASnapshot(): Promise<SnapshotState> {
  const response = await fetch(`${STAGING_HTTP_BASE}/api/matches/live`);
  if (!response.ok) {
    throw new Error(`Failed to fetch live matches: ${response.statusText}`);
  }

  const data = await response.json();
  const matches: LiveMatch[] = (data as any)?.data?.results || (data as any)?.results || [];

  const anomalies = {
    minute_text_null: [] as string[],
    minute_regression: [] as Array<{ id: string; prev: number | null; curr: number | null }>,
    status_regression: [] as Array<{ id: string; prev: number; curr: number }>,
    score_change_no_timestamp: [] as Array<{ id: string; score_change: string }>,
  };

  const matchMap = new Map<string, LiveMatch>();

  for (const match of matches) {
    matchMap.set(match.external_id, match);

    // Check minute_text null
    if (match.minute_text === null || match.minute_text === undefined) {
      anomalies.minute_text_null.push(match.external_id);
    }

    // Compare with previous snapshot
    if (previousSnapshot) {
      const prevMatch = previousSnapshot.matches.get(match.external_id);
      if (prevMatch) {
        // Check minute regression
        if (
          prevMatch.minute !== null &&
          match.minute !== null &&
          match.minute < prevMatch.minute
        ) {
          anomalies.minute_regression.push({
            id: match.external_id,
            prev: prevMatch.minute,
            curr: match.minute,
          });
        }

        // Check status regression
        if (match.status_id < prevMatch.status_id) {
          anomalies.status_regression.push({
            id: match.external_id,
            prev: prevMatch.status_id,
            curr: match.status_id,
          });
        }

        // Check score change without timestamp progression (will be checked in DB query)
        const prevScore = `${prevMatch.home_score_display ?? prevMatch.home_score ?? ''}-${prevMatch.away_score_display ?? prevMatch.away_score ?? ''}`;
        const currScore = `${match.home_score_display ?? match.home_score ?? ''}-${match.away_score_display ?? match.away_score ?? ''}`;
        if (prevScore !== currScore) {
          anomalies.score_change_no_timestamp.push({
            id: match.external_id,
            score_change: `${prevScore} => ${currScore}`,
          });
        }
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    matches: matchMap,
    anomalies,
  };
}

/**
 * Query 1: Get kickoff timestamps and minute fields for specific external_ids
 */
async function query1KickoffTimestamps(externalIds: string[]): Promise<string> {
  if (externalIds.length === 0) return '';

  const ids = externalIds.map(id => `'${id}'`).join(',');
  const query = `
    SELECT
      external_id,
      status_id,
      minute,
      minute_text,
      first_half_kickoff_ts,
      second_half_kickoff_ts,
      provider_update_time,
      last_event_ts,
      updated_at
    FROM ts_matches
    WHERE external_id IN (${ids})
    ORDER BY external_id;
  `;

  try {
    const result = await pool.query(query);
    return JSON.stringify(result.rows, null, 2);
  } catch (error: any) {
    return `ERROR: ${error.message}`;
  }
}

/**
 * Query 2: Find LIVE matches with missing kickoff timestamps
 */
async function query2KickoffNullScan(): Promise<string> {
  const query = `
    SELECT
      external_id,
      status_id,
      minute,
      minute_text,
      first_half_kickoff_ts,
      second_half_kickoff_ts,
      provider_update_time,
      last_event_ts
    FROM ts_matches
    WHERE status_id IN (2,3,4,5,7)
      AND (first_half_kickoff_ts IS NULL OR (status_id IN (4,5,7) AND second_half_kickoff_ts IS NULL))
    ORDER BY provider_update_time DESC NULLS LAST
    LIMIT 50;
  `;

  try {
    const result = await pool.query(query);
    return JSON.stringify(result.rows, null, 2);
  } catch (error: any) {
    return `ERROR: ${error.message}`;
  }
}

/**
 * Query 3: DB vs API live diff
 */
async function query3DbVsApiDiff(): Promise<{
  dbLiveCount: number;
  apiLiveCount: number;
  dbNotInApi: string[];
}> {
  // Get DB live matches
  const dbResult = await pool.query(`
    SELECT external_id
    FROM ts_matches
    WHERE status_id IN (2,3,4,5,7)
    ORDER BY provider_update_time DESC NULLS LAST;
  `);
  const dbIds = new Set(dbResult.rows.map((r: any) => r.external_id));

  // Get API live matches
  const response = await fetch(`${STAGING_HTTP_BASE}/api/matches/live`);
  const data = await response.json();
  const apiMatches: LiveMatch[] = (data as any)?.data?.results || (data as any)?.results || [];
  const apiIds = new Set(apiMatches.map(m => m.external_id));

  // Find DB matches not in API
  const dbNotInApi = Array.from(dbIds).filter(id => !apiIds.has(id));

  return {
    dbLiveCount: dbIds.size,
    apiLiveCount: apiIds.size,
    dbNotInApi: dbNotInApi.slice(0, 50),
  };
}

/**
 * Check score change coherence (score changed but provider_update_time didn't advance)
 */
async function checkScoreChangeCoherence(
  externalIds: string[]
): Promise<Array<{ id: string; issue: string }>> {
  if (externalIds.length === 0) return [];

  const ids = externalIds.map(id => `'${id}'`).join(',');
  const query = `
    SELECT
      external_id,
      home_score,
      away_score,
      provider_update_time,
      last_event_ts,
      updated_at
    FROM ts_matches
    WHERE external_id IN (${ids})
    ORDER BY external_id;
  `;

  try {
    const result = await pool.query(query);
    // Note: This is a simplified check. Full coherence check would require comparing
    // previous snapshot's provider_update_time with current one.
    // For now, we just return the matches that had score changes for manual review.
    return result.rows.map((row: any) => ({
      id: row.external_id,
      issue: 'Score change detected - verify provider_update_time progression',
    }));
  } catch (error: any) {
    return [{ id: 'ERROR', issue: error.message }];
  }
}

/**
 * Write incident snapshot to observation log
 * 
 * CRITICAL: This function always writes when called (caller ensures anomalies exist).
 * All 3 DB proofs (query1, query2, query3) are included in the incident snapshot.
 */
function writeIncidentSnapshot(
  snapshot: SnapshotState,
  query1Results: string,
  query2Results: string,
  query3Results: { dbLiveCount: number; apiLiveCount: number; dbNotInApi: string[] },
  scoreCoherenceIssues: Array<{ id: string; issue: string }>
): void {

  const incidentBlock = `
### Incident Snapshot

**Timestamp:** ${snapshot.timestamp}

**Anomalies Detected:**
- minute_text_null: ${snapshot.anomalies.minute_text_null.length} matches
- minute_regression: ${snapshot.anomalies.minute_regression.length} matches
- status_regression: ${snapshot.anomalies.status_regression.length} matches
- score_change_no_timestamp: ${snapshot.anomalies.score_change_no_timestamp.length} matches
- DB_NOT_IN_API: ${query3Results.dbNotInApi.length} matches

**Affected external_ids:**
${[
      ...snapshot.anomalies.minute_text_null,
      ...snapshot.anomalies.minute_regression.map(a => a.id),
      ...snapshot.anomalies.status_regression.map(a => a.id),
      ...snapshot.anomalies.score_change_no_timestamp.map(a => a.id),
      ...query3Results.dbNotInApi.slice(0, 10),
    ]
      .filter((v, i, a) => a.indexOf(v) === i)
      .map(id => `- ${id}`)
      .join('\n')}

**Query 1 Results (Kickoff Timestamps):**
\`\`\`json
${query1Results}
\`\`\`

**Query 2 Results (Kickoff NULL Scan):**
\`\`\`json
${query2Results}
\`\`\`

**Query 3 Results (DB vs API Diff):**
- DB_LIVE_COUNT: ${query3Results.dbLiveCount}
- API_LIVE_COUNT: ${query3Results.apiLiveCount}
- DB_NOT_IN_API: ${query3Results.dbNotInApi.length > 0 ? query3Results.dbNotInApi.join(', ') : 'NONE'}

**Score Coherence Issues:**
${scoreCoherenceIssues.length > 0 ? scoreCoherenceIssues.map(i => `- ${i.id}: ${i.issue}`).join('\n') : 'NONE'}

**Evidence-based Conclusion:**
${getConclusion(snapshot, query2Results, query3Results)}

---

`;

  // Append to observation log
  if (existsSync(OBSERVATION_LOG_PATH)) {
    appendFileSync(OBSERVATION_LOG_PATH, incidentBlock);
  } else {
    logger.warn(`Observation log file not found: ${OBSERVATION_LOG_PATH}`);
  }
}

function getConclusion(
  snapshot: SnapshotState,
  query2Results: string,
  query3Results: { dbLiveCount: number; apiLiveCount: number; dbNotInApi: string[] }
): string {
  const issues: string[] = [];

  if (snapshot.anomalies.minute_text_null.length > 0) {
    issues.push(`${snapshot.anomalies.minute_text_null.length} matches with null minute_text`);
  }

  if (snapshot.anomalies.minute_regression.length > 0) {
    issues.push(`${snapshot.anomalies.minute_regression.length} matches with minute regression`);
  }

  if (snapshot.anomalies.status_regression.length > 0) {
    issues.push(`${snapshot.anomalies.status_regression.length} matches with status regression`);
  }

  if (query2Results !== '[]' && query2Results !== '') {
    issues.push('LIVE matches with missing kickoff timestamps detected');
  }

  if (query3Results.dbNotInApi.length > 0) {
    issues.push(`${query3Results.dbNotInApi.length} DB live matches not found in API`);
  }

  if (issues.length === 0) {
    return 'No anomalies detected. System operating normally.';
  }

  return `Issues detected: ${issues.join('; ')}. Requires investigation.`;
}

/**
 * Main observer loop
 */
async function runObserver(): Promise<void> {
  logger.info('Starting staging observer for 23 Dec monitoring...');

  try {
    // Layer A snapshot
    const snapshot = await layerASnapshot();
    logger.info(`Layer A snapshot: ${snapshot.matches.size} live matches`);

    // Collect all affected external_ids
    const affectedIds = [
      ...snapshot.anomalies.minute_text_null,
      ...snapshot.anomalies.minute_regression.map(a => a.id),
      ...snapshot.anomalies.status_regression.map(a => a.id),
      ...snapshot.anomalies.score_change_no_timestamp.map(a => a.id),
    ].filter((v, i, a) => a.indexOf(v) === i);

    // Run DB queries (3 proofs as required)
    logger.info('Running DB proofs: Query 1 (kickoff timestamps), Query 2 (kickoff NULL scan), Query 3 (DB vs API diff)');

    const query1Results = affectedIds.length > 0 ? await query1KickoffTimestamps(affectedIds.slice(0, 20)) : '[]';
    const query2Results = await query2KickoffNullScan();
    const query3Results = await query3DbVsApiDiff();

    // Check score coherence for matches with score changes
    const scoreChangeIds = snapshot.anomalies.score_change_no_timestamp.map(a => a.id);
    const scoreCoherenceIssues = await checkScoreChangeCoherence(scoreChangeIds);

    // If DB_NOT_IN_API exists, run Query 1 for first 10
    if (query3Results.dbNotInApi.length > 0) {
      const dbNotInApiQuery1 = await query1KickoffTimestamps(query3Results.dbNotInApi.slice(0, 10));
      logger.info(`DB_NOT_IN_API detected: ${query3Results.dbNotInApi.length} matches`);
    }

    // Write incident snapshot if anomalies detected (always runs 3 DB proofs)
    const hasAnomalies =
      snapshot.anomalies.minute_text_null.length > 0 ||
      snapshot.anomalies.minute_regression.length > 0 ||
      snapshot.anomalies.status_regression.length > 0 ||
      snapshot.anomalies.score_change_no_timestamp.length > 0 ||
      query3Results.dbNotInApi.length > 0 ||
      (query2Results !== '[]' && query2Results !== '');

    if (hasAnomalies) {
      logger.warn('INCIDENT SNAPSHOT: Anomalies detected, writing to observation log');
      writeIncidentSnapshot(snapshot, query1Results, query2Results, query3Results, scoreCoherenceIssues);
    } else {
      logger.info('No anomalies detected, all DB proofs passed');
    }

    // Update previous snapshot
    previousSnapshot = snapshot;

    logger.info('Observer cycle complete');
  } catch (error: any) {
    logger.error(`Observer error: ${error.message}`, error);
    throw error;
  }
}

// Run observer if executed directly
if (require.main === module) {
  if (onceMode) {
    // One-shot mode
    runObserver()
      .then(() => {
        logger.info('Observer completed successfully (one-shot mode)');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Observer failed', error);
        process.exit(1);
      });
  } else {
    // Continuous mode
    logger.info(`Starting observer in continuous mode (interval: ${intervalSec}s)`);
    const runLoop = async () => {
      try {
        await runObserver();
        setTimeout(runLoop, intervalSec * 1000);
      } catch (error: any) {
        logger.error('Observer cycle failed', error);
        // Continue loop even on error (resilient monitoring)
        setTimeout(runLoop, intervalSec * 1000);
      }
    };
    runLoop();
  }
}

export { runObserver, layerASnapshot, query1KickoffTimestamps, query2KickoffNullScan, query3DbVsApiDiff };

