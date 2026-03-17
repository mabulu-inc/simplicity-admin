# Authentication Module Specification

**PRD Reference:** §5 (US-003), §6 (NFR-005)

## Overview

The auth module (`@mabulu-inc/simplicity-admin-auth`) provides multi-strategy authentication and JWT token management. Multiple authentication strategies can be active simultaneously — for example, email/password + Twilio Verify OTP + Office 365 OAuth. Strategies are configurable at the app level and optionally per-tenant (e.g., tenant A uses Google Workspace OAuth, tenant B uses Office 365). The token layer (JWT sign/verify/refresh) is constant; only the identity verification method varies.

## Package Location

- Package: `@mabulu-inc/simplicity-admin-auth`
- Source: `packages/auth/src/`
- Tests: `packages/auth/tests/`

## Dependencies

- `@mabulu-inc/simplicity-admin-core` — provider interfaces (TokenProvider, AuthStrategy), config types
- `@mabulu-inc/simplicity-admin-db` — connection pool (to query users/memberships/strategy configs)
- `jsonwebtoken` — JWT sign/verify
- `bcrypt` — password hashing (for password strategy)

## Public API

### Token Provider (JWT)

```typescript
// packages/auth/src/token/jwt.ts

export function jwtTokenProvider(config?: AuthConfig): TokenProvider;
```

### Strategy Registry

```typescript
// packages/auth/src/strategies/registry.ts

export class StrategyRegistry {
  /** Register a strategy (app-level) */
  register(strategy: AuthStrategy): void;

  /** Get all registered strategies */
  getAll(): AuthStrategy[];

  /** Get strategy by type (e.g., 'password', 'oauth:office365') */
  get(type: string): AuthStrategy;

  /** Get strategies available for a specific tenant */
  getForTenant(tenantId: string, pool: ConnectionPool): Promise<AuthStrategy[]>;
}

export function createStrategyRegistry(configs: AuthStrategyConfig[]): StrategyRegistry;
```

### Built-in Strategies

```typescript
// packages/auth/src/strategies/password.ts
export function passwordStrategy(): AuthStrategy;

// packages/auth/src/strategies/oauth.ts
export function oauthStrategy(config: OAuthStrategyConfig): AuthStrategy;

export interface OAuthStrategyConfig {
  provider: string;           // 'office365' | 'google' | 'github' | custom
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  callbackUrl?: string;
  /** Display name override (defaults to provider name) */
  displayName?: string;
}

// packages/auth/src/strategies/otp.ts
export function otpStrategy(config: OTPStrategyConfig): AuthStrategy;

export interface OTPStrategyConfig {
  provider: string;           // 'twilio' | custom
  accountSid?: string;        // Twilio
  authToken?: string;         // Twilio
  serviceSid?: string;        // Twilio Verify service SID
}
```

### Per-Tenant Strategy Configuration

```typescript
// packages/auth/src/strategies/tenant-config.ts

export interface TenantStrategyConfig {
  id: string;
  tenantId: string;
  strategyType: string;       // e.g., 'oauth:google'
  enabled: boolean;
  config: Record<string, unknown>;  // Provider-specific (clientId, clientSecret, scopes, etc.)
  createdBy: string;
  createdAt: Date;
}

/** Save or update a tenant's strategy config (admin only) */
export function saveTenantStrategyConfig(
  pool: ConnectionPool,
  tenantId: string,
  config: Omit<TenantStrategyConfig, 'id' | 'createdAt'>
): Promise<TenantStrategyConfig>;

/** List strategy configs for a tenant */
export function listTenantStrategyConfigs(
  pool: ConnectionPool,
  tenantId: string
): Promise<TenantStrategyConfig[]>;

/** Remove a tenant's strategy config */
export function removeTenantStrategyConfig(
  pool: ConnectionPool,
  configId: string
): Promise<void>;
```

### Password Utilities

```typescript
// packages/auth/src/strategies/password.ts

export function hashPassword(plain: string): Promise<string>;
export function verifyPassword(plain: string, hash: string): Promise<boolean>;
```

### Auth Middleware

```typescript
// packages/auth/src/middleware.ts

export function createAuthMiddleware(
  tokenProvider: TokenProvider,
  pool: ConnectionPool,
  config: ProjectConfig
): HttpMiddleware;

export type HttpMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) => void | Promise<void>;
```

### Auth Routes

```typescript
// packages/auth/src/routes/strategies.ts
/** Returns available strategies for the current tenant (drives login page UI) */
export function createStrategiesHandler(registry: StrategyRegistry, pool: ConnectionPool): HttpHandler;

// packages/auth/src/routes/login.ts
/** Handles direct credential strategies (password, OTP) */
export function createLoginHandler(
  registry: StrategyRegistry,
  tokenProvider: TokenProvider,
  pool: ConnectionPool
): HttpHandler;

// packages/auth/src/routes/oauth.ts
/** Initiates OAuth redirect for a given provider */
export function createOAuthStartHandler(registry: StrategyRegistry, pool: ConnectionPool): HttpHandler;
/** Handles OAuth callback, provisions user if needed, issues tokens */
export function createOAuthCallbackHandler(
  registry: StrategyRegistry,
  tokenProvider: TokenProvider,
  pool: ConnectionPool
): HttpHandler;

// packages/auth/src/routes/otp.ts
/** Sends OTP to phone/email */
export function createOTPSendHandler(registry: StrategyRegistry, pool: ConnectionPool): HttpHandler;
/** Verifies OTP code and issues tokens */
export function createOTPVerifyHandler(
  registry: StrategyRegistry,
  tokenProvider: TokenProvider,
  pool: ConnectionPool
): HttpHandler;

// packages/auth/src/routes/logout.ts
export function createLogoutHandler(tokenProvider: TokenProvider, pool: ConnectionPool): HttpHandler;

// packages/auth/src/routes/refresh.ts
export function createRefreshHandler(tokenProvider: TokenProvider): HttpHandler;

// packages/auth/src/routes/switch-role.ts
export function createSwitchRoleHandler(tokenProvider: TokenProvider, pool: ConnectionPool): HttpHandler;

// packages/auth/src/routes/switch-tenant.ts
export function createSwitchTenantHandler(tokenProvider: TokenProvider, pool: ConnectionPool): HttpHandler;
```

### Request Context

```typescript
// packages/auth/src/context.ts

export interface AuthenticatedRequest extends IncomingMessage {
  user?: {
    userId: string;
    tenantId?: string;        // Undefined when super-admin is in global mode
    roles: string[];          // All roles assigned to this user
    activeRole: string;       // Currently selected role (drives RBAC/UI)
    superAdmin: boolean;      // System-level flag — bypasses tenant membership
    email: string;
  };
}

export function getUserFromRequest(req: IncomingMessage): AuthenticatedRequest['user'] | undefined;
```

## Behavior Specification

### Token Provider

### B-AUTH-001: JWT Sign
**Given** a payload `{ userId: "abc", roles: ["app_editor", "app_viewer"], activeRole: "app_editor" }`
**When** `tokenProvider.sign(payload)` is called
**Then** returns a valid JWT string that can be decoded to the original payload

### B-AUTH-002: JWT Verify — Valid Token
**Given** a JWT signed with the configured secret
**When** `tokenProvider.verify(token)` is called
**Then** returns the decoded `TokenPayload`

### B-AUTH-003: JWT Verify — Expired Token
**Given** a JWT with an expiry time in the past
**When** `tokenProvider.verify(token)` is called
**Then** throws an `AuthError` with code `AUTH_002`

### B-AUTH-004: JWT Verify — Invalid Signature
**Given** a JWT signed with a different secret
**When** `tokenProvider.verify(token)` is called
**Then** throws an `AuthError` with code `AUTH_003`

### B-AUTH-005: JWT Refresh
**Given** a valid refresh token
**When** `tokenProvider.refresh(refreshToken)` is called
**Then** returns a new `TokenPair` with fresh access and refresh tokens

### B-AUTH-006: JWT Refresh — Expired Refresh Token
**Given** an expired refresh token
**When** `tokenProvider.refresh(refreshToken)` is called
**Then** throws an `AuthError` with code `AUTH_004`

### Password Strategy

### B-AUTH-007: Password Hash
**Given** a plain text password "MyP@ssw0rd"
**When** `hashPassword("MyP@ssw0rd")` is called
**Then** returns a bcrypt hash (starts with "$2b$") that is NOT the plain text

### B-AUTH-008: Password Verify — Correct
**Given** a hash produced by `hashPassword("MyP@ssw0rd")`
**When** `verifyPassword("MyP@ssw0rd", hash)` is called
**Then** returns `true`

### B-AUTH-009: Password Verify — Incorrect
**Given** a hash produced by `hashPassword("MyP@ssw0rd")`
**When** `verifyPassword("WrongPassword", hash)` is called
**Then** returns `false`

### Auth Middleware

### B-AUTH-010: Auth Middleware — Valid Token
**Given** a request with `Authorization: Bearer <valid-jwt>`
**When** the auth middleware processes the request
**Then** `req.user` is populated with the decoded payload and `next()` is called

### B-AUTH-011: Auth Middleware — Missing Token
**Given** a request with no Authorization header
**When** the auth middleware processes the request
**Then** `req.user` is `undefined` and `next()` is called (allows public routes to work)

### B-AUTH-012: Auth Middleware — Invalid Token
**Given** a request with `Authorization: Bearer <invalid-jwt>`
**When** the auth middleware processes the request
**Then** responds with 401 and JSON `{ error: "Invalid token" }`

### Strategy Discovery

### B-AUTH-040: Available Strategies — Default
**Given** no `auth.strategies` configured
**When** GET `/auth/strategies`
**Then** responds with `[{ type: "password", displayName: "Email & Password" }]`

### B-AUTH-041: Available Strategies — Multiple
**Given** config has strategies: password + OAuth (Office 365) + OTP (Twilio)
**When** GET `/auth/strategies`
**Then** responds with all three strategies including their `type`, `displayName`, and `icon`

### B-AUTH-042: Available Strategies — Per-Tenant Filtering
**Given** app-level strategies: password + OAuth (Google, `tenantConfigurable: true`)
**And** tenant Acme has configured their own Google OAuth credentials
**And** tenant Globex has NOT configured Google OAuth
**When** GET `/auth/strategies` on Globex's URL (e.g., `globex.app.com/auth/strategies`)
**Then** responds with `[{ type: "password", ... }]` only — Google OAuth is excluded because Globex hasn't configured it. The tenant is resolved from the URL, not a query parameter.

### B-AUTH-043: Available Strategies — Tenant With Custom OAuth
**Given** tenant Acme has configured Google OAuth via the admin settings
**When** GET `/auth/strategies` on Acme's URL (e.g., `acme.app.com/auth/strategies`)
**Then** responds with `[{ type: "password", ... }, { type: "oauth:google", displayName: "Sign in with Google", ... }]`

### Login — Password Strategy

### B-AUTH-013: Login — Valid Credentials
**Given** a user with email "alice@example.com" and password "password123" exists in the database
**When** POST `/auth/login` with body `{ strategy: "password", email: "alice@example.com", password: "password123" }`
**Then** responds with 200 and `{ accessToken: "...", refreshToken: "..." }`

### B-AUTH-014: Login — Invalid Email
**Given** no user with email "unknown@example.com" exists
**When** POST `/auth/login` with body `{ strategy: "password", email: "unknown@example.com", password: "..." }`
**Then** responds with 401 and `{ error: "Invalid credentials" }` (same message as wrong password — no email enumeration)

### B-AUTH-015: Login — Invalid Password
**Given** a user with email "alice@example.com" exists but password is wrong
**When** POST `/auth/login` with body `{ strategy: "password", email: "alice@example.com", password: "wrong" }`
**Then** responds with 401 and `{ error: "Invalid credentials" }`

### B-AUTH-016: Login — Includes Roles and Tenant
**Given** user Alice has memberships to tenant T with roles `app_editor` and `app_viewer`
**When** Alice logs in (via any strategy)
**Then** the JWT payload includes `tenantId: T.id`, `roles: ["app_editor", "app_viewer"]`, and `activeRole: "app_editor"` (highest-privilege role is the default)

### Login — OAuth Strategy

### B-AUTH-044: OAuth — Initiate
**Given** OAuth strategy 'office365' is configured
**When** GET `/auth/oauth/office365`
**Then** responds with 302 redirect to the Office 365 authorization URL with correct `client_id`, `scope`, `redirect_uri`, and `state`

### B-AUTH-045: OAuth — Callback — Existing User
**Given** user Alice (alice@example.com) exists and Office 365 returns her identity
**When** GET `/auth/oauth/office365/callback?code=<auth-code>&state=<state>`
**Then** matches Alice by email, issues a token pair, and redirects to the admin UI with tokens

### B-AUTH-046: OAuth — Callback — New User (Auto-Provision)
**Given** no user with email "bob@example.com" exists and Office 365 returns Bob's identity
**When** GET `/auth/oauth/office365/callback?code=<auth-code>&state=<state>`
**Then** creates a new user record from the OAuth profile, assigns default role in the resolved tenant, issues a token pair, and redirects to the admin UI

### B-AUTH-047: OAuth — Callback — Tenant-Scoped Credentials
**Given** tenant Acme has configured their own Google OAuth client ID/secret
**When** a user in tenant Acme initiates OAuth via GET `/auth/oauth/google?tenantId=<acme-id>`
**Then** the authorization URL uses Acme's client ID and scopes, NOT the app-level defaults

### B-AUTH-048: OAuth — Unknown Provider
**Given** no OAuth strategy registered for provider 'linkedin'
**When** GET `/auth/oauth/linkedin`
**Then** responds with 404 and `{ error: "Unknown auth provider" }`

### Login — OTP Strategy

### B-AUTH-049: OTP — Send Code
**Given** OTP strategy (Twilio Verify) is configured
**When** POST `/auth/otp/send` with body `{ channel: "sms", to: "+15551234567" }`
**Then** sends a verification code via Twilio and responds with 200 and `{ sent: true }`

### B-AUTH-050: OTP — Verify — Valid Code
**Given** a verification code was sent to "+15551234567"
**When** POST `/auth/otp/verify` with body `{ to: "+15551234567", code: "123456" }`
**Then** verifies the code, matches/provisions the user by phone number, issues a token pair

### B-AUTH-051: OTP — Verify — Invalid Code
**Given** a verification code was sent to "+15551234567"
**When** POST `/auth/otp/verify` with body `{ to: "+15551234567", code: "000000" }`
**Then** responds with 401 and `{ error: "Invalid verification code" }`

### B-AUTH-052: Login — Strategy Not Available
**Given** only the password strategy is configured
**When** POST `/auth/login` with body `{ strategy: "otp", ... }`
**Then** responds with 400 and `{ error: "Strategy 'otp' is not available" }`

### Per-Tenant Strategy Configuration

### B-AUTH-053: Save Tenant Strategy Config
**Given** app-level OAuth Google strategy has `tenantConfigurable: true`
**When** tenant admin for Acme saves `{ strategyType: "oauth:google", config: { clientId: "...", clientSecret: "..." } }`
**Then** the config is persisted in the `auth_strategy_configs` system table

### B-AUTH-054: Tenant Strategy Config — Non-Configurable Strategy
**Given** app-level password strategy does NOT have `tenantConfigurable: true`
**When** tenant admin attempts to save a tenant strategy config for type "password"
**Then** responds with 400 and `{ error: "Strategy 'password' is not tenant-configurable" }`

### B-AUTH-055: Tenant Strategy Config — Cascades on Tenant Switch
**Given** user switches from tenant Acme (has Google OAuth) to tenant Globex (no Google OAuth)
**When** the login page reloads for Globex
**Then** Google OAuth button is no longer shown

### B-AUTH-017: Logout
**Given** a valid refresh token
**When** POST `/auth/logout` with body `{ refreshToken: "..." }`
**Then** invalidates the refresh token (subsequent refresh attempts fail) and responds with 200

### B-AUTH-018: Refresh Route
**Given** a valid refresh token
**When** POST `/auth/refresh` with body `{ refreshToken: "..." }`
**Then** responds with 200 and new `{ accessToken: "...", refreshToken: "..." }`

### B-AUTH-019: Switch Role — Valid
**Given** user Alice has roles `["app_admin", "app_editor", "app_viewer"]` and is currently using `app_admin`
**When** POST `/auth/switch-role` with body `{ role: "app_viewer" }` and a valid access token
**Then** responds with 200 and a new `{ accessToken: "...", refreshToken: "..." }` where the JWT has `activeRole: "app_viewer"` and `roles` unchanged

### B-AUTH-020: Switch Role — Role Not Assigned
**Given** user Bob has roles `["app_viewer"]`
**When** POST `/auth/switch-role` with body `{ role: "app_admin" }` and a valid access token
**Then** responds with 403 and `{ error: "Role not assigned to user" }`

### B-AUTH-021: Switch Role — Already Active
**Given** user Alice has `activeRole: "app_editor"`
**When** POST `/auth/switch-role` with body `{ role: "app_editor" }`
**Then** responds with 200 and a fresh token pair (idempotent, no error)

### B-AUTH-022: Login — Single Role User
**Given** user Bob has exactly one role `app_viewer`
**When** Bob logs in
**Then** the JWT payload includes `roles: ["app_viewer"]` and `activeRole: "app_viewer"`

### B-AUTH-023: Switch Tenant — Valid
**Given** user Alice has memberships in tenants Acme (id: A) and Globex (id: G), currently active tenant is A
**And** Alice authenticated with strategy "password" which is available in both tenants
**When** POST `/auth/switch-tenant` with body `{ tenantId: "G" }` and a valid access token
**Then** responds with 200 and a new `{ accessToken: "...", refreshToken: "..." }` where the JWT has `tenantId: "G"` and `roles` reflects Alice's roles in tenant G

### B-AUTH-024: Switch Tenant — No Membership
**Given** user Bob has a membership only in tenant Acme
**When** POST `/auth/switch-tenant` with body `{ tenantId: "G" }` and a valid access token
**Then** responds with 403 and `{ error: "Not a member of requested tenant" }`

### B-AUTH-025: Switch Tenant — Roles Reload
**Given** Alice has role `app_admin` in tenant Acme but only `app_viewer` in tenant Globex
**When** Alice switches from Acme to Globex
**Then** the new JWT has `roles: ["app_viewer"]`, `activeRole: "app_viewer"`, and `tenantId: "G"` — roles are always scoped to the active tenant

### B-AUTH-056: Switch Tenant — Strategy Not Available in Target
**Given** Alice authenticated with strategy "oauth:office365" in tenant Acme
**And** tenant Globex does NOT have the "oauth:office365" strategy configured
**When** POST `/auth/switch-tenant` with body `{ tenantId: "G" }`
**Then** responds with 403 and `{ error: "Your authentication method is not available in the target tenant. Please sign out and sign in to that tenant directly." }`

### B-AUTH-026: Login — Multi-Tenant User
**Given** user Alice has memberships in tenants Acme and Globex
**When** Alice logs in
**Then** the JWT `tenantId` is set to the first tenant (or most-recently-used), and the UI can fetch the full tenant list via `listTenantsForUser()`

### B-AUTH-027: Login — Super-Admin
**Given** user SuperSam has `super_admin: true` on their user record
**When** SuperSam logs in
**Then** the JWT includes `superAdmin: true`, `roles: ["app_admin"]`, `activeRole: "app_admin"`, and `tenantId` set to the default tenant (super-admins always start in a tenant context, not global)

### B-AUTH-028: Switch Tenant — Super-Admin (No Membership Required)
**Given** SuperSam is a super-admin and tenant Globex exists but SuperSam has no membership in Globex
**When** POST `/auth/switch-tenant` with body `{ tenantId: "G" }`
**Then** responds with 200 and a new token pair with `tenantId: "G"`, `roles: ["app_admin"]`, `activeRole: "app_admin"` — super-admins bypass both membership and strategy-availability checks

### B-AUTH-029: Switch Tenant — Super-Admin Global Mode
**Given** SuperSam is a super-admin
**When** POST `/auth/switch-tenant` with body `{ tenantId: null }`
**Then** responds with 200 and a new token pair with `tenantId: undefined` — enables cross-tenant data access (RLS super-admin bypass is active, no tenant filter)

### B-AUTH-030: Switch Tenant — Non-Super-Admin Cannot Enter Global Mode
**Given** user Alice is NOT a super-admin
**When** POST `/auth/switch-tenant` with body `{ tenantId: null }`
**Then** responds with 403 and `{ error: "Global mode requires super-admin privileges" }`

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Missing auth secret in production | AuthError | AUTH_001 | Throw on startup: "auth.secret is required in production" |
| Token expired | AuthError | AUTH_002 | 401 response |
| Invalid token signature | AuthError | AUTH_003 | 401 response |
| Refresh token expired/invalid | AuthError | AUTH_004 | 401 response |
| Invalid credentials | AuthError | AUTH_005 | 401 response (same message for wrong email or password) |
| Unknown strategy type | AuthError | AUTH_006 | 400 response: "Strategy 'X' is not available" |
| Unknown OAuth provider | AuthError | AUTH_007 | 404 response: "Unknown auth provider" |
| OAuth callback failed | AuthError | AUTH_008 | 401 response with provider error detail |
| Invalid OTP code | AuthError | AUTH_009 | 401 response: "Invalid verification code" |
| Strategy not tenant-configurable | AuthError | AUTH_010 | 400 response |
| OAuth state mismatch (CSRF) | AuthError | AUTH_011 | 403 response: "Invalid state parameter" |

## Security Considerations

- NEVER differentiate between "email not found" and "wrong password" in responses (prevents email enumeration)
- bcrypt cost factor must be 12 or higher
- JWT secret must be at least 32 characters in production
- Refresh tokens must be stored hashed in the database (not plain text)
- Access tokens should be short-lived (15 min default)
- Login endpoint must be rate-limited (out of scope for M1, but the middleware hook point must exist)
- OAuth `state` parameter must be cryptographically random and validated on callback (CSRF protection)
- OAuth client secrets and OTP provider credentials must be encrypted at rest in the `auth_strategy_configs` table
- Per-tenant OAuth configs must be validated (well-formed client ID, valid callback URL) before saving
- OAuth auto-provisioning must respect tenant boundaries — a new user is only created in the tenant that initiated the OAuth flow
- OTP rate limiting: max 5 send attempts per phone/email per 15-minute window

## Test Requirements

### Unit Tests
- [ ] `jwtTokenProvider().sign()` produces a valid JWT
- [ ] `jwtTokenProvider().verify()` returns correct payload for valid token
- [ ] `jwtTokenProvider().verify()` throws for expired token
- [ ] `jwtTokenProvider().verify()` throws for invalid signature
- [ ] `jwtTokenProvider().refresh()` returns new token pair
- [ ] `jwtTokenProvider().refresh()` throws for expired refresh token
- [ ] `hashPassword()` returns bcrypt hash
- [ ] `verifyPassword()` returns true for correct password
- [ ] `verifyPassword()` returns false for incorrect password
- [ ] Auth middleware populates `req.user` for valid token
- [ ] Auth middleware passes through for missing token (public routes)
- [ ] Auth middleware returns 401 for invalid token
- [ ] `StrategyRegistry` registers and retrieves strategies by type
- [ ] `StrategyRegistry.getForTenant()` filters by tenant availability
- [ ] `passwordStrategy().authenticate()` returns AuthResult for valid credentials
- [ ] `passwordStrategy().authenticate()` throws for invalid credentials
- [ ] `oauthStrategy().getAuthorizationUrl()` returns well-formed URL with correct params
- [ ] Login handler rejects unknown strategy type with AUTH_006

### Integration Tests (require real Postgres)
- [ ] Login with valid credentials returns token pair
- [ ] Login with invalid email returns 401
- [ ] Login with invalid password returns 401
- [ ] Login JWT payload includes correct userId, roles, activeRole, tenantId
- [ ] Login with multi-role user defaults activeRole to highest-privilege role
- [ ] Switch role returns new token pair with updated activeRole
- [ ] Switch role rejects role not assigned to user (403)
- [ ] Switch tenant returns new token pair with updated tenantId
- [ ] Switch tenant reloads roles scoped to the new tenant
- [ ] Switch tenant rejects tenant user has no membership in (403)
- [ ] Super-admin login includes `superAdmin: true` and defaults to `app_admin` role
- [ ] Super-admin can switch to any tenant without membership
- [ ] Super-admin can enter global mode (`tenantId: null`)
- [ ] Non-super-admin cannot enter global mode (403)
- [ ] Logout invalidates refresh token
- [ ] Refresh with valid token returns new pair
- [ ] Refresh with invalidated token fails
- [ ] Default admin can log in after bootstrap
- [ ] GET `/auth/strategies` returns configured strategies
- [ ] GET `/auth/strategies?tenantId=X` filters by tenant config
- [ ] OAuth initiate redirects to correct provider URL
- [ ] OAuth callback with valid code issues tokens and redirects
- [ ] OAuth callback auto-provisions new user on first login
- [ ] OAuth callback matches existing user by email
- [ ] Tenant-scoped OAuth uses tenant's own client credentials
- [ ] `saveTenantStrategyConfig()` persists config for tenant-configurable strategy
- [ ] `saveTenantStrategyConfig()` rejects non-tenant-configurable strategy
- [ ] Switch tenant blocked when auth strategy not available in target tenant (403)
- [ ] Super-admin can switch to any tenant regardless of strategy availability

## File Manifest

```
packages/auth/
  src/
    index.ts                    # Public API re-exports
    token/
      jwt.ts                    # JWT TokenProvider implementation
    strategies/
      registry.ts               # StrategyRegistry class
      password.ts               # Password strategy + hash/verify utils
      oauth.ts                  # OAuth strategy (Office 365, Google, GitHub, custom)
      otp.ts                    # OTP strategy (Twilio Verify, custom)
      tenant-config.ts          # Per-tenant strategy configuration CRUD
    middleware.ts               # Auth middleware (token verification)
    context.ts                  # Request context types + helpers
    routes/
      strategies.ts             # GET /auth/strategies
      login.ts                  # POST /auth/login (password, direct strategies)
      oauth.ts                  # GET /auth/oauth/:provider, GET /auth/oauth/:provider/callback
      otp.ts                    # POST /auth/otp/send, POST /auth/otp/verify
      logout.ts                 # POST /auth/logout
      refresh.ts                # POST /auth/refresh
      switch-role.ts            # POST /auth/switch-role
      switch-tenant.ts          # POST /auth/switch-tenant
  tests/
    token.test.ts               # Unit tests for JWT token provider
    password.test.ts            # Unit tests for password utils
    strategy-registry.test.ts   # Unit tests for strategy registry
    middleware.test.ts          # Unit tests for auth middleware
    auth-routes.test.ts         # Integration tests for login/logout/refresh
    oauth.test.ts               # Integration tests for OAuth flow
    tenant-strategy.test.ts     # Integration tests for per-tenant strategy config
  package.json
  tsconfig.json
```

## Decision References

- ADR-005: JWT auth default, functional roles, PG-native authorization
- ADR-006: Provider pattern — jwtProvider() is the default AuthProvider
