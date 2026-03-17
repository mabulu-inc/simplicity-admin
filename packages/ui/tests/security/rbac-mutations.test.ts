import { describe, it, expect } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import type { ColumnMeta } from '@mabulu-inc/simplicity-admin-core';
import type { TableRbacInfo } from '$lib/server/rbac.js';
import {
	requireAuth,
	requireInsert,
	requireUpdate,
	requireDelete,
	getWritableColumnNames,
} from '$lib/server/rbac-guards.js';

function col(overrides: Partial<ColumnMeta> & { name: string }): ColumnMeta {
	return {
		type: 'text',
		pgType: 'text',
		nullable: false,
		hasDefault: false,
		defaultValue: null,
		isPrimaryKey: false,
		isGenerated: false,
		comment: null,
		...overrides,
	};
}

function makeRbac(overrides: Partial<TableRbacInfo> = {}): TableRbacInfo {
	return {
		visibleColumns: [
			col({ name: 'id', type: 'integer', pgType: 'int4', isPrimaryKey: true, hasDefault: true }),
			col({ name: 'name' }),
			col({ name: 'email', nullable: true }),
		],
		readOnlyColumns: [],
		hiddenColumns: [],
		canInsert: true,
		canUpdate: true,
		canDelete: true,
		...overrides,
	};
}

describe('Server-side RBAC enforcement on mutations', () => {
	describe('requireAuth', () => {
		it('returns the user when authenticated', () => {
			const user = { userId: '1', roles: ['app_admin'], activeRole: 'app_admin', superAdmin: false };
			const result = requireAuth(user);
			expect(result).toBe(user);
		});

		it('throws 401 when user is undefined', () => {
			try {
				requireAuth(undefined);
				expect.fail('should have thrown');
			} catch (err) {
				expect(isHttpError(err, 401)).toBe(true);
			}
		});
	});

	describe('requireInsert', () => {
		it('does not throw when canInsert is true', () => {
			expect(() => requireInsert(makeRbac({ canInsert: true }))).not.toThrow();
		});

		it('throws 403 when canInsert is false', () => {
			try {
				requireInsert(makeRbac({ canInsert: false }));
				expect.fail('should have thrown');
			} catch (err) {
				expect(isHttpError(err, 403)).toBe(true);
			}
		});
	});

	describe('requireUpdate', () => {
		it('does not throw when canUpdate is true', () => {
			expect(() => requireUpdate(makeRbac({ canUpdate: true }))).not.toThrow();
		});

		it('throws 403 when canUpdate is false', () => {
			try {
				requireUpdate(makeRbac({ canUpdate: false }));
				expect.fail('should have thrown');
			} catch (err) {
				expect(isHttpError(err, 403)).toBe(true);
			}
		});
	});

	describe('requireDelete', () => {
		it('does not throw when canDelete is true', () => {
			expect(() => requireDelete(makeRbac({ canDelete: true }))).not.toThrow();
		});

		it('throws 403 when canDelete is false', () => {
			try {
				requireDelete(makeRbac({ canDelete: false }));
				expect.fail('should have thrown');
			} catch (err) {
				expect(isHttpError(err, 403)).toBe(true);
			}
		});
	});

	describe('getWritableColumnNames', () => {
		it('returns visible columns minus read-only columns', () => {
			const rbac = makeRbac({ readOnlyColumns: ['email'] });
			const writable = getWritableColumnNames(rbac);
			expect(writable).toContain('name');
			expect(writable).not.toContain('email');
		});

		it('excludes hidden columns', () => {
			const rbac = makeRbac({
				hiddenColumns: ['secret_field'],
			});
			const writable = getWritableColumnNames(rbac);
			expect(writable).not.toContain('secret_field');
		});

		it('returns empty set when all columns are read-only', () => {
			const rbac = makeRbac({
				readOnlyColumns: ['id', 'name', 'email'],
			});
			const writable = getWritableColumnNames(rbac);
			expect(writable.size).toBe(0);
		});

		it('does not include primary key columns', () => {
			const rbac = makeRbac({ readOnlyColumns: [] });
			const writable = getWritableColumnNames(rbac);
			// id is a primary key, should not be in writable set
			expect(writable).not.toContain('id');
		});
	});
});
