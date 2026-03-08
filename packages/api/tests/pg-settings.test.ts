import { describe, it, expect } from 'vitest';
import { createPgSettingsFromToken } from '@simplicity-admin/api';
import type { TokenPayload } from '@simplicity-admin/core';

describe('createPgSettingsFromToken', () => {
  it('maps userId, role, and tenantId to pgSettings keys', () => {
    const payload: TokenPayload = {
      userId: 'abc',
      tenantId: 'xyz',
      roles: ['app_editor'],
      activeRole: 'app_editor',
      authStrategy: 'password',
    };

    const settings = createPgSettingsFromToken(payload);

    expect(settings).toEqual({
      role: 'app_editor',
      'app.user_id': 'abc',
      'app.tenant_id': 'xyz',
    });
  });

  it('omits tenant when not present', () => {
    const payload: TokenPayload = {
      userId: 'abc',
      roles: ['app_viewer'],
      activeRole: 'app_viewer',
      authStrategy: 'password',
    };

    const settings = createPgSettingsFromToken(payload);

    expect(settings).toEqual({
      role: 'app_viewer',
      'app.user_id': 'abc',
    });
    expect(settings).not.toHaveProperty('app.tenant_id');
  });
});
