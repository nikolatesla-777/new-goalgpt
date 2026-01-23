"use strict";
/**
 * Data Validation Utilities
 * Handles validation and deduplication of CSV records
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDuplicateIds = removeDuplicateIds;
exports.removeDuplicateEmails = removeDuplicateEmails;
exports.filterValidForeignKeys = filterValidForeignKeys;
exports.getForeignKeyColumn = getForeignKeyColumn;
exports.validateBatch = validateBatch;
/**
 * Remove duplicate records based on ID
 */
function removeDuplicateIds(records) {
    const seenIds = new Set();
    const unique = records.filter(record => {
        const id = record.id || record[Object.keys(record)[0]];
        if (id && !seenIds.has(id)) {
            seenIds.add(id);
            return true;
        }
        return false;
    });
    return { unique, seenIds };
}
/**
 * Remove duplicate records based on email
 */
function removeDuplicateEmails(records) {
    const seenEmails = new Set();
    const unique = records.filter(record => {
        const email = record.email;
        if (email && email.trim()) {
            const normalizedEmail = email.toLowerCase().trim();
            if (!seenEmails.has(normalizedEmail)) {
                seenEmails.add(normalizedEmail);
                return true;
            }
            return false;
        }
        return true; // Keep records without email
    });
    return { unique, seenEmails };
}
/**
 * Filter records with valid foreign key references
 */
function filterValidForeignKeys(records, fkColumn, validIds) {
    return records.filter(record => {
        const fkValue = record[fkColumn];
        if (!fkValue || fkValue === '')
            return false;
        return validIds.has(fkValue);
    });
}
/**
 * Get foreign key column name for a table
 */
function getForeignKeyColumn(tableName, record) {
    if ((tableName.includes('customer_') || tableName.includes('support_') || tableName.includes('favorite_')) &&
        tableName !== 'customer_users') {
        const fkColumn = Object.keys(record).find(col => col === 'customer_user_id' || col === 'user_id');
        return fkColumn || null;
    }
    return null;
}
/**
 * Validate and clean a batch of records
 */
function validateBatch(records, tableName, context) {
    let validated = records;
    // Remove duplicate IDs
    const { unique: uniqueByIds, seenIds } = removeDuplicateIds(validated);
    validated = uniqueByIds;
    context.seenIds = new Set([...context.seenIds, ...seenIds]);
    // Remove duplicate emails if email column exists
    if (validated.length > 0 && Object.keys(validated[0]).includes('email')) {
        const { unique: uniqueByEmails, seenEmails } = removeDuplicateEmails(validated);
        validated = uniqueByEmails;
        context.seenEmails = new Set([...context.seenEmails, ...seenEmails]);
    }
    // Filter invalid foreign keys
    if (validated.length > 0 && context.validUserIds) {
        const fkColumn = getForeignKeyColumn(tableName, validated[0]);
        if (fkColumn) {
            validated = filterValidForeignKeys(validated, fkColumn, context.validUserIds);
        }
    }
    return validated;
}
