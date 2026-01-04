import { pool } from '../database/connection';

async function diagnoseMatchStatus() {
    try {
        const nowTs = Math.floor(Date.now() / 1000);
        const oneHourAgo = nowTs - 3600;
        const twoHoursAgo = nowTs - 7200;
        const fourHoursAgo = nowTs - 14400;

        console.log('=== MATCH STATUS DIAGNOSTIC ===');
        console.log('Current UTC:', new Date().toISOString());
        console.log('nowTs:', nowTs);
        console.log('');

        // 1. Matches that should be live (match_time passed, status still 1)
        const shouldBeLive = await pool.query(`
            SELECT m.external_id, ht.name as home, at.name as away, m.match_time, m.status_id,
                   to_timestamp(m.match_time) as match_time_readable,
                   m.updated_at,
                   (${nowTs} - m.match_time) / 60 as minutes_since_start
            FROM ts_matches m
            LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
            LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
            WHERE m.status_id = 1 
              AND m.match_time <= $1 
              AND m.match_time >= $2
            ORDER BY m.match_time DESC
            LIMIT 15
        `, [nowTs, fourHoursAgo]);

        console.log('=== SHOULD BE LIVE (status=1, match_time passed) ===');
        console.log('Count:', shouldBeLive.rows.length);
        if (shouldBeLive.rows.length > 0) {
            for (const r of shouldBeLive.rows) {
                const minsSince = Number(r.minutes_since_start) || 0;
                console.log(`  ${r.home} vs ${r.away} | started ${minsSince.toFixed(0)}min ago | status=${r.status_id}`);
            }
        }

        // 2. Currently live matches
        const liveNow = await pool.query(`
            SELECT m.external_id, ht.name as home, at.name as away, m.status_id, m.minute, m.match_time,
                   m.home_score_regular, m.away_score_regular, m.updated_at
            FROM ts_matches m
            LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
            LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
            WHERE m.status_id IN (2, 3, 4, 5, 7)
            ORDER BY m.match_time DESC
            LIMIT 20
        `);

        console.log('');
        console.log('=== CURRENTLY LIVE (status IN 2,3,4,5,7) ===');
        console.log('Count:', liveNow.rows.length);
        for (const r of liveNow.rows) {
            console.log(`  ${r.home} vs ${r.away} | ${r.home_score_regular}-${r.away_score_regular} | min=${r.minute} | status=${r.status_id}`);
        }

        // 3. Matches that should be finished but still showing as live (status 2-7 but started > 3 hours ago)
        const stuckLive = await pool.query(`
            SELECT m.external_id, ht.name as home, at.name as away, m.status_id, m.minute, m.match_time,
                   to_timestamp(m.match_time) as match_time_readable,
                   m.updated_at,
                   (${nowTs} - m.match_time) / 60 as minutes_since_start
            FROM ts_matches m
            LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
            LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
            WHERE m.status_id IN (2, 3, 4, 5, 7)
              AND m.match_time <= $1
            ORDER BY m.match_time ASC
            LIMIT 10
        `, [nowTs - 10800]); // Started more than 3 hours ago

        console.log('');
        console.log('=== STUCK AS LIVE (status 2-7 but started > 3 hours ago) ===');
        console.log('Count:', stuckLive.rows.length);
        for (const r of stuckLive.rows) {
            const minsSince = Number(r.minutes_since_start) || 0;
            console.log(`  ${r.home} vs ${r.away} | started ${minsSince.toFixed(0)}min ago | status=${r.status_id} | updated=${r.updated_at}`);
        }

        // 4. Recent finished matches
        const finished = await pool.query(`
            SELECT m.external_id, ht.name as home, at.name as away, m.status_id, m.match_time, m.updated_at,
                   m.home_score_regular, m.away_score_regular
            FROM ts_matches m
            LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
            LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
            WHERE m.status_id IN (8, 12)
              AND m.match_time >= $1
            ORDER BY m.updated_at DESC
            LIMIT 10
        `, [fourHoursAgo]);

        console.log('');
        console.log('=== RECENTLY FINISHED (status 8 or 12) ===');
        console.log('Count:', finished.rows.length);
        for (const r of finished.rows) {
            console.log(`  ${r.home} vs ${r.away} | ${r.home_score_regular}-${r.away_score_regular} | status=${r.status_id} | updated=${r.updated_at}`);
        }

        // 5. Check last database update time
        const lastUpdated = await pool.query(`
            SELECT MAX(updated_at) as last_update FROM ts_matches
            WHERE updated_at > NOW() - INTERVAL '24 hours'
        `);

        console.log('');
        console.log('=== LAST DATABASE UPDATE ===');
        console.log('Last match update:', lastUpdated.rows[0]?.last_update);

        process.exit(0);
    } catch (e: any) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

diagnoseMatchStatus();
