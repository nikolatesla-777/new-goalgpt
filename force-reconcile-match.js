/**
 * Force reconcile a match via detail_live
 */
const { MatchDetailLiveService } = require('./dist/services/thesports/match/matchDetailLive.service');
const { TheSportsClient } = require('./dist/services/thesports/client/thesports-client');
require('dotenv').config();

async function forceReconcile() {
  const matchId = 'k82rekhgxp2grep';
  console.log(`\n🔄 Force reconciling match ${matchId}...\n`);
  
  try {
    const client = new TheSportsClient();
    const service = new MatchDetailLiveService(client);
    
    const result = await service.reconcileMatchToDatabase(matchId, null);
    
    console.log('Reconcile Result:');
    console.log('  Updated:', result.updated);
    console.log('  RowCount:', result.rowCount);
    console.log('  StatusId:', result.statusId);
    console.log('  Score:', result.score);
    console.log('  ProviderUpdateTime:', result.providerUpdateTime);
    
    if (result.updated) {
      console.log('\n✅ Match reconciled successfully!');
    } else {
      console.log('\n⚠️ Match was not updated (might be already up to date or no changes)');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

forceReconcile();
