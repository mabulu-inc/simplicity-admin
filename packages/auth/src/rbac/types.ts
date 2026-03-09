export type Operation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface TablePermission {
  table: string;
  schema: string;
  operations: Operation[];
  columnPermissions: ColumnPermission[];
}

export interface ColumnPermission {
  column: string;
  operations: Operation[];
}

export interface EffectivePermissions {
  role: string;
  tables: TablePermission[];
}
