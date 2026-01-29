#!/usr/bin/env tsx

/**
 * Backtest CLI - Week-2C
 *
 * Validates scoring system performance on historical data
 *
 * Usage:
 *   npm run backtest -- --market O25 --from 2024-06-01 --to 2024-12-31
 *   npm run backtest -- --market all --from 2024-01-01 --to 2024-12-31 --save
 *   npm run backtest -- --market BTTS --min-confidence 70
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { program } from 'commander';
import { backtestService, type BacktestConfig, type BacktestResult } from '../services/scoring/backtest.service';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

// ============================================================================
// CLI PROGRAM
// ============================================================================

program
  .name('backtest')
  .description('Run backtest validation for scoring system')
  .requiredOption('--market <id>', 'Market ID (O25, BTTS, HT_O05, O35, HOME_O15, CORNERS_O85, CARDS_O25, all)')
  .requiredOption('--from <date>', 'Start date (YYYY-MM-DD)', validateDate)
  .requiredOption('--to <date>', 'End date (YYYY-MM-DD)', validateDate)
  .option('--min-confidence <number>', 'Minimum confidence threshold', '55')
  .option('--min-quality <number>', 'Minimum data quality score', '60')
  .option('--save', 'Save results to docs/', false)
  .option('--verbose', 'Show detailed per-match results', false)
  .parse();

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = program.opts();

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   📊 Backtest - Week-2C Scoring Validation              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Parse options
  const markets = options.market === 'all'
    ? ['O25', 'BTTS', 'HT_O05', 'O35', 'HOME_O15', 'CORNERS_O85', 'CARDS_O25']
    : [options.market.toUpperCase()];

  // Display configuration
  console.log('Configuration:');
  console.log(`  Markets: ${markets.join(', ')}`);
  console.log(`  Period: ${options.from} to ${options.to}`);
  console.log(`  Min Matches: 100 (default)`);
  console.log(`  Save Results: ${options.save ? 'Yes' : 'No'}\n`);

  // Run backtests
  const allResults: BacktestResult[] = [];
  const startTime = Date.now();

  for (const marketId of markets) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Running backtest for ${marketId}...`);
    console.log('='.repeat(60) + '\n');

    try {
      const config: BacktestConfig = {
        marketId: marketId as any,
        startDate: options.from,
        endDate: options.to,
        minMatches: 100,
      };

      const result = await backtestService.runBacktest(config);
      allResults.push(result);

      // Display results
      displayResults(result);

      // Save to database if requested
      if (options.save) {
        await backtestService.saveBacktestResult(result);
        console.log(`✅ Result saved to database\n`);
      }
    } catch (error) {
      logger.error(`[Backtest] Error running backtest for ${marketId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  const elapsedMs = Date.now() - startTime;
  const elapsedMin = Math.round(elapsedMs / 60000);

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ Backtest Complete                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`Total Markets Tested: ${allResults.length}`);
  console.log(`Total Time: ${elapsedMin} minutes\n`);

  // Pass/Fail Summary
  console.log('Pass/Fail Summary:');
  for (const result of allResults) {
    const passed = result.validation_passed;
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${result.market_id}: ${passed ? 'PASSED' : 'FAILED'}`);
  }
  console.log();

  // Save markdown report if requested
  if (options.save) {
    const reportPath = saveMarkdownReport(allResults, options.from, options.to);
    console.log(`📄 Markdown report saved to: ${reportPath}\n`);
  }

  // Exit with appropriate code
  const allPassed = allResults.every(r => r.validation_passed);
  process.exit(allPassed ? 0 : 1);
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

function displayResults(result: BacktestResult) {
  console.log('📊 PERFORMANCE METRICS:');
  console.log(`  Total Predictions: ${result.total_predictions}`);
  console.log(`  Settled: ${result.total_settled} | Won: ${result.won} | Lost: ${result.lost} | Void: ${result.void}`);
  console.log(`  Hit Rate: ${(result.hit_rate * 100).toFixed(2)}%`);
  console.log(`  ROI: ${(result.roi * 100).toFixed(2)}%`);
  console.log(`  Avg Confidence: ${result.avg_confidence.toFixed(1)}`);
  console.log(`  Avg Probability: ${(result.avg_probability * 100).toFixed(1)}%\n`);

  console.log('📈 CALIBRATION:');
  console.log(`  Calibration Error: ${(result.calibration_error * 100).toFixed(2)}%`);
  console.log('  Bucket Analysis:');

  for (const bucket of result.calibration_curve) {
    const predicted = (bucket.avg_predicted * 100).toFixed(1);
    const actual = (bucket.actual_rate * 100).toFixed(1);
    const errorVal = (bucket.error * 100).toFixed(1);
    const sign = bucket.avg_predicted <= bucket.actual_rate ? '+' : '-';

    console.log(`    ${bucket.bucket}: Predicted ${predicted}% | Actual ${actual}% | Error: ${sign}${errorVal}% (n=${bucket.count})`);
  }
  console.log();

  // Validation result
  console.log('✅ VALIDATION:');
  if (result.validation_passed) {
    console.log('  ✅ ALL CHECKS PASSED');
    console.log(`  ${result.validation_notes}`);
  } else {
    console.log('  ❌ VALIDATION FAILED');
    console.log(`  ${result.validation_notes}`);
  }
  console.log();
}

function saveMarkdownReport(
  allResults: BacktestResult[],
  startDate: string,
  endDate: string
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `BACKTEST_RESULTS_${startDate}_${endDate}_${timestamp}.md`;
  const reportPath = path.join(process.cwd(), 'docs', filename);

  let markdown = `# Backtest Results - Week-2C\n\n`;
  markdown += `**Date**: ${new Date().toISOString()}\n`;
  markdown += `**Period**: ${startDate} to ${endDate}\n\n`;
  markdown += `---\n\n`;

  // Summary table
  markdown += `## Summary\n\n`;
  markdown += `| Market | Predictions | Hit Rate | ROI | Calibration Error | Validation |\n`;
  markdown += `|--------|-------------|----------|-----|-------------------|------------|\n`;

  for (const result of allResults) {
    const hitRate = (result.hit_rate * 100).toFixed(2);
    const roi = (result.roi * 100).toFixed(2);
    const calError = (result.calibration_error * 100).toFixed(2);
    const status = result.validation_passed ? '✅ PASS' : '❌ FAIL';

    markdown += `| **${result.market_id}** | ${result.total_predictions} | ${hitRate}% | ${roi}% | ${calError}% | ${status} |\n`;
  }

  markdown += `\n---\n\n`;

  // Detailed results per market
  for (const result of allResults) {
    markdown += `## ${result.market_id} - Detailed Results\n\n`;

    markdown += `### Performance Metrics\n\n`;
    markdown += `- **Total Predictions**: ${result.total_predictions}\n`;
    markdown += `- **Settled**: ${result.total_settled} (Won: ${result.won}, Lost: ${result.lost}, Void: ${result.void})\n`;
    markdown += `- **Hit Rate**: ${(result.hit_rate * 100).toFixed(2)}%\n`;
    markdown += `- **ROI**: ${(result.roi * 100).toFixed(2)}%\n`;
    markdown += `- **Avg Confidence**: ${result.avg_confidence.toFixed(1)}\n`;
    markdown += `- **Avg Probability**: ${(result.avg_probability * 100).toFixed(1)}%\n\n`;

    markdown += `### Calibration Analysis\n\n`;
    markdown += `- **Overall Calibration Error**: ${(result.calibration_error * 100).toFixed(2)}%\n\n`;
    markdown += `| Bucket | Predicted | Actual | Error | Count |\n`;
    markdown += `|--------|-----------|--------|-------|-------|\n`;

    for (const bucket of result.calibration_curve) {
      const predicted = (bucket.avg_predicted * 100).toFixed(1);
      const actual = (bucket.actual_rate * 100).toFixed(1);
      const errorVal = (bucket.error * 100).toFixed(1);
      markdown += `| ${bucket.bucket} | ${predicted}% | ${actual}% | ${errorVal}% | ${bucket.count} |\n`;
    }

    markdown += `\n### Validation\n\n`;
    if (result.validation_passed) {
      markdown += `✅ **PASSED**\n\n`;
      markdown += `${result.validation_notes}\n`;
    } else {
      markdown += `❌ **FAILED**\n\n`;
      markdown += `${result.validation_notes}\n`;
    }

    markdown += `\n---\n\n`;
  }

  // Next steps
  markdown += `## Next Steps\n\n`;
  markdown += `1. Review failed markets and analyze root causes\n`;
  markdown += `2. Adjust threshold values in market_registry.json if needed\n`;
  markdown += `3. Investigate calibration errors > 10%\n`;
  markdown += `4. Run data quality report: \`npm run backtest:data-quality\`\n`;
  markdown += `5. Consider expanding historical data if sample size < 300\n\n`;

  markdown += `---\n\n`;
  markdown += `**Generated**: ${new Date().toISOString()}\n`;
  markdown += `**Tool**: npm run backtest (Week-2C)\n`;

  fs.writeFileSync(reportPath, markdown, 'utf-8');

  return reportPath;
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
