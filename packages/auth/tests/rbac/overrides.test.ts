import { describe, it, expect, beforeEach } from 'vitest';
import type { ConnectionPool, QueryResult } from '@simplicity-admin/core';
import type { EffectivePermissions } from '../../src/rbac/types.js';
import type { PermissionOverride } from '../../src/rbac/overrides.js';

/**
 * Unit tests for RBAC UI overrides.
 *
 * These tests use an in-memory mock pool to avoid requiring Postgres.
 * The mock tracks SQL calls and returns canned results so we can verify
 * the business logic: ceiling enforcement, deny-only constraint, merge behavior.
 */

/** Minimal mock pool that records queries and returns configurable results */
function createMockPool(results: Map<string, QueryResult<Record<string, unknown>>> = new Map()): {
  pool: ConnectionPool;
  queries: { sql: string; params: unknown[] }[];
} {
  const queries: { sql: string; params: unknown[] }[] = [];

  const pool: ConnectionPool = {
    async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      queries.push({ sql, params });

      // Try to find a matching result by checking if any key is a substring of the query
      for (const [key, result] of results.entries()) {
        if (sql.includes(key)) {
          return result as unknown as QueryResult<T>;
        }
      }

      // Default: empty result
      return { rows: [] as T[], rowCount: 0 };
    },
    async withClient<T>(fn: (client: never) => Promise<T>): Promise<T> {
      return fn(null as never);
    },
    async end(): Promise<void> {
      // no-op
    },
  };

  return { pool, queries };
}

/** Build a code-defined EffectivePermissions fixture */
function makeCodePermissions(): EffectivePermissions {
  return {
    role: 'app_editor',
    tables: [
      {
        table: 'contacts',
        schema: 'public',
        operations: ['SELECT', 'INSERT', 'UPDATE'],
        columnPermissions: [
          { column: 'id', operations: ['SELECT'] },
          { column: 'name', operations: ['SELECT', 'INSERT', 'UPDATE'] },
          { column: 'email', operations: ['SELECT', 'INSERT', 'UPDATE'] },
          { column: 'salary', operations: ['SELECT', 'INSERT', 'UPDATE'] },
        ],
      },
    ],
  };
}

describe('RBAC overrides — unit tests', () => {
  describe('saveOverride()', () => {
    it('persists a deny override', async () => {
      const { saveOverride } = await import('../../src/rbac/overrides.js');

      const results = new Map<string, QueryResult<Record<string, unknown>>>();
      // Mock for the INSERT returning the created row
      results.set('INSERT INTO', {
        rows: [{
          id: '550e8400-e29b-41d4-a716-446655440000',
          role: 'app_editor',
          table_name: 'contacts',
          column_name: 'email',
          operation: 'UPDATE',
          denied: true,
          created_by: 'admin-user',
          created_at: new Date('2026-03-08'),
        }],
        rowCount: 1,
      });

      // Mock for code ceiling check — role_table_grants
      results.set('role_table_grants', {
        rows: [
          { table_schema: 'public', table_name: 'contacts', privilege_type: 'UPDATE' },
        ],
        rowCount: 1,
      });
      // Mock for role_column_grants
      results.set('role_column_grants', {
        rows: [
          { table_schema: 'public', table_name: 'contacts', column_name: 'email', privilege_type: 'UPDATE' },
        ],
        rowCount: 1,
      });

      const { pool, queries } = createMockPool(results);

      const override = await saveOverride(pool, {
        role: 'app_editor',
        table: 'contacts',
        column: 'email',
        operation: 'UPDATE',
        denied: true,
        createdBy: 'admin-user',
      });

      expect(override.id).toBeDefined();
      expect(override.role).toBe('app_editor');
      expect(override.table).toBe('contacts');
      expect(override.column).toBe('email');
      expect(override.operation).toBe('UPDATE');
      expect(override.denied).toBe(true);
      expect(override.createdBy).toBe('admin-user');
      expect(override.createdAt).toBeInstanceOf(Date);

      // Verify an INSERT query was issued
      const insertQuery = queries.find(q => q.sql.includes('INSERT'));
      expect(insertQuery).toBeDefined();
    });

    it('rejects override that exceeds code ceiling (denied: false = grant)', async () => {
      const { saveOverride } = await import('../../src/rbac/overrides.js');
      const { pool } = createMockPool();

      // Attempting to GRANT (denied: false) should always be rejected
      await expect(
        saveOverride(pool, {
          role: 'app_viewer',
          table: 'contacts',
          operation: 'UPDATE',
          denied: false, // trying to grant — should fail
          createdBy: 'admin-user',
        }),
      ).rejects.toThrow('Cannot grant permissions beyond code-defined ceiling');
    });

    it('rejected override has RBAC_003 error code', async () => {
      const { saveOverride } = await import('../../src/rbac/overrides.js');
      const { pool } = createMockPool();

      try {
        await saveOverride(pool, {
          role: 'app_viewer',
          table: 'contacts',
          operation: 'UPDATE',
          denied: false,
          createdBy: 'admin-user',
        });
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as { code: string }).code).toBe('RBAC_003');
      }
    });
  });

  describe('removeOverride()', () => {
    it('deletes an override by id', async () => {
      const { removeOverride } = await import('../../src/rbac/overrides.js');

      const results = new Map<string, QueryResult<Record<string, unknown>>>();
      results.set('DELETE FROM', { rows: [], rowCount: 1 });

      const { pool, queries } = createMockPool(results);
      await removeOverride(pool, '550e8400-e29b-41d4-a716-446655440000');

      const deleteQuery = queries.find(q => q.sql.includes('DELETE'));
      expect(deleteQuery).toBeDefined();
      expect(deleteQuery!.params).toContain('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('listOverrides()', () => {
    it('returns all overrides for a role', async () => {
      const { listOverrides } = await import('../../src/rbac/overrides.js');

      const results = new Map<string, QueryResult<Record<string, unknown>>>();
      results.set('SELECT', {
        rows: [
          {
            id: 'override-1',
            role: 'app_editor',
            table_name: 'contacts',
            column_name: 'email',
            operation: 'UPDATE',
            denied: true,
            created_by: 'admin-user',
            created_at: new Date('2026-03-08'),
          },
          {
            id: 'override-2',
            role: 'app_editor',
            table_name: 'contacts',
            column_name: 'salary',
            operation: 'UPDATE',
            denied: true,
            created_by: 'admin-user',
            created_at: new Date('2026-03-08'),
          },
        ],
        rowCount: 2,
      });

      const { pool } = createMockPool(results);
      const overrides = await listOverrides(pool, 'app_editor');

      expect(overrides).toHaveLength(2);
      expect(overrides[0]!.role).toBe('app_editor');
      expect(overrides[0]!.table).toBe('contacts');
      expect(overrides[0]!.column).toBe('email');
      expect(overrides[1]!.column).toBe('salary');
    });

    it('returns empty array when no overrides exist', async () => {
      const { listOverrides } = await import('../../src/rbac/overrides.js');
      const { pool } = createMockPool();
      const overrides = await listOverrides(pool, 'app_viewer');
      expect(overrides).toEqual([]);
    });
  });

  describe('mergeOverrides()', () => {
    it('merges deny overrides into effective permissions', async () => {
      const { mergeOverrides } = await import('../../src/rbac/overrides.js');
      const codePerms = makeCodePermissions();

      const overrides: PermissionOverride[] = [
        {
          id: 'override-1',
          role: 'app_editor',
          table: 'contacts',
          column: 'salary',
          operation: 'UPDATE',
          denied: true,
          createdBy: 'admin-user',
          createdAt: new Date('2026-03-08'),
        },
      ];

      const merged = mergeOverrides(codePerms, overrides);

      // salary should no longer have UPDATE
      const contacts = merged.tables.find(t => t.table === 'contacts');
      expect(contacts).toBeDefined();
      const salaryCol = contacts!.columnPermissions.find(c => c.column === 'salary');
      expect(salaryCol).toBeDefined();
      expect(salaryCol!.operations).not.toContain('UPDATE');
      // salary should still have SELECT and INSERT
      expect(salaryCol!.operations).toContain('SELECT');
      expect(salaryCol!.operations).toContain('INSERT');
    });

    it('can deny an entire table operation', async () => {
      const { mergeOverrides } = await import('../../src/rbac/overrides.js');
      const codePerms = makeCodePermissions();

      const overrides: PermissionOverride[] = [
        {
          id: 'override-table',
          role: 'app_editor',
          table: 'contacts',
          operation: 'UPDATE',
          denied: true,
          createdBy: 'admin-user',
          createdAt: new Date('2026-03-08'),
        },
      ];

      const merged = mergeOverrides(codePerms, overrides);

      const contacts = merged.tables.find(t => t.table === 'contacts');
      expect(contacts).toBeDefined();
      // Table-level UPDATE should be removed
      expect(contacts!.operations).not.toContain('UPDATE');
      // All columns should lose UPDATE
      for (const cp of contacts!.columnPermissions) {
        expect(cp.operations).not.toContain('UPDATE');
      }
    });

    it('leaves other operations untouched', async () => {
      const { mergeOverrides } = await import('../../src/rbac/overrides.js');
      const codePerms = makeCodePermissions();

      const overrides: PermissionOverride[] = [
        {
          id: 'override-1',
          role: 'app_editor',
          table: 'contacts',
          column: 'salary',
          operation: 'UPDATE',
          denied: true,
          createdBy: 'admin-user',
          createdAt: new Date('2026-03-08'),
        },
      ];

      const merged = mergeOverrides(codePerms, overrides);

      // name and email should still have UPDATE
      const contacts = merged.tables.find(t => t.table === 'contacts');
      const nameCol = contacts!.columnPermissions.find(c => c.column === 'name');
      expect(nameCol!.operations).toContain('UPDATE');
      const emailCol = contacts!.columnPermissions.find(c => c.column === 'email');
      expect(emailCol!.operations).toContain('UPDATE');
    });

    it('handles no overrides gracefully', async () => {
      const { mergeOverrides } = await import('../../src/rbac/overrides.js');
      const codePerms = makeCodePermissions();
      const merged = mergeOverrides(codePerms, []);
      expect(merged).toEqual(codePerms);
    });
  });
});
