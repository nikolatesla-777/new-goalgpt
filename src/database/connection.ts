import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

dotenv.config();

// CRITICAL: Supabase connection configuration
const isSupabase = process.env.DB_HOST?.includes('supabase') || process.env.DB_HOST?.includes('pooler');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'goalgpt',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '10'), // REDUCED for Supabase free tier
  min: 2, // REDUCED to minimize idle connections
  idleTimeoutMillis: 30000, // REDUCED for faster connection release
  connectionTimeoutMillis: 45000, // Increased for standings queries (45s)

  // CRITICAL: Keep-alive settings to prevent connection drops
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,

  // CRITICAL: Statement timeout to prevent hanging queries
  statement_timeout: 30000, // 30 seconds max per query
  query_timeout: 30000,

  // CRITICAL: Supabase requires SSL
  ssl: isSupabase
    ? {
      rejectUnauthorized: false, // Supabase uses self-signed certificates
    }
    : false,
  // CRITICAL: Connection pooling mode for Supabase
  ...(isSupabase && {
    application_name: 'goalgpt-backend',
  }),
});

// CRITICAL: Global error handler - prevents crash on connection errors
pool.on('error', (err: Error, client: PoolClient) => {
  // Log but don't crash - pool will auto-reconnect
  logger.warn('Database pool error (non-fatal, pool will reconnect):', {
    message: err.message,
    name: err.name,
  });

  // Release the errored client if possible
  try {
    if (client) {
      client.release(true); // true = destroy client, don't return to pool
    }
  } catch (releaseErr) {
    // Ignore release errors
  }
});

// CRITICAL: Handle client errors before they become unhandled
pool.on('connect', (client: PoolClient) => {
  client.on('error', (err: Error) => {
    logger.warn('PostgreSQL client error (connection will be recreated):', {
      message: err.message,
    });
  });
});

// CRITICAL: Log when connections are removed from pool
pool.on('remove', () => {
  logger.debug('PostgreSQL client removed from pool, will create new if needed');
});

// ============================================================
// QUERY PARSING UTILITIES
// ============================================================

/**
 * Parse SQL query to extract operation type and table name
 */
function parseQueryInfo(sql: string): { operation: string; table: string } {
  const normalized = sql.trim().toUpperCase();

  let operation = 'UNKNOWN';
  if (normalized.startsWith('SELECT')) operation = 'SELECT';
  else if (normalized.startsWith('INSERT')) operation = 'INSERT';
  else if (normalized.startsWith('UPDATE')) operation = 'UPDATE';
  else if (normalized.startsWith('DELETE')) operation = 'DELETE';

  let table = 'unknown';
  try {
    if (operation === 'SELECT') {
      const fromMatch = normalized.match(/FROM\s+([a-z_][a-z0-9_]*)/i);
      if (fromMatch) table = fromMatch[1].toLowerCase();
    } else if (operation === 'INSERT') {
      const intoMatch = normalized.match(/INTO\s+([a-z_][a-z0-9_]*)/i);
      if (intoMatch) table = intoMatch[1].toLowerCase();
    } else if (operation === 'UPDATE') {
      const updateMatch = normalized.match(/UPDATE\s+([a-z_][a-z0-9_]*)/i);
      if (updateMatch) table = updateMatch[1].toLowerCase();
    } else if (operation === 'DELETE') {
      const deleteMatch = normalized.match(/FROM\s+([a-z_][a-z0-9_]*)/i);
      if (deleteMatch) table = deleteMatch[1].toLowerCase();
    }
  } catch (err) {
    // Keep 'unknown' on parse error
  }

  return { operation, table };
}

/**
 * Truncate SQL for logging (max 120 chars)
 */
function truncateSQL(sql: string): string {
  const cleaned = sql.replace(/\s+/g, ' ').trim();
  return cleaned.length > 120 ? cleaned.substring(0, 117) + '...' : cleaned;
}

/**
 * Sanitize params for logging (count only, no values)
 */
function sanitizeParams(params?: any[]): string {
  if (!params || params.length === 0) return '[]';
  return `[${params.length} params]`;
}

// ============================================================
// SAFE QUERY WRAPPER
// ============================================================

/**
 * Safe query wrapper with auto-retry on connection errors
 */
export async function safeQuery<T = any>(
  text: string,
  params?: any[],
  retries = 2
): Promise<T[]> {
  const startTime = Date.now();
  const { operation, table } = parseQueryInfo(text);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      const result = await client.query(text, params);
      client.release();

      // SUCCESS: Record metrics
      const durationMs = Date.now() - startTime;
      try {
        metrics.recordDbQuery(operation, table, durationMs);
      } catch (metricsErr) {
        // Ignore metrics errors - don't break the query
      }

      // Log slow queries
      const slowThreshold = parseInt(process.env.DB_SLOW_QUERY_THRESHOLD_MS || '2000');
      const slowLogEnabled = process.env.DB_SLOW_QUERY_LOG_ENABLED !== 'false';

      if (slowLogEnabled && durationMs > slowThreshold) {
        logger.warn('[DB] Slow query detected', {
          durationMs,
          operation,
          table,
          query: truncateSQL(text),
          params: sanitizeParams(params),
          threshold: slowThreshold,
        });
        metrics.inc('db.slow_queries', { operation, table });
      }

      return result.rows as T[];
    } catch (err: any) {
      lastError = err;

      // Log query details on error
      const errorMsg = err.message?.toLowerCase() || '';
      if (errorMsg.includes('uuid') || errorMsg.includes('character varying')) {
        console.error('='.repeat(80));
        console.error('[DB] UUID/TYPE ERROR DETECTED:');
        console.error('Error:', err.message);
        console.error('Full Query:', text);
        console.error('Params:', JSON.stringify(params));
        console.error('Stack:', err.stack?.substring(0, 1000));
        console.error('='.repeat(80));

        logger.error('[DB] UUID/Type Error - Query:', {
          error: err.message,
          query_preview: text.substring(0, 500),
          params: params?.slice(0, 5)
        });
      }

      // Release client with error flag (destroys connection)
      if (client) {
        try {
          client.release(true);
        } catch (releaseErr) {
          logger.warn('[DB] Client release error:', releaseErr);
        }
      }

      // Only retry on connection errors, not SQL errors
      const isConnectionError =
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ENOTFOUND' ||
        err.message?.includes('Connection terminated') ||
        err.message?.includes('timeout') ||
        err.message?.includes('connect');

      if (!isConnectionError || attempt === retries) {
        // Record error metrics
        const durationMs = Date.now() - startTime;
        try {
          metrics.recordDbQuery(operation, table, durationMs);
        } catch (metricsErr) {
          // Ignore metrics errors
        }
        metrics.inc('db.query_errors', {
          operation,
          table,
          error_type: err.code || 'unknown'
        });
        throw err;
      }

      logger.warn(`Database query failed (attempt ${attempt + 1}/${retries + 1}), retrying...`);
      await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // Backoff
    }
  }

  throw lastError;
}

export async function connectDatabase() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info('Database connection test:', result.rows[0]);
    client.release();
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export { pool };
