// packages/ui/src/lib/dashboards/manager.ts — CRUD for dashboards and widgets

import type { ConnectionPool } from '@simplicity-admin/core';
import type { Dashboard, Widget, WidgetLayout } from './types.js';

// ── Row types for DB mapping ────────────────────────────────────

interface DashboardRow {
	id: string;
	name: string;
	slug: string;
	roles: string[];
	is_default: boolean;
	layout: WidgetLayout[];
	created_by: string;
	created_at: Date;
	updated_at: Date;
}

interface WidgetRow {
	id: string;
	type: 'stat' | 'table' | 'chart';
	title: string;
	config: Record<string, unknown>;
	created_at: Date;
	updated_at: Date;
}

// ── Mappers ─────────────────────────────────────────────────────

function toDashboard(row: DashboardRow): Dashboard {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		roles: row.roles,
		isDefault: row.is_default,
		layout: row.layout,
		createdBy: row.created_by,
		createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
		updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
	};
}

function toWidget(row: WidgetRow): Widget {
	return {
		id: row.id,
		type: row.type,
		title: row.title,
		config: row.config as unknown as Widget['config'],
	};
}

// ── Dashboard CRUD ──────────────────────────────────────────────

export async function createDashboard(
	pool: ConnectionPool,
	dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Dashboard> {
	const result = await pool.query<DashboardRow>(
		`INSERT INTO simplicity_dashboards (name, slug, roles, is_default, layout, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING *`,
		[
			dashboard.name,
			dashboard.slug,
			dashboard.roles,
			dashboard.isDefault,
			JSON.stringify(dashboard.layout),
			dashboard.createdBy,
		],
	);
	return toDashboard(result.rows[0]);
}

export async function updateDashboard(
	pool: ConnectionPool,
	id: string,
	updates: Partial<Dashboard>,
): Promise<Dashboard> {
	// Build dynamic SET clause from provided fields
	const fields: string[] = [];
	const values: unknown[] = [];
	let paramIdx = 1;

	if (updates.name !== undefined) {
		fields.push(`name = $${paramIdx++}`);
		values.push(updates.name);
	}
	if (updates.slug !== undefined) {
		fields.push(`slug = $${paramIdx++}`);
		values.push(updates.slug);
	}
	if (updates.roles !== undefined) {
		fields.push(`roles = $${paramIdx++}`);
		values.push(updates.roles);
	}
	if (updates.isDefault !== undefined) {
		fields.push(`is_default = $${paramIdx++}`);
		values.push(updates.isDefault);
	}
	if (updates.layout !== undefined) {
		fields.push(`layout = $${paramIdx++}`);
		values.push(JSON.stringify(updates.layout));
	}

	fields.push(`updated_at = now()`);
	values.push(id);

	const result = await pool.query<DashboardRow>(
		`UPDATE simplicity_dashboards SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
		values,
	);
	return toDashboard(result.rows[0]);
}

export async function deleteDashboard(pool: ConnectionPool, id: string): Promise<void> {
	await pool.query('DELETE FROM simplicity_dashboards WHERE id = $1', [id]);
}

export async function getDashboard(pool: ConnectionPool, id: string): Promise<Dashboard | null> {
	const result = await pool.query<DashboardRow>(
		'SELECT * FROM simplicity_dashboards WHERE id = $1',
		[id],
	);
	return result.rows.length > 0 ? toDashboard(result.rows[0]) : null;
}

export async function listDashboards(
	pool: ConnectionPool,
	role?: string,
): Promise<Dashboard[]> {
	if (role) {
		// Return dashboards that include this role OR have empty roles array (visible to all)
		const result = await pool.query<DashboardRow>(
			`SELECT * FROM simplicity_dashboards
			 WHERE $1 = ANY(roles) OR roles = '{}'::text[]
			 ORDER BY name`,
			[role],
		);
		return result.rows.map(toDashboard);
	}

	const result = await pool.query<DashboardRow>(
		'SELECT * FROM simplicity_dashboards ORDER BY name',
	);
	return result.rows.map(toDashboard);
}

export async function getDefaultDashboard(
	pool: ConnectionPool,
	role: string,
): Promise<Dashboard | null> {
	const result = await pool.query<DashboardRow>(
		`SELECT * FROM simplicity_dashboards
		 WHERE is_default = true AND ($1 = ANY(roles) OR roles = '{}'::text[])
		 ORDER BY created_at ASC
		 LIMIT 1`,
		[role],
	);
	return result.rows.length > 0 ? toDashboard(result.rows[0]) : null;
}

// ── Widget CRUD ─────────────────────────────────────────────────

export async function createWidget(
	pool: ConnectionPool,
	widget: Omit<Widget, 'id'>,
): Promise<Widget> {
	const result = await pool.query<WidgetRow>(
		`INSERT INTO simplicity_widgets (type, title, config)
		 VALUES ($1, $2, $3)
		 RETURNING *`,
		[widget.type, widget.title, JSON.stringify(widget.config)],
	);
	return toWidget(result.rows[0]);
}

export async function updateWidget(
	pool: ConnectionPool,
	id: string,
	updates: Partial<Widget>,
): Promise<Widget> {
	const fields: string[] = [];
	const values: unknown[] = [];
	let paramIdx = 1;

	if (updates.type !== undefined) {
		fields.push(`type = $${paramIdx++}`);
		values.push(updates.type);
	}
	if (updates.title !== undefined) {
		fields.push(`title = $${paramIdx++}`);
		values.push(updates.title);
	}
	if (updates.config !== undefined) {
		fields.push(`config = $${paramIdx++}`);
		values.push(JSON.stringify(updates.config));
	}

	fields.push(`updated_at = now()`);
	values.push(id);

	const result = await pool.query<WidgetRow>(
		`UPDATE simplicity_widgets SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
		values,
	);
	return toWidget(result.rows[0]);
}

export async function deleteWidget(pool: ConnectionPool, id: string): Promise<void> {
	await pool.query('DELETE FROM simplicity_widgets WHERE id = $1', [id]);
}
