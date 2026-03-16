// @simplicity-admin/auth — public API
export { createRateLimiter, type RateLimiter, type RateLimitOptions, type RateLimitResult } from './rate-limit.js';
export { hashPassword, verifyPassword } from './strategies/password.js';
export { jwtTokenProvider } from './providers/jwt.js';
export { AuthError } from './errors.js';
export { createAuthMiddleware, type HttpMiddleware } from './middleware.js';
export { getUserFromRequest, type AuthenticatedRequest } from './context.js';
export { createLoginHandler } from './routes/login.js';
export { createLogoutHandler } from './routes/logout.js';
export { createRefreshHandler } from './routes/refresh.js';
export type {
  Operation,
  TablePermission,
  ColumnPermission,
  EffectivePermissions,
} from './rbac/types.js';
export {
  canAccess,
  canAccessColumn,
  getAccessibleColumns,
  getEffectivePermissions,
} from './rbac/engine.js';
export type { PermissionOverride } from './rbac/overrides.js';
export {
  saveOverride,
  removeOverride,
  listOverrides,
  mergeOverrides,
} from './rbac/overrides.js';
