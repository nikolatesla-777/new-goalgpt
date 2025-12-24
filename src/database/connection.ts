import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'goalgpt',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // CRITICAL: Supabase requires SSL
  ssl: process.env.DB_HOST?.includes('supabase') || process.env.DB_HOST?.includes('pooler') 
    ? {
        rejectUnauthorized: false, // Supabase uses self-signed certificates
      }
    : false,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
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

