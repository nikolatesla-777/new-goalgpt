"use strict";
/**
 * Migration: Create ts_match_player_stats table
 *
 * Stores individual player statistics for each match.
 * This data is fetched from /match/player_stats API and persisted
 * so it remains available even after the match ends (API stops returning data).
 *
 * CRITICAL: TheSports API only returns player stats for live/recent matches.
 * We must persist this data before the match becomes "old".
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const connection_1 = require("../connection");
async function up() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Create the player stats table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_match_player_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id VARCHAR(50) NOT NULL,
        player_id VARCHAR(50) NOT NULL,
        team_id VARCHAR(50),

        -- Player info at match time
        player_name VARCHAR(255),
        player_position VARCHAR(50),
        player_shirt_number INT,
        is_substitute BOOLEAN DEFAULT FALSE,

        -- Match participation
        minutes_played INT,
        started BOOLEAN DEFAULT FALSE,
        substituted_in INT,   -- Minute substituted in
        substituted_out INT,  -- Minute substituted out

        -- Attacking stats
        goals INT DEFAULT 0,
        assists INT DEFAULT 0,
        shots INT DEFAULT 0,
        shots_on_target INT DEFAULT 0,
        shots_blocked INT DEFAULT 0,
        shots_woodwork INT DEFAULT 0,
        penalties_taken INT DEFAULT 0,
        penalties_scored INT DEFAULT 0,
        penalties_missed INT DEFAULT 0,

        -- Passing stats
        passes INT DEFAULT 0,
        passes_accurate INT DEFAULT 0,
        pass_accuracy DECIMAL(5,2),
        key_passes INT DEFAULT 0,
        crosses INT DEFAULT 0,
        crosses_accurate INT DEFAULT 0,
        long_balls INT DEFAULT 0,
        long_balls_accurate INT DEFAULT 0,

        -- Defensive stats
        tackles INT DEFAULT 0,
        tackles_won INT DEFAULT 0,
        interceptions INT DEFAULT 0,
        clearances INT DEFAULT 0,
        blocks INT DEFAULT 0,

        -- Duel stats
        duels INT DEFAULT 0,
        duels_won INT DEFAULT 0,
        aerial_duels INT DEFAULT 0,
        aerial_duels_won INT DEFAULT 0,
        ground_duels INT DEFAULT 0,
        ground_duels_won INT DEFAULT 0,

        -- Dribbling stats
        dribbles INT DEFAULT 0,
        dribbles_successful INT DEFAULT 0,

        -- Discipline
        yellow_cards INT DEFAULT 0,
        red_cards INT DEFAULT 0,
        fouls INT DEFAULT 0,
        fouls_drawn INT DEFAULT 0,
        offsides INT DEFAULT 0,

        -- Goalkeeper specific
        saves INT DEFAULT 0,
        saves_inside_box INT DEFAULT 0,
        punches INT DEFAULT 0,
        claims INT DEFAULT 0,
        goals_conceded INT DEFAULT 0,

        -- Rating
        rating DECIMAL(4,2),

        -- Raw data for any additional stats
        raw_stats JSONB,

        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        -- Unique constraint: one entry per player per match
        UNIQUE(match_id, player_id)
      );
    `);
        // Create indexes for fast lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_match_player_stats_match_id ON ts_match_player_stats(match_id);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_match_player_stats_player_id ON ts_match_player_stats(player_id);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_match_player_stats_team_id ON ts_match_player_stats(team_id);
    `);
        // Composite index for team queries
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_match_player_stats_match_team ON ts_match_player_stats(match_id, team_id);
    `);
        await client.query('COMMIT');
        console.log('✅ ts_match_player_stats table created successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function down() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DROP TABLE IF EXISTS ts_match_player_stats CASCADE');
        await client.query('COMMIT');
        console.log('✅ ts_match_player_stats table dropped successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
