import type { TokenPayload } from '@mabulu-inc/simplicity-admin-core';

export function createPgSettingsFromToken(payload: TokenPayload): Record<string, string> {
  const settings: Record<string, string> = {
    role: payload.activeRole,
    'app.user_id': payload.userId,
  };

  if (payload.tenantId) {
    settings['app.tenant_id'] = payload.tenantId;
  }

  return settings;
}
