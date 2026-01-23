"use strict";
/**
 * Data Transformation Utilities
 * Handles conversion of CSV data to database-compatible formats
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformValue = transformValue;
exports.transformRecord = transformRecord;
/**
 * Transform a single value based on its column type
 */
function transformValue(value, columnName, columnType) {
    // Handle empty/null values
    if (value === '' || value === 'null' || value === null || value === undefined) {
        return null;
    }
    // Handle JSONB columns (home_scores, away_scores, data, etc.)
    if (columnType === 'jsonb' || columnName.includes('_scores') || columnName === 'data') {
        return transformJSONB(value);
    }
    // Handle UUID columns
    if (columnType === 'uuid' || isUUIDColumn(columnName)) {
        return transformUUID(value);
    }
    // Handle boolean columns
    if (columnType === 'boolean') {
        return transformBoolean(value);
    }
    // Handle numeric columns
    if (isNumericType(columnType)) {
        return transformNumeric(value, columnType);
    }
    return value;
}
/**
 * Transform JSONB values (arrays, objects)
 */
function transformJSONB(value) {
    if (typeof value === 'string') {
        // Handle PostgreSQL array format: {0,1,2,3}
        if (value.startsWith('{') && value.endsWith('}')) {
            try {
                const arrayStr = value.slice(1, -1);
                const array = arrayStr.split(',').map(v => {
                    const trimmed = v.trim();
                    return trimmed === '' ? null : (isNaN(Number(trimmed)) ? trimmed : Number(trimmed));
                });
                return JSON.stringify(array);
            }
            catch {
                return value;
            }
        }
        // Handle JSON strings
        if (value.startsWith('{') || value.startsWith('[')) {
            try {
                return JSON.stringify(JSON.parse(value));
            }
            catch {
                return value;
            }
        }
    }
    return value;
}
/**
 * Transform and validate UUID values
 */
function transformUUID(value) {
    if (typeof value === 'string' && value.trim()) {
        const trimmed = value.trim();
        // Skip invalid values like "user", "admin", etc.
        const lowerValue = trimmed.toLowerCase();
        if (lowerValue === 'user' || lowerValue === 'admin' || trimmed.length < 10) {
            return null;
        }
        // Strict UUID validation: must be exactly 36 chars with proper format
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (trimmed.length === 36 && uuidPattern.test(trimmed)) {
            return trimmed;
        }
        // Try to extract UUID from string
        const uuidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch && uuidMatch[0].length === 36) {
            return uuidMatch[0];
        }
    }
    return null;
}
/**
 * Transform boolean values
 */
function transformBoolean(value) {
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1' || value === 't';
    }
    return Boolean(value);
}
/**
 * Transform numeric values
 */
function transformNumeric(value, columnType) {
    if (typeof value === 'string' && value.trim() !== '') {
        const num = Number(value);
        if (!isNaN(num)) {
            return columnType === 'integer' || columnType === 'bigint' ? Math.floor(num) : num;
        }
    }
    return value;
}
/**
 * Check if column is a UUID column
 */
function isUUIDColumn(columnName) {
    return (columnName.includes('_id') &&
        columnName !== 'old_id' &&
        columnName !== 'login_fail_count' &&
        !columnName.includes('position') &&
        !columnName.includes('count') &&
        !columnName.includes('num'));
}
/**
 * Check if column type is numeric
 */
function isNumericType(columnType) {
    return (columnType === 'integer' ||
        columnType === 'bigint' ||
        columnType === 'numeric' ||
        columnType === 'double precision');
}
/**
 * Transform a record (row) based on column mappings
 */
function transformRecord(record, columns, columnTypes) {
    return columns.map(col => {
        const value = record[col];
        const columnType = columnTypes.get(col) || 'text';
        return transformValue(value, col, columnType);
    });
}
