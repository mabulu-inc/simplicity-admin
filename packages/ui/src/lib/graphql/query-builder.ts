// packages/ui/src/lib/graphql/query-builder.ts — GraphQL query/mutation string builders

import type { TableMeta, RelationMeta } from '@simplicity-admin/core';

export interface ListOptions {
  page: number;
  pageSize: number;
  sort?: { column: string; direction: 'asc' | 'desc' };
  filters?: Record<string, unknown>;
}

/**
 * Convert snake_case to camelCase (PostGraphile V5 convention).
 */
function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Convert snake_case to PascalCase.
 */
function toPascalCase(s: string): string {
  const camel = toCamelCase(s);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert snake_case to UPPER_SNAKE_CASE for PostGraphile orderBy enums.
 */
function toOrderByEnum(column: string, direction: 'asc' | 'desc'): string {
  return `${column.toUpperCase()}_${direction.toUpperCase()}`;
}

/**
 * Singularize a table name (simple heuristic for PostGraphile conventions).
 */
function singularize(name: string): string {
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('ses') || name.endsWith('xes') || name.endsWith('zes')) return name.slice(0, -2);
  if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
  return name;
}

/**
 * Get the camelCase column names to include in a query selection set.
 */
function getFieldSelection(table: TableMeta, columns?: string[]): string {
  const cols = columns
    ? table.columns.filter((c) => columns.includes(c.name))
    : table.columns;
  return cols.map((c) => toCamelCase(c.name)).join('\n    ');
}

/**
 * Build a paginated list query for a table.
 * PostGraphile V5 convention: allContacts(first:, offset:, orderBy:)
 */
export function buildListQuery(table: TableMeta, options: ListOptions, columns?: string[]): string {
  const allName = `all${toPascalCase(table.name)}`;
  const offset = (options.page - 1) * options.pageSize;
  const fields = getFieldSelection(table, columns);

  const args: string[] = [`first: ${options.pageSize}`, `offset: ${offset}`];

  if (options.sort) {
    args.push(`orderBy: ${toOrderByEnum(options.sort.column, options.sort.direction)}`);
  }

  return `query {
  ${allName}(${args.join(', ')}) {
    nodes {
      ${fields}
    }
    totalCount
  }
}`;
}

/**
 * Build a detail query for a single record by rowId.
 * PostGraphile V5 convention: contactByRowId(rowId: $rowId)
 */
export function buildDetailQuery(table: TableMeta, relations: RelationMeta[]): string {
  const singular = singularize(table.name);
  const queryName = `${toCamelCase(singular)}ByRowId`;
  const fields = getFieldSelection(table);

  // Build relation subqueries for one-to-many relations where this table is the target
  const relationFields = relations
    .filter((r) => r.type === 'one-to-many')
    .map((r) => {
      const relName = `${toCamelCase(r.fromTable)}By${toPascalCase(r.fromColumns[0])}`;
      return `    ${relName} {
      nodes {
        rowId
      }
    }`;
    })
    .join('\n');

  const allFields = relationFields
    ? `${fields}\n${relationFields}`
    : fields;

  return `query ($rowId: UUID!) {
  ${queryName}(rowId: $rowId) {
    ${allFields}
  }
}`;
}

/**
 * Build a create mutation for a table.
 * PostGraphile V5 convention: createContact(input: { contact: { ... } })
 */
export function buildCreateMutation(table: TableMeta): string {
  const singular = singularize(table.name);
  const mutationName = `create${toPascalCase(singular)}`;
  const inputType = `Create${toPascalCase(singular)}Input!`;
  const fields = getFieldSelection(table);

  return `mutation ($input: ${inputType}) {
  ${mutationName}(input: $input) {
    ${toCamelCase(singular)} {
      ${fields}
    }
  }
}`;
}

/**
 * Build an update mutation for a table.
 * PostGraphile V5 convention: updateContactByRowId(input: { rowId, contactPatch: { ... } })
 */
export function buildUpdateMutation(table: TableMeta): string {
  const singular = singularize(table.name);
  const mutationName = `update${toPascalCase(singular)}ByRowId`;
  const inputType = `Update${toPascalCase(singular)}ByRowIdInput!`;
  const fields = getFieldSelection(table);

  return `mutation ($input: ${inputType}) {
  ${mutationName}(input: $input) {
    ${toCamelCase(singular)} {
      ${fields}
    }
  }
}`;
}

/**
 * Build a delete mutation for a table.
 * PostGraphile V5 convention: deleteContactByRowId(input: { rowId })
 */
export function buildDeleteMutation(table: TableMeta): string {
  const singular = singularize(table.name);
  const mutationName = `delete${toPascalCase(singular)}ByRowId`;
  const inputType = `Delete${toPascalCase(singular)}ByRowIdInput!`;
  const fields = getFieldSelection(table);

  return `mutation ($input: ${inputType}) {
  ${mutationName}(input: $input) {
    ${toCamelCase(singular)} {
      ${fields}
    }
  }
}`;
}
