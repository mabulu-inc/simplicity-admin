// @simplicity-admin/auth — public API
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
