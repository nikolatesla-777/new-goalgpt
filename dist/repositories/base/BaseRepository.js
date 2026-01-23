"use strict";
/**
 * Base Repository
 *
 * Generic base class for repositories with common CRUD logic and idempotency
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
class BaseRepository {
    constructor(tableName, externalIdColumn = 'external_id') {
        this.tableName = tableName;
        this.externalIdColumn = externalIdColumn;
    }
    /**
     * Execute query with error handling
     */
    async executeQuery(query, params = [], client) {
        const dbClient = client || await connection_1.pool.connect();
        try {
            const result = await dbClient.query(query, params);
            return result.rows;
        }
        catch (error) {
            logger_1.logger.error(`Database error in ${this.tableName}:`, {
                message: error.message,
                query,
                params,
            });
            throw error;
        }
        finally {
            if (!client) {
                dbClient.release();
            }
        }
    }
    /**
     * Find by ID
     */
    async findById(id) {
        const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
        const rows = await this.executeQuery(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Find by external ID (TheSports ID)
     */
    async findByExternalId(externalId) {
        const query = `SELECT * FROM ${this.tableName} WHERE ${this.externalIdColumn} = $1`;
        const rows = await this.executeQuery(query, [externalId]);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Find all
     */
    async findAll() {
        const query = `SELECT * FROM ${this.tableName}`;
        return this.executeQuery(query);
    }
    /**
     * Create new record
     */
    async create(item) {
        const columns = Object.keys(item).join(', ');
        const placeholders = Object.keys(item)
            .map((_, index) => `$${index + 1}`)
            .join(', ');
        const values = Object.values(item);
        const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;
        const rows = await this.executeQuery(query, values);
        return rows[0];
    }
    /**
     * Update record
     */
    async update(id, item) {
        const setClause = Object.keys(item)
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ');
        const values = [id, ...Object.values(item)];
        const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
        const rows = await this.executeQuery(query, values);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Upsert (Insert or Update) - Idempotent operation
     * Uses ON CONFLICT DO UPDATE to prevent duplicates
     * CRITICAL: Triple-check ID stripping to prevent NOT NULL constraint violation
     */
    async upsert(item, conflictKey = this.externalIdColumn) {
        // CRITICAL FIX: Create clean object WITHOUT id/created_at from scratch
        const itemAny = item;
        const insertData = {};
        // Only copy allowed fields (explicitly exclude id and created_at)
        for (const key in itemAny) {
            if (key !== 'id' && key !== 'created_at' && itemAny.hasOwnProperty(key)) {
                insertData[key] = itemAny[key];
            }
        }
        // FINAL SAFETY CHECK: Explicitly remove id if it somehow got in
        delete insertData.id;
        delete insertData.created_at;
        // Build columns and values arrays (id is guaranteed to be excluded)
        const columns = Object.keys(insertData).filter(k => k !== 'id' && k !== 'created_at').join(', ');
        const placeholders = Object.keys(insertData)
            .filter(k => k !== 'id' && k !== 'created_at')
            .map((_, index) => `$${index + 1}`)
            .join(', ');
        const values = Object.keys(insertData)
            .filter(k => k !== 'id' && k !== 'created_at')
            .map(k => insertData[k]);
        const updateClause = Object.keys(insertData)
            .filter(key => key !== conflictKey && key !== 'updated_at') // Exclude updated_at - we set it manually
            .map((key, index) => {
            const valueIndex = Object.keys(insertData).indexOf(key) + 1;
            return `${key} = $${valueIndex}`;
        })
            .join(', ');
        const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      ON CONFLICT (${conflictKey}) 
      DO UPDATE SET ${updateClause}, updated_at = NOW()
      RETURNING *
    `;
        const rows = await this.executeQuery(query, values);
        return rows[0];
    }
    /**
     * Delete record
     */
    async delete(id) {
        const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
        const rows = await this.executeQuery(query, [id]);
        return rows.length > 0;
    }
    /**
     * Batch upsert - Idempotent bulk operation
     */
    async batchUpsert(items, conflictKey = this.externalIdColumn) {
        if (items.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const item of items) {
                const result = await this.upsert(item, conflictKey);
                results.push(result);
            }
            await client.query('COMMIT');
            return results;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
}
exports.BaseRepository = BaseRepository;
