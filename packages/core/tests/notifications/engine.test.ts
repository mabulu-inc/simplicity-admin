import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationEngine } from '../../src/notifications/engine.js';
import { evaluateCondition, interpolateTemplate } from '../../src/notifications/rules.js';
import type { ConnectionPool, QueryResult } from '@mabulu-inc/simplicity-admin-core';
import type { DataEvent, EmailProvider, NotificationRule } from '../../src/notifications/types.js';

// ── Helpers ────────────────────────────────────────────────────

function mockPool(overrides: Partial<ConnectionPool> = {}): ConnectionPool {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    withClient: vi.fn(),
    end: vi.fn(),
    ...overrides,
  };
}

function makeRule(overrides: Partial<NotificationRule> = {}): NotificationRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    enabled: true,
    trigger: 'record.created',
    table: 'contacts',
    channels: ['in_app'],
    template: { subject: 'New record', body: 'A record was created' },
    recipients: { type: 'users', userIds: ['user-1'] },
    createdBy: 'admin-1',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<DataEvent> = {}): DataEvent {
  return {
    type: 'record.created',
    table: 'contacts',
    recordId: 'rec-1',
    newValues: { first_name: 'Alice', last_name: 'Smith', status: 'urgent' },
    userId: 'user-1',
    ...overrides,
  };
}

// ── evaluateCondition() ────────────────────────────────────────

describe('evaluateCondition', () => {
  it('handles equality', () => {
    expect(evaluateCondition("status = 'urgent'", { status: 'urgent' })).toBe(true);
    expect(evaluateCondition("status = 'urgent'", { status: 'normal' })).toBe(false);
  });

  it('handles inequality', () => {
    expect(evaluateCondition("status != 'draft'", { status: 'published' })).toBe(true);
    expect(evaluateCondition("status != 'draft'", { status: 'draft' })).toBe(false);
  });

  it('handles greater than', () => {
    expect(evaluateCondition('priority > 5', { priority: 10 })).toBe(true);
    expect(evaluateCondition('priority > 5', { priority: 3 })).toBe(false);
  });

  it('handles less than', () => {
    expect(evaluateCondition('priority < 5', { priority: 3 })).toBe(true);
    expect(evaluateCondition('priority < 5', { priority: 10 })).toBe(false);
  });

  it('handles greater-than-or-equal', () => {
    expect(evaluateCondition('priority >= 5', { priority: 5 })).toBe(true);
    expect(evaluateCondition('priority >= 5', { priority: 4 })).toBe(false);
  });

  it('handles less-than-or-equal', () => {
    expect(evaluateCondition('priority <= 5', { priority: 5 })).toBe(true);
    expect(evaluateCondition('priority <= 5', { priority: 6 })).toBe(false);
  });

  it('returns false for null/undefined field values', () => {
    expect(evaluateCondition("status = 'urgent'", {})).toBe(false);
    expect(evaluateCondition("status = 'urgent'", { status: null })).toBe(false);
  });

  it('throws on invalid condition syntax', () => {
    expect(() => evaluateCondition('nonsense', { a: 1 })).toThrow('Invalid condition syntax');
  });
});

// ── interpolateTemplate() ──────────────────────────────────────

describe('interpolateTemplate', () => {
  it('replaces variables', () => {
    const result = interpolateTemplate('Hello {{first_name}} {{last_name}}', {
      first_name: 'Alice',
      last_name: 'Smith',
    });
    expect(result).toBe('Hello Alice Smith');
  });

  it('handles missing variables with empty string', () => {
    const result = interpolateTemplate('Hello {{first_name}} {{last_name}}', {
      first_name: 'Alice',
    });
    expect(result).toBe('Hello Alice ');
  });

  it('handles null values with empty string', () => {
    const result = interpolateTemplate('Status: {{status}}', { status: null });
    expect(result).toBe('Status: ');
  });

  it('handles no placeholders', () => {
    const result = interpolateTemplate('No placeholders here', { a: 1 });
    expect(result).toBe('No placeholders here');
  });
});

// ── NotificationEngine.processEvent() ──────────────────────────

describe('NotificationEngine', () => {
  let pool: ConnectionPool;
  let engine: NotificationEngine;

  beforeEach(() => {
    pool = mockPool();
    engine = new NotificationEngine(pool);
  });

  describe('processEvent()', () => {
    it('creates notification for matching rule', async () => {
      const rule = makeRule();
      const queryFn = vi.fn()
        // First call: fetch rules
        .mockResolvedValueOnce({ rows: [rule], rowCount: 1 })
        // Second call: insert notification
        .mockResolvedValueOnce({
          rows: [{ id: 'notif-1', userId: 'user-1', channel: 'in_app', subject: 'New record', body: 'A record was created', read: false, ruleId: 'rule-1', createdAt: new Date() }],
          rowCount: 1,
        });

      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.processEvent(makeEvent());

      // Should have fetched rules, then inserted a notification
      expect(queryFn).toHaveBeenCalledTimes(2);
      expect(queryFn.mock.calls[1][0]).toContain('INSERT INTO simplicity_notifications');
    });

    it('skips non-matching conditions', async () => {
      const rule = makeRule({ condition: "status = 'normal'" });
      const queryFn = vi.fn()
        .mockResolvedValueOnce({ rows: [rule], rowCount: 1 });

      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.processEvent(makeEvent({ newValues: { status: 'urgent' } }));

      // Only the rules query, no insert
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('handles field.changed trigger', async () => {
      const rule = makeRule({
        trigger: 'field.changed',
        field: 'status',
      });
      const queryFn = vi.fn()
        .mockResolvedValueOnce({ rows: [rule], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'notif-1' }], rowCount: 1 });

      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.processEvent(makeEvent({
        type: 'record.updated',
        oldValues: { status: 'draft' },
        newValues: { status: 'published' },
      }));

      expect(queryFn).toHaveBeenCalledTimes(2);
      expect(queryFn.mock.calls[1][0]).toContain('INSERT INTO simplicity_notifications');
    });

    it('skips field.changed when field did not change', async () => {
      const rule = makeRule({
        trigger: 'field.changed',
        field: 'status',
      });
      const queryFn = vi.fn()
        .mockResolvedValueOnce({ rows: [rule], rowCount: 1 });

      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.processEvent(makeEvent({
        type: 'record.updated',
        oldValues: { status: 'draft' },
        newValues: { status: 'draft' },
      }));

      // Only the rules query, no insert
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('skips disabled rules (not returned by query)', async () => {
      // Disabled rules are filtered by the SQL WHERE enabled = true,
      // so they never appear in the results
      const queryFn = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.processEvent(makeEvent());

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(queryFn.mock.calls[0][0]).toContain('enabled = true');
    });

    it('interpolates template with event values', async () => {
      const rule = makeRule({
        template: {
          subject: 'New contact: {{first_name}} {{last_name}}',
          body: 'Created by {{userId}}',
        },
      });
      const queryFn = vi.fn()
        .mockResolvedValueOnce({ rows: [rule], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: 'notif-1' }],
          rowCount: 1,
        });

      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.processEvent(makeEvent({
        newValues: { first_name: 'Alice', last_name: 'Smith' },
      }));

      const insertArgs = queryFn.mock.calls[1][1] as unknown[];
      expect(insertArgs[2]).toBe('New contact: Alice Smith'); // subject
    });

    it('skips rules for different tables', async () => {
      const rule = makeRule({ table: 'orders' });
      const queryFn = vi.fn()
        .mockResolvedValueOnce({ rows: [rule], rowCount: 1 });

      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.processEvent(makeEvent({ table: 'contacts' }));

      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('resolves role-based recipients', async () => {
      const rule = makeRule({
        recipients: { type: 'roles', roles: ['app_admin'] },
      });
      const queryFn = vi.fn()
        // Fetch rules
        .mockResolvedValueOnce({ rows: [rule], rowCount: 1 })
        // Resolve role recipients
        .mockResolvedValueOnce({ rows: [{ user_id: 'admin-1' }, { user_id: 'admin-2' }], rowCount: 2 })
        // Insert notification for admin-1
        .mockResolvedValueOnce({ rows: [{ id: 'n-1' }], rowCount: 1 })
        // Insert notification for admin-2
        .mockResolvedValueOnce({ rows: [{ id: 'n-2' }], rowCount: 1 });

      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.processEvent(makeEvent());

      // rules + recipients + 2 inserts = 4
      expect(queryFn).toHaveBeenCalledTimes(4);
    });
  });

  describe('getUnread()', () => {
    it('queries unread notifications for user', async () => {
      const notifications = [
        { id: 'n-1', userId: 'user-1', read: false },
        { id: 'n-2', userId: 'user-1', read: false },
      ];
      const queryFn = vi.fn().mockResolvedValueOnce({ rows: notifications, rowCount: 2 });
      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      const result = await engine.getUnread('user-1');

      expect(result).toHaveLength(2);
      expect(queryFn.mock.calls[0][0]).toContain('read = false');
      expect(queryFn.mock.calls[0][1]).toEqual(['user-1']);
    });
  });

  describe('markRead()', () => {
    it('updates notification to read', async () => {
      const queryFn = vi.fn().mockResolvedValueOnce({ rows: [], rowCount: 1 });
      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.markRead('notif-1');

      expect(queryFn.mock.calls[0][0]).toContain('read = true');
      expect(queryFn.mock.calls[0][1]).toEqual(['notif-1']);
    });
  });

  describe('markAllRead()', () => {
    it('marks all notifications as read for user', async () => {
      const queryFn = vi.fn().mockResolvedValueOnce({ rows: [], rowCount: 3 });
      pool = mockPool({ query: queryFn });
      engine = new NotificationEngine(pool);

      await engine.markAllRead('user-1');

      expect(queryFn.mock.calls[0][0]).toContain('read = true');
      expect(queryFn.mock.calls[0][0]).toContain('user_id = $1');
      expect(queryFn.mock.calls[0][1]).toEqual(['user-1']);
    });
  });
});
