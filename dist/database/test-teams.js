"use strict";
/**
 * Test Teams Table and Repository
 *
 * Tests ts_teams table and TeamRepository functionality
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const connection_1 = require("./connection");
const logger_1 = require("../utils/logger");
const TeamRepository_1 = require("../repositories/implementations/TeamRepository");
dotenv_1.default.config();
async function testTeams() {
    const client = await connection_1.pool.connect();
    const repository = new TeamRepository_1.TeamRepository();
    try {
        logger_1.logger.info('Testing ts_teams table and repository...');
        // Test 1: Check table exists
        const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ts_teams'
      )
    `);
        logger_1.logger.info(`✅ Table exists: ${tableCheck.rows[0].exists}`);
        // Test 2: Test createOrUpdate (idempotent)
        const testTeam = {
            external_id: 'test_team_123',
            name: 'Test Team',
            short_name: 'TT',
            logo_url: 'https://example.com/logo.png',
        };
        logger_1.logger.info('Testing createOrUpdate...');
        const created = await repository.createOrUpdate(testTeam);
        logger_1.logger.info(`✅ Team created: ${created.id}`);
        // Test 3: Test idempotency (update same team)
        const updated = await repository.createOrUpdate({
            ...testTeam,
            name: 'Updated Test Team',
        });
        logger_1.logger.info(`✅ Team updated (idempotent): ${updated.name}`);
        // Test 4: Test findByExternalId
        const found = await repository.findByExternalId('test_team_123');
        logger_1.logger.info(`✅ Team found: ${found?.name}`);
        // Test 5: Test findByExternalIds (batch)
        const batchFound = await repository.findByExternalIds(['test_team_123']);
        logger_1.logger.info(`✅ Batch found: ${batchFound.length} teams`);
        // Test 6: Test findIncomplete
        const incomplete = await repository.findIncomplete(10);
        logger_1.logger.info(`✅ Incomplete teams: ${incomplete.length}`);
        // Cleanup
        await repository.delete(created.id);
        logger_1.logger.info('✅ Test team deleted');
        logger_1.logger.info('✅ All tests passed!');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ Test failed:', error);
        process.exit(1);
    }
    finally {
        client.release();
    }
}
testTeams();
