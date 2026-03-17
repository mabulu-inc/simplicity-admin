// packages/ui/src/lib/nav/builder.ts — Navigation builder

import type { SchemaMeta } from '@mabulu-inc/simplicity-admin-core';
import type { EffectivePermissions } from '@mabulu-inc/simplicity-admin-auth';
import type { NavConfig, NavItem, NavItemConfig } from './types.js';

/** System schemas whose tables should not appear in auto-generated navigation */
const SYSTEM_SCHEMAS = new Set(['simplicity', 'information_schema', 'pg_catalog']);

/**
 * Converts a snake_case table name to Title Case.
 * Example: "deal_products" → "Deal Products"
 */
export function humanizeTableName(tableName: string): string {
  return tableName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Builds a list of NavItems based on schema metadata, optional config, and user permissions.
 * @param basePath - URL prefix for table routes (default: '/admin')
 */
export function buildNavItems(
  meta: SchemaMeta,
  config: NavConfig | undefined,
  permissions: EffectivePermissions,
  basePath = '/admin',
): NavItem[] {
  const permittedTables = new Set(permissions.tables.map((tp) => tp.table));
  const appTables = meta.tables.filter((t) => !SYSTEM_SCHEMAS.has(t.schema));

  if (config?.items && config.items.length > 0) {
    return buildFromConfig(config.items, appTables, permittedTables, permissions.role, basePath, config.defaultIcon);
  }

  return buildAutoNav(appTables, permittedTables, basePath, config?.defaultIcon);
}

function buildAutoNav(
  tables: SchemaMeta['tables'],
  permittedTables: Set<string>,
  basePath: string,
  defaultIcon?: string,
): NavItem[] {
  return tables
    .filter((t) => permittedTables.has(t.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t, index) => ({
      label: humanizeTableName(t.name),
      href: `${basePath}/${t.name}`,
      order: index,
      ...(defaultIcon ? { icon: defaultIcon } : {}),
    }));
}

function buildFromConfig(
  items: NavItemConfig[],
  appTables: SchemaMeta['tables'],
  permittedTables: Set<string>,
  currentRole: string,
  basePath: string,
  defaultIcon?: string,
): NavItem[] {
  const tableNames = new Set(appTables.map((t) => t.name));
  const result: NavItem[] = [];

  for (const item of items) {
    const navItem = resolveConfigItem(item, tableNames, permittedTables, currentRole, basePath, defaultIcon);
    if (navItem) {
      result.push(navItem);
    }
  }

  // Sort by explicit order, preserving config order for equal values
  result.sort((a, b) => a.order - b.order);

  return result;
}

function resolveConfigItem(
  item: NavItemConfig,
  tableNames: Set<string>,
  permittedTables: Set<string>,
  currentRole: string,
  basePath: string,
  defaultIcon?: string,
): NavItem | null {
  // Non-table item (custom href)
  if (!item.table && item.href) {
    if (item.roles && !item.roles.includes(currentRole)) {
      return null;
    }
    return {
      label: item.label ?? '',
      href: item.href,
      order: item.order ?? 0,
      ...(item.icon ? { icon: item.icon } : {}),
      ...(item.group ? { group: item.group } : {}),
    };
  }

  // Table-based item
  if (item.table) {
    // Silently omit non-existent tables
    if (!tableNames.has(item.table)) {
      return null;
    }

    // RBAC check
    if (!permittedTables.has(item.table)) {
      return null;
    }

    // Custom role restriction
    if (item.roles && !item.roles.includes(currentRole)) {
      return null;
    }

    const icon = item.icon ?? defaultIcon;
    return {
      label: item.label ?? humanizeTableName(item.table),
      href: `${basePath}/${item.table}`,
      order: item.order ?? 0,
      ...(icon ? { icon } : {}),
      ...(item.group ? { group: item.group } : {}),
    };
  }

  return null;
}
