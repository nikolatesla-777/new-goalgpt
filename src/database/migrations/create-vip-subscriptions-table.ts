/**
 * VIP Subscriptions Table Migration
 * 
 * Telegram Stars ile VIP üyelik sistemi
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // VIP Subscriptions Table
  await db.schema
    .createTable('telegram_vip_subscriptions')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('telegram_user_id', 'bigint', (col) => col.notNull())
    .addColumn('telegram_chat_id', 'bigint', (col) => col.notNull())
    .addColumn('username', 'varchar(255)')
    .addColumn('first_name', 'varchar(255)')
    .addColumn('subscription_type', 'varchar(50)', (col) => col.notNull().defaultTo('weekly'))
    .addColumn('price_stars', 'integer', (col) => col.notNull()) // Telegram Stars amount
    .addColumn('price_tl', 'decimal(10,2)', (col) => col.notNull()) // TL equivalent for display
    .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('pending')) // pending, active, expired, cancelled
    .addColumn('started_at', 'timestamp')
    .addColumn('expires_at', 'timestamp')
    .addColumn('cancelled_at', 'timestamp')
    .addColumn('telegram_payment_charge_id', 'varchar(255)')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  // Indexes
  await db.schema
    .createIndex('idx_vip_subs_telegram_user')
    .on('telegram_vip_subscriptions')
    .column('telegram_user_id')
    .execute();

  await db.schema
    .createIndex('idx_vip_subs_status')
    .on('telegram_vip_subscriptions')
    .columns(['status', 'expires_at'])
    .execute();

  // Payment Transactions Table
  await db.schema
    .createTable('telegram_payment_transactions')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('telegram_user_id', 'bigint', (col) => col.notNull())
    .addColumn('telegram_payment_charge_id', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('telegram_invoice_payload', 'varchar(255)', (col) => col.notNull())
    .addColumn('amount_stars', 'integer', (col) => col.notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('pending'))
    .addColumn('subscription_id', 'integer')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_payment_txn_charge_id')
    .on('telegram_payment_transactions')
    .column('telegram_payment_charge_id')
    .execute();

  console.log('✅ VIP subscriptions tables created');
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('telegram_payment_transactions').execute();
  await db.schema.dropTable('telegram_vip_subscriptions').execute();
  console.log('✅ VIP subscriptions tables dropped');
}
