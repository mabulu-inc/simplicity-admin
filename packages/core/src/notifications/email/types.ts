// packages/core/src/notifications/email/types.ts — Email provider types

/** Re-export the core EmailProvider interface */
export type { EmailProvider } from '../types.js';

/** SMTP connection configuration */
export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
}
