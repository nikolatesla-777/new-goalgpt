"use strict";
/**
 * CSV Import Module - Stream-Based Architecture
 *
 * This module uses Node.js streams to efficiently import large CSV files
 * without loading entire files into memory. It processes data in chunks,
 * making it suitable for files of any size.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const csv_parse_1 = require("csv-parse");
const promises_1 = require("stream/promises");
const stream_1 = require("stream");
const connection_1 = require("./connection");
const logger_1 = require("../utils/logger");
const dotenv_1 = __importDefault(require("dotenv"));
// Data transformation and validation utilities
const data_transformers_1 = require("./utils/data-transformers");
const validators_1 = require("./utils/validators");
const database_helpers_1 = require("./utils/database-helpers");
dotenv_1.default.config();
const CSV_DIR = process.env.CSV_DIR || '/Users/utkubozbay/Downloads/tüm-data';
const BATCH_SIZE = 1000; // Process records in batches of 1000
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB limit (stream can handle large files)
const tableMappings = {
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
    constructor(tableName, skipColumns = []) {
        this.columns = [];
        this.columnTypes = new Map();
        this.batch = [];
        this.totalProcessed = 0;
        this.totalInserted = 0;
        this.needsValidUserIds = false;
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
    async initialize() {
        const { columns, columnTypes } = await (0, database_helpers_1.getTableColumns)(this.tableName);
        this.columnTypes = columnTypes;
        // Check if we need valid user IDs for foreign key validation
        this.needsValidUserIds =
            (this.tableName.includes('customer_') ||
                this.tableName.includes('support_') ||
                this.tableName.includes('favorite_')) &&
                this.tableName !== 'customer_users';
        if (this.needsValidUserIds) {
            this.validationContext.validUserIds = await (0, database_helpers_1.getValidCustomerUserIds)();
        }
    }
    /**
     * Set CSV columns and filter to match database columns
     */
    setCSVColumns(csvColumns) {
        this.columns = (0, database_helpers_1.filterMatchingColumns)(csvColumns, Array.from(this.columnTypes.keys()), this.skipColumns);
        if (this.columns.length === 0) {
            logger_1.logger.warn(`No matching columns found for ${this.tableName}, skipping...`);
            return false;
        }
        logger_1.logger.info(`Importing to ${this.tableName} with ${this.columns.length} columns (${csvColumns.length} CSV columns)`);
        return true;
    }
    /**
     * Process a single record
     */
    async processRecord(record) {
        this.totalProcessed++;
        // Validate and transform record
        const validated = (0, validators_1.validateBatch)([record], this.tableName, this.validationContext);
        if (validated.length === 0) {
            return; // Record was filtered out
        }
        const transformed = (0, data_transformers_1.transformRecord)(validated[0], this.columns, this.columnTypes);
        this.batch.push(transformed);
        // Process batch when it reaches the batch size
        if (this.batch.length >= BATCH_SIZE) {
            await this.flushBatch();
        }
    }
    /**
     * Flush remaining records in batch
     */
    async flushBatch() {
        if (this.batch.length === 0) {
            return;
        }
        try {
            await (0, database_helpers_1.executeBatchInsert)(this.tableName, this.columns, this.batch);
            this.totalInserted += this.batch.length;
            logger_1.logger.info(`Inserted ${this.totalInserted} records into ${this.tableName} (processed: ${this.totalProcessed})`);
            this.batch = [];
        }
        catch (error) {
            logger_1.logger.error(`Error inserting batch into ${this.tableName}:`, {
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
async function importCSVFileStream(filePath, tableName, skipColumns = []) {
    const processor = new CSVStreamProcessor(tableName, skipColumns);
    try {
        // Check file size
        const fileStats = (0, fs_1.statSync)(filePath);
        const fileSizeMB = fileStats.size / 1024 / 1024;
        if (fileStats.size === 0) {
            logger_1.logger.warn(`File ${filePath} is empty, skipping...`);
            return;
        }
        if (fileStats.size > MAX_FILE_SIZE) {
            logger_1.logger.warn(`File ${filePath} is too large (${fileSizeMB.toFixed(2)}MB), skipping...`);
            return;
        }
        if (fileSizeMB > 100) {
            logger_1.logger.info(`Processing large file: ${filePath} (${fileSizeMB.toFixed(2)}MB) - using stream processing`);
        }
        logger_1.logger.info(`Starting stream import: ${filePath} -> ${tableName}`);
        // Initialize processor
        await processor.initialize();
        // Create CSV parser stream
        const parser = (0, csv_parse_1.parse)({
            columns: true,
            skip_empty_lines: true,
            cast: false,
            relax_column_count: true,
        });
        // Set columns from first record
        let firstRecordReceived = false;
        // Create transform stream to process records
        const recordProcessor = new stream_1.Transform({
            objectMode: true,
            async transform(record, encoding, callback) {
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
                }
                catch (error) {
                    logger_1.logger.error(`Error processing record:`, error.message);
                    callback(); // Continue processing despite errors
                }
            },
        });
        // Create file read stream
        const fileStream = (0, fs_1.createReadStream)(filePath, { encoding: 'utf-8' });
        // Process stream pipeline
        await (0, promises_1.pipeline)(fileStream, parser, recordProcessor);
        // Flush remaining batch
        await processor.flushBatch();
        const stats = processor.getStats();
        logger_1.logger.info(`✅ Successfully imported ${stats.inserted} records to ${tableName} (${stats.filtered} filtered out)`);
    }
    catch (error) {
        logger_1.logger.error(`Error importing ${filePath} to ${tableName}:`, {
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        });
        throw error;
    }
}
/**
 * Import CSV file (wrapper function for backward compatibility)
 */
async function importCSVFile(filePath, tableName, skipColumns = []) {
    // Truncate table first
    try {
        await (0, database_helpers_1.truncateTable)(tableName);
        logger_1.logger.info(`Cleared existing data from ${tableName}`);
    }
    catch (error) {
        logger_1.logger.warn(`Could not truncate ${tableName}: ${error.message}`);
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
        await connection_1.pool.query('SELECT 1');
        logger_1.logger.info('✅ Database connection established');
        // Import files in order
        for (const file of importOrder) {
            const mapping = tableMappings[file];
            if (mapping) {
                const filePath = (0, path_1.join)(CSV_DIR, file);
                try {
                    const fileStats = (0, fs_1.statSync)(filePath);
                    if (fileStats.size === 0) {
                        logger_1.logger.warn(`File ${file} is empty, skipping...`);
                        continue;
                    }
                    await importCSVFile(filePath, mapping.table, mapping.skipColumns || []);
                }
                catch (error) {
                    logger_1.logger.warn(`Error processing ${file}: ${error.message}, skipping...`);
                }
            }
        }
        // Import remaining files that are not in order
        const files = (0, fs_1.readdirSync)(CSV_DIR).filter(f => f.endsWith('.csv'));
        for (const file of files) {
            if (!importOrder.includes(file)) {
                const mapping = tableMappings[file];
                if (mapping) {
                    const filePath = (0, path_1.join)(CSV_DIR, file);
                    const fileStats = (0, fs_1.statSync)(filePath);
                    if (fileStats.size > 0) {
                        try {
                            await importCSVFile(filePath, mapping.table, mapping.skipColumns || []);
                        }
                        catch (error) {
                            logger_1.logger.warn(`Error processing ${file}: ${error.message}, skipping...`);
                        }
                    }
                }
                else {
                    logger_1.logger.warn(`No mapping found for ${file}, skipping...`);
                }
            }
        }
        logger_1.logger.info('✅ CSV import completed!');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Import failed:', error);
        process.exit(1);
    }
}
main();
