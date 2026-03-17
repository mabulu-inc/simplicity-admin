// @mabulu-inc/simplicity-admin-ui — public API
// Components will be exported here as they are implemented.

export { getFieldComponent, getDisplayFormatter } from './components/field-map.js';
export type { FieldComponent } from './components/field-map.js';
export {
  buildListQuery,
  buildDetailQuery,
  buildCreateMutation,
  buildUpdateMutation,
  buildDeleteMutation,
} from './graphql/query-builder.js';
export type { ListOptions } from './graphql/query-builder.js';
