import type { IncomingMessage } from 'node:http';

export interface AuthenticatedRequest extends IncomingMessage {
  user?: {
    userId: string;
    tenantId?: string;
    roles: string[];
    activeRole: string;
    superAdmin: boolean;
    email: string;
  };
}

export function getUserFromRequest(req: IncomingMessage): AuthenticatedRequest['user'] | undefined {
  return (req as AuthenticatedRequest).user;
}
