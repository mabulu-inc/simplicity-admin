// packages/core/src/notifications/engine.ts — NotificationEngine

import type { ConnectionPool } from '../providers/types.js';
import type {
  DataEvent,
  EmailProvider,
  Notification,
  NotificationRule,
} from './types.js';
import { evaluateCondition, interpolateTemplate } from './rules.js';

export class NotificationEngine {
  private pool: ConnectionPool;
  private emailProvider?: EmailProvider;

  constructor(pool: ConnectionPool, emailProvider?: EmailProvider) {
    this.pool = pool;
    this.emailProvider = emailProvider;
  }

  /** Process a data event against all enabled rules */
  async processEvent(event: DataEvent): Promise<void> {
    const result = await this.pool.query<NotificationRule>(
      'SELECT * FROM simplicity_notification_rules WHERE enabled = true',
    );
    const rules = result.rows;

    for (const rule of rules) {
      if (!this.matchesRule(rule, event)) continue;

      const values = event.newValues ?? event.oldValues ?? {};
      const subject = interpolateTemplate(rule.template.subject, values);
      const body = interpolateTemplate(rule.template.body, values);

      // Resolve recipients
      const userIds = await this.resolveRecipients(rule, event);

      for (const userId of userIds) {
        for (const channel of rule.channels) {
          await this.send({
            userId,
            channel,
            subject,
            body,
            read: false,
            ruleId: rule.id,
            recordId: event.recordId,
            tableName: event.table,
          });
        }
      }
    }
  }

  /** Send a notification */
  async send(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const result = await this.pool.query<Notification>(
      `INSERT INTO simplicity_notifications
         (user_id, channel, subject, body, read, rule_id, record_id, table_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        notification.userId,
        notification.channel,
        notification.subject,
        notification.body,
        notification.read,
        notification.ruleId,
        notification.recordId ?? null,
        notification.tableName ?? null,
      ],
    );

    const saved = result.rows[0];

    // If email channel and provider configured, send email
    if (notification.channel === 'email' && this.emailProvider) {
      const emailResult = await this.pool.query<{ email: string }>(
        'SELECT email FROM users WHERE id = $1',
        [notification.userId],
      );
      if (emailResult.rows.length > 0) {
        await this.emailProvider.send(
          emailResult.rows[0].email,
          notification.subject,
          notification.body,
        );
      }
    }

    return saved;
  }

  /** Get unread notifications for a user */
  async getUnread(userId: string): Promise<Notification[]> {
    const result = await this.pool.query<Notification>(
      'SELECT * FROM simplicity_notifications WHERE user_id = $1 AND read = false ORDER BY created_at DESC',
      [userId],
    );
    return result.rows;
  }

  /** Mark a notification as read */
  async markRead(notificationId: string): Promise<void> {
    await this.pool.query(
      'UPDATE simplicity_notifications SET read = true WHERE id = $1',
      [notificationId],
    );
  }

  /** Mark all notifications as read for a user */
  async markAllRead(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE simplicity_notifications SET read = true WHERE user_id = $1 AND read = false',
      [userId],
    );
  }

  private matchesRule(rule: NotificationRule, event: DataEvent): boolean {
    // Check trigger type
    if (rule.trigger === 'field.changed') {
      if (event.type !== 'record.updated') return false;
      if (!rule.field || !event.oldValues || !event.newValues) return false;
      if (event.oldValues[rule.field] === event.newValues[rule.field]) return false;
    } else if (rule.trigger !== event.type) {
      return false;
    }

    // Check table match
    if (rule.table && rule.table !== event.table) return false;

    // Check condition
    if (rule.condition) {
      const values = event.newValues ?? event.oldValues ?? {};
      if (!evaluateCondition(rule.condition, values)) return false;
    }

    return true;
  }

  private async resolveRecipients(rule: NotificationRule, event: DataEvent): Promise<string[]> {
    switch (rule.recipients.type) {
      case 'users':
        return rule.recipients.userIds ?? [];

      case 'roles': {
        if (!rule.recipients.roles?.length) return [];
        const placeholders = rule.recipients.roles.map((_, i) => `$${i + 1}`).join(', ');
        const result = await this.pool.query<{ user_id: string }>(
          `SELECT DISTINCT user_id FROM memberships WHERE role IN (${placeholders})`,
          rule.recipients.roles,
        );
        return result.rows.map((r) => r.user_id);
      }

      case 'field': {
        if (!rule.recipients.field) return [];
        const values = event.newValues ?? {};
        const userId = values[rule.recipients.field];
        return userId ? [String(userId)] : [];
      }

      default:
        return [];
    }
  }
}
