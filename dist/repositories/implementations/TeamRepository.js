"use strict";
/**
 * Team Repository
 *
 * Data access layer for ts_teams table
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
class TeamRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_teams', 'external_id');
    }
    /**
     * Find teams by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Create or update team (idempotent)
     * CRITICAL: Removes id field to prevent NOT NULL constraint violation
     */
    async createOrUpdate(teamData) {
        if (!teamData.external_id) {
            throw new Error('external_id is required');
        }
        // CRITICAL: Force strip id field using destructuring (most aggressive method)
        const { id, created_at, ...cleanData } = teamData;
        // Double-check: ensure id is not in the object
        if ('id' in cleanData) {
            delete cleanData.id;
        }
        if ('created_at' in cleanData) {
            delete cleanData.created_at;
        }
        return this.upsert(cleanData, 'external_id');
    }
    /**
     * Find incomplete teams (missing name or logo)
     */
    async findIncomplete(limit = 100) {
        const query = `
      SELECT * FROM ${this.tableName} 
      WHERE name IS NULL OR logo_url IS NULL
      ORDER BY updated_at ASC
      LIMIT $1
    `;
        return this.executeQuery(query, [limit]);
    }
    /**
     * Find teams without logo
     */
    async findWithoutLogo(limit = 100) {
        const query = `
      SELECT * FROM ${this.tableName} 
      WHERE logo_url IS NULL
      ORDER BY updated_at ASC
      LIMIT $1
    `;
        return this.executeQuery(query, [limit]);
    }
    /**
     * Batch upsert teams
     */
    async batchUpsert(teams) {
        if (teams.length === 0)
            return [];
        const { pool } = await Promise.resolve().then(() => __importStar(require('../../database/connection')));
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const team of teams) {
                // Determine if this is a duplicate based on uid field
                const isDuplicate = !!(team.uid && team.uid.trim() !== '');
                const teamData = {
                    external_id: team.external_id,
                    name: team.name,
                    short_name: team.short_name || null,
                    logo_url: team.logo_url || null,
                    website: team.website || null,
                    national: team.national !== undefined ? team.national : null,
                    foundation_time: team.foundation_time || null,
                    competition_id: team.competition_id || null,
                    country_id: team.country_id || null,
                    venue_id: team.venue_id || null,
                    coach_id: team.coach_id || null,
                    uid: team.uid || null,
                    is_duplicate: isDuplicate,
                };
                // Convert updated_at timestamp to Date if provided
                if (team.updated_at) {
                    teamData.updated_at = new Date(team.updated_at * 1000);
                }
                const result = await this.upsert(teamData, 'external_id');
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
exports.TeamRepository = TeamRepository;
