/**
 * Database Connection Test Script
 * 
 * Bu script database bağlantısını test eder.
 * 
 * Kullanım: tsx src/database/test-connection.ts
 */

import dotenv from 'dotenv';
import { connectDatabase } from './connection';
import { logger } from '../utils/logger';

dotenv.config();

async function testConnection() {
  try {
    logger.info('Testing database connection...');
    await connectDatabase();
    logger.info('✅ Database connection successful!');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();

