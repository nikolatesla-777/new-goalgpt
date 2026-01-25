import { pool } from './src/database/connection';

async function removeConstraint() {
  const client = await pool.connect();
  try {
    console.log('Removing UNIQUE constraint from telegram_posts...');
    
    await client.query(`
      ALTER TABLE telegram_posts 
      DROP CONSTRAINT IF EXISTS telegram_posts_match_channel_unique
    `);
    
    await client.query(`
      ALTER TABLE telegram_posts 
      DROP CONSTRAINT IF EXISTS telegram_posts_match_id_channel_id_key
    `);
    
    console.log('✅ Constraint removed successfully!');
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

removeConstraint();
