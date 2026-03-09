import { describe, it, expect } from 'vitest';
import type {
  Operation,
  TablePermission,
  ColumnPermission,
  EffectivePermissions,
} from '@simplicity-admin/auth';

describe('RBAC permission types', () => {
  it('Operation type accepts valid operations', () => {
    const ops: Operation[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
    expect(ops).toHaveLength(4);
  });

  it('ColumnPermission has correct shape', () => {
    const cp: ColumnPermission = {
      column: 'email',
      operations: ['SELECT', 'UPDATE'],
    };
    expect(cp.column).toBe('email');
    expect(cp.operations).toEqual(['SELECT', 'UPDATE']);
  });

  it('TablePermission has correct shape', () => {
    const tp: TablePermission = {
      table: 'contacts',
      schema: 'public',
      operations: ['SELECT', 'INSERT'],
      columnPermissions: [
        { column: 'id', operations: ['SELECT'] },
        { column: 'name', operations: ['SELECT', 'INSERT'] },
      ],
    };
    expect(tp.table).toBe('contacts');
    expect(tp.schema).toBe('public');
    expect(tp.operations).toEqual(['SELECT', 'INSERT']);
    expect(tp.columnPermissions).toHaveLength(2);
  });

  it('EffectivePermissions has correct shape', () => {
    const ep: EffectivePermissions = {
      role: 'app_viewer',
      tables: [
        {
          table: 'contacts',
          schema: 'public',
          operations: ['SELECT'],
          columnPermissions: [
            { column: 'id', operations: ['SELECT'] },
          ],
        },
      ],
    };
    expect(ep.role).toBe('app_viewer');
    expect(ep.tables).toHaveLength(1);
    expect(ep.tables[0].table).toBe('contacts');
  });
});
