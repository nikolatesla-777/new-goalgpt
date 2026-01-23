"use strict";
/**
 * Database Helper Utilities
 * Handles database schema queries and operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTableColumns = getTableColumns;
exports.getValidCustomerUserIds = getValidCustomerUserIds;
exports.filterMatchingColumns = filterMatchingColumns;
exports.buildInsertQuery = buildInsertQuery;
exports.executeBatchInsert = executeBatchInsert;
exports.truncateTable = truncateTable;
const connection_1 = require("../connection");
/**
 * Get column information for a table
 */
async function getTableColumns(tableName) {
    const result = await connection_1.pool.query(`SELECT column_name, data_type 
     FROM information_schema.columns 
     WHERE table_name = $1 AND table_schema = 'public' 
     ORDER BY ordinal_position`, [tableName]);
    const columns = result.rows.map((row) => row.column_name);
    const columnTypes = new Map(result.rows.map((row) => [row.column_name, row.data_type]));
    return { columns, columnTypes };
}
/**
 * Get valid customer user IDs for foreign key validation
 */
async function getValidCustomerUserIds() {
    const result = await connection_1.pool.query('SELECT id FROM customer_users');
    return new Set(result.rows.map((r) => r.id));
}
/**
 * Filter CSV columns to match database columns
 */
function filterMatchingColumns(csvColumns, dbColumns, skipColumns = []) {
    return csvColumns.filter(col => !skipColumns.includes(col) && dbColumns.includes(col));
}
/**
 * Build INSERT query with conflict handling
 */
function buildInsertQuery(tableName, columns, batchSize) {
    const columnNames = columns.join(', ');
    // Determine conflict clause
    let conflictClause = '';
    if (columns.includes('id')) {
        conflictClause = 'ON CONFLICT (id) DO NOTHING';
    }
    else if (columns.includes('email')) {
        conflictClause = 'ON CONFLICT (email) DO NOTHING';
    }
    // Build VALUES placeholders for batch
    const valuesPlaceholders = Array(batchSize)
        .fill(0)
        .map((_, idx) => `(${columns.map((_, colIdx) => `$${idx * columns.length + colIdx + 1}`).join(', ')})`)
        .join(', ');
    const query = `
    INSERT INTO ${tableName} (${columnNames})
    VALUES ${valuesPlaceholders}
    ${conflictClause}
  `;
    return { query, conflictClause };
}
/**
 * Execute batch insert
 */
async function executeBatchInsert(tableName, columns, batch) {
    const { query } = buildInsertQuery(tableName, columns, batch.length);
    const flatValues = batch.flat();
    await connection_1.pool.query(query, flatValues);
}
/**
 * Truncate table (clear existing data)
 */
async function truncateTable(tableName) {
    await connection_1.pool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
}
