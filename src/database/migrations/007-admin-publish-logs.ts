/**
 * Migration: 007 - Admin Publish Logs
 *
 * Phase-3B.2: Create admin_publish_logs table for audit logging.
 * Tracks all admin publishing actions (bulk + single) with full context.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('admin_publish_logs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('admin_user_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('match_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('market_id', 'varchar(20)', (col) => col.notNull())
    .addColumn('dry_run', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull())
    .addColumn('telegram_message_id', 'bigint')
    .addColumn('error_message', 'text')
    .addColumn('request_id', 'varchar(100)')
    .addColumn('ip_address', 'varchar(50)')
    .addColumn('user_agent', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create indexes for common queries
  await db.schema
    .createIndex('idx_admin_publish_logs_match_market')
    .on('admin_publish_logs')
    .columns(['match_id', 'market_id'])
    .execute();

  await db.schema
    .createIndex('idx_admin_publish_logs_admin_user')
    .on('admin_publish_logs')
    .column('admin_user_id')
    .execute();

  await db.schema
    .createIndex('idx_admin_publish_logs_created_at')
    .on('admin_publish_logs')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_admin_publish_logs_status')
    .on('admin_publish_logs')
    .column('status')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('admin_publish_logs').execute();
}
