/**
 * CSV Import Module - Stream-Based Architecture
 * 
 * This module uses Node.js streams to efficiently import large CSV files
 * without loading entire files into memory. It processes data in chunks,
 * making it suitable for files of any size.
 */

import { createReadStream, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { pool } from './connection';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Data transformation and validation utilities
import { transformRecord } from './utils/data-transformers';
import { validateBatch, type ValidationContext } from './utils/validators';
import {
  getTableColumns,
  getValidCustomerUserIds,
  filterMatchingColumns,
  executeBatchInsert,
  truncateTable,
} from './utils/database-helpers';

dotenv.config();

const CSV_DIR = process.env.CSV_DIR || '/Users/utkubozbay/Downloads/tüm-data';
const BATCH_SIZE = 1000; // Process records in batches of 1000
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB limit (stream can handle large files)

interface TableMapping {
  [key: string]: {
    table: string;
    skipColumns?: string[];
    transform?: (row: any) => any;
  };
}

const tableMappings: TableMapping = {
  'customer_users.csv': { table: 'customer_users' },
  'customer_subscriptions.csv': { table: 'customer_subscriptions' },
  'subscription_plans.csv': { table: 'subscription_plans' },
  'ts_matches.csv': { table: 'ts_matches' },
  'ts_teams.csv': { table: 'ts_teams' },
  'ts_competitions.csv': { table: 'ts_competitions' },
  'ts_seasons.csv': { table: 'ts_seasons' },
  'ts_venues.csv': { table: 'ts_venues' },
  'ts_referees.csv': { table: 'ts_referees' },
  'ts_country.csv': { table: 'ts_country' },
  'prediction_bot_groups.csv': { table: 'prediction_bot_groups' },
  'prediction_bot_competitions.csv': { table: 'prediction_bot_competitions' },
  'ts_prediction_mapped.csv': { table: 'ts_prediction_mapped' },
  'ts_prediction_group.csv': { table: 'ts_prediction_group' },
  'ts_prediction_group_item.csv': { table: 'ts_prediction_group_item' },
  'ts_prediction_live_view_active.csv': { table: 'ts_prediction_live_view_active' },
  'customer_push_notifications.csv': { table: 'customer_push_notifications' },
  'customer_notification_tokens.csv': { table: 'customer_notification_tokens' },
  'notification_outbox.csv': { table: 'notification_outbox' },
  'admin_users.csv': { table: 'admin_users' },
  'ts_recent_matches.csv': { table: 'ts_recent_matches' },
  'favorite_teams.csv': { table: 'favorite_teams' },
  'customer_sessions.csv': { table: 'customer_sessions' },
  'support_tickets.csv': { table: 'support_tickets' },
  'support_ticket_messages.csv': { table: 'support_ticket_messages' },
};

/**
 * Stream-based CSV import processor
 */
class CSVStreamProcessor {
  private tableName: string;
  private skipColumns: string[];
  private columns: string[] = [];
  private columnTypes: Map<string, string> = new Map();
  private validationContext: ValidationContext;
  private batch: any[] = [];
  private totalProcessed = 0;
  private totalInserted = 0;
  private needsValidUserIds = false;

  constructor(tableName: string, skipColumns: string[] = []) {
    this.tableName = tableName;
    this.skipColumns = skipColumns;
    this.validationContext = {
      seenIds: new Set(),
      seenEmails: new Set(),
    };
  }

  /**
   * Initialize database schema information
   */
  async initialize(): Promise<void> {
    const { columns, columnTypes } = await getTableColumns(this.tableName);
    this.columnTypes = columnTypes;

    // Check if we need valid user IDs for foreign key validation
    this.needsValidUserIds =
      (this.tableName.includes('customer_') ||
        this.tableName.includes('support_') ||
        this.tableName.includes('favorite_')) &&
      this.tableName !== 'customer_users';

    if (this.needsValidUserIds) {
      this.validationContext.validUserIds = await getValidCustomerUserIds();
    }
  }

  /**
   * Set CSV columns and filter to match database columns
   */
  setCSVColumns(csvColumns: string[]): boolean {
    this.columns = filterMatchingColumns(
      csvColumns,
      Array.from(this.columnTypes.keys()),
      this.skipColumns
    );

    if (this.columns.length === 0) {
      logger.warn(`No matching columns found for ${this.tableName}, skipping...`);
      return false;
    }

    logger.info(
      `Importing to ${this.tableName} with ${this.columns.length} columns (${csvColumns.length} CSV columns)`
    );
    return true;
  }

  /**
   * Process a single record
   */
  async processRecord(record: any): Promise<void> {
    this.totalProcessed++;

    // Validate and transform record
    const validated = validateBatch([record], this.tableName, this.validationContext);
    if (validated.length === 0) {
      return; // Record was filtered out
    }

    const transformed = transformRecord(validated[0], this.columns, this.columnTypes);
    this.batch.push(transformed);

    // Process batch when it reaches the batch size
    if (this.batch.length >= BATCH_SIZE) {
      await this.flushBatch();
    }
  }

  /**
   * Flush remaining records in batch
   */
  async flushBatch(): Promise<void> {
    if (this.batch.length === 0) {
      return;
    }

    try {
      await executeBatchInsert(this.tableName, this.columns, this.batch);
      this.totalInserted += this.batch.length;
      logger.info(
        `Inserted ${this.totalInserted} records into ${this.tableName} (processed: ${this.totalProcessed})`
      );
      this.batch = [];
    } catch (error: any) {
      logger.error(`Error inserting batch into ${this.tableName}:`, {
        message: error.message,
        batchSize: this.batch.length,
      });
      // Continue with next batch
      this.batch = [];
    }
  }

  /**
   * Get import statistics
   */
  getStats() {
    return {
      processed: this.totalProcessed,
      inserted: this.totalInserted,
      filtered: this.totalProcessed - this.totalInserted,
    };
  }
}

/**
 * Import CSV file using stream processing
 */
async function importCSVFileStream(
  filePath: string,
  tableName: string,
  skipColumns: string[] = []
): Promise<void> {
  const processor = new CSVStreamProcessor(tableName, skipColumns);

  try {
    // Check file size
    const fileStats = statSync(filePath);
    const fileSizeMB = fileStats.size / 1024 / 1024;

    if (fileStats.size === 0) {
      logger.warn(`File ${filePath} is empty, skipping...`);
      return;
    }

    if (fileStats.size > MAX_FILE_SIZE) {
      logger.warn(
        `File ${filePath} is too large (${fileSizeMB.toFixed(2)}MB), skipping...`
      );
      return;
    }

    if (fileSizeMB > 100) {
      logger.info(
        `Processing large file: ${filePath} (${fileSizeMB.toFixed(2)}MB) - using stream processing`
      );
    }

    logger.info(`Starting stream import: ${filePath} -> ${tableName}`);

    // Initialize processor
    await processor.initialize();

    // Create CSV parser stream
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      cast: false,
      relax_column_count: true,
    });

    // Set columns from first record
    let firstRecordReceived = false;

    // Create transform stream to process records
    const recordProcessor = new Transform({
      objectMode: true,
      async transform(record: any, encoding, callback) {
        try {
          if (!firstRecordReceived) {
            firstRecordReceived = true;
            const csvColumns = Object.keys(record);
            const canProceed = processor.setCSVColumns(csvColumns);
            if (!canProceed) {
              return callback(new Error('No matching columns'));
            }
          }

          await processor.processRecord(record);
          callback();
        } catch (error: any) {
          logger.error(`Error processing record:`, error.message);
          callback(); // Continue processing despite errors
        }
      },
    });

    // Create file read stream
    const fileStream = createReadStream(filePath, { encoding: 'utf-8' });

    // Process stream pipeline
    await pipeline(fileStream, parser, recordProcessor);

    // Flush remaining batch
    await processor.flushBatch();

    const stats = processor.getStats();
    logger.info(
      `✅ Successfully imported ${stats.inserted} records to ${tableName} (${stats.filtered} filtered out)`
    );
  } catch (error: any) {
    logger.error(`Error importing ${filePath} to ${tableName}:`, {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    });
    throw error;
  }
}

/**
 * Import CSV file (wrapper function for backward compatibility)
 */
async function importCSVFile(
  filePath: string,
  tableName: string,
  skipColumns: string[] = []
): Promise<void> {
  // Truncate table first
  try {
    await truncateTable(tableName);
    logger.info(`Cleared existing data from ${tableName}`);
  } catch (error: any) {
    logger.warn(`Could not truncate ${tableName}: ${error.message}`);
  }

  // Import using stream
  await importCSVFileStream(filePath, tableName, skipColumns);
}

// Import order: parent tables first, then child tables
const importOrder = [
  'subscription_plans.csv',
  'customer_users.csv',
  'ts_teams.csv',
  'ts_competitions.csv',
  'ts_seasons.csv',
  'ts_venues.csv',
  'ts_referees.csv',
  'ts_country.csv',
  'prediction_bot_groups.csv',
  'ts_matches.csv',
  'ts_recent_matches.csv',
  'customer_subscriptions.csv',
  'customer_sessions.csv',
  'customer_notification_tokens.csv',
  'customer_push_notifications.csv',
  'notification_outbox.csv',
  'favorite_teams.csv',
  'support_tickets.csv',
  'support_ticket_messages.csv',
  'prediction_bot_competitions.csv',
  'ts_prediction_group.csv',
  'ts_prediction_group_item.csv',
  'ts_prediction_mapped.csv',
  'ts_prediction_live_view_active.csv',
  'admin_users.csv',
];

/**
 * Main import function
 */
async function main() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    logger.info('✅ Database connection established');

    // Import files in order
    for (const file of importOrder) {
      const mapping = tableMappings[file];
      if (mapping) {
        const filePath = join(CSV_DIR, file);
        try {
          const fileStats = statSync(filePath);
          if (fileStats.size === 0) {
            logger.warn(`File ${file} is empty, skipping...`);
            continue;
          }
          await importCSVFile(filePath, mapping.table, mapping.skipColumns || []);
        } catch (error: any) {
          logger.warn(`Error processing ${file}: ${error.message}, skipping...`);
        }
      }
    }

    // Import remaining files that are not in order
    const files = readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
    for (const file of files) {
      if (!importOrder.includes(file)) {
        const mapping = tableMappings[file];
        if (mapping) {
          const filePath = join(CSV_DIR, file);
          const fileStats = statSync(filePath);
          if (fileStats.size > 0) {
            try {
              await importCSVFile(filePath, mapping.table, mapping.skipColumns || []);
            } catch (error: any) {
              logger.warn(`Error processing ${file}: ${error.message}, skipping...`);
            }
          }
        } else {
          logger.warn(`No mapping found for ${file}, skipping...`);
        }
      }
    }

    logger.info('✅ CSV import completed!');
    process.exit(0);
  } catch (error) {
    logger.error('Import failed:', error);
    process.exit(1);
  }
}

main();
