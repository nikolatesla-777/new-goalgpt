import { pool } from './src/database/connection';

async function testLiveMatch() {
  const client = await pool.connect();
  try {
    // 1. Canlı maç bul (status 2 veya 4, yakın zamanda başlamış)
    const result = await client.query(`
      SELECT 
        m.external_id,
        ht.name as home_team_name,
        at.name as away_team_name,
        m.status_id,
        m.live_kickoff_time,
        m.match_time,
        m.updated_at
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      WHERE (ht.name ILIKE '%Tirana%' OR at.name ILIKE '%Tirana%')
        OR (ht.name ILIKE '%Vllaznia%' OR at.name ILIKE '%Vllaznia%')
        OR m.status_id IN (2, 4)
      ORDER BY m.match_time DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('❌ Canlı maç bulunamadı');
      return;
    }

    console.log(`📋 ${result.rows.length} maç bulundu:`);
    result.rows.forEach((row: any, idx: number) => {
      console.log(`${idx + 1}. ${row.home_team_name} vs ${row.away_team_name} - Status: ${row.status_id} - Time: ${new Date(Number(row.match_time) * 1000).toISOString()}`);
    });

    // Status 2 veya 4 olanı seç, yoksa ilkini al
    const match = result.rows.find((r: any) => r.status_id === 2 || r.status_id === 4) || result.rows[0];
    console.log(`\n🎯 Seçilen maç: ${match.home_team_name} vs ${match.away_team_name}\n`);
    console.log('📊 İLK KONTROL (T0):');
    console.log('Match ID:', match.external_id);
    console.log('Maç:', `${match.home_team_name} vs ${match.away_team_name}`);
    console.log('Status ID:', match.status_id);
    console.log('Match Time:', new Date(Number(match.match_time) * 1000).toISOString());
    console.log('Live Kickoff Time:', match.live_kickoff_time ? new Date(Number(match.live_kickoff_time) * 1000).toISOString() : 'NULL');
    console.log('Updated At:', match.updated_at);
    console.log('Updated At (timestamp):', new Date(match.updated_at).getTime());
    

    const initialUpdatedAt = match.updated_at;
    const initialUpdatedAtTimestamp = new Date(match.updated_at).getTime();
    const initialStatusId = match.status_id;

    console.log('\n⏳ 90 saniye bekleniyor...\n');
    await new Promise(resolve => setTimeout(resolve, 90000)); // 90 saniye

    // 2. Tekrar kontrol et
    const result2 = await client.query(`
      SELECT 
        m.status_id,
        m.live_kickoff_time,
        m.updated_at
      FROM ts_matches m
      WHERE m.external_id = $1
    `, [match.external_id]);

    if (result2.rows.length === 0) {
      console.log('❌ Maç bulunamadı (ikinci kontrol)');
      return;
    }

    const match2 = result2.rows[0];
    console.log('📊 İKİNCİ KONTROL (T+90s):');
    console.log('Status ID:', match2.status_id, match2.status_id !== initialStatusId ? '✅ DEĞİŞTİ' : '❌ DEĞİŞMEDİ');
    console.log('Updated At:', match2.updated_at);
    console.log('Updated At (timestamp):', new Date(match2.updated_at).getTime());
    const updatedAtTimestamp2 = new Date(match2.updated_at).getTime();
    const updatedAtChanged = updatedAtTimestamp2 !== initialUpdatedAtTimestamp;
    console.log('Updated At değişti mi?', updatedAtChanged ? '✅ EVET' : '❌ HAYIR');
    if (updatedAtChanged) {
      console.log('Fark (ms):', updatedAtTimestamp2 - initialUpdatedAtTimestamp);
    }


    console.log('\n📈 SONUÇ:');
    if (updatedAtChanged || match2.status_id !== initialStatusId) {
      console.log('✅ DB güncelleniyor - UI 30 saniye içinde güncellenmeli');
      if (!updatedAtChanged && match2.status_id === initialStatusId) {
        console.log('⚠️  Ama sadece updated_at değişti, status_id değişmedi');
      }
    } else {
      console.log('❌ DB güncellenmiyor - Sorun var!');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

testLiveMatch().catch(console.error);

