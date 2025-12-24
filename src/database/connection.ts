import { Pool } from 'pg';
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
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased for Supabase
  // CRITICAL: Supabase requires SSL
  ssl: isSupabase
    ? {
        rejectUnauthorized: false, // Supabase uses self-signed certificates
      }
    : false,
  // CRITICAL: Connection pooling mode for Supabase
  ...(isSupabase && {
    // Supabase connection pooling specific settings
    application_name: 'goalgpt-backend',
  }),
});

pool.on('error', (err: any) => {
  // CRITICAL FIX: Don't exit on connection errors - these are expected during network hiccups
  // Only log the error - pool will automatically retry connections
  // Connection errors (ECONNRESET, ETIMEDOUT) are normal in production environments
  // and should not crash the entire backend
  logger.warn('Database pool error (non-fatal, pool will retry):', {
    message: err.message,
    code: err.code,
    errno: err.errno,
  });
  
  // Only exit on truly critical errors (invalid connection string, auth failures)
  // These are unlikely to recover automatically
  const isCriticalError = err.code === '28P01' || // invalid_password
                          err.code === '28000' || // invalid_authorization_specification
                          err.code === '3D000' || // invalid_catalog_name (database doesn't exist)
                          err.message?.includes('password authentication failed') ||
                          err.message?.includes('database') && err.message?.includes('does not exist');
  
  if (isCriticalError) {
    logger.error('CRITICAL database error - exiting:', err);
    process.exit(-1);
  }
  
  // For connection errors (ECONNRESET, ETIMEDOUT, etc.), just log and continue
  // The pool will automatically retry connections
});

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

