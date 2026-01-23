"use strict";
/**
 * Venue Repository
 *
 * Data access layer for ts_venues table
 * Critical for "Home Advantage" analysis and future Weather integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VenueRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
const connection_1 = require("../../database/connection");
class VenueRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_venues', 'external_id');
    }
    /**
     * Find venues by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Find venues by country_id
     */
    async findByCountryId(countryId) {
        const query = `SELECT * FROM ${this.tableName} WHERE country_id = $1 ORDER BY capacity DESC, name`;
        return this.executeQuery(query, [countryId]);
    }
    /**
     * Find venues by city
     */
    async findByCity(city) {
        const query = `SELECT * FROM ${this.tableName} WHERE city = $1 ORDER BY capacity DESC, name`;
        return this.executeQuery(query, [city]);
    }
    /**
     * Create or update venue (idempotent)
     */
    async createOrUpdate(venueData) {
        if (!venueData.external_id) {
            throw new Error('external_id is required');
        }
        return this.upsert(venueData, 'external_id');
    }
    /**
     * Batch upsert venues
     */
    async batchUpsert(venues) {
        if (venues.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const venue of venues) {
                const venueData = {
                    external_id: venue.external_id,
                    name: venue.name,
                    city: venue.city || null,
                    capacity: venue.capacity || null,
                    country_id: venue.country_id || null,
                };
                // Convert updated_at timestamp to Date if provided
                if (venue.updated_at) {
                    venueData.updated_at = new Date(venue.updated_at * 1000);
                }
                const result = await this.upsert(venueData, 'external_id');
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
exports.VenueRepository = VenueRepository;
