---
title: Customizing Auth
description: How to swap the built-in auth provider with a custom implementation.
---

SIMPLICITY-ADMIN ships with a JWT + bcrypt auth provider. If you need to integrate with an external identity provider (OIDC, SAML, Auth0, etc.), you can replace it by implementing the `AuthProvider` interface.

## The AuthProvider Interface

```ts
interface AuthProvider {
  sign(payload: object): string;
  verify(token: string): object;
  refresh(token: string): string;
  hashPassword(plain: string): Promise<string>;
  verifyPassword(plain: string, hash: string): Promise<boolean>;
}
```

All five methods are required. SIMPLICITY-ADMIN calls these methods during authentication flows — you control the implementation.

## Example: External OIDC Provider

This example delegates authentication to an external OIDC provider while keeping SIMPLICITY-ADMIN's RBAC system intact.

```ts
// lib/oidc-auth-provider.ts
import type { AuthProvider } from '@mabulu-inc/simplicity-admin-core';
import { jwtVerify, SignJWT } from 'jose';

const OIDC_ISSUER = 'https://auth.example.com';
const OIDC_JWKS_URI = `${OIDC_ISSUER}/.well-known/jwks.json`;

export function createOIDCAuthProvider(secret: string): AuthProvider {
  const secretKey = new TextEncoder().encode(secret);

  return {
    sign(payload) {
      // Issue internal tokens after OIDC validation
      return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(secretKey);
    },

    async verify(token) {
      // First, try verifying as an internal token
      try {
        const { payload } = await jwtVerify(token, secretKey);
        return payload;
      } catch {
        // Fall back to OIDC token verification
        const JWKS = createRemoteJWKSet(new URL(OIDC_JWKS_URI));
        const { payload } = await jwtVerify(token, JWKS, {
          issuer: OIDC_ISSUER,
        });
        return payload;
      }
    },

    refresh(token) {
      // Delegate to OIDC provider's refresh flow
      // or handle internally
      const payload = this.verify(token);
      return this.sign(payload);
    },

    async hashPassword(plain) {
      // Not used when OIDC handles passwords
      throw new Error('Password hashing is managed by the OIDC provider');
    },

    async verifyPassword(plain, hash) {
      // Not used when OIDC handles passwords
      throw new Error('Password verification is managed by the OIDC provider');
    },
  };
}
```

## Register the Custom Provider

Pass your provider in the config:

```ts
// simplicity-admin.config.ts
import { defineConfig } from '@mabulu-inc/simplicity-admin-core';
import { createOIDCAuthProvider } from './lib/oidc-auth-provider';

export default defineConfig({
  database: process.env.DATABASE_URL,
  providers: {
    auth: createOIDCAuthProvider(process.env.SIMPLICITY_ADMIN_AUTH_SECRET),
  },
});
```

SIMPLICITY-ADMIN uses your provider for all authentication operations. The RBAC engine continues to work normally — it resolves roles from the user record in the `_simplicity` schema regardless of how the user was authenticated.
