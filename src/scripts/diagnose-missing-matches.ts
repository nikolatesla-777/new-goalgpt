/**
 * Diagnose Missing Matches Script
 *
 * Finds matches that should be live but are missing from today's diary
 * Checks: Vietnam and Indonesia Indo D4 leagues
 */

import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

// TSİ (Turkey) offset: UTC+3
const TSI_OFFSET_MS = 3 * 60 * 60 * 1000;

async function diagnose() {
  const client = await pool.connect();
  try {
    const nowTSI = new Date(Date.now() + TSI_OFFSET_MS);
    const now = Math.floor(Date.now() / 1000);

    // Today in TSİ
    const todayStr = nowTSI.toISOString().split('T')[0];
    const startOfDay = Math.floor(new Date(`${todayStr}T00:00:00+03:00`).getTime() / 1000);
    const endOfDay = Math.floor(new Date(`${todayStr}T23:59:59+03:00`).getTime() / 1000);

    console.log('🔍 MISSING MATCHES DIAGNOSTIC');
    console.log('================================');
    console.log(`Current time (TSİ): ${nowTSI.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`);
    console.log(`Current timestamp (UTC): ${now}`);
    console.log(`Today (TSİ): ${todayStr}`);
    console.log(`Day range: ${startOfDay} - ${endOfDay}`);
    console.log('');

    // 1. Search for Vietnam matches
    console.log('🇻🇳 VIETNAM MATCHES (Today)');
    console.log('--------------------------');
    const vietnamResult = await client.query(`
      SELECT
        m.external_id as id,
        m.match_time,
        m.status_id,
        m.minute,
        ht.name as home_team,
        at.name as away_team,
        c.name as competition,
        c.external_id as competition_id,
        m.home_score_display as home_score,
        m.away_score_display as away_score,
        m.updated_at
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
      WHERE (
        LOWER(c.name) LIKE '%vietnam%'
        OR LOWER(ht.name) LIKE '%vietnam%'
        OR LOWER(at.name) LIKE '%vietnam%'
      )
      AND m.match_time >= $1 - 86400  -- yesterday to today
      AND m.match_time <= $2 + 86400  -- today to tomorrow
      ORDER BY m.match_time ASC
    `, [startOfDay, endOfDay]);

    if (vietnamResult.rows.length === 0) {
      console.log('❌ No Vietnam matches found in database!');
    } else {
      vietnamResult.rows.forEach((row: any, i: number) => {
        const matchTime = new Date(row.match_time * 1000);
        const tsiTime = matchTime.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        const status = getStatusName(row.status_id);
        const inTodayRange = row.match_time >= startOfDay && row.match_time <= endOfDay;
        const shouldBeLive = row.match_time <= now && row.status_id === 1;

        console.log(`${i + 1}. [${row.id}] ${row.home_team || '?'} vs ${row.away_team || '?'}`);
        console.log(`   Competition: ${row.competition || '?'} (${row.competition_id})`);
        console.log(`   Match Time: ${tsiTime} (ts: ${row.match_time})`);
        console.log(`   Status: ${status} (${row.status_id})`);
        console.log(`   Score: ${row.home_score ?? '-'}-${row.away_score ?? '-'}`);
        console.log(`   In today's range: ${inTodayRange ? '✅ YES' : '❌ NO'}`);
        console.log(`   Should be live: ${shouldBeLive ? '⚠️ YES!' : 'No'}`);
        console.log('');
      });
    }
    console.log('');

    // 2. Search for Indonesia D4 matches
    console.log('🇮🇩 INDONESIA INDO D4 MATCHES (Today)');
    console.log('--------------------------------------');
    const indonesiaResult = await client.query(`
      SELECT
        m.external_id as id,
        m.match_time,
        m.status_id,
        m.minute,
        ht.name as home_team,
        at.name as away_team,
        c.name as competition,
        c.external_id as competition_id,
        m.home_score_display as home_score,
        m.away_score_display as away_score,
        m.updated_at
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
      WHERE (
        LOWER(c.name) LIKE '%indonesia%'
        OR LOWER(c.name) LIKE '%indo%d4%'
        OR LOWER(c.name) LIKE '%liga 4%'
        OR LOWER(c.name) LIKE '%division 4%'
      )
      AND m.match_time >= $1 - 86400
      AND m.match_time <= $2 + 86400
      ORDER BY m.match_time ASC
    `, [startOfDay, endOfDay]);

    if (indonesiaResult.rows.length === 0) {
      console.log('❌ No Indonesia D4 matches found in database!');
    } else {
      indonesiaResult.rows.forEach((row: any, i: number) => {
        const matchTime = new Date(row.match_time * 1000);
        const tsiTime = matchTime.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        const status = getStatusName(row.status_id);
        const inTodayRange = row.match_time >= startOfDay && row.match_time <= endOfDay;
        const shouldBeLive = row.match_time <= now && row.status_id === 1;

        console.log(`${i + 1}. [${row.id}] ${row.home_team || '?'} vs ${row.away_team || '?'}`);
        console.log(`   Competition: ${row.competition || '?'} (${row.competition_id})`);
        console.log(`   Match Time: ${tsiTime} (ts: ${row.match_time})`);
        console.log(`   Status: ${status} (${row.status_id})`);
        console.log(`   Score: ${row.home_score ?? '-'}-${row.away_score ?? '-'}`);
        console.log(`   In today's range: ${inTodayRange ? '✅ YES' : '❌ NO'}`);
        console.log(`   Should be live: ${shouldBeLive ? '⚠️ YES!' : 'No'}`);
        console.log('');
      });
    }
    console.log('');

    // 3. Check all "should be live" matches
    console.log('⏰ ALL "SHOULD BE LIVE" MATCHES');
    console.log('(status=1 but match_time already passed)');
    console.log('--------------------------------------');
    const shouldBeLiveResult = await client.query(`
      SELECT
        m.external_id as id,
        m.match_time,
        m.status_id,
        m.minute,
        ht.name as home_team,
        at.name as away_team,
        c.name as competition,
        m.home_score_display as home_score,
        m.away_score_display as away_score,
        ROUND(($1 - m.match_time) / 60.0) as minutes_ago
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
      WHERE m.status_id = 1
        AND m.match_time <= $1
        AND m.match_time >= $1 - 7200  -- last 2 hours
      ORDER BY m.match_time DESC
      LIMIT 20
    `, [now]);

    if (shouldBeLiveResult.rows.length === 0) {
      console.log('✅ No "should be live" matches found (good!)');
    } else {
      console.log(`Found ${shouldBeLiveResult.rows.length} matches that should be live:`);
      shouldBeLiveResult.rows.forEach((row: any, i: number) => {
        const matchTime = new Date(row.match_time * 1000);
        const tsiTime = matchTime.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });

        console.log(`${i + 1}. [${row.id}] ${row.home_team || '?'} vs ${row.away_team || '?'}`);
        console.log(`   Competition: ${row.competition || '?'}`);
        console.log(`   Kickoff: ${tsiTime} (${row.minutes_ago} minutes ago)`);
        console.log('');
      });
    }
    console.log('');

    // 4. Check TheSports API directly for today's diary count
    console.log('📊 TODAY\'S DIARY SUMMARY');
    console.log('------------------------');
    const summaryResult = await client.query(`
      SELECT
        status_id,
        COUNT(*) as count
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
      GROUP BY status_id
      ORDER BY count DESC
    `, [startOfDay, endOfDay]);

    let totalToday = 0;
    const statusNames: Record<number, string> = {
      1: 'NOT_STARTED',
      2: 'FIRST_HALF',
      3: 'HALF_TIME',
      4: 'SECOND_HALF',
      5: 'OVERTIME',
      7: 'PENALTIES',
      8: 'ENDED',
      9: 'POSTPONED',
      10: 'CANCELLED'
    };

    summaryResult.rows.forEach((row: any) => {
      const name = statusNames[row.status_id] || `UNKNOWN(${row.status_id})`;
      console.log(`   ${name}: ${row.count}`);
      totalToday += parseInt(row.count);
    });
    console.log(`   TOTAL: ${totalToday}`);

  } finally {
    client.release();
    await pool.end();
  }
}

function getStatusName(statusId: number): string {
  const names: Record<number, string> = {
    1: 'NOT_STARTED',
    2: 'FIRST_HALF',
    3: 'HALF_TIME',
    4: 'SECOND_HALF',
    5: 'OVERTIME',
    7: 'PENALTIES',
    8: 'ENDED',
    9: 'POSTPONED',
    10: 'CANCELLED',
    12: 'CANCELLED'
  };
  return names[statusId] || `UNKNOWN(${statusId})`;
}

diagnose().catch(console.error);
