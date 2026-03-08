// packages/core/src/metadata/column-types.ts — PostgreSQL type mapping

export type ColumnType =
  | 'text' | 'varchar' | 'char'
  | 'integer' | 'bigint' | 'smallint' | 'serial' | 'bigserial'
  | 'numeric' | 'decimal' | 'real' | 'double'
  | 'boolean'
  | 'date' | 'timestamp' | 'timestamptz' | 'time' | 'timetz'
  | 'uuid'
  | 'json' | 'jsonb'
  | 'enum'
  | 'array'
  | 'unknown';

const PG_TYPE_MAP: Record<string, ColumnType> = {
  // Text
  text: 'text',
  'character varying': 'varchar',
  varchar: 'varchar',
  character: 'char',
  char: 'char',

  // Integer
  integer: 'integer',
  int: 'integer',
  int4: 'integer',
  bigint: 'bigint',
  int8: 'bigint',
  smallint: 'smallint',
  int2: 'smallint',
  serial: 'serial',
  serial4: 'serial',
  bigserial: 'bigserial',
  serial8: 'bigserial',

  // Numeric
  numeric: 'numeric',
  decimal: 'decimal',
  real: 'real',
  float4: 'real',
  'double precision': 'double',
  float8: 'double',

  // Boolean
  boolean: 'boolean',
  bool: 'boolean',

  // Date/time
  date: 'date',
  'timestamp without time zone': 'timestamp',
  timestamp: 'timestamp',
  'timestamp with time zone': 'timestamptz',
  timestamptz: 'timestamptz',
  'time without time zone': 'time',
  time: 'time',
  'time with time zone': 'timetz',
  timetz: 'timetz',

  // UUID
  uuid: 'uuid',

  // JSON
  json: 'json',
  jsonb: 'jsonb',

  // Array
  ARRAY: 'array',
};

/**
 * Maps a raw PostgreSQL type name to a normalized ColumnType.
 * Returns 'unknown' for unrecognized types.
 */
export function mapPgType(pgType: string): ColumnType {
  // Check for array notation (e.g. "integer[]")
  if (pgType.endsWith('[]')) {
    return 'array';
  }

  return PG_TYPE_MAP[pgType] ?? 'unknown';
}
