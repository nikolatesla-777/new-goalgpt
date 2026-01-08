/**
 * Detect Player Duplicates Script
 *
 * Uses fuzzy name matching (Levenshtein distance) to detect duplicate players
 * within the same team. Generates a report and can optionally fix duplicates.
 */

import { pool } from '../database/connection';

// Levenshtein distance implementation
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Normalize name for comparison
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '')       // Remove special chars
    .trim();
}

// Calculate similarity percentage
function similarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);

  if (normA === normB) return 100;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(normA, normB);
  return Math.round((1 - distance / maxLen) * 100);
}

interface PlayerRecord {
  external_id: string;
  name: string;
  position: string | null;
  shirt_number: number | null;
  age: number | null;
  market_value: number | null;
  is_duplicate: boolean | null;
  uid: string | null;
  team_id: string | null;
}

interface DuplicateGroup {
  masterId: string;
  masterName: string;
  duplicates: Array<{
    id: string;
    name: string;
    similarity: number;
    position: string | null;
    marketValue: number | null;
  }>;
  teamId: string;
}

// Mode: 'report' | 'fix'
const MODE = process.argv[2] || 'report';
const SIMILARITY_THRESHOLD = 85; // Minimum similarity percentage to consider as duplicate
const TEAM_ID = process.argv[3]; // Optional: specific team to analyze

async function detectDuplicates() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('OYUNCU DUPLICATE TESPİT SİSTEMİ');
    console.log('========================================');
    console.log(`Mod: ${MODE.toUpperCase()}`);
    console.log(`Eşik: %${SIMILARITY_THRESHOLD} benzerlik`);
    if (TEAM_ID) {
      console.log(`Takım: ${TEAM_ID}`);
    }
    console.log('========================================\n');

    // Get teams with players
    let teamsQuery = `
      SELECT DISTINCT t.external_id, t.name as team_name
      FROM ts_teams t
      INNER JOIN ts_players p ON p.team_id = t.external_id
      WHERE (t.is_duplicate = false OR t.is_duplicate IS NULL)
    `;
    const teamsParams: string[] = [];

    if (TEAM_ID) {
      teamsQuery += ` AND t.external_id = $1`;
      teamsParams.push(TEAM_ID);
    }

    teamsQuery += ` ORDER BY t.name`;

    const teamsResult = await client.query(teamsQuery, teamsParams);
    console.log(`Analiz edilecek takım sayısı: ${teamsResult.rows.length}\n`);

    const allDuplicateGroups: DuplicateGroup[] = [];
    let totalDuplicatesFound = 0;
    let teamsWithDuplicates = 0;

    for (const team of teamsResult.rows) {
      // Get all players for this team
      const playersResult = await client.query<PlayerRecord>(`
        SELECT
          external_id,
          name,
          position,
          shirt_number,
          age,
          market_value,
          is_duplicate,
          uid
        FROM ts_players
        WHERE team_id = $1
          AND (is_duplicate = false OR is_duplicate IS NULL)
        ORDER BY market_value DESC NULLS LAST, name
      `, [team.external_id]);

      const players = playersResult.rows;
      if (players.length < 2) continue;

      // Find duplicates using fuzzy matching
      const duplicateGroups: DuplicateGroup[] = [];
      const processedIds = new Set<string>();

      for (let i = 0; i < players.length; i++) {
        const player1 = players[i];
        if (processedIds.has(player1.external_id)) continue;

        const group: DuplicateGroup = {
          masterId: player1.external_id,
          masterName: player1.name,
          duplicates: [],
          teamId: team.external_id
        };

        for (let j = i + 1; j < players.length; j++) {
          const player2 = players[j];
          if (processedIds.has(player2.external_id)) continue;
          if (!player1.name || !player2.name) continue;

          const sim = similarity(player1.name, player2.name);

          if (sim >= SIMILARITY_THRESHOLD) {
            group.duplicates.push({
              id: player2.external_id,
              name: player2.name,
              similarity: sim,
              position: player2.position,
              marketValue: player2.market_value
            });
            processedIds.add(player2.external_id);
          }
        }

        if (group.duplicates.length > 0) {
          duplicateGroups.push(group);
          processedIds.add(player1.external_id);
        }
      }

      if (duplicateGroups.length > 0) {
        teamsWithDuplicates++;
        console.log(`\n${team.team_name} (${team.external_id}):`);
        console.log('-------------------------------------------');

        for (const group of duplicateGroups) {
          console.log(`  Master: "${group.masterName}" (${group.masterId})`);
          for (const dup of group.duplicates) {
            console.log(`    Duplicate [%${dup.similarity}]: "${dup.name}" (${dup.id})`);
            totalDuplicatesFound++;
          }
        }

        allDuplicateGroups.push(...duplicateGroups);
      }
    }

    console.log('\n========================================');
    console.log('ÖZET');
    console.log('========================================');
    console.log(`Analiz edilen takım: ${teamsResult.rows.length}`);
    console.log(`Duplicate bulunan takım: ${teamsWithDuplicates}`);
    console.log(`Toplam duplicate kayıt: ${totalDuplicatesFound}`);
    console.log(`Toplam duplicate grup: ${allDuplicateGroups.length}`);

    // Fix mode - update database
    if (MODE === 'fix' && allDuplicateGroups.length > 0) {
      console.log('\n========================================');
      console.log('DÜZELTİLİYOR...');
      console.log('========================================\n');

      let fixedCount = 0;

      for (const group of allDuplicateGroups) {
        for (const dup of group.duplicates) {
          await client.query(`
            UPDATE ts_players
            SET
              is_duplicate = true,
              uid = $1,
              updated_at = NOW()
            WHERE external_id = $2
          `, [group.masterId, dup.id]);

          console.log(`  Düzeltildi: "${dup.name}" -> master: "${group.masterName}"`);
          fixedCount++;
        }
      }

      console.log(`\nToplam ${fixedCount} kayıt düzeltildi.`);
    }

    console.log('\n========================================');
    console.log('Tamamlandı');
    console.log('========================================\n');

  } catch (error) {
    console.error('Hata:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

detectDuplicates();
