// packages/core/src/metadata/types.ts — Database metadata types

import type { ColumnType } from './column-types.js';

export type { ColumnType } from './column-types.js';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  pgType: string;
  nullable: boolean;
  hasDefault: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isGenerated: boolean;
  enumValues?: string[];
  arrayElementType?: ColumnType;
  comment: string | null;
  maxLength?: number;
  precision?: number;
  scale?: number;
}

export interface TableMeta {
  name: string;
  schema: string;
  columns: ColumnMeta[];
  primaryKey: string[];
  comment: string | null;
}

export interface RelationMeta {
  name: string;
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  type: 'many-to-one' | 'one-to-many';
}

export interface EnumMeta {
  name: string;
  schema: string;
  values: string[];
}

export interface SchemaMeta {
  tables: TableMeta[];
  relations: RelationMeta[];
  enums: EnumMeta[];
}
