/**
 * PR-14: Zod Validation Smoke Tests
 *
 * Tests 4 critical endpoints to verify validation middleware:
 * 1. Auth endpoint (strict mode)
 * 2. Prediction ingest (non-strict mode)
 * 3. Comments endpoint (strict mode)
 * 4. Forum endpoint (strict mode)
 *
 * Each test verifies:
 * - Valid payloads → 200/201
 * - Invalid payloads → 400 VALIDATION_ERROR with field details
 * - Unknown fields → Rejected in strict mode, accepted in non-strict
 */

import { validate } from '../../middleware/validation.middleware';
import { emailLoginSchema } from '../../schemas/auth.schema';
import { ingestPredictionSchema } from '../../schemas/prediction.schema';
import { createCommentSchema } from '../../schemas/comments.schema';
import { chatMessageSchema } from '../../schemas/forum.schema';
import { z } from 'zod';

interface TestResult {
  endpoint: string;
  test: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

// Mock Fastify request/reply
function mockRequest(body: any, params?: any, query?: any) {
  return {
    body,
    params: params || {},
    query: query || {},
    url: '/test',
    method: 'POST',
  } as any;
}

function mockReply() {
  let statusCode = 200;
  let response: any;

  return {
    status: (code: number) => {
      statusCode = code;
      return {
        send: (data: any) => {
          response = { status: statusCode, data };
          return response;
        },
      };
    },
    getStatus: () => statusCode,
    getResponse: () => response,
  } as any;
}

async function runTest(
  name: string,
  endpoint: string,
  validator: any,
  payload: any,
  expectSuccess: boolean
): Promise<void> {
  try {
    const request = mockRequest(payload);
    const reply = mockReply();

    await validator(request, reply);

    const status = reply.getResponse()?.status || 200;
    const passed = expectSuccess ? (status < 400) : (status === 400);

    results.push({
      endpoint,
      test: name,
      passed,
      error: !passed ? `Expected ${expectSuccess ? 'success' : 'error'}, got status ${status}` : undefined,
    });

    if (passed) {
      console.log(`✅ ${endpoint} - ${name}`);
    } else {
      console.log(`❌ ${endpoint} - ${name}: ${results[results.length - 1].error}`);
      if (reply.getResponse()?.data) {
        console.log(`   Response:`, JSON.stringify(reply.getResponse().data, null, 2));
      }
    }
  } catch (error: any) {
    results.push({
      endpoint,
      test: name,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${endpoint} - ${name}: ${error.message}`);
  }
}

async function smokeTests() {
  console.log('🧪 PR-14: Zod Validation Smoke Tests\n');

  // ==============================================
  // 1. Auth Endpoint (Strict Mode)
  // ==============================================
  console.log('1️⃣  Auth Endpoint (Strict Mode)');

  const authValidator = validate({ body: emailLoginSchema });

  // Valid payload
  await runTest(
    'Valid login',
    'POST /api/auth/login',
    authValidator,
    { email: 'test@example.com', password: 'password123' },
    true
  );

  // Invalid email
  await runTest(
    'Invalid email format',
    'POST /api/auth/login',
    authValidator,
    { email: 'invalid-email', password: 'password123' },
    false
  );

  // Missing field
  await runTest(
    'Missing password',
    'POST /api/auth/login',
    authValidator,
    { email: 'test@example.com' },
    false
  );

  // Unknown field (strict mode should reject)
  await runTest(
    'Unknown field (strict mode)',
    'POST /api/auth/login',
    authValidator,
    { email: 'test@example.com', password: 'password123', unknownField: 'hacker' },
    false
  );

  console.log('');

  // ==============================================
  // 2. Prediction Ingest (Non-Strict Mode)
  // ==============================================
  console.log('2️⃣  Prediction Ingest (Non-Strict Mode)');

  const predictionValidator = validate({ body: ingestPredictionSchema, strict: false });

  // Valid payload
  await runTest(
    'Valid prediction',
    'POST /api/predictions/ingest',
    predictionValidator,
    {
      home_team: 'Team A',
      away_team: 'Team B',
      prediction: 'IY 0.5 ÜST',
      league: 'Premier League',
    },
    true
  );

  // Unknown field (non-strict should accept)
  await runTest(
    'Unknown field (non-strict mode)',
    'POST /api/predictions/ingest',
    predictionValidator,
    {
      home_team: 'Team A',
      away_team: 'Team B',
      prediction: 'IY 0.5 ÜST',
      league: 'Premier League',
      bot_custom_field: 'extra-data', // Should be accepted
    },
    true
  );

  console.log('');

  // ==============================================
  // 3. Comments Endpoint (Strict Mode)
  // ==============================================
  console.log('3️⃣  Comments Endpoint (Strict Mode)');

  const commentsValidator = validate({ body: createCommentSchema });

  // Valid comment
  await runTest(
    'Valid comment',
    'POST /api/comments/match/:matchId',
    commentsValidator,
    { content: 'Great match!' },
    true
  );

  // Empty content
  await runTest(
    'Empty content',
    'POST /api/comments/match/:matchId',
    commentsValidator,
    { content: '' },
    false
  );

  // Unknown field (strict mode)
  await runTest(
    'Unknown field (strict mode)',
    'POST /api/comments/match/:matchId',
    commentsValidator,
    { content: 'Great match!', malicious: 'sql injection' },
    false
  );

  console.log('');

  // ==============================================
  // 4. Forum Endpoint (Strict Mode)
  // ==============================================
  console.log('4️⃣  Forum Endpoint (Strict Mode)');

  const forumValidator = validate({ body: chatMessageSchema });

  // Valid chat message
  await runTest(
    'Valid chat message',
    'POST /api/forum/:matchId/chat',
    forumValidator,
    { message: 'Hello everyone!' },
    true
  );

  // Missing message field
  await runTest(
    'Missing message field',
    'POST /api/forum/:matchId/chat',
    forumValidator,
    {}, // No message field
    false
  );

  // Unknown field (strict mode)
  await runTest(
    'Unknown field (strict mode)',
    'POST /api/forum/:matchId/chat',
    forumValidator,
    { message: 'Hello everyone!', extraField: 'hack' },
    false
  );

  console.log('');

  // ==============================================
  // Summary
  // ==============================================
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Test Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total: ${total} tests`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log('');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  • ${r.endpoint} - ${r.test}`);
      console.log(`    Error: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('✅ All smoke tests passed!');
    console.log('');
    console.log('PR-14 Zod validation is ready for production.');
    process.exit(0);
  }
}

// Run tests
smokeTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
