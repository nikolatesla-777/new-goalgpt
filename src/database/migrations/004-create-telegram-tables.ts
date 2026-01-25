import { Kysely, sql } from 'kysely';

/**
 * Create telegram_posts and telegram_picks tables
 * For Telegram publishing system with settlement tracking
 */
export async function up(db: Kysely<any>): Promise<void> {
  console.log('🚀 Creating telegram tables...');

  // Enable pgcrypto extension for gen_random_uuid()
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

  // Create telegram_posts table
  await db.schema
    .createTable('telegram_posts')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('match_id', 'varchar(50)', col => col.notNull())
    .addColumn('fs_match_id', 'integer')
    .addColumn('telegram_message_id', 'bigint', col => col.notNull())
    .addColumn('channel_id', 'varchar(100)', col => col.notNull())
    .addColumn('content', 'text', col => col.notNull())
    .addColumn('posted_at', 'timestamptz', col => col.defaultTo(sql`NOW()`))
    .addColumn('settled_at', 'timestamptz')
    .addColumn('status', 'varchar(20)', col => col.defaultTo('active'))
    .execute();

  // Create indexes
  await db.schema
    .createIndex('idx_telegram_posts_status')
    .on('telegram_posts')
    .column('status')
    .execute();

  await db.schema
    .createIndex('idx_telegram_posts_match_id')
    .on('telegram_posts')
    .column('match_id')
    .execute();

  // Add unique constraint
  await sql`
    ALTER TABLE telegram_posts
    ADD CONSTRAINT telegram_posts_match_channel_unique
    UNIQUE (match_id, channel_id)
  `.execute(db);

  // Create telegram_picks table
  await db.schema
    .createTable('telegram_picks')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('post_id', 'uuid', col => col.references('telegram_posts.id').onDelete('cascade'))
    .addColumn('market_type', 'varchar(50)', col => col.notNull())
    .addColumn('odds', sql`DECIMAL(5,2)`)
    .addColumn('status', 'varchar(20)', col => col.defaultTo('pending'))
    .addColumn('settled_at', 'timestamptz')
    .addColumn('result_data', 'jsonb')
    .addColumn('created_at', 'timestamptz', col => col.defaultTo(sql`NOW()`))
    .execute();

  // Create indexes
  await db.schema
    .createIndex('idx_telegram_picks_status')
    .on('telegram_picks')
    .column('status')
    .execute();

  await db.schema
    .createIndex('idx_telegram_picks_post_id')
    .on('telegram_picks')
    .column('post_id')
    .execute();

  console.log('✅ Telegram tables created successfully');
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log('🔄 Dropping telegram tables...');

  await db.schema.dropTable('telegram_picks').ifExists().execute();
  await db.schema.dropTable('telegram_posts').ifExists().execute();

  console.log('✅ Telegram tables dropped');
}
