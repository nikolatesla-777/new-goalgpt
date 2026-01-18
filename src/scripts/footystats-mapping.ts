#!/usr/bin/env npx tsx
/**
 * FootyStats Mapping Script
 *
 * Maps TheSports leagues and teams to FootyStats IDs
 *
 * Usage:
 *   npx tsx src/scripts/footystats-mapping.ts --leagues     # Map leagues only
 *   npx tsx src/scripts/footystats-mapping.ts --teams       # Map teams only
 *   npx tsx src/scripts/footystats-mapping.ts --all         # Map both
 *   npx tsx src/scripts/footystats-mapping.ts --stats       # Show mapping stats
 *   npx tsx src/scripts/footystats-mapping.ts --unverified  # List unverified
 *
 * @author GoalGPT Team
 */

import dotenv from 'dotenv';
dotenv.config();

import { mappingService } from '../services/footystats/mapping.service';
import { footyStatsAPI } from '../services/footystats/footystats.client';
import { createFootyStatsTables } from '../database/migrations/create-footystats-tables';
import { logger } from '../utils/logger';

// ============================================================================
// CLI COMMANDS
// ============================================================================

async function runLeagueMapping(): Promise<void> {
  console.log('\n🏆 Starting League Mapping...\n');

  // Check API key
  if (!footyStatsAPI.isConfigured()) {
    console.log('❌ FootyStats API key not configured!');
    console.log('   Set FOOTYSTATS_API_KEY in your .env file');
    return;
  }

  const stats = await mappingService.mapLeagues();

  console.log('\n📊 League Mapping Results:');
  console.log('─'.repeat(40));
  console.log(`   Total Leagues:     ${stats.total}`);
  console.log(`   ✓ Auto-Verified:   ${stats.auto_verified}`);
  console.log(`   ? Needs Review:    ${stats.pending_review}`);
  console.log(`   ✗ No Match:        ${stats.no_match}`);
  console.log('─'.repeat(40));
}

async function runTeamMapping(): Promise<void> {
  console.log('\n⚽ Starting Team Mapping...\n');

  if (!footyStatsAPI.isConfigured()) {
    console.log('❌ FootyStats API key not configured!');
    return;
  }

  const stats = await mappingService.mapAllTeams();

  console.log('\n📊 Team Mapping Results:');
  console.log('─'.repeat(40));
  console.log(`   Total Teams:       ${stats.total}`);
  console.log(`   ✓ Auto-Verified:   ${stats.auto_verified}`);
  console.log(`   ? Needs Review:    ${stats.pending_review}`);
  console.log(`   ✗ No Match:        ${stats.no_match}`);
  console.log('─'.repeat(40));
}

async function showStats(): Promise<void> {
  console.log('\n📈 Mapping Statistics\n');

  const stats = await mappingService.getStats();

  console.log('🏆 Leagues:');
  console.log(`   Total:      ${stats.leagues.total}`);
  console.log(`   Verified:   ${stats.leagues.auto_verified}`);
  console.log(`   Pending:    ${stats.leagues.pending_review}`);

  console.log('\n⚽ Teams:');
  console.log(`   Total:      ${stats.teams.total}`);
  console.log(`   Verified:   ${stats.teams.auto_verified}`);
  console.log(`   Pending:    ${stats.teams.pending_review}`);
}

async function showUnverified(): Promise<void> {
  console.log('\n🔍 Unverified Mappings\n');

  const unverified = await mappingService.getUnverifiedMappings();

  if (unverified.length === 0) {
    console.log('   ✓ All mappings are verified!');
    return;
  }

  console.log('─'.repeat(80));
  console.log(
    'TheSports Name'.padEnd(30) +
    'FootyStats Name'.padEnd(30) +
    'Confidence'.padEnd(12) +
    'TS_ID'
  );
  console.log('─'.repeat(80));

  for (const mapping of unverified) {
    console.log(
      mapping.ts_name.substring(0, 28).padEnd(30) +
      mapping.fs_name.substring(0, 28).padEnd(30) +
      `${mapping.confidence_score.toFixed(1)}%`.padEnd(12) +
      mapping.ts_id
    );
  }

  console.log('─'.repeat(80));
  console.log(`\nTotal unverified: ${unverified.length}`);
}

async function runMigration(): Promise<void> {
  console.log('\n🔧 Running FootyStats tables migration...\n');

  await createFootyStatsTables();

  console.log('✓ Migration complete!');
}

async function testApi(): Promise<void> {
  console.log('\n🧪 Testing FootyStats API...\n');

  if (!footyStatsAPI.isConfigured()) {
    console.log('❌ API key not configured!');
    console.log('   Set FOOTYSTATS_API_KEY in your .env file');

    // Try with example key for testing
    console.log('\n   Trying with example key (limited data)...\n');
    footyStatsAPI.setApiKey('example');
  }

  try {
    const response = await footyStatsAPI.getLeagueList();
    console.log(`✓ API connection successful!`);
    console.log(`   Leagues available: ${response.data?.length || 0}`);

    if (response.data && response.data.length > 0) {
      console.log('\n   Sample leagues:');
      response.data.slice(0, 5).forEach((league) => {
        console.log(`   - ${league.name} (${league.country}) [ID: ${league.id}]`);
      });
    }
  } catch (error: any) {
    console.log(`❌ API test failed: ${error.message}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || '--help';

  console.log('═'.repeat(50));
  console.log('  FootyStats Integration Tool');
  console.log('═'.repeat(50));

  try {
    switch (command) {
      case '--migrate':
        await runMigration();
        break;

      case '--leagues':
        await runLeagueMapping();
        break;

      case '--teams':
        await runTeamMapping();
        break;

      case '--all':
        await runMigration();
        await runLeagueMapping();
        await runTeamMapping();
        break;

      case '--stats':
        await showStats();
        break;

      case '--unverified':
        await showUnverified();
        break;

      case '--test':
        await testApi();
        break;

      case '--help':
      default:
        console.log('\nUsage:');
        console.log('  npx tsx src/scripts/footystats-mapping.ts <command>\n');
        console.log('Commands:');
        console.log('  --migrate     Create FootyStats tables');
        console.log('  --leagues     Map TheSports leagues to FootyStats');
        console.log('  --teams       Map TheSports teams to FootyStats');
        console.log('  --all         Run migration + league + team mapping');
        console.log('  --stats       Show mapping statistics');
        console.log('  --unverified  List unverified mappings');
        console.log('  --test        Test FootyStats API connection');
        console.log('  --help        Show this help');
        break;
    }
  } catch (error) {
    logger.error('Script error:', error);
    console.error('\n❌ Error:', error);
    process.exit(1);
  }

  console.log('\n');
  process.exit(0);
}

main();
