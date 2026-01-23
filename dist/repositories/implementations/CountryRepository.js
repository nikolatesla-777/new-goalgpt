"use strict";
/**
 * Country Repository
 *
 * Data access layer for ts_countries table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountryRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
const connection_1 = require("../../database/connection");
class CountryRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_countries', 'external_id');
    }
    /**
     * Find countries by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Find countries by category_id
     */
    async findByCategoryId(categoryId) {
        const query = `SELECT * FROM ${this.tableName} WHERE category_id = $1`;
        return this.executeQuery(query, [categoryId]);
    }
    /**
     * Create or update country (idempotent)
     */
    async createOrUpdate(countryData) {
        if (!countryData.external_id) {
            throw new Error('external_id is required');
        }
        return this.upsert(countryData, 'external_id');
    }
    /**
     * Batch upsert countries
     */
    async batchUpsert(countries) {
        if (countries.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const country of countries) {
                const countryData = {
                    external_id: country.external_id,
                    category_id: country.category_id || null,
                    name: country.name,
                    logo: country.logo || null,
                };
                // Convert updated_at timestamp to Date if provided
                if (country.updated_at) {
                    countryData.updated_at = new Date(country.updated_at * 1000);
                }
                const result = await this.upsert(countryData, 'external_id');
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
exports.CountryRepository = CountryRepository;
