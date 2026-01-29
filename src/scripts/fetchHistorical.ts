#!/usr/bin/env tsx

/**
 * Historical Data Fetch CLI - Week-2C
 *
 * Fetches FootyStats historical match data for backtest + calibration
 *
 * Usage:
 *   npm run fetch:historical -- --from 2024-06-01 --to 2024-12-31 --limit 2000
 *   npm run fetch:historical -- --from 2024-01-01 --to 2024-12-31 --competitions 1,2,3,4,5
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { program } from 'commander';
import { fetchHistoricalData, FetchProgress } from '../services/footystats/historicalFetcher.service';
import { logger } from '../utils/logger';

// ============================================================================
// CLI PROGRAM
// ============================================================================

program
  .name('fetch-historical')
  .description('Fetch historical FootyStats data for backtest + calibration')
  .requiredOption('--from <date>', 'Start date (YYYY-MM-DD)', validateDate)
  .requiredOption('--to <date>', 'End date (YYYY-MM-DD)', validateDate)
  .option('--competitions <ids>', 'Comma-separated competition IDs (e.g., 1,2,3 for top leagues)')
  .option('--limit <number>', 'Max matches to fetch', '2000')
  .option('--skip-existing', 'Skip already fetched matches', true)
  .parse();

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = program.opts();

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   📊 Historical Data Fetch - Week-2C                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Parse options
  const config = {
    startDate: options.from,
    endDate: options.to,
    competitions: options.competitions?.split(',').map((id: string) => parseInt(id.trim())),
    limit: parseInt(options.limit),
    skipExisting: options.skipExisting,
  };

  // Display configuration
  console.log('Configuration:');
  console.log(`  Start Date: ${config.startDate}`);
  console.log(`  End Date: ${config.endDate}`);
  console.log(`  Competitions: ${config.competitions ? config.competitions.join(', ') : 'All'}`);
  console.log(`  Limit: ${config.limit}`);
  console.log(`  Skip Existing: ${config.skipExisting}\n`);

  // Confirm before proceeding
  console.log('⏳ Starting fetch... (this may take 1-3 hours depending on match count)\n');

  // Execute fetch
  const startTime = Date.now();

  try {
    const progress: FetchProgress = await fetchHistoricalData(config);

    const elapsedMs = Date.now() - startTime;
    const elapsedMin = Math.round(elapsedMs / 60000);

    // Display results
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   ✅ Fetch Complete                                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('Results:');
    console.log(`  Total Matches: ${progress.total}`);
    console.log(`  ✅ Success: ${progress.success}`);
    console.log(`  ❌ Errors: ${progress.errors}`);
    console.log(`  ⏭️  Skipped: ${progress.skipped}`);
    console.log(`  📊 Avg Quality Score: ${progress.avgQualityScore}/100`);
    console.log(`  ⏱️  Elapsed Time: ${elapsedMin} minutes\n`);

    if (progress.success > 0) {
      const successRate = ((progress.success / progress.total) * 100).toFixed(1);
      console.log(`Success Rate: ${successRate}%\n`);
    }

    // Warnings
    if (progress.avgQualityScore < 70) {
      console.warn('⚠️  WARNING: Low average quality score (<70)');
      console.warn('   Some matches may have missing xG, potentials, or odds data.\n');
    }

    if (progress.errors / progress.total > 0.2) {
      console.warn('⚠️  WARNING: High error rate (>20%)');
      console.warn('   Check logs for FootyStats API issues or rate limit errors.\n');
    }

    console.log('Next Steps:');
    console.log('  1. Run backtest: npm run backtest -- --market O25 --from 2024-06-01 --to 2024-12-31');
    console.log('  2. View data quality: npm run backtest:data-quality\n');

    process.exit(0);
  } catch (error) {
    logger.error('[fetchHistorical] Fatal error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.error('\n❌ Fatal Error:', error instanceof Error ? error.message : String(error));
    console.error('Check logs for details.\n');

    process.exit(1);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function validateDate(value: string): string {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    throw new Error(`Invalid date format: ${value} (expected YYYY-MM-DD)`);
  }
  return value;
}

// ============================================================================
// RUN
// ============================================================================

main();
