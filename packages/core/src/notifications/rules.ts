// packages/core/src/notifications/rules.ts — Rule CRUD + condition evaluation

import type { ConnectionPool } from '../providers/types.js';
import type { NotificationRule } from './types.js';

/**
 * Evaluate a simple condition string against a record.
 * Supports: =, !=, >, <, >=, <=
 */
export function evaluateCondition(condition: string, record: Record<string, unknown>): boolean {
  const operators = ['!=', '>=', '<=', '=', '>', '<'] as const;

  for (const op of operators) {
    const idx = condition.indexOf(op);
    if (idx === -1) continue;

    const field = condition.slice(0, idx).trim();
    const rawValue = condition.slice(idx + op.length).trim();
    // Strip surrounding quotes
    const expected = rawValue.replace(/^['"]|['"]$/g, '');
    const actual = record[field];

    if (actual === undefined || actual === null) return false;

    const actualStr = String(actual);

    switch (op) {
      case '=':
        return actualStr === expected;
      case '!=':
        return actualStr !== expected;
      case '>':
        return Number(actual) > Number(expected);
      case '<':
        return Number(actual) < Number(expected);
      case '>=':
        return Number(actual) >= Number(expected);
      case '<=':
        return Number(actual) <= Number(expected);
    }
  }

  throw new Error(`Invalid condition syntax: ${condition}`);
}

/**
 * Interpolate {{field}} placeholders in a template string.
 * Missing fields are replaced with empty string.
 */
export function interpolateTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, field: string) => {
    const val = values[field];
    if (val === undefined || val === null) return '';
    return String(val);
  });
}

export async function createRule(
  pool: ConnectionPool,
  rule: Omit<NotificationRule, 'id' | 'createdAt'>,
): Promise<NotificationRule> {
  const result = await pool.query<NotificationRule>(
    `INSERT INTO simplicity_notification_rules
       (name, enabled, trigger, "table", field, condition, channels, template, recipients, schedule, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      rule.name,
      rule.enabled,
      rule.trigger,
      rule.table ?? null,
      rule.field ?? null,
      rule.condition ?? null,
      JSON.stringify(rule.channels),
      JSON.stringify(rule.template),
      JSON.stringify(rule.recipients),
      rule.schedule ?? null,
      rule.createdBy,
    ],
  );
  return result.rows[0];
}

export async function updateRule(
  pool: ConnectionPool,
  id: string,
  updates: Partial<NotificationRule>,
): Promise<NotificationRule> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  const columnMap: Record<string, string> = {
    name: 'name',
    enabled: 'enabled',
    trigger: 'trigger',
    table: '"table"',
    field: 'field',
    condition: 'condition',
    channels: 'channels',
    template: 'template',
    recipients: 'recipients',
    schedule: 'schedule',
  };

  for (const [key, col] of Object.entries(columnMap)) {
    if (key in updates) {
      const val = updates[key as keyof NotificationRule];
      fields.push(`${col} = $${paramIdx++}`);
      values.push(
        key === 'channels' || key === 'template' || key === 'recipients'
          ? JSON.stringify(val)
          : val ?? null,
      );
    }
  }

  values.push(id);
  const result = await pool.query<NotificationRule>(
    `UPDATE simplicity_notification_rules SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values,
  );
  return result.rows[0];
}

export async function deleteRule(pool: ConnectionPool, id: string): Promise<void> {
  await pool.query('DELETE FROM simplicity_notification_rules WHERE id = $1', [id]);
}

export async function listRules(pool: ConnectionPool): Promise<NotificationRule[]> {
  const result = await pool.query<NotificationRule>('SELECT * FROM simplicity_notification_rules ORDER BY created_at');
  return result.rows;
}
