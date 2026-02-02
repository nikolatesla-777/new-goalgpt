#!/usr/bin/env tsx
/**
 * Migration Safety Validator
 *
 * CI script that ensures all CREATE INDEX statements use CONCURRENTLY
 * to prevent production table locks during deployments.
 *
 * Usage:
 *   npm run validate:migrations
 *   or
 *   tsx scripts/validate-migrations.ts
 *
 * Exit codes:
 *   0 = All migrations are safe
 *   1 = Found unsafe CREATE INDEX statements
 */

import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';

interface ValidationError {
  file: string;
  line: number;
  content: string;
  reason: string;
}

const MIGRATIONS_DIR = path.resolve(__dirname, '../src/database/migrations');
const ERRORS: ValidationError[] = [];

// Patterns to check
const UNSAFE_INDEX_PATTERN = /CREATE\s+INDEX(?!\s+CONCURRENTLY)/gi;
const SAFE_INDEX_PATTERN = /CREATE\s+INDEX\s+CONCURRENTLY/gi;

// Files to exclude (legacy migrations before this rule was enforced)
const LEGACY_FILES = [
  '001-mobile-app-schema.ts', // Uses Kysely API, can't add CONCURRENTLY easily
  'phase8-performance-indexes.ts', // Already uses CONCURRENTLY
];

function validateMigrationFile(filePath: string): void {
  const fileName = path.basename(filePath);

  // Skip legacy files
  if (LEGACY_FILES.includes(fileName)) {
    console.log(`⏭️  Skipping legacy file: ${fileName}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check for unsafe CREATE INDEX
    if (UNSAFE_INDEX_PATTERN.test(line)) {
      // Double-check it's not a false positive (e.g., comment or string)
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return;
      }

      // Skip if it's inside a string literal (checking for quotes)
      const beforeIndex = line.substring(0, line.toLowerCase().indexOf('create index'));
      const quoteCount = (beforeIndex.match(/['"]/g) || []).length;
      if (quoteCount % 2 !== 0) {
        return; // Inside a string
      }

      ERRORS.push({
        file: fileName,
        line: lineNumber,
        content: trimmed,
        reason: 'CREATE INDEX without CONCURRENTLY - will lock table in production',
      });
    }
  });

  // Reset regex state
  UNSAFE_INDEX_PATTERN.lastIndex = 0;
  SAFE_INDEX_PATTERN.lastIndex = 0;
}

function main(): void {
  console.log('🔍 Validating migration files for production safety...\n');

  // Find all migration files
  const migrationFiles = globSync(`${MIGRATIONS_DIR}/**/*.ts`);

  if (migrationFiles.length === 0) {
    console.error('❌ No migration files found!');
    process.exit(1);
  }

  console.log(`Found ${migrationFiles.length} migration files to validate\n`);

  // Validate each file
  migrationFiles.forEach(validateMigrationFile);

  // Report results
  if (ERRORS.length === 0) {
    console.log('\n✅ All migration files are production-safe!');
    console.log('All CREATE INDEX statements use CONCURRENTLY.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Found unsafe migration patterns:\n');

    ERRORS.forEach((error) => {
      console.log(`File: ${error.file}:${error.line}`);
      console.log(`Code: ${error.content}`);
      console.log(`Issue: ${error.reason}\n`);
    });

    console.log('─'.repeat(60));
    console.log(`Total errors: ${ERRORS.length}`);
    console.log('\n💡 Fix: Add CONCURRENTLY keyword to all CREATE INDEX statements');
    console.log('Example:');
    console.log('  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON table(column);\n');

    process.exit(1);
  }
}

// Run validator
if (require.main === module) {
  try {
    main();
  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}
