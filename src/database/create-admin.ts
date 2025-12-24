import bcrypt from 'bcryptjs';
import { pool } from './connection';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

async function createAdmin(email: string, password: string, role: string = 'admin') {
  try {
    // Check if admin already exists
    const existing = await pool.query(
      'SELECT id FROM admin_users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      logger.warn(`Admin with email ${email} already exists`);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const adminId = randomUUID();
    await pool.query(
      `INSERT INTO admin_users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
      [adminId, email.toLowerCase(), passwordHash, role]
    );

    logger.info(`✅ Admin user created: ${email}`);
    logger.info(`   ID: ${adminId}`);
    logger.info(`   Role: ${role}`);
  } catch (error: any) {
    logger.error('Error creating admin:', error.message);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const email = args[0] || 'admin@goalgpt.com';
  const password = args[1] || 'admin123';
  const role = args[2] || 'admin';

  createAdmin(email, password, role)
    .then(() => {
      logger.info('Admin creation completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Admin creation failed:', error);
      process.exit(1);
    });
}

export { createAdmin };

