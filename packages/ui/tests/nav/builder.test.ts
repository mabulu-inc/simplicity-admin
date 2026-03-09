import { describe, it, expect } from 'vitest';
import { buildNavItems, humanizeTableName } from '../../src/lib/nav/builder.js';
import type { SchemaMeta, TableMeta } from '@simplicity-admin/core';
import type { EffectivePermissions } from '@simplicity-admin/auth';
import type { NavConfig } from '../../src/lib/nav/types.js';

function makeTable(name: string, schema = 'public'): TableMeta {
  return { name, schema, columns: [], primaryKey: ['id'], comment: null };
}

function makePermissions(role: string, tables: string[]): EffectivePermissions {
  return {
    role,
    tables: tables.map((t) => ({
      table: t,
      schema: 'public',
      operations: ['SELECT' as const],
      columnPermissions: [],
    })),
  };
}

function makeMeta(tableNames: string[], schema = 'public'): SchemaMeta {
  return {
    tables: tableNames.map((n) => makeTable(n, schema)),
    relations: [],
    enums: [],
  };
}

describe('humanizeTableName', () => {
  it('converts snake_case to Title Case', () => {
    expect(humanizeTableName('deal_products')).toBe('Deal Products');
  });

  it('handles single word', () => {
    expect(humanizeTableName('contacts')).toBe('Contacts');
  });

  it('handles multiple underscores', () => {
    expect(humanizeTableName('user_account_settings')).toBe('User Account Settings');
  });
});

describe('buildNavItems', () => {
  it('auto-generates alphabetical nav from schema (B-NAV-001)', () => {
    const meta = makeMeta(['contacts', 'deals', 'products']);
    const perms = makePermissions('app_admin', ['contacts', 'deals', 'products']);

    const items = buildNavItems(meta, undefined, perms);

    expect(items).toHaveLength(3);
    expect(items[0].label).toBe('Contacts');
    expect(items[1].label).toBe('Deals');
    expect(items[2].label).toBe('Products');
    expect(items[0].href).toBe('/admin/contacts');
    expect(items[1].href).toBe('/admin/deals');
    expect(items[2].href).toBe('/admin/products');
  });

  it('humanizes table names for labels (B-NAV-002)', () => {
    const meta = makeMeta(['deal_products']);
    const perms = makePermissions('app_admin', ['deal_products']);

    const items = buildNavItems(meta, undefined, perms);

    expect(items[0].label).toBe('Deal Products');
  });

  it('filters by RBAC permissions (B-NAV-003)', () => {
    const meta = makeMeta(['contacts', 'deals', 'audit_log']);
    const perms = makePermissions('app_viewer', ['contacts', 'deals']);

    const items = buildNavItems(meta, undefined, perms);

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.label)).toEqual(['Contacts', 'Deals']);
  });

  it('applies custom grouping (B-NAV-004)', () => {
    const meta = makeMeta(['contacts', 'deals', 'products']);
    const perms = makePermissions('app_admin', ['contacts', 'deals', 'products']);
    const config: NavConfig = {
      items: [
        { table: 'contacts', group: 'CRM' },
        { table: 'deals', group: 'CRM' },
        { table: 'products', group: 'Catalog' },
      ],
    };

    const items = buildNavItems(meta, config, perms);

    const crmItems = items.filter((i) => i.group === 'CRM');
    const catalogItems = items.filter((i) => i.group === 'Catalog');
    expect(crmItems).toHaveLength(2);
    expect(crmItems.map((i) => i.label)).toContain('Contacts');
    expect(crmItems.map((i) => i.label)).toContain('Deals');
    expect(catalogItems).toHaveLength(1);
    expect(catalogItems[0].label).toBe('Products');
  });

  it('applies custom ordering (B-NAV-005)', () => {
    const meta = makeMeta(['contacts', 'deals']);
    const perms = makePermissions('app_admin', ['contacts', 'deals']);
    const config: NavConfig = {
      items: [
        { table: 'deals', order: 1 },
        { table: 'contacts', order: 2 },
      ],
    };

    const items = buildNavItems(meta, config, perms);

    expect(items[0].label).toBe('Deals');
    expect(items[1].label).toBe('Contacts');
  });

  it('applies custom labels (B-NAV-006)', () => {
    const meta = makeMeta(['contacts']);
    const perms = makePermissions('app_admin', ['contacts']);
    const config: NavConfig = {
      items: [{ table: 'contacts', label: 'People' }],
    };

    const items = buildNavItems(meta, config, perms);

    expect(items[0].label).toBe('People');
  });

  it('applies custom icons (B-NAV-007)', () => {
    const meta = makeMeta(['contacts']);
    const perms = makePermissions('app_admin', ['contacts']);
    const config: NavConfig = {
      items: [{ table: 'contacts', icon: 'users' }],
    };

    const items = buildNavItems(meta, config, perms);

    expect(items[0].icon).toBe('users');
  });

  it('filters by custom role restriction (B-NAV-008)', () => {
    const meta = makeMeta(['settings', 'contacts']);
    const perms = makePermissions('app_editor', ['settings', 'contacts']);
    const config: NavConfig = {
      items: [
        { table: 'settings', roles: ['app_admin'] },
        { table: 'contacts' },
      ],
    };

    const items = buildNavItems(meta, config, perms);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Contacts');
  });

  it('includes non-table items with custom hrefs (B-NAV-009)', () => {
    const meta = makeMeta(['contacts']);
    const perms = makePermissions('app_admin', ['contacts']);
    const config: NavConfig = {
      items: [
        { label: 'Dashboard', href: '/admin/dashboard', icon: 'chart' },
        { table: 'contacts' },
      ],
    };

    const items = buildNavItems(meta, config, perms);

    expect(items).toHaveLength(2);
    const dashboard = items.find((i) => i.label === 'Dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard!.href).toBe('/admin/dashboard');
    expect(dashboard!.icon).toBe('chart');
  });

  it('excludes system schema tables (B-NAV-010)', () => {
    const meta: SchemaMeta = {
      tables: [
        makeTable('contacts', 'public'),
        makeTable('users', 'simplicity'),
        makeTable('tenants', 'simplicity'),
        makeTable('memberships', 'simplicity'),
      ],
      relations: [],
      enums: [],
    };
    const perms = makePermissions('app_admin', [
      'contacts',
      'users',
      'tenants',
      'memberships',
    ]);

    const items = buildNavItems(meta, undefined, perms);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Contacts');
  });

  it('silently omits config items referencing non-existent tables', () => {
    const meta = makeMeta(['contacts']);
    const perms = makePermissions('app_admin', ['contacts']);
    const config: NavConfig = {
      items: [
        { table: 'contacts' },
        { table: 'nonexistent_table' },
      ],
    };

    const items = buildNavItems(meta, config, perms);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Contacts');
  });

  it('applies default icon for auto-generated items', () => {
    const meta = makeMeta(['contacts']);
    const perms = makePermissions('app_admin', ['contacts']);
    const config: NavConfig = { defaultIcon: 'table' };

    const items = buildNavItems(meta, config, perms);

    expect(items[0].icon).toBe('table');
  });
});
