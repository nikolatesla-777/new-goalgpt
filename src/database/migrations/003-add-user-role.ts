import { Kysely, sql } from 'kysely';

/**
 * Add role column to customer_users table
 */
export async function up(db: Kysely<any>): Promise<void> {
    console.log('🚀 Adding role column to customer_users...');

    await sql`
    ALTER TABLE customer_users
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'
  `.execute(db);

    // Add constraint to ensure only allowed roles
    await sql`
    ALTER TABLE customer_users
    ADD CONSTRAINT chk_user_role CHECK (role IN ('user', 'admin', 'moderator'))
  `.execute(db);

    console.log('✅ role column added');
}

export async function down(db: Kysely<any>): Promise<void> {
    console.log('🔄 Removing role column from customer_users...');

    await sql`
    ALTER TABLE customer_users
    DROP CONSTRAINT IF EXISTS chk_user_role
  `.execute(db);

    await sql`
    ALTER TABLE customer_users
    DROP COLUMN IF EXISTS role
  `.execute(db);

    console.log('✅ role column removed');
}
