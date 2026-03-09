import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationEngine } from '../../src/notifications/engine.js';
import { SmtpEmailProvider } from '../../src/notifications/email/provider.js';
import type { ConnectionPool } from '../../src/providers/types.js';
import type { DataEvent, EmailProvider, Notification, NotificationRule } from '../../src/notifications/types.js';

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
    template: { subject: 'New: {{first_name}}', body: 'Record created' },
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
    newValues: { first_name: 'Alice', last_name: 'Smith' },
    userId: 'user-1',
    ...overrides,
  };
}

const savedNotification: Notification = {
  id: 'notif-1',
  userId: 'user-1',
  channel: 'in_app',
  subject: 'New: Alice',
  body: 'Record created',
  read: false,
  ruleId: 'rule-1',
  recordId: 'rec-1',
  tableName: 'contacts',
  createdAt: new Date(),
};

// ── In-App Delivery ────────────────────────────────────────────

describe('In-App notification delivery', () => {
  let pool: ConnectionPool;
  let engine: NotificationEngine;

  it('stores in-app notification and retrieves it via getUnread()', async () => {
    const queryFn = vi.fn()
      // send() → INSERT
      .mockResolvedValueOnce({ rows: [savedNotification], rowCount: 1 })
      // getUnread() → SELECT
      .mockResolvedValueOnce({ rows: [savedNotification], rowCount: 1 });

    pool = mockPool({ query: queryFn });
    engine = new NotificationEngine(pool);

    const sent = await engine.send({
      userId: 'user-1',
      channel: 'in_app',
      subject: 'New: Alice',
      body: 'Record created',
      read: false,
      ruleId: 'rule-1',
      recordId: 'rec-1',
      tableName: 'contacts',
    });

    expect(sent.id).toBe('notif-1');
    expect(sent.channel).toBe('in_app');
    expect(sent.read).toBe(false);

    const unread = await engine.getUnread('user-1');
    expect(unread).toHaveLength(1);
    expect(unread[0].id).toBe('notif-1');
    expect(unread[0].read).toBe(false);
  });

  it('getUnread() returns only unread notifications for the target user', async () => {
    const notifs = [
      { ...savedNotification, id: 'n-1' },
      { ...savedNotification, id: 'n-2' },
    ];
    const queryFn = vi.fn().mockResolvedValueOnce({ rows: notifs, rowCount: 2 });
    pool = mockPool({ query: queryFn });
    engine = new NotificationEngine(pool);

    const result = await engine.getUnread('user-1');

    expect(result).toHaveLength(2);
    expect(queryFn.mock.calls[0][0]).toContain('read = false');
    expect(queryFn.mock.calls[0][0]).toContain('user_id = $1');
    expect(queryFn.mock.calls[0][1]).toEqual(['user-1']);
  });

  it('markRead() updates a single notification status', async () => {
    const queryFn = vi.fn().mockResolvedValueOnce({ rows: [], rowCount: 1 });
    pool = mockPool({ query: queryFn });
    engine = new NotificationEngine(pool);

    await engine.markRead('notif-1');

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryFn.mock.calls[0][0]).toContain('read = true');
    expect(queryFn.mock.calls[0][0]).toContain('WHERE id = $1');
    expect(queryFn.mock.calls[0][1]).toEqual(['notif-1']);
  });

  it('markAllRead() marks all unread notifications for a user', async () => {
    const queryFn = vi.fn().mockResolvedValueOnce({ rows: [], rowCount: 3 });
    pool = mockPool({ query: queryFn });
    engine = new NotificationEngine(pool);

    await engine.markAllRead('user-1');

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryFn.mock.calls[0][0]).toContain('read = true');
    expect(queryFn.mock.calls[0][0]).toContain('user_id = $1');
    expect(queryFn.mock.calls[0][0]).toContain('read = false');
    expect(queryFn.mock.calls[0][1]).toEqual(['user-1']);
  });
});

// ── Email Delivery ─────────────────────────────────────────────

describe('Email notification delivery', () => {
  it('sends email via EmailProvider when channel is email', async () => {
    const mockEmailProvider: EmailProvider = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const queryFn = vi.fn()
      // send() → INSERT notification
      .mockResolvedValueOnce({
        rows: [{ ...savedNotification, channel: 'email' }],
        rowCount: 1,
      })
      // send() → lookup user email
      .mockResolvedValueOnce({
        rows: [{ email: 'alice@example.com' }],
        rowCount: 1,
      });

    const pool = mockPool({ query: queryFn });
    const engine = new NotificationEngine(pool, mockEmailProvider);

    await engine.send({
      userId: 'user-1',
      channel: 'email',
      subject: 'Test Email',
      body: 'Hello Alice',
      read: false,
      ruleId: 'rule-1',
    });

    expect(mockEmailProvider.send).toHaveBeenCalledWith(
      'alice@example.com',
      'Test Email',
      'Hello Alice',
    );
  });

  it('does not send email when channel is in_app', async () => {
    const mockEmailProvider: EmailProvider = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const queryFn = vi.fn()
      .mockResolvedValueOnce({ rows: [savedNotification], rowCount: 1 });

    const pool = mockPool({ query: queryFn });
    const engine = new NotificationEngine(pool, mockEmailProvider);

    await engine.send({
      userId: 'user-1',
      channel: 'in_app',
      subject: 'In App Only',
      body: 'No email',
      read: false,
      ruleId: 'rule-1',
    });

    expect(mockEmailProvider.send).not.toHaveBeenCalled();
  });

  it('does not send email when no email provider configured', async () => {
    const queryFn = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ ...savedNotification, channel: 'email' }],
        rowCount: 1,
      });

    const pool = mockPool({ query: queryFn });
    const engine = new NotificationEngine(pool); // no email provider

    await engine.send({
      userId: 'user-1',
      channel: 'email',
      subject: 'No Provider',
      body: 'Should not throw',
      read: false,
      ruleId: 'rule-1',
    });

    // Should store the notification but not attempt email
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('processEvent sends email for rule with email channel', async () => {
    const mockEmailProvider: EmailProvider = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const rule = makeRule({ channels: ['email'] });
    const queryFn = vi.fn()
      // Fetch rules
      .mockResolvedValueOnce({ rows: [rule], rowCount: 1 })
      // Insert notification
      .mockResolvedValueOnce({
        rows: [{ ...savedNotification, channel: 'email' }],
        rowCount: 1,
      })
      // Lookup user email
      .mockResolvedValueOnce({
        rows: [{ email: 'alice@example.com' }],
        rowCount: 1,
      });

    const pool = mockPool({ query: queryFn });
    const engine = new NotificationEngine(pool, mockEmailProvider);

    await engine.processEvent(makeEvent());

    expect(mockEmailProvider.send).toHaveBeenCalledWith(
      'alice@example.com',
      'New: Alice',
      'Record created',
    );
  });
});

// ── SmtpEmailProvider ──────────────────────────────────────────

describe('SmtpEmailProvider', () => {
  it('constructs without error', () => {
    const provider = new SmtpEmailProvider({
      host: 'smtp.example.com',
      port: 587,
      from: 'noreply@example.com',
      auth: { user: 'user', pass: 'pass' },
    });
    expect(provider).toBeDefined();
    expect(provider.send).toBeInstanceOf(Function);
  });

  it('calls nodemailer sendMail with correct params', async () => {
    const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'abc' });
    const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });

    // Mock nodemailer dynamic import
    vi.doMock('nodemailer', () => ({
      default: { createTransport: mockCreateTransport },
      createTransport: mockCreateTransport,
    }));

    // Re-import to pick up the mock
    const { SmtpEmailProvider: MockedProvider } = await import(
      '../../src/notifications/email/provider.js'
    );

    const provider = new MockedProvider({
      host: 'smtp.test.com',
      port: 465,
      secure: true,
      from: 'admin@test.com',
      auth: { user: 'u', pass: 'p' },
    });

    await provider.send('bob@example.com', 'Subject', '<p>Body</p>');

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.test.com',
      port: 465,
      secure: true,
      auth: { user: 'u', pass: 'p' },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'admin@test.com',
      to: 'bob@example.com',
      subject: 'Subject',
      html: '<p>Body</p>',
    });
  });
});
