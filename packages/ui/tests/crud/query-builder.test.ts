import { describe, it, expect } from 'vitest';
import type { TableMeta, RelationMeta } from '@mabulu-inc/simplicity-admin-core';
import {
  buildListQuery,
  buildDetailQuery,
  buildCreateMutation,
  buildUpdateMutation,
  buildDeleteMutation,
} from '../../src/lib/graphql/query-builder.js';

// Helper: minimal table metadata for testing
function makeTable(name: string, columns: Partial<TableMeta['columns'][0]>[]): TableMeta {
  return {
    name,
    schema: 'public',
    columns: columns.map((c) => ({
      name: c.name ?? 'id',
      type: c.type ?? 'uuid',
      pgType: c.pgType ?? 'uuid',
      nullable: c.nullable ?? false,
      hasDefault: c.hasDefault ?? false,
      defaultValue: c.defaultValue ?? null,
      isPrimaryKey: c.isPrimaryKey ?? false,
      isGenerated: c.isGenerated ?? false,
      comment: c.comment ?? null,
    })),
    primaryKey: columns.filter((c) => c.isPrimaryKey).map((c) => c.name ?? 'id'),
    comment: null,
  };
}

const contactsTable = makeTable('contacts', [
  { name: 'id', type: 'uuid', isPrimaryKey: true, hasDefault: true },
  { name: 'first_name', type: 'varchar' },
  { name: 'last_name', type: 'varchar' },
  { name: 'email', type: 'varchar' },
]);

const dealsTable = makeTable('deals', [
  { name: 'id', type: 'uuid', isPrimaryKey: true, hasDefault: true },
  { name: 'title', type: 'varchar' },
  { name: 'amount', type: 'numeric' },
  { name: 'contact_id', type: 'uuid' },
]);

const contactRelations: RelationMeta[] = [
  {
    name: 'deals_contact_id_fkey',
    fromTable: 'deals',
    fromColumns: ['contact_id'],
    toTable: 'contacts',
    toColumns: ['id'],
    type: 'one-to-many',
  },
];

describe('buildListQuery', () => {
  it('produces valid GraphQL with pagination args', () => {
    const query = buildListQuery(contactsTable, { page: 1, pageSize: 25 });
    // PostGraphile V5: allContacts(first:, offset:)
    expect(query).toContain('allContacts');
    expect(query).toContain('first: 25');
    expect(query).toContain('offset: 0');
    expect(query).toContain('nodes');
    expect(query).toContain('totalCount');
    // Should include all columns
    expect(query).toContain('id');
    expect(query).toContain('firstName');
    expect(query).toContain('lastName');
    expect(query).toContain('email');
  });

  it('calculates offset from page number', () => {
    const query = buildListQuery(contactsTable, { page: 3, pageSize: 10 });
    expect(query).toContain('offset: 20');
    expect(query).toContain('first: 10');
  });

  it('includes sorting via orderBy', () => {
    const query = buildListQuery(contactsTable, {
      page: 1,
      pageSize: 25,
      sort: { column: 'last_name', direction: 'asc' },
    });
    expect(query).toContain('orderBy');
    expect(query).toContain('LAST_NAME_ASC');
  });

  it('handles descending sort', () => {
    const query = buildListQuery(contactsTable, {
      page: 1,
      pageSize: 25,
      sort: { column: 'first_name', direction: 'desc' },
    });
    expect(query).toContain('FIRST_NAME_DESC');
  });

  it('respects column filtering (only requested columns)', () => {
    const query = buildListQuery(contactsTable, { page: 1, pageSize: 25 }, ['id', 'email']);
    // Should include filtered columns
    expect(query).toContain('id');
    expect(query).toContain('email');
    // Should NOT include excluded columns
    expect(query).not.toContain('firstName');
    expect(query).not.toContain('lastName');
  });
});

describe('buildDetailQuery', () => {
  it('produces valid detail query by rowId', () => {
    const query = buildDetailQuery(contactsTable, []);
    expect(query).toContain('contactByRowId');
    expect(query).toContain('$rowId');
    expect(query).toContain('id');
    expect(query).toContain('firstName');
    expect(query).toContain('lastName');
    expect(query).toContain('email');
  });

  it('includes relation fields', () => {
    const query = buildDetailQuery(contactsTable, contactRelations);
    // One-to-many: deals related to contacts
    expect(query).toContain('dealsByContactId');
    expect(query).toContain('nodes');
  });

  it('handles tables with no relations', () => {
    const query = buildDetailQuery(contactsTable, []);
    expect(query).toContain('contactByRowId');
    expect(query).not.toContain('dealsByContactId');
  });
});

describe('buildCreateMutation', () => {
  it('produces valid create mutation', () => {
    const mutation = buildCreateMutation(contactsTable);
    expect(mutation).toContain('mutation');
    expect(mutation).toContain('createContact');
    expect(mutation).toContain('$input');
    expect(mutation).toContain('contact');
    // Should return all columns
    expect(mutation).toContain('id');
    expect(mutation).toContain('firstName');
  });
});

describe('buildUpdateMutation', () => {
  it('produces valid update mutation', () => {
    const mutation = buildUpdateMutation(contactsTable);
    expect(mutation).toContain('mutation');
    expect(mutation).toContain('updateContactByRowId');
    expect(mutation).toContain('$input');
    expect(mutation).toContain('contact');
    expect(mutation).toContain('id');
  });
});

describe('buildDeleteMutation', () => {
  it('produces valid delete mutation', () => {
    const mutation = buildDeleteMutation(contactsTable);
    expect(mutation).toContain('mutation');
    expect(mutation).toContain('deleteContactByRowId');
    expect(mutation).toContain('$input');
    expect(mutation).toContain('contact');
    expect(mutation).toContain('id');
  });
});

describe('edge cases', () => {
  it('handles tables with no relations', () => {
    const query = buildListQuery(dealsTable, { page: 1, pageSize: 10 });
    expect(query).toContain('allDeals');
    expect(query).toContain('title');
    expect(query).toContain('amount');
  });

  it('handles single-column table', () => {
    const simpleTable = makeTable('tags', [
      { name: 'id', type: 'integer', isPrimaryKey: true, hasDefault: true },
    ]);
    const query = buildListQuery(simpleTable, { page: 1, pageSize: 10 });
    expect(query).toContain('allTags');
    expect(query).toContain('id');
  });
});
