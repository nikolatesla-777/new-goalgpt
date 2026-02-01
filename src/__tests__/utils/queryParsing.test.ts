/**
 * Query Parsing Tests
 *
 * Tests for SQL query parsing utilities (PR-P0-3)
 */

// Since these are private functions, we'll test them indirectly through safeQuery
// or create a test-only export. For now, let's test the patterns directly.

// Helper functions extracted for testing
function parseQueryInfo(sql: string): { operation: string; table: string } {
  const normalized = sql.trim().toUpperCase();

  let operation = 'UNKNOWN';
  if (normalized.startsWith('SELECT')) operation = 'SELECT';
  else if (normalized.startsWith('INSERT')) operation = 'INSERT';
  else if (normalized.startsWith('UPDATE')) operation = 'UPDATE';
  else if (normalized.startsWith('DELETE')) operation = 'DELETE';

  let table = 'unknown';
  try {
    if (operation === 'SELECT') {
      const fromMatch = normalized.match(/FROM\s+([a-z_][a-z0-9_]*)/i);
      if (fromMatch) table = fromMatch[1].toLowerCase();
    } else if (operation === 'INSERT') {
      const intoMatch = normalized.match(/INTO\s+([a-z_][a-z0-9_]*)/i);
      if (intoMatch) table = intoMatch[1].toLowerCase();
    } else if (operation === 'UPDATE') {
      const updateMatch = normalized.match(/UPDATE\s+([a-z_][a-z0-9_]*)/i);
      if (updateMatch) table = updateMatch[1].toLowerCase();
    } else if (operation === 'DELETE') {
      const deleteMatch = normalized.match(/FROM\s+([a-z_][a-z0-9_]*)/i);
      if (deleteMatch) table = deleteMatch[1].toLowerCase();
    }
  } catch (err) {
    // Keep 'unknown' on parse error
  }

  return { operation, table };
}

function truncateSQL(sql: string): string {
  const cleaned = sql.replace(/\s+/g, ' ').trim();
  return cleaned.length > 120 ? cleaned.substring(0, 117) + '...' : cleaned;
}

function sanitizeParams(params?: any[]): string {
  if (!params || params.length === 0) return '[]';
  return `[${params.length} params]`;
}

describe('Query Parsing Utilities', () => {
  describe('parseQueryInfo', () => {
    describe('SELECT queries', () => {
      it('should parse simple SELECT', () => {
        const result = parseQueryInfo('SELECT * FROM ts_matches');
        expect(result.operation).toBe('SELECT');
        expect(result.table).toBe('ts_matches');
      });

      it('should parse SELECT with WHERE clause', () => {
        const result = parseQueryInfo('SELECT id, name FROM ts_teams WHERE id = $1');
        expect(result.operation).toBe('SELECT');
        expect(result.table).toBe('ts_teams');
      });

      it('should parse SELECT with JOIN', () => {
        const result = parseQueryInfo(`
          SELECT m.*, t.name
          FROM ts_matches m
          JOIN ts_teams t ON m.home_team_id = t.id
        `);
        expect(result.operation).toBe('SELECT');
        expect(result.table).toBe('ts_matches');
      });

      it('should handle lowercase SELECT', () => {
        const result = parseQueryInfo('select * from ts_players');
        expect(result.operation).toBe('SELECT');
        expect(result.table).toBe('ts_players');
      });

      it('should handle extra whitespace', () => {
        const result = parseQueryInfo('  SELECT   *   FROM   ts_competitions  ');
        expect(result.operation).toBe('SELECT');
        expect(result.table).toBe('ts_competitions');
      });
    });

    describe('INSERT queries', () => {
      it('should parse simple INSERT', () => {
        const result = parseQueryInfo('INSERT INTO ts_matches (id, name) VALUES ($1, $2)');
        expect(result.operation).toBe('INSERT');
        expect(result.table).toBe('ts_matches');
      });

      it('should parse INSERT with RETURNING', () => {
        const result = parseQueryInfo(`
          INSERT INTO ts_predictions (match_id, prediction)
          VALUES ($1, $2) RETURNING id
        `);
        expect(result.operation).toBe('INSERT');
        expect(result.table).toBe('ts_predictions');
      });

      it('should handle lowercase INSERT', () => {
        const result = parseQueryInfo('insert into ts_teams (name) values ($1)');
        expect(result.operation).toBe('INSERT');
        expect(result.table).toBe('ts_teams');
      });
    });

    describe('UPDATE queries', () => {
      it('should parse simple UPDATE', () => {
        const result = parseQueryInfo('UPDATE ts_matches SET status = $1 WHERE id = $2');
        expect(result.operation).toBe('UPDATE');
        expect(result.table).toBe('ts_matches');
      });

      it('should parse UPDATE with multiple columns', () => {
        const result = parseQueryInfo(`
          UPDATE ts_teams
          SET name = $1, logo_url = $2
          WHERE id = $3
        `);
        expect(result.operation).toBe('UPDATE');
        expect(result.table).toBe('ts_teams');
      });

      it('should handle lowercase UPDATE', () => {
        const result = parseQueryInfo('update ts_players set age = $1');
        expect(result.operation).toBe('UPDATE');
        expect(result.table).toBe('ts_players');
      });
    });

    describe('DELETE queries', () => {
      it('should parse simple DELETE', () => {
        const result = parseQueryInfo('DELETE FROM ts_matches WHERE id = $1');
        expect(result.operation).toBe('DELETE');
        expect(result.table).toBe('ts_matches');
      });

      it('should parse DELETE with multiple conditions', () => {
        const result = parseQueryInfo(`
          DELETE FROM ts_predictions
          WHERE match_id = $1 AND created_at < $2
        `);
        expect(result.operation).toBe('DELETE');
        expect(result.table).toBe('ts_predictions');
      });

      it('should handle lowercase DELETE', () => {
        const result = parseQueryInfo('delete from ts_teams where id = $1');
        expect(result.operation).toBe('DELETE');
        expect(result.table).toBe('ts_teams');
      });
    });

    describe('Edge cases', () => {
      it('should handle unknown operation', () => {
        const result = parseQueryInfo('CREATE TABLE test (id INT)');
        expect(result.operation).toBe('UNKNOWN');
        expect(result.table).toBe('unknown');
      });

      it('should handle missing table name', () => {
        const result = parseQueryInfo('SELECT * FROM');
        expect(result.operation).toBe('SELECT');
        expect(result.table).toBe('unknown');
      });

      it('should handle table names with underscores', () => {
        const result = parseQueryInfo('SELECT * FROM ts_match_events');
        expect(result.operation).toBe('SELECT');
        expect(result.table).toBe('ts_match_events');
      });

      it('should handle schema-qualified table names (takes first)', () => {
        const result = parseQueryInfo('SELECT * FROM public.ts_matches');
        expect(result.operation).toBe('SELECT');
        expect(result.table).toBe('public'); // Regex captures first identifier
      });
    });
  });

  describe('truncateSQL', () => {
    it('should not truncate short queries', () => {
      const sql = 'SELECT * FROM ts_matches WHERE id = $1';
      const result = truncateSQL(sql);
      expect(result).toBe(sql);
      expect(result.length).toBeLessThanOrEqual(120);
    });

    it('should truncate long queries to 120 chars', () => {
      const sql = 'SELECT id, home_team_id, away_team_id, status_id, home_score, away_score, match_time, created_at, updated_at FROM ts_matches WHERE status_id IN (1, 2, 3, 4) ORDER BY match_time DESC';
      const result = truncateSQL(sql);
      expect(result.length).toBe(120);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should normalize whitespace', () => {
      const sql = '  SELECT   *   FROM   ts_matches  ';
      const result = truncateSQL(sql);
      expect(result).toBe('SELECT * FROM ts_matches');
    });

    it('should handle newlines and tabs', () => {
      const sql = 'SELECT *\n\tFROM ts_matches\n\tWHERE id = $1';
      const result = truncateSQL(sql);
      expect(result).toBe('SELECT * FROM ts_matches WHERE id = $1');
    });

    it('should handle exactly 120 chars', () => {
      const sql = 'A'.repeat(120);
      const result = truncateSQL(sql);
      expect(result.length).toBe(120);
      expect(result.endsWith('...')).toBe(false);
    });

    it('should handle 121 chars', () => {
      const sql = 'A'.repeat(121);
      const result = truncateSQL(sql);
      expect(result.length).toBe(120);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('sanitizeParams', () => {
    it('should return [] for no params', () => {
      expect(sanitizeParams()).toBe('[]');
      expect(sanitizeParams([])).toBe('[]');
    });

    it('should show count for params', () => {
      expect(sanitizeParams([1])).toBe('[1 params]');
      expect(sanitizeParams([1, 2, 3])).toBe('[3 params]');
      expect(sanitizeParams(['a', 'b', 'c', 'd', 'e'])).toBe('[5 params]');
    });

    it('should not expose param values', () => {
      const result = sanitizeParams(['secret', 'password123']);
      expect(result).toBe('[2 params]');
      expect(result).not.toContain('secret');
      expect(result).not.toContain('password123');
    });

    it('should handle complex param types', () => {
      const result = sanitizeParams([
        { foo: 'bar' },
        [1, 2, 3],
        null,
        undefined,
        'string',
      ]);
      expect(result).toBe('[5 params]');
    });
  });
});
