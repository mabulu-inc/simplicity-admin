import { describe, it, expect } from 'vitest';
import { mapPgType } from '@mabulu-inc/simplicity-admin-core';
import type {
  ColumnType,
  ColumnMeta,
  TableMeta,
  RelationMeta,
  EnumMeta,
  SchemaMeta,
} from '@mabulu-inc/simplicity-admin-core';

describe('mapPgType', () => {
  describe('text types', () => {
    it('maps "text" to text', () => {
      expect(mapPgType('text')).toBe('text');
    });

    it('maps "character varying" to varchar', () => {
      expect(mapPgType('character varying')).toBe('varchar');
    });

    it('maps "varchar" to varchar', () => {
      expect(mapPgType('varchar')).toBe('varchar');
    });

    it('maps "character" to char', () => {
      expect(mapPgType('character')).toBe('char');
    });

    it('maps "char" to char', () => {
      expect(mapPgType('char')).toBe('char');
    });
  });

  describe('integer types', () => {
    it('maps "integer" to integer', () => {
      expect(mapPgType('integer')).toBe('integer');
    });

    it('maps "int" to integer', () => {
      expect(mapPgType('int')).toBe('integer');
    });

    it('maps "int4" to integer', () => {
      expect(mapPgType('int4')).toBe('integer');
    });

    it('maps "bigint" to bigint', () => {
      expect(mapPgType('bigint')).toBe('bigint');
    });

    it('maps "int8" to bigint', () => {
      expect(mapPgType('int8')).toBe('bigint');
    });

    it('maps "smallint" to smallint', () => {
      expect(mapPgType('smallint')).toBe('smallint');
    });

    it('maps "int2" to smallint', () => {
      expect(mapPgType('int2')).toBe('smallint');
    });

    it('maps "serial" to serial', () => {
      expect(mapPgType('serial')).toBe('serial');
    });

    it('maps "serial4" to serial', () => {
      expect(mapPgType('serial4')).toBe('serial');
    });

    it('maps "bigserial" to bigserial', () => {
      expect(mapPgType('bigserial')).toBe('bigserial');
    });

    it('maps "serial8" to bigserial', () => {
      expect(mapPgType('serial8')).toBe('bigserial');
    });
  });

  describe('numeric types', () => {
    it('maps "numeric" to numeric', () => {
      expect(mapPgType('numeric')).toBe('numeric');
    });

    it('maps "decimal" to decimal', () => {
      expect(mapPgType('decimal')).toBe('decimal');
    });

    it('maps "real" to real', () => {
      expect(mapPgType('real')).toBe('real');
    });

    it('maps "float4" to real', () => {
      expect(mapPgType('float4')).toBe('real');
    });

    it('maps "double precision" to double', () => {
      expect(mapPgType('double precision')).toBe('double');
    });

    it('maps "float8" to double', () => {
      expect(mapPgType('float8')).toBe('double');
    });
  });

  describe('boolean type', () => {
    it('maps "boolean" to boolean', () => {
      expect(mapPgType('boolean')).toBe('boolean');
    });

    it('maps "bool" to boolean', () => {
      expect(mapPgType('bool')).toBe('boolean');
    });
  });

  describe('date/time types', () => {
    it('maps "date" to date', () => {
      expect(mapPgType('date')).toBe('date');
    });

    it('maps "timestamp without time zone" to timestamp', () => {
      expect(mapPgType('timestamp without time zone')).toBe('timestamp');
    });

    it('maps "timestamp" to timestamp', () => {
      expect(mapPgType('timestamp')).toBe('timestamp');
    });

    it('maps "timestamp with time zone" to timestamptz', () => {
      expect(mapPgType('timestamp with time zone')).toBe('timestamptz');
    });

    it('maps "timestamptz" to timestamptz', () => {
      expect(mapPgType('timestamptz')).toBe('timestamptz');
    });

    it('maps "time without time zone" to time', () => {
      expect(mapPgType('time without time zone')).toBe('time');
    });

    it('maps "time" to time', () => {
      expect(mapPgType('time')).toBe('time');
    });

    it('maps "time with time zone" to timetz', () => {
      expect(mapPgType('time with time zone')).toBe('timetz');
    });

    it('maps "timetz" to timetz', () => {
      expect(mapPgType('timetz')).toBe('timetz');
    });
  });

  describe('uuid type', () => {
    it('maps "uuid" to uuid', () => {
      expect(mapPgType('uuid')).toBe('uuid');
    });
  });

  describe('json types', () => {
    it('maps "json" to json', () => {
      expect(mapPgType('json')).toBe('json');
    });

    it('maps "jsonb" to jsonb', () => {
      expect(mapPgType('jsonb')).toBe('jsonb');
    });
  });

  describe('array type', () => {
    it('maps types ending with "[]" to array', () => {
      expect(mapPgType('integer[]')).toBe('array');
    });

    it('maps "ARRAY" to array', () => {
      expect(mapPgType('ARRAY')).toBe('array');
    });
  });

  describe('unknown types', () => {
    it('returns "unknown" for unrecognized types', () => {
      expect(mapPgType('my_custom_type')).toBe('unknown');
    });

    it('returns "unknown" for empty string', () => {
      expect(mapPgType('')).toBe('unknown');
    });
  });
});

describe('metadata type shapes', () => {
  it('ColumnMeta has required fields', () => {
    const col: ColumnMeta = {
      name: 'id',
      type: 'uuid',
      pgType: 'uuid',
      nullable: false,
      hasDefault: true,
      defaultValue: 'gen_random_uuid()',
      isPrimaryKey: true,
      isGenerated: false,
      comment: null,
    };
    expect(col.name).toBe('id');
    expect(col.type).toBe('uuid');
  });

  it('ColumnMeta supports optional fields', () => {
    const col: ColumnMeta = {
      name: 'tags',
      type: 'array',
      pgType: 'text[]',
      nullable: true,
      hasDefault: false,
      defaultValue: null,
      isPrimaryKey: false,
      isGenerated: false,
      comment: 'Tag list',
      arrayElementType: 'text',
      enumValues: undefined,
      maxLength: undefined,
      precision: undefined,
      scale: undefined,
    };
    expect(col.arrayElementType).toBe('text');
  });

  it('TableMeta has required fields', () => {
    const table: TableMeta = {
      name: 'users',
      schema: 'public',
      columns: [],
      primaryKey: ['id'],
      comment: null,
    };
    expect(table.name).toBe('users');
    expect(table.primaryKey).toEqual(['id']);
  });

  it('RelationMeta has required fields', () => {
    const rel: RelationMeta = {
      name: 'fk_order_customer',
      fromTable: 'orders',
      fromColumns: ['customer_id'],
      toTable: 'customers',
      toColumns: ['id'],
      type: 'many-to-one',
    };
    expect(rel.type).toBe('many-to-one');
  });

  it('EnumMeta has required fields', () => {
    const e: EnumMeta = {
      name: 'status',
      schema: 'public',
      values: ['active', 'inactive'],
    };
    expect(e.values).toHaveLength(2);
  });

  it('SchemaMeta composes tables, relations, enums', () => {
    const meta: SchemaMeta = {
      tables: [],
      relations: [],
      enums: [],
    };
    expect(meta.tables).toEqual([]);
  });
});
