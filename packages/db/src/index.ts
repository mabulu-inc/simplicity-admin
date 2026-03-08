// @simplicity-admin/db — public API
// Re-exports will be added as modules are implemented.

export { createPool } from './connection.js';
export { DatabaseError, maskConnectionUrl } from './errors.js';
