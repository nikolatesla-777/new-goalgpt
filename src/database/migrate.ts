import { pool } from './connection';
import { logger } from '../utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * TODO [DATABASE-REFACTOR-TRACK]:
 * This file violates the "SQL only in repositories" architectural rule.
 *
 * PROBLEM:
 * - 700+ lines of inline SQL makes this unmaintainable
 * - SQL should live in src/database/repositories/{entity}.repository.ts
 * - Migration logic should be separated from schema definitions
 *
 * PLAN (dedicated DB refactor PR):
 * 1. Extract schema SQL to src/database/schema/*.sql files
 * 2. Create proper migration runner that reads from schema/
 * 3. Implement repository pattern for all DB queries
 * 4. Use Kysely query builder for type-safe queries
 *
 * DO NOT REFACTOR NOW - this is intentionally deferred to the database
 * architecture PR track. PR-0 focuses on deployment infrastructure only.
 */

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    // Read and execute SQL migration file
    const migrationSQL = `
      -- Create extensions
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Customer Users Table
      CREATE TABLE IF NOT EXISTS customer_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        public_id UUID UNIQUE,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        email_verified_at TIMESTAMP,
        phone_verified_at TIMESTAMP,
        password_hash VARCHAR(255),
        full_name VARCHAR(255),
        address TEXT,
        is_active BOOLEAN DEFAULT true,
        is_online BOOLEAN DEFAULT false,
        last_seen_at TIMESTAMP,
        two_fa_enabled BOOLEAN DEFAULT false,
        two_fa_secret VARCHAR(255),
        registration_platform VARCHAR(50),
        registration_source VARCHAR(255),
        registration_ip VARCHAR(50),
        registration_country VARCHAR(100),
        last_login_ip VARCHAR(50),
        last_login_country VARCHAR(100),
        last_login_platform VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP,
        public_code VARCHAR(50),
        username VARCHAR(100),
        profile_image_url TEXT,
        cover_image_url TEXT,
        is_push_allowed_mobile BOOLEAN DEFAULT true,
        is_push_allowed_web BOOLEAN DEFAULT true,
        deleted_by UUID,
        selected_team_id VARCHAR(255),
        selected_team_name VARCHAR(255),
        selected_team_logo TEXT,
        is_vip BOOLEAN DEFAULT false,
        old_id INTEGER,
        password_last_changed TIMESTAMP,
        locale_preference VARCHAR(10) DEFAULT 'tr'
      );

      -- Subscription Plans Table
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id UUID PRIMARY KEY,
        name VARCHAR(255),
        description TEXT,
        platform VARCHAR(50),
        external_product_id VARCHAR(255),
        stripe_price_id VARCHAR(255),
        price DECIMAL(10, 2),
        duration_in_days INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP,
        duration_label VARCHAR(50),
        discount_rate DECIMAL(5, 2),
        mobile_home_page_title VARCHAR(255)
      );

      -- Customer Subscriptions Table
      CREATE TABLE IF NOT EXISTS customer_subscriptions (
        id UUID PRIMARY KEY,
        customer_user_id UUID REFERENCES customer_users(id),
        plan_id UUID REFERENCES subscription_plans(id),
        status VARCHAR(50),
        started_at TIMESTAMP,
        expired_at TIMESTAMP,
        canceled_at TIMESTAMP,
        renewal_type VARCHAR(50),
        store_type VARCHAR(50),
        store_transaction_id TEXT,
        store_original_transaction_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP,
        store_product_id VARCHAR(255),
        auto_renew_enabled BOOLEAN,
        revoked_at TIMESTAMP,
        revocation_reason TEXT,
        grace_expires_at TIMESTAMP,
        last_verified_at TIMESTAMP,
        environment VARCHAR(50),
        google_purchase_token TEXT,
        device_id UUID,
        platform VARCHAR(50),
        app_account_token TEXT,
        amount DECIMAL(10, 2),
        currency VARCHAR(10),
        country_code VARCHAR(10),
        last_status INTEGER,
        last_signed_date_ms BIGINT,
        store_order_id VARCHAR(255),
        obfuscated_external_account_id TEXT,
        obfuscated_external_profile_id TEXT,
        linked_purchase_token TEXT
      );

      -- Admin Users Table
      CREATE TABLE IF NOT EXISTS admin_users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        avatar_url TEXT,
        last_login_at TIMESTAMP,
        login_fail_count INTEGER DEFAULT 0,
        force_password_change BOOLEAN DEFAULT false,
        two_fa_enabled BOOLEAN DEFAULT false,
        two_fa_secret VARCHAR(255),
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP,
        password_salt VARCHAR(255)
      );

      -- TS Matches Table
      CREATE TABLE IF NOT EXISTS ts_matches (
        id UUID PRIMARY KEY,
        external_id VARCHAR(255) UNIQUE,
        season_id VARCHAR(255),
        competition_id VARCHAR(255),
        home_team_id VARCHAR(255),
        away_team_id VARCHAR(255),
        status_id INTEGER,
        match_time BIGINT,
        venue_id VARCHAR(255),
        referee_id VARCHAR(255),
        neutral BOOLEAN DEFAULT false,
        note TEXT,
        home_scores JSONB,
        away_scores JSONB,
        home_position INTEGER,
        away_position INTEGER,
        coverage_mlive BOOLEAN,
        coverage_lineup BOOLEAN,
        stage_id VARCHAR(255),
        group_num INTEGER,
        round_num INTEGER,
        related_id VARCHAR(255),
        agg_score VARCHAR(50),
        environment_weather VARCHAR(255),
        environment_pressure VARCHAR(255),
        environment_temperature VARCHAR(255),
        environment_wind VARCHAR(255),
        environment_humidity VARCHAR(255),
        tbd BOOLEAN,
        has_ot BOOLEAN,
        ended BOOLEAN,
        team_reverse BOOLEAN,
        external_updated_at BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- TS Teams Table
      CREATE TABLE IF NOT EXISTS ts_teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(100),
        logo_url VARCHAR(500),
        website VARCHAR(500),
        national BOOLEAN,
        foundation_time INTEGER,
        competition_id VARCHAR(255),
        country_id VARCHAR(255),
        venue_id VARCHAR(255),
        coach_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_teams_external_id ON ts_teams(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_teams_competition_id ON ts_teams(competition_id);
      CREATE INDEX IF NOT EXISTS idx_ts_teams_country_id ON ts_teams(country_id);
      CREATE INDEX IF NOT EXISTS idx_ts_teams_name ON ts_teams(name);

      -- TS Players Table (High Volume)
      CREATE TABLE IF NOT EXISTS ts_players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(100),
        logo VARCHAR(500),
        team_id VARCHAR(255),
        country_id VARCHAR(255),
        age INTEGER,
        birthday BIGINT,
        height INTEGER,
        weight INTEGER,
        market_value BIGINT,
        market_value_currency VARCHAR(10),
        contract_until BIGINT,
        preferred_foot INTEGER,
        position VARCHAR(10),
        positions JSONB,
        ability JSONB,
        characteristics JSONB,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_players_external_id ON ts_players(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_players_team_id ON ts_players(team_id);
      CREATE INDEX IF NOT EXISTS idx_ts_players_country_id ON ts_players(country_id);
      CREATE INDEX IF NOT EXISTS idx_ts_players_name ON ts_players(name);
      CREATE INDEX IF NOT EXISTS idx_ts_players_positions_gin ON ts_players USING GIN (positions);

      -- TS Coaches Table
      CREATE TABLE IF NOT EXISTS ts_coaches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(100),
        logo VARCHAR(500),
        team_id VARCHAR(255),
        country_id VARCHAR(255),
        type INTEGER,
        birthday BIGINT,
        age INTEGER,
        preferred_formation VARCHAR(20),
        nationality VARCHAR(100),
        joined BIGINT,
        contract_until BIGINT,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_coaches_external_id ON ts_coaches(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_coaches_team_id ON ts_coaches(team_id);
      CREATE INDEX IF NOT EXISTS idx_ts_coaches_country_id ON ts_coaches(country_id);
      CREATE INDEX IF NOT EXISTS idx_ts_coaches_name ON ts_coaches(name);

      -- TS Referees Table
      CREATE TABLE IF NOT EXISTS ts_referees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(100),
        logo VARCHAR(500),
        country_id VARCHAR(255),
        birthday BIGINT,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_referees_external_id ON ts_referees(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_referees_country_id ON ts_referees(country_id);
      CREATE INDEX IF NOT EXISTS idx_ts_referees_name ON ts_referees(name);

      -- TS Venues Table
      CREATE TABLE IF NOT EXISTS ts_venues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        city VARCHAR(255),
        capacity INTEGER,
        country_id VARCHAR(255),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_venues_external_id ON ts_venues(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_venues_country_id ON ts_venues(country_id);
      CREATE INDEX IF NOT EXISTS idx_ts_venues_name ON ts_venues(name);
      CREATE INDEX IF NOT EXISTS idx_ts_venues_city ON ts_venues(city);

      -- TS Seasons Table
      CREATE TABLE IF NOT EXISTS ts_seasons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        competition_id VARCHAR(255),
        year VARCHAR(50),
        is_current BOOLEAN,
        has_table BOOLEAN,
        has_player_stats BOOLEAN,
        has_team_stats BOOLEAN,
        start_time BIGINT,
        end_time BIGINT,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_seasons_external_id ON ts_seasons(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_seasons_competition_id ON ts_seasons(competition_id);
      CREATE INDEX IF NOT EXISTS idx_ts_seasons_competition_current ON ts_seasons(competition_id, is_current);
      CREATE INDEX IF NOT EXISTS idx_ts_seasons_is_current ON ts_seasons(is_current);

      -- TS Stages Table
      CREATE TABLE IF NOT EXISTS ts_stages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        season_id VARCHAR(255),
        name VARCHAR(255),
        mode INTEGER,
        group_count INTEGER,
        round_count INTEGER,
        sort_order INTEGER,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_stages_external_id ON ts_stages(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_stages_season_id ON ts_stages(season_id);
      CREATE INDEX IF NOT EXISTS idx_ts_stages_season_order ON ts_stages(season_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_ts_stages_mode ON ts_stages(mode);

      -- TS Categories Table
      CREATE TABLE IF NOT EXISTS ts_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_categories_external_id ON ts_categories(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_categories_name ON ts_categories(name);

      -- TS Countries Table
      CREATE TABLE IF NOT EXISTS ts_countries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        category_id VARCHAR(255),
        name VARCHAR(255),
        logo VARCHAR(500),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_countries_external_id ON ts_countries(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_countries_category_id ON ts_countries(category_id);
      CREATE INDEX IF NOT EXISTS idx_ts_countries_name ON ts_countries(name);

      -- TS Competitions Table
      CREATE TABLE IF NOT EXISTS ts_competitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(255),
        logo_url VARCHAR(500),
        type INTEGER,
        category_id VARCHAR(255),
        country_id VARCHAR(255),
        cur_season_id VARCHAR(255),
        cur_stage_id VARCHAR(255),
        primary_color VARCHAR(50),
        secondary_color VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ts_competitions_external_id ON ts_competitions(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_competitions_category_id ON ts_competitions(category_id);
      CREATE INDEX IF NOT EXISTS idx_ts_competitions_type ON ts_competitions(type);

      -- Prediction Bot Groups Table
      CREATE TABLE IF NOT EXISTS prediction_bot_groups (
        id UUID PRIMARY KEY,
        name VARCHAR(255),
        display_name VARCHAR(255),
        alias VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_public BOOLEAN DEFAULT false,
        is_deleted BOOLEAN DEFAULT false
      );

      -- TS Prediction Mapped Table
      CREATE TABLE IF NOT EXISTS ts_prediction_mapped (
        id UUID PRIMARY KEY,
        temp_prediction_id UUID,
        bot_group_id UUID REFERENCES prediction_bot_groups(id),
        competition_name VARCHAR(255),
        home_team_name VARCHAR(255),
        away_team_name VARCHAR(255),
        home_team_id VARCHAR(255),
        away_team_id VARCHAR(255),
        match_score VARCHAR(50),
        minute INTEGER,
        prediction TEXT,
        alert VARCHAR(255),
        raw_text TEXT,
        clean_text TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Notification Outbox Table
      CREATE TABLE IF NOT EXISTS notification_outbox (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_user_id UUID REFERENCES customer_users(id),
        notification_type VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        data JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Customer Notification Tokens Table
      CREATE TABLE IF NOT EXISTS customer_notification_tokens (
        id UUID PRIMARY KEY,
        customer_user_id UUID REFERENCES customer_users(id),
        device_id UUID,
        platform VARCHAR(50),
        token TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      -- TS Prediction Group Table
      CREATE TABLE IF NOT EXISTS ts_prediction_group (
        id UUID PRIMARY KEY,
        title VARCHAR(255),
        created_at TIMESTAMP,
        temp_prediction_id UUID,
        raw_text TEXT,
        clean_text TEXT,
        access_type VARCHAR(50)
      );

      -- TS Prediction Group Item Table
      CREATE TABLE IF NOT EXISTS ts_prediction_group_item (
        id UUID PRIMARY KEY,
        group_id UUID REFERENCES ts_prediction_group(id),
        home_team_name VARCHAR(255),
        away_team_name VARCHAR(255),
        prediction TEXT,
        created_at TIMESTAMP,
        home_team_id VARCHAR(255),
        away_team_id VARCHAR(255),
        home_team_logo TEXT,
        away_team_logo TEXT,
        country_logo TEXT,
        league_name VARCHAR(255),
        match_time BIGINT
      );

      -- Prediction Bot Competitions Table
      CREATE TABLE IF NOT EXISTS prediction_bot_competitions (
        id UUID PRIMARY KEY,
        bot_group_id UUID REFERENCES prediction_bot_groups(id),
        competition_external_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      );

      -- TS Prediction Live View Active Table
      CREATE TABLE IF NOT EXISTS ts_prediction_live_view_active (
        id UUID PRIMARY KEY,
        temp_prediction_id UUID,
        bot_group_id UUID REFERENCES prediction_bot_groups(id),
        bot_group_name VARCHAR(255),
        prediction TEXT,
        match_score VARCHAR(50),
        prediction_minute INTEGER,
        home_team_id VARCHAR(255),
        home_team_name VARCHAR(255),
        home_team_logo TEXT,
        away_team_id VARCHAR(255),
        away_team_name VARCHAR(255),
        away_team_logo TEXT,
        competition_id VARCHAR(255),
        competition_name VARCHAR(255),
        match_time BIGINT,
        match_status INTEGER,
        match_status_text VARCHAR(255),
        home_score INTEGER,
        away_score INTEGER,
        match_minute INTEGER,
        match_uuid UUID,
        is_active BOOLEAN DEFAULT true,
        is_success BOOLEAN,
        error_message TEXT,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        competition_logo TEXT,
        country_logo TEXT,
        manual_prediction_id UUID
      );

      -- Customer Push Notifications Table
      CREATE TABLE IF NOT EXISTS customer_push_notifications (
        id UUID PRIMARY KEY,
        customer_user_id UUID REFERENCES customer_users(id),
        notification_type VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        data JSONB,
        status VARCHAR(50),
        sent_at TIMESTAMP,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      );

      -- TS Match Live Data Table (for storing live match updates)
      CREATE TABLE IF NOT EXISTS ts_match_live_data (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        match_id UUID REFERENCES ts_matches(id),
        external_id VARCHAR(255),
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- TS Seasons Table
      CREATE TABLE IF NOT EXISTS ts_seasons (
        id UUID PRIMARY KEY,
        external_id VARCHAR(255) UNIQUE,
        name VARCHAR(255),
        competition_id VARCHAR(255),
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        is_current BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- TS Venues Table
      CREATE TABLE IF NOT EXISTS ts_venues (
        id UUID PRIMARY KEY,
        external_id VARCHAR(255) UNIQUE,
        name VARCHAR(255),
        city VARCHAR(255),
        country VARCHAR(255),
        capacity INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- TS Referees Table
      CREATE TABLE IF NOT EXISTS ts_referees (
        id UUID PRIMARY KEY,
        external_id VARCHAR(255) UNIQUE,
        name VARCHAR(255),
        country VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- TS Country Table
      CREATE TABLE IF NOT EXISTS ts_country (
        id UUID PRIMARY KEY,
        external_id VARCHAR(255) UNIQUE,
        name VARCHAR(255),
        code VARCHAR(10),
        flag_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- TS Recent Matches Table
      CREATE TABLE IF NOT EXISTS ts_recent_matches (
        id UUID PRIMARY KEY,
        external_id VARCHAR(255) UNIQUE,
        season_id VARCHAR(255),
        competition_id VARCHAR(255),
        home_team_id VARCHAR(255),
        away_team_id VARCHAR(255),
        status_id INTEGER,
        match_time BIGINT,
        venue_id VARCHAR(255),
        referee_id VARCHAR(255),
        neutral BOOLEAN DEFAULT false,
        note TEXT,
        home_scores JSONB,
        away_scores JSONB,
        home_position INTEGER,
        away_position INTEGER,
        coverage_mlive BOOLEAN,
        coverage_lineup BOOLEAN,
        stage_id VARCHAR(255),
        group_num INTEGER,
        round_num INTEGER,
        related_id VARCHAR(255),
        agg_score VARCHAR(50),
        environment_weather VARCHAR(255),
        environment_pressure VARCHAR(255),
        environment_temperature VARCHAR(255),
        environment_wind VARCHAR(255),
        environment_humidity VARCHAR(255),
        tbd BOOLEAN,
        has_ot BOOLEAN,
        ended BOOLEAN,
        team_reverse BOOLEAN,
        external_updated_at BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Favorite Teams Table
      CREATE TABLE IF NOT EXISTS favorite_teams (
        id UUID PRIMARY KEY,
        customer_user_id UUID REFERENCES customer_users(id),
        league_id VARCHAR(255),
        team_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      -- Customer Sessions Table
      CREATE TABLE IF NOT EXISTS customer_sessions (
        id UUID PRIMARY KEY,
        customer_user_id UUID REFERENCES customer_users(id),
        device_id UUID,
        platform VARCHAR(50),
        ip_address VARCHAR(50),
        country VARCHAR(100),
        user_agent TEXT,
        access_token TEXT,
        refresh_token TEXT,
        refresh_token_expire_at TIMESTAMP,
        revoked_at TIMESTAMP,
        last_activity_at TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        is_current BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      -- Support Tickets Table
      CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY,
        customer_user_id UUID REFERENCES customer_users(id),
        subject VARCHAR(255),
        status VARCHAR(50),
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        closed_at TIMESTAMP,
        expires_at TIMESTAMP,
        deleted_at TIMESTAMP,
        seen_at TIMESTAMP,
        platform VARCHAR(50),
        ticket_no VARCHAR(50) UNIQUE
      );

      -- Support Ticket Messages Table
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ticket_id UUID REFERENCES support_tickets(id),
        customer_user_id UUID REFERENCES customer_users(id),
        message TEXT,
        is_from_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_user_id ON customer_subscriptions(customer_user_id);
      CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON customer_subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_expired_at ON customer_subscriptions(expired_at);
      CREATE INDEX IF NOT EXISTS idx_ts_matches_status ON ts_matches(status_id);
      CREATE INDEX IF NOT EXISTS idx_ts_matches_time ON ts_matches(match_time);
      CREATE INDEX IF NOT EXISTS idx_ts_matches_competition ON ts_matches(competition_id);
      CREATE INDEX IF NOT EXISTS idx_ts_matches_external_id ON ts_matches(external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_prediction_mapped_bot_group ON ts_prediction_mapped(bot_group_id);
      CREATE INDEX IF NOT EXISTS idx_ts_prediction_mapped_created_at ON ts_prediction_mapped(created_at);
      CREATE INDEX IF NOT EXISTS idx_ts_prediction_group_item_group_id ON ts_prediction_group_item(group_id);
      CREATE INDEX IF NOT EXISTS idx_prediction_bot_competitions_bot_group ON prediction_bot_competitions(bot_group_id);
      CREATE INDEX IF NOT EXISTS idx_prediction_bot_competitions_competition ON prediction_bot_competitions(competition_external_id);
      CREATE INDEX IF NOT EXISTS idx_ts_prediction_live_view_active_bot_group ON ts_prediction_live_view_active(bot_group_id);
      CREATE INDEX IF NOT EXISTS idx_ts_prediction_live_view_active_is_active ON ts_prediction_live_view_active(is_active);
      CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox(status);
      CREATE INDEX IF NOT EXISTS idx_notification_outbox_customer_user ON notification_outbox(customer_user_id);
      CREATE INDEX IF NOT EXISTS idx_customer_notification_tokens_user ON customer_notification_tokens(customer_user_id);
      CREATE INDEX IF NOT EXISTS idx_customer_notification_tokens_active ON customer_notification_tokens(is_active);
      CREATE INDEX IF NOT EXISTS idx_customer_users_email ON customer_users(email);
      CREATE INDEX IF NOT EXISTS idx_customer_users_is_active ON customer_users(is_active);
      CREATE INDEX IF NOT EXISTS idx_favorite_teams_user ON favorite_teams(customer_user_id);
      CREATE INDEX IF NOT EXISTS idx_customer_sessions_user ON customer_sessions(customer_user_id);
      CREATE INDEX IF NOT EXISTS idx_customer_sessions_active ON customer_sessions(is_active);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(customer_user_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);
    `;

    await pool.query(migrationSQL);
    logger.info('✅ Database schema created successfully');
  } catch (error: any) {
    logger.error('Migration failed:', error.message);
    throw error;
  }
}

runMigrations()
  .then(() => {
    logger.info('Migrations completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration error:', error);
    process.exit(1);
  });

