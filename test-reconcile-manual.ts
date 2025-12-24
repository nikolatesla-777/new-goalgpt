import { pool } from './src/database/connection';
import { TheSportsClient } from './src/services/thesports/client/thesports-client';
import { MatchDetailLiveService } from './src/services/thesports/match/matchDetailLive.service';
import { logger } from './src/utils/logger';

async function testManualReconcile() {
  const matchId = '8yomo4h14eo4q0j';
  const client = await pool.connect();
  
  try {
    console.log('📊 TEST BAŞLANGICI');
    console.log('Match ID:', matchId);
    console.log('Maç: Central FC vs San Juan Jabloteh\n');

    // 1. İlk DB durumunu kontrol et
    console.log('🔍 İLK DB DURUMU (T0):');
    const beforeResult = await client.query(`
      SELECT 
        status_id,
        home_score_display,
        away_score_display,
        live_kickoff_time,
        updated_at
      FROM ts_matches
      WHERE external_id = $1
    `, [matchId]);

    if (beforeResult.rows.length === 0) {
      console.log('❌ Maç DB\'de bulunamadı!');
      return;
    }

    const before = beforeResult.rows[0];
    console.log('Status ID:', before.status_id);
    console.log('Home Score:', before.home_score_display);
    console.log('Away Score:', before.away_score_display);
    console.log('Live Kickoff Time:', before.live_kickoff_time ? new Date(Number(before.live_kickoff_time) * 1000).toISOString() : 'NULL');
    console.log('Updated At:', before.updated_at);
    console.log('');

    // 2. API'den ham veriyi çek (debug için)
    console.log('🔍 API\'den ham veri çekiliyor...');
    const apiClient = new TheSportsClient();
    const apiResponse = await apiClient.get('/match/detail_live', { match_id: matchId });
    console.log('API Response Keys:', Object.keys(apiResponse || {}));
    console.log('API Response (first 500 chars):', JSON.stringify(apiResponse).substring(0, 500));
    console.log('');

    // 3. Manuel reconcile tetikle
    console.log('🔄 MANUEL RECONCILE TETİKLENİYOR...');
    const matchDetailLiveService = new MatchDetailLiveService(apiClient);
    
    // Log seviyesini INFO'ya ayarla (zaten öyle olmalı)
    await matchDetailLiveService.reconcileMatchToDatabase(matchId);
    
    console.log('✅ Reconcile tamamlandı\n');

    // 4. Sonraki DB durumunu kontrol et
    console.log('🔍 SONRAKİ DB DURUMU (T1):');
    const afterResult = await client.query(`
      SELECT 
        status_id,
        home_score_display,
        away_score_display,
        live_kickoff_time,
        updated_at
      FROM ts_matches
      WHERE external_id = $1
    `, [matchId]);

    const after = afterResult.rows[0];
    console.log('Status ID:', after.status_id, after.status_id !== before.status_id ? '✅ DEĞİŞTİ' : '❌ DEĞİŞMEDİ');
    console.log('Home Score:', after.home_score_display, after.home_score_display !== before.home_score_display ? '✅ DEĞİŞTİ' : '❌ DEĞİŞMEDİ');
    console.log('Away Score:', after.away_score_display, after.away_score_display !== before.away_score_display ? '✅ DEĞİŞTİ' : '❌ DEĞİŞMEDİ');
    console.log('Live Kickoff Time:', after.live_kickoff_time ? new Date(Number(after.live_kickoff_time) * 1000).toISOString() : 'NULL', 
                after.live_kickoff_time !== before.live_kickoff_time ? '✅ DEĞİŞTİ' : '❌ DEĞİŞMEDİ');
    console.log('Updated At:', after.updated_at, after.updated_at !== before.updated_at ? '✅ DEĞİŞTİ' : '❌ DEĞİŞMEDİ');
    console.log('');

    // 5. Tam satırı göster
    console.log('📋 TAM SATIR:');
    const fullRow = await client.query(`
      SELECT *
      FROM ts_matches
      WHERE external_id = $1
    `, [matchId]);
    console.log(JSON.stringify(fullRow.rows[0], null, 2));
    console.log('');

    // 6. Rapor
    console.log('📊 RAPOR:');
    const changed = {
      status_id: after.status_id !== before.status_id,
      home_score: after.home_score_display !== before.home_score_display,
      away_score: after.away_score_display !== before.away_score_display,
      live_kickoff_time: after.live_kickoff_time !== before.live_kickoff_time,
      updated_at: after.updated_at !== before.updated_at,
    };

    const anyChanged = Object.values(changed).some(v => v);
    console.log('Reconcile çalıştı mı?', anyChanged ? '✅ EVET' : '❌ HAYIR');
    console.log('DB\'de değişen alanlar:', Object.entries(changed).filter(([_, v]) => v).map(([k, _]) => k).join(', ') || 'YOK');
    
    // API payload kontrolü
    const hasCode = apiResponse && 'code' in apiResponse;
    const hasResults = apiResponse && ('results' in apiResponse || 'result' in apiResponse);
    const hasScore = apiResponse && ('score' in apiResponse || (apiResponse.results && 'score' in apiResponse.results));
    const hasStatus = apiResponse && ('status' in apiResponse || 'status_id' in apiResponse || (apiResponse.results && ('status' in apiResponse.results || 'status_id' in apiResponse.results)));
    
    console.log('Provider payload boş mu dolu mu?', apiResponse ? '✅ DOLU' : '❌ BOŞ');
    console.log('Payload\'da code var mı?', hasCode ? '✅ VAR' : '❌ YOK');
    console.log('Payload\'da results var mı?', hasResults ? '✅ VAR' : '❌ YOK');
    console.log('Payload\'da score var mı?', hasScore ? '✅ VAR' : '❌ YOK');
    console.log('Payload\'da status var mı?', hasStatus ? '✅ VAR' : '❌ YOK');
    
    console.log('\n💬 SONUÇ YORUMU:');
    if (!apiResponse) {
      console.log('❌ API\'den hiç veri gelmedi - Provider kaynaklı sorun');
    } else if (!hasResults && !hasCode) {
      console.log('❌ API payload boş veya geçersiz format - Provider kaynaklı sorun');
    } else if (!anyChanged) {
      console.log('⚠️  API\'den veri geldi ama DB güncellenmedi - Parse hatası veya extractLiveFields sorunu');
    } else {
      console.log('✅ Reconcile başarılı - DB güncellendi');
    }

  } catch (error: any) {
    console.error('❌ HATA:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

testManualReconcile().catch(console.error);

