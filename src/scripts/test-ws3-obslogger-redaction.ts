/**
 * Phase 4-5 WS3: Test obsLogger secret redaction
 */

import { logEvent } from '../utils/obsLogger';

console.log('Testing obsLogger secret redaction...\n');

// Test with secret field
logEvent('info', 'test.secret', {
  api_key: 'secret123',
  password: 'mypassword',
  normal_field: 'should_not_be_redacted',
  token: 'bearer_token_xyz',
  api_secret: 'very_secret',
  apiKey: 'another_secret',
  auth_token: 'auth123',
});

console.log('\n✅ Check logs above - secret fields should show [REDACTED], normal_field should show original value');





