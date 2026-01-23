"use strict";
/**
 * Category Repository
 *
 * Data access layer for ts_categories table
 * STATUS: Skeleton - waiting for API documentation to define schema
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
const connection_1 = require("../../database/connection");
class CategoryRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_categories', 'external_id');
    }
    /**
     * Find categories by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Create or update category (idempotent)
     */
    async createOrUpdate(categoryData) {
        if (!categoryData.external_id) {
            throw new Error('external_id is required');
        }
        return this.upsert(categoryData, 'external_id');
    }
    /**
     * Batch upsert categories
     */
    async batchUpsert(categories) {
        if (categories.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const cat of categories) {
                const categoryData = {
                    external_id: cat.external_id,
                    name: cat.name,
                };
                // Convert updated_at timestamp to Date if provided
                if (cat.updated_at) {
                    categoryData.updated_at = new Date(cat.updated_at * 1000);
                }
                const result = await this.upsert(categoryData, 'external_id');
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
exports.CategoryRepository = CategoryRepository;
