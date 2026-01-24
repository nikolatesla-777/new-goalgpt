#!/usr/bin/env node

/**
 * Timeout Wrapper for VPS without GNU timeout command
 *
 * Usage:
 *   node scripts/timeout-wrapper.js 10 "npx tsx scripts/test.ts"
 *   # Runs command with 10 second timeout
 *
 * Exit codes:
 *   - Command's exit code if finishes in time
 *   - 124 if timeout (matches GNU timeout behavior)
 *   - 1 if error
 */

const { spawn } = require('child_process');

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: timeout-wrapper.js <seconds> <command>');
  console.error('Example: timeout-wrapper.js 10 "npm test"');
  process.exit(1);
}

const timeoutSeconds = parseInt(args[0], 10);
const command = args.slice(1).join(' ');

if (isNaN(timeoutSeconds) || timeoutSeconds <= 0) {
  console.error('Error: Timeout must be a positive number');
  process.exit(1);
}

// Spawn command
const child = spawn(command, {
  shell: true,
  stdio: 'inherit'
});

// Set timeout
const timer = setTimeout(() => {
  console.error(`\nTimeout: Command exceeded ${timeoutSeconds} seconds`);
  child.kill('SIGTERM');

  // Force kill after 5 more seconds
  setTimeout(() => {
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }, 5000);
}, timeoutSeconds * 1000);

// Handle child exit
child.on('exit', (code, signal) => {
  clearTimeout(timer);

  if (signal === 'SIGTERM') {
    // Timeout occurred (exit 124 like GNU timeout)
    process.exit(124);
  } else {
    // Normal exit
    process.exit(code || 0);
  }
});

// Handle errors
child.on('error', (err) => {
  clearTimeout(timer);
  console.error('Error spawning command:', err.message);
  process.exit(1);
});
