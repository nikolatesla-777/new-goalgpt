/**
 * Database Helper Utilities
 * Handles database schema queries and operations
 */

import { pool } from '../connection';

export interface ColumnInfo {
  column_name: string;
  data_type: string;
}

/**
 * Get column information for a table
 */
export async function getTableColumns(tableName: string): Promise<{
  columns: string[];
  columnTypes: Map<string, string>;
}> {
  const result = await pool.query(
    `SELECT column_name, data_type 
     FROM information_schema.columns 
     WHERE table_name = $1 AND table_schema = 'public' 
     ORDER BY ordinal_position`,
    [tableName]
  );

  const columns = result.rows.map((row: ColumnInfo) => row.column_name);
  const columnTypes = new Map<string, string>(
    result.rows.map((row: ColumnInfo) => [row.column_name, row.data_type])
  );

  return { columns, columnTypes };
}

/**
 * Get valid customer user IDs for foreign key validation
 */
export async function getValidCustomerUserIds(): Promise<Set<string>> {
  const result = await pool.query('SELECT id FROM customer_users');
  return new Set(result.rows.map((r: { id: string }) => r.id));
}

/**
 * Filter CSV columns to match database columns
 */
export function filterMatchingColumns(
  csvColumns: string[],
  dbColumns: string[],
  skipColumns: string[] = []
): string[] {
  return csvColumns.filter(
    col => !skipColumns.includes(col) && dbColumns.includes(col)
  );
}

/**
 * Build INSERT query with conflict handling
 */
export function buildInsertQuery(
  tableName: string,
  columns: string[],
  batchSize: number
): { query: string; conflictClause: string } {
  const columnNames = columns.join(', ');

  // Determine conflict clause
  let conflictClause = '';
  if (columns.includes('id')) {
    conflictClause = 'ON CONFLICT (id) DO NOTHING';
  } else if (columns.includes('email')) {
    conflictClause = 'ON CONFLICT (email) DO NOTHING';
  }

  // Build VALUES placeholders for batch
  const valuesPlaceholders = Array(batchSize)
    .fill(0)
    .map(
      (_, idx) =>
        `(${columns.map((_, colIdx) => `$${idx * columns.length + colIdx + 1}`).join(', ')})`
    )
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
export async function executeBatchInsert(
  tableName: string,
  columns: string[],
  batch: any[][]
): Promise<void> {
  const { query } = buildInsertQuery(tableName, columns, batch.length);
  const flatValues = batch.flat();
  await pool.query(query, flatValues);
}

/**
 * Truncate table (clear existing data)
 */
export async function truncateTable(tableName: string): Promise<void> {
  await pool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
}

