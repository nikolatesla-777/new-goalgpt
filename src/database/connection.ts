import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

// CRITICAL: Supabase connection configuration
const isSupabase = process.env.DB_HOST?.includes('supabase') || process.env.DB_HOST?.includes('pooler');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'goalgpt',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '25'), // Increased for high load (Phase 1 Fix)
  min: 5, // Keep more connections alive for better performance
  idleTimeoutMillis: 60000, // Increased to 60 seconds
  connectionTimeoutMillis: 15000, // Increased for Supabase stability

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

/**
 * Safe query wrapper with auto-retry on connection errors
 */
export async function safeQuery<T = any>(
  text: string,
  params?: any[],
  retries = 2
): Promise<T[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      const result = await client.query(text, params);
      client.release();
      return result.rows as T[];
    } catch (err: any) {
      lastError = err;

      // Log query details on error
      if (err.message?.includes('uuid')) {
        logger.error('[DB] UUID Error - Query:', {
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
