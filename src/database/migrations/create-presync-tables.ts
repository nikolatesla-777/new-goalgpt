/**
 * Migration: Create pre-sync tables for H2H, Lineups, and Compensation
 * 
 * These tables store data fetched during daily pre-sync (before matches start)
 */

import { pool } from '../connection';

export async function up(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. ts_match_h2h - H2H data from /match/analysis
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_match_h2h (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id VARCHAR(50) UNIQUE NOT NULL,
        home_team_id VARCHAR(50),
        away_team_id VARCHAR(50),
        
        -- H2H Summary
        total_matches INT DEFAULT 0,
        home_wins INT DEFAULT 0,
        draws INT DEFAULT 0,
        away_wins INT DEFAULT 0,
        
        -- Raw data from API
        h2h_matches JSONB,
        home_recent_form JSONB,
        away_recent_form JSONB,
        goal_distribution JSONB,
        raw_response JSONB,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

        // Index for fast lookup
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_match_h2h_match_id ON ts_match_h2h(match_id);
    `);

        // 2. ts_match_lineups - Lineup data from /match/lineup/detail
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_match_lineups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id VARCHAR(50) UNIQUE NOT NULL,
        
        home_formation VARCHAR(20),
        away_formation VARCHAR(20),
        home_lineup JSONB,
        away_lineup JSONB,
        home_subs JSONB,
        away_subs JSONB,
        raw_response JSONB,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_match_lineups_match_id ON ts_match_lineups(match_id);
    `);

        // 3. ts_compensation - Compensation data from /compensation/list
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_compensation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id VARCHAR(50) UNIQUE NOT NULL,
        
        h2h_data JSONB,
        recent_record JSONB,
        historical_compensation JSONB,
        raw_response JSONB,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_compensation_match_id ON ts_compensation(match_id);
    `);

        // 4. ts_standings - Standings from /season/recent/table/detail
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_standings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        season_id VARCHAR(50) UNIQUE NOT NULL,
        competition_id VARCHAR(50),
        
        standings JSONB,
        raw_response JSONB,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_standings_season_id ON ts_standings(season_id);
    `);

        await client.query('COMMIT');
        console.log('✅ Pre-sync tables created successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function down(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DROP TABLE IF EXISTS ts_match_h2h CASCADE');
        await client.query('DROP TABLE IF EXISTS ts_match_lineups CASCADE');
        await client.query('DROP TABLE IF EXISTS ts_compensation CASCADE');
        await client.query('DROP TABLE IF EXISTS ts_standings CASCADE');
        await client.query('COMMIT');
        console.log('✅ Pre-sync tables dropped successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
