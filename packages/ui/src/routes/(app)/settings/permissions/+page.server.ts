import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSchemaMeta, getPool, SCHEMA } from '$lib/server/db.js';
import {
	getEffectivePermissions,
	listOverrides,
	mergeOverrides,
	saveOverride,
	removeOverride,
} from '@simplicity-admin/auth';
import type { Operation, PermissionOverride } from '@simplicity-admin/auth';

/** The functional roles that can be managed via the permissions UI */
const MANAGEABLE_ROLES = ['app_viewer', 'app_editor', 'app_admin'] as const;

/** System schemas whose tables are excluded from the permissions matrix */
const SYSTEM_SCHEMAS = new Set(['simplicity', 'information_schema', 'pg_catalog', 'simplicity_admin']);

export interface PermissionsPageData {
	roles: string[];
	selectedRole: string;
	tables: TablePermissionRow[];
	overrides: PermissionOverride[];
}

export interface TablePermissionRow {
	table: string;
	operations: Record<Operation, boolean>;
	columns: ColumnPermissionRow[];
}

export interface ColumnPermissionRow {
	column: string;
	operations: Record<Operation, boolean>;
	/** Code-defined ceiling — what the column CAN have (before overrides) */
	ceiling: Record<Operation, boolean>;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	// Only admins can manage permissions
	if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
		throw error(403, 'Only admins can manage permissions');
	}

	const selectedRole = url.searchParams.get('role') ?? 'app_viewer';
	const pool = getPool();
	const meta = await getSchemaMeta();

	// Get code-defined permissions (before overrides)
	const codePerms = await getEffectivePermissions(pool, selectedRole, SCHEMA);

	// Get UI overrides
	const overrides = await listOverrides(pool, selectedRole);

	// Get merged (effective) permissions
	const effectivePerms = mergeOverrides(codePerms, overrides);

	// Filter to app tables only
	const appTables = meta.tables.filter((t) => !SYSTEM_SCHEMAS.has(t.schema));

	const tables: TablePermissionRow[] = appTables.map((tableMeta) => {
		const codeTp = codePerms.tables.find((tp) => tp.table === tableMeta.name);
		const effectiveTp = effectivePerms.tables.find((tp) => tp.table === tableMeta.name);

		const ops: Operation[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
		const tableOps: Record<Operation, boolean> = {} as Record<Operation, boolean>;
		for (const op of ops) {
			tableOps[op] = effectiveTp?.operations.includes(op) ?? false;
		}

		const columns: ColumnPermissionRow[] = tableMeta.columns.map((col) => {
			const codeCp = codeTp?.columnPermissions.find((cp) => cp.column === col.name);
			const effectiveCp = effectiveTp?.columnPermissions.find((cp) => cp.column === col.name);

			const colOps: Record<Operation, boolean> = {} as Record<Operation, boolean>;
			const ceiling: Record<Operation, boolean> = {} as Record<Operation, boolean>;
			for (const op of ops) {
				colOps[op] = effectiveCp?.operations.includes(op) ?? false;
				ceiling[op] = codeCp?.operations.includes(op) ?? false;
			}

			return { column: col.name, operations: colOps, ceiling };
		});

		return { table: tableMeta.name, operations: tableOps, columns };
	});

	return {
		roles: [...MANAGEABLE_ROLES],
		selectedRole,
		tables,
		overrides,
	} satisfies PermissionsPageData;
};

export const actions: Actions = {
	toggle: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can manage permissions');
		}

		const formData = await request.formData();
		const role = formData.get('role') as string;
		const table = formData.get('table') as string;
		const column = (formData.get('column') as string) || undefined;
		const operation = formData.get('operation') as Operation;
		const action = formData.get('action') as 'deny' | 'restore';

		if (!role || !table || !operation) {
			throw error(400, 'Missing required fields');
		}

		const pool = getPool();

		if (action === 'deny') {
			await saveOverride(pool, {
				role,
				table,
				column,
				operation,
				denied: true,
				createdBy: locals.user.userId,
			});
		} else {
			// Find and remove the matching override
			const overrides = await listOverrides(pool, role);
			const match = overrides.find(
				(o) =>
					o.table === table &&
					(o.column ?? undefined) === column &&
					o.operation === operation,
			);
			if (match) {
				await removeOverride(pool, match.id);
			}
		}

		return { success: true };
	},
};
