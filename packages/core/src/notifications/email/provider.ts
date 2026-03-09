// packages/core/src/notifications/email/provider.ts — Default SMTP EmailProvider

import type { Transporter } from 'nodemailer';
import type { EmailProvider } from '../types.js';
import type { SmtpConfig } from './types.js';

/**
 * SMTP-based email provider using nodemailer.
 *
 * Lazily imports nodemailer so it remains an optional peer dependency —
 * consumers who only use in-app notifications don't need it installed.
 */
export class SmtpEmailProvider implements EmailProvider {
  private config: SmtpConfig;
  private transporter: Transporter | null = null;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    const transport = await this.getTransporter();
    await transport.sendMail({
      from: this.config.from,
      to,
      subject,
      html: body,
    });
  }

  private async getTransporter(): Promise<Transporter> {
    if (!this.transporter) {
      const nodemailer = await import('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure ?? false,
        auth: this.config.auth,
      });
    }
    return this.transporter;
  }
}
