// Server-side database utilities for SvelteKit load functions.
// Provides a cached connection pool and schema metadata.

import { createPool, introspectSchema } from '@mabulu-inc/simplicity-admin-db';
import type { ConnectionPool, SchemaMeta, TableMeta } from '@mabulu-inc/simplicity-admin-core';

const DB_URL =
	process.env.SIMPLICITY_ADMIN_DATABASE ??
	'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

const SCHEMA = process.env.SIMPLICITY_ADMIN_SCHEMA ?? 'public';

let poolInstance: ConnectionPool | null = null;
let metaCache: SchemaMeta | null = null;

export function getPool(): ConnectionPool {
	if (!poolInstance) {
		poolInstance = createPool(DB_URL);
	}
	return poolInstance;
}

export async function getSchemaMeta(): Promise<SchemaMeta> {
	if (!metaCache) {
		metaCache = await introspectSchema(getPool(), SCHEMA);
	}
	return metaCache;
}

export function invalidateMetaCache(): void {
	metaCache = null;
}

export function getTableMeta(meta: SchemaMeta, tableName: string): TableMeta | undefined {
	return meta.tables.find((t) => t.name === tableName);
}

export { SCHEMA };
