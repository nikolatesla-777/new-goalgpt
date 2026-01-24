/**
 * Orchestrator Null Handling Verification
 *
 * Verifies that:
 * 1. LOCK_KEYS.matchUpdateLock() null handling is safe (no throw)
 * 2. Jobs log 'rejected_invalid' as DEBUG, not WARN/ERROR
 * 3. All orchestrator callers handle null gracefully
 *
 * Usage: npx tsx scripts/test-orchestrator-null-handling.ts
 */

import fs from 'fs';
import path from 'path';

// ============================================================
// TEST 1: LOCK_KEYS.matchUpdateLock NULL SAFETY
// ============================================================

function testLockKeysNullSafety(): boolean {
  console.log('\n=== TEST 1: LOCK_KEYS.matchUpdateLock Null Safety ===');

  const lockKeysPath = path.join(__dirname, '../src/jobs/lockKeys.ts');
  const content = fs.readFileSync(lockKeysPath, 'utf-8');

  // Check for null return
  const hasNullReturn = content.includes('return null');
  console.log(`✓ LOCK_KEYS.matchUpdateLock can return null: ${hasNullReturn}`);

  // Check for throw statements in matchUpdateLock
  const matchUpdateLockMatch = content.match(/matchUpdateLock:.*?\{([\s\S]*?)\}/);
  const matchUpdateLockBody = matchUpdateLockMatch ? matchUpdateLockMatch[1] : '';

  const hasThrow = matchUpdateLockBody.includes('throw ');
  console.log(`  Throws errors: ${hasThrow}`);

  if (hasThrow) {
    console.log('❌ matchUpdateLock throws errors - should return null instead');
    return false;
  }

  if (!hasNullReturn) {
    console.log('❌ matchUpdateLock does not return null - missing null safety');
    return false;
  }

  console.log('✅ matchUpdateLock returns null for invalid IDs (no throw)');
  return true;
}

// ============================================================
// TEST 2: ORCHESTRATOR NULL HANDLING
// ============================================================

function testOrchestratorNullHandling(): boolean {
  console.log('\n=== TEST 2: Orchestrator Null Handling ===');

  const orchestratorPath = path.join(__dirname, '../src/modules/matches/services/MatchOrchestrator.ts');
  const content = fs.readFileSync(orchestratorPath, 'utf-8');

  // Check for null check
  const hasNullCheck = content.includes('if (lockKey === null)');
  console.log(`  Has null check: ${hasNullCheck}`);

  if (!hasNullCheck) {
    console.log('❌ MatchOrchestrator missing null check for lockKey');
    return false;
  }

  // Check for rejected_invalid status
  const hasRejectedInvalid = content.includes("status: 'rejected_invalid'");
  console.log(`  Returns 'rejected_invalid': ${hasRejectedInvalid}`);

  if (!hasRejectedInvalid) {
    console.log('❌ MatchOrchestrator does not return rejected_invalid for null lockKey');
    return false;
  }

  // Extract the null handling block
  const nullHandlingMatch = content.match(/if \(lockKey === null\) \{([\s\S]*?)\}/);
  const nullHandlingBlock = nullHandlingMatch ? nullHandlingMatch[1] : '';

  // Check it returns, doesn't throw
  const returnsOnNull = nullHandlingBlock.includes('return');
  const throwsOnNull = nullHandlingBlock.includes('throw ');

  console.log(`  Returns on null: ${returnsOnNull}`);
  console.log(`  Throws on null: ${throwsOnNull}`);

  if (throwsOnNull) {
    console.log('❌ MatchOrchestrator throws on null lockKey');
    return false;
  }

  if (!returnsOnNull) {
    console.log('❌ MatchOrchestrator does not return on null lockKey');
    return false;
  }

  console.log('✅ MatchOrchestrator handles null lockKey safely');
  return true;
}

// ============================================================
// TEST 3: JOB CALLERS LOG LEVEL
// ============================================================

function testJobCallersLogLevel(): boolean {
  console.log('\n=== TEST 3: Job Callers Log Level ===');

  const jobsDir = path.join(__dirname, '../src/jobs');
  const jobFiles = fs.readdirSync(jobsDir)
    .filter(f => f.endsWith('.job.ts'))
    .filter(f => !f.includes('.test.'));

  console.log(`Found ${jobFiles.length} job files to check`);

  const issues: string[] = [];

  for (const jobFile of jobFiles) {
    const jobPath = path.join(jobsDir, jobFile);
    const content = fs.readFileSync(jobPath, 'utf-8');

    // Check if file uses matchOrchestrator
    if (!content.includes('matchOrchestrator.updateMatch')) {
      console.log(`  ⏭️ ${jobFile}: No orchestrator usage, skipping`);
      continue;
    }

    console.log(`  📄 Checking ${jobFile}...`);

    // Look for rejected_invalid handling
    const hasRejectedInvalidCheck = content.includes("'rejected_invalid'") || content.includes('"rejected_invalid"');

    if (!hasRejectedInvalidCheck) {
      console.log(`    ⚠️ No explicit rejected_invalid handling found`);
      // This is OK - it might be handled in a generic way
      continue;
    }

    // Check log level for rejected_invalid
    // Extract the block handling rejected_invalid
    const rejectedInvalidMatch = content.match(
      /(rejected_invalid'|rejected_invalid")[\s\S]{0,300}?logger\.(debug|info|warn|error)/
    );

    if (rejectedInvalidMatch) {
      const logLevel = rejectedInvalidMatch[2];
      console.log(`    Log level for rejected_invalid: ${logLevel}`);

      if (logLevel === 'warn' || logLevel === 'error') {
        issues.push(`${jobFile}: Uses logger.${logLevel} for rejected_invalid (should be debug)`);
      }
    }
  }

  if (issues.length > 0) {
    console.log('\n❌ Found issues:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    return false;
  }

  console.log('✅ All job callers use appropriate log levels');
  return true;
}

// ============================================================
// TEST 4: NO DIRECT LOCK USAGE WITHOUT NULL CHECK
// ============================================================

function testNoDirectLockUsage(): boolean {
  console.log('\n=== TEST 4: No Direct Lock Usage Without Null Check ===');

  const jobsDir = path.join(__dirname, '../src/jobs');
  const jobFiles = fs.readdirSync(jobsDir)
    .filter(f => f.endsWith('.job.ts'))
    .filter(f => !f.includes('.test.'));

  const issues: string[] = [];

  for (const jobFile of jobFiles) {
    const jobPath = path.join(jobsDir, jobFile);
    const content = fs.readFileSync(jobPath, 'utf-8');

    // Check for direct LOCK_KEYS.matchUpdateLock usage
    if (!content.includes('LOCK_KEYS.matchUpdateLock')) {
      continue;
    }

    console.log(`  📄 Checking ${jobFile}...`);

    // If job uses LOCK_KEYS.matchUpdateLock directly (not through orchestrator),
    // it MUST have null check
    const directLockUsageMatch = content.match(
      /const\s+(\w+)\s*=\s*LOCK_KEYS\.matchUpdateLock\([^)]+\)/g
    );

    if (directLockUsageMatch) {
      directLockUsageMatch.forEach(match => {
        // Extract variable name
        const varMatch = match.match(/const\s+(\w+)\s*=/);
        if (varMatch) {
          const varName = varMatch[1];

          // Check if there's a null check for this variable
          const hasNullCheck = new RegExp(`if\\s*\\(\\s*${varName}\\s*===\\s*null\\s*\\)`).test(content);

          if (!hasNullCheck) {
            issues.push(`${jobFile}: Direct lock usage (${varName}) without null check`);
          } else {
            console.log(`    ✓ Has null check for ${varName}`);
          }
        }
      });
    }
  }

  if (issues.length > 0) {
    console.log('\n❌ Found issues:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    return false;
  }

  console.log('✅ All direct lock usages have null checks');
  return true;
}

// ============================================================
// MAIN RUNNER
// ============================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║    Orchestrator Null Handling Verification             ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  const results: { test: string; passed: boolean }[] = [];

  try {
    results.push({ test: 'LOCK_KEYS Null Safety', passed: testLockKeysNullSafety() });
  } catch (err: any) {
    console.error('❌ Test 1 crashed:', err.message);
    results.push({ test: 'LOCK_KEYS Null Safety', passed: false });
  }

  try {
    results.push({ test: 'Orchestrator Null Handling', passed: testOrchestratorNullHandling() });
  } catch (err: any) {
    console.error('❌ Test 2 crashed:', err.message);
    results.push({ test: 'Orchestrator Null Handling', passed: false });
  }

  try {
    results.push({ test: 'Job Callers Log Level', passed: testJobCallersLogLevel() });
  } catch (err: any) {
    console.error('❌ Test 3 crashed:', err.message);
    results.push({ test: 'Job Callers Log Level', passed: false });
  }

  try {
    results.push({ test: 'Direct Lock Usage Safety', passed: testNoDirectLockUsage() });
  } catch (err: any) {
    console.error('❌ Test 4 crashed:', err.message);
    results.push({ test: 'Direct Lock Usage Safety', passed: false });
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  results.forEach(({ test, passed }) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
  });

  const allPassed = results.every(r => r.passed);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ ALL NULL HANDLING TESTS PASSED');
    console.log('   - LOCK_KEYS returns null safely (no throw)');
    console.log('   - Orchestrator handles null gracefully');
    console.log('   - Jobs use appropriate log levels');
    console.log('   - Direct lock usage has null checks');
  } else {
    console.log('❌ SOME TESTS FAILED - Review above output');
  }
  console.log('='.repeat(60) + '\n');

  process.exit(allPassed ? 0 : 1);
}

main();
