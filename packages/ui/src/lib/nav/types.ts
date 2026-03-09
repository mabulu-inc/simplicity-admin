// packages/ui/src/lib/nav/types.ts — Navigation types

export interface NavItemConfig {
  /** Table name (must match a table in the schema) */
  table?: string;
  /** Display label (defaults to humanized table name) */
  label?: string;
  /** Icon identifier */
  icon?: string;
  /** Group heading (items with same group are grouped together) */
  group?: string;
  /** Sort order within group (lower = higher in list) */
  order?: number;
  /** Custom href (for non-table pages like dashboards) */
  href?: string;
  /** Roles that can see this item (defaults to: any role with SELECT on the table) */
  roles?: string[];
  /** Nested items (one level of nesting) */
  children?: NavItemConfig[];
}

export interface NavConfig {
  /** Custom navigation items. If omitted, auto-generated from schema. */
  items?: NavItemConfig[];
  /** Default icon for auto-generated items */
  defaultIcon?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  group?: string;
  order: number;
  badge?: number;
  children?: NavItem[];
}
