"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdmin = createAdmin;
// @ts-ignore
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const connection_1 = require("./connection");
const logger_1 = require("../utils/logger");
const crypto_1 = require("crypto");
async function createAdmin(email, password, role = 'admin') {
    try {
        // Check if admin already exists
        const existing = await connection_1.pool.query('SELECT id FROM admin_users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            logger_1.logger.warn(`Admin with email ${email} already exists`);
            return;
        }
        // Hash password
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        // Create admin user
        const adminId = (0, crypto_1.randomUUID)();
        await connection_1.pool.query(`INSERT INTO admin_users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())`, [adminId, email.toLowerCase(), passwordHash, role]);
        logger_1.logger.info(`✅ Admin user created: ${email}`);
        logger_1.logger.info(`   ID: ${adminId}`);
        logger_1.logger.info(`   Role: ${role}`);
    }
    catch (error) {
        logger_1.logger.error('Error creating admin:', error.message);
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
        logger_1.logger.info('Admin creation completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Admin creation failed:', error);
        process.exit(1);
    });
}
