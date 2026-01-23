"use strict";
/**
 * Migration: Create AI Predictions tables
 *
 * Tables for storing incoming AI predictions and their matches to TheSports data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const connection_1 = require("../connection");
async function up() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // 1. ai_predictions - Raw incoming predictions from external AI
        await client.query(`
      CREATE TABLE IF NOT EXISTS ai_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(100),
        bot_group_id UUID,
        bot_name VARCHAR(100),
        league_name VARCHAR(255),
        home_team_name VARCHAR(255),
        away_team_name VARCHAR(255),
        score_at_prediction VARCHAR(20),
        minute_at_prediction INTEGER,
        prediction_type VARCHAR(100),
        prediction_value VARCHAR(255),
        raw_payload TEXT,
        processed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
        // Indexes for ai_predictions
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_external_id ON ai_predictions(external_id);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_processed ON ai_predictions(processed);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_created_at ON ai_predictions(created_at DESC);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_bot_group_id ON ai_predictions(bot_group_id);
    `);
        // 1b. ai_bot_rules - Rules for assigning predictions to bot groups based on minute
        await client.query(`
      CREATE TABLE IF NOT EXISTS ai_bot_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_group_id UUID,
        bot_display_name VARCHAR(100) NOT NULL,
        minute_from INTEGER,
        minute_to INTEGER,
        prediction_type_pattern VARCHAR(255),
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_bot_rules_active ON ai_bot_rules(is_active);
    `);
        // Insert default bot rules (can be modified via admin)
        await client.query(`
      INSERT INTO ai_bot_rules (bot_display_name, minute_from, minute_to, priority) 
      VALUES 
        ('ALERT: D', 1, 15, 10),
        ('70. Dakika Botu', 65, 75, 20),
        ('BOT 007', 0, 90, 1)
      ON CONFLICT DO NOTHING;
    `);
        // 2. ai_prediction_matches - Links predictions to ts_matches
        await client.query(`
      CREATE TABLE IF NOT EXISTS ai_prediction_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prediction_id UUID NOT NULL REFERENCES ai_predictions(id) ON DELETE CASCADE,
        match_external_id VARCHAR(255),
        match_uuid UUID,
        home_team_id VARCHAR(255),
        away_team_id VARCHAR(255),
        home_team_confidence FLOAT DEFAULT 0,
        away_team_confidence FLOAT DEFAULT 0,
        overall_confidence FLOAT DEFAULT 0,
        match_status VARCHAR(50) DEFAULT 'pending',
        prediction_result VARCHAR(50) DEFAULT 'pending',
        final_home_score INTEGER,
        final_away_score INTEGER,
        result_reason TEXT,
        matched_at TIMESTAMP,
        resulted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
        // Indexes for ai_prediction_matches
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_prediction_matches_prediction_id ON ai_prediction_matches(prediction_id);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_prediction_matches_match_external_id ON ai_prediction_matches(match_external_id);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_prediction_matches_status ON ai_prediction_matches(match_status);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_prediction_matches_result ON ai_prediction_matches(prediction_result);
    `);
        // 3. ai_prediction_requests - Log ALL incoming requests for debugging
        await client.query(`
      CREATE TABLE IF NOT EXISTS ai_prediction_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id VARCHAR(100),
        source_ip VARCHAR(50),
        user_agent TEXT,
        http_method VARCHAR(10) DEFAULT 'POST',
        endpoint VARCHAR(255),
        request_headers JSONB,
        request_body TEXT,
        response_status INTEGER,
        response_body TEXT,
        success BOOLEAN DEFAULT false,
        error_message TEXT,
        processing_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        // Indexes for ai_prediction_requests
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_prediction_requests_created_at ON ai_prediction_requests(created_at DESC);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_prediction_requests_success ON ai_prediction_requests(success);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_prediction_requests_source_ip ON ai_prediction_requests(source_ip);
    `);
        await client.query('COMMIT');
        console.log('✅ AI Predictions tables created successfully');
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
        await client.query('DROP TABLE IF EXISTS ai_prediction_requests CASCADE');
        await client.query('DROP TABLE IF EXISTS ai_prediction_matches CASCADE');
        await client.query('DROP TABLE IF EXISTS ai_predictions CASCADE');
        await client.query('DROP TABLE IF EXISTS ai_bot_rules CASCADE');
        await client.query('COMMIT');
        console.log('✅ AI Predictions tables dropped successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
// CLI runner
if (require.main === module) {
    const action = process.argv[2];
    if (action === 'up') {
        up().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    }
    else if (action === 'down') {
        down().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    }
    else {
        console.log('Usage: npx tsx create-ai-predictions-tables.ts [up|down]');
        process.exit(1);
    }
}
