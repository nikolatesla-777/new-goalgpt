"use strict";
/**
 * Database Connection Test Script
 *
 * Bu script database bağlantısını test eder.
 *
 * Kullanım: tsx src/database/test-connection.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const connection_1 = require("./connection");
const logger_1 = require("../utils/logger");
dotenv_1.default.config();
async function testConnection() {
    try {
        logger_1.logger.info('Testing database connection...');
        await (0, connection_1.connectDatabase)();
        logger_1.logger.info('✅ Database connection successful!');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
}
testConnection();
