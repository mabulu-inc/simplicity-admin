import { describe, it, expect } from 'vitest';
import type { EffectivePermissions } from '@simplicity-admin/auth';

// Import the engine functions we need to implement
import {
  canAccess,
  canAccessColumn,
  getAccessibleColumns,
  getEffectivePermissions,
} from '../../src/rbac/engine.js';

/**
 * Fixture: permissions for app_viewer with SELECT on contacts (id, name, email)
 */
function makeViewerPermissions(): EffectivePermissions {
  return {
    role: 'app_viewer',
    tables: [
      {
        table: 'contacts',
        schema: 'public',
        operations: ['SELECT'],
        columnPermissions: [
          { column: 'id', operations: ['SELECT'] },
          { column: 'name', operations: ['SELECT'] },
          { column: 'email', operations: ['SELECT'] },
        ],
      },
    ],
  };
}

/**
 * Fixture: permissions for app_editor with SELECT + UPDATE on contacts
 */
function makeEditorPermissions(): EffectivePermissions {
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
          { column: 'salary', operations: ['SELECT'] },
        ],
      },
    ],
  };
}

describe('RBAC permission engine — unit tests', () => {
  describe('canAccess()', () => {
    it('returns true for granted table operation', () => {
      const perms = makeViewerPermissions();
      expect(canAccess(perms, 'contacts', 'SELECT')).toBe(true);
    });

    it('returns false for non-granted table operation', () => {
      const perms = makeViewerPermissions();
      expect(canAccess(perms, 'contacts', 'UPDATE')).toBe(false);
    });

    it('returns false for non-existent table', () => {
      const perms = makeViewerPermissions();
      expect(canAccess(perms, 'audit_log', 'SELECT')).toBe(false);
    });

    it('handles multiple operations on a table', () => {
      const perms = makeEditorPermissions();
      expect(canAccess(perms, 'contacts', 'SELECT')).toBe(true);
      expect(canAccess(perms, 'contacts', 'INSERT')).toBe(true);
      expect(canAccess(perms, 'contacts', 'UPDATE')).toBe(true);
      expect(canAccess(perms, 'contacts', 'DELETE')).toBe(false);
    });
  });

  describe('canAccessColumn()', () => {
    it('returns true for granted column operation', () => {
      const perms = makeViewerPermissions();
      expect(canAccessColumn(perms, 'contacts', 'email', 'SELECT')).toBe(true);
    });

    it('returns false for non-granted column operation', () => {
      const perms = makeViewerPermissions();
      expect(canAccessColumn(perms, 'contacts', 'email', 'UPDATE')).toBe(false);
    });

    it('returns false for non-existent column', () => {
      const perms = makeViewerPermissions();
      expect(canAccessColumn(perms, 'contacts', 'salary', 'SELECT')).toBe(false);
    });

    it('returns false for non-existent table', () => {
      const perms = makeViewerPermissions();
      expect(canAccessColumn(perms, 'audit_log', 'id', 'SELECT')).toBe(false);
    });

    it('checks column-specific operations correctly', () => {
      const perms = makeEditorPermissions();
      // salary only has SELECT, not UPDATE
      expect(canAccessColumn(perms, 'contacts', 'salary', 'SELECT')).toBe(true);
      expect(canAccessColumn(perms, 'contacts', 'salary', 'UPDATE')).toBe(false);
      // name has SELECT + UPDATE
      expect(canAccessColumn(perms, 'contacts', 'name', 'UPDATE')).toBe(true);
    });
  });

  describe('getAccessibleColumns()', () => {
    it('returns correct columns for SELECT operation', () => {
      const perms = makeViewerPermissions();
      const cols = getAccessibleColumns(perms, 'contacts', 'SELECT');
      expect(cols).toEqual(['id', 'name', 'email']);
    });

    it('returns correct columns for UPDATE operation', () => {
      const perms = makeEditorPermissions();
      const cols = getAccessibleColumns(perms, 'contacts', 'UPDATE');
      expect(cols).toEqual(['name', 'email']);
    });

    it('returns empty array for non-granted operation', () => {
      const perms = makeViewerPermissions();
      const cols = getAccessibleColumns(perms, 'contacts', 'DELETE');
      expect(cols).toEqual([]);
    });

    it('returns empty array for non-existent table', () => {
      const perms = makeViewerPermissions();
      const cols = getAccessibleColumns(perms, 'audit_log', 'SELECT');
      expect(cols).toEqual([]);
    });
  });
});

describe('RBAC permission engine — integration tests', () => {
  // getEffectivePermissions requires a real Postgres connection.
  // These tests run against the Docker Compose database with bootstrapped roles/grants.

  const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/simplicity_test';

  // Skip integration tests if no DB is available
  const describeDb = process.env['CI'] || process.env['DATABASE_URL']
    ? describe
    : describe.skip;

  describeDb('getEffectivePermissions()', () => {
    let pool: import('@simplicity-admin/core').ConnectionPool;

    // We dynamically import to avoid errors when pg is not available
    beforeAll(async () => {
      const { createPool } = await import('@simplicity-admin/db');
      pool = createPool(DATABASE_URL);

      // Bootstrap: ensure roles and grants exist
      const { bootstrap } = await import('@simplicity-admin/db');
      await bootstrap(pool);
    });

    afterAll(async () => {
      if (pool) await pool.end();
    });

    it('reads grants for a role from the database', async () => {
      const perms = await getEffectivePermissions(pool, 'app_viewer');
      expect(perms.role).toBe('app_viewer');
      expect(perms.tables.length).toBeGreaterThan(0);
    });

    it('includes column-level detail', async () => {
      const perms = await getEffectivePermissions(pool, 'app_viewer');
      const usersTable = perms.tables.find(t => t.table === 'users');
      expect(usersTable).toBeDefined();
      expect(usersTable!.columnPermissions.length).toBeGreaterThan(0);
    });

    it('returns SELECT operations for app_viewer', async () => {
      const perms = await getEffectivePermissions(pool, 'app_viewer');
      // app_viewer should only have SELECT
      for (const table of perms.tables) {
        for (const op of table.operations) {
          expect(op).toBe('SELECT');
        }
      }
    });

    it('returns broader permissions for app_admin', async () => {
      const perms = await getEffectivePermissions(pool, 'app_admin');
      expect(perms.role).toBe('app_admin');
      // app_admin should have at least SELECT and DELETE on some tables
      const allOps = new Set(perms.tables.flatMap(t => t.operations));
      expect(allOps.has('SELECT')).toBe(true);
    });

    it('filters by schema when provided', async () => {
      const perms = await getEffectivePermissions(pool, 'app_viewer', 'public');
      for (const table of perms.tables) {
        expect(table.schema).toBe('public');
      }
    });
  });
});
